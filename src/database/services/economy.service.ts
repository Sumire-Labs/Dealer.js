import {type GameType, Prisma, type TransactionType} from '@prisma/client';
import {prisma} from '../client.js';
import {findOrCreateUser} from '../repositories/user.repository.js';
import {applyPenalty, getBankruptcyPenaltyMultiplier} from './loan.service.js';
import {type AchievementCheckInput, checkAchievements} from './achievement.service.js';
import {getUnlockedIds} from '../repositories/achievement.repository.js';
import type {AchievementDefinition} from '../../config/achievements.js';
import {type CompletedMission, updateMissionProgress} from './mission.service.js';
import {consumeInventoryItem} from './shop.service.js';
import {loadUserItemsSnapshot, snapshotHasBuff, snapshotHasItem} from './shop/batch-inventory.service.js';
import {SHOP_EFFECTS} from '../../config/shop.js';

export async function getBalance(userId: string): Promise<bigint> {
    const user = await findOrCreateUser(userId);
    return user.chips;
}

export async function addChips(
    userId: string,
    amount: bigint,
    type: TransactionType,
    game?: GameType,
    metadata?: Prisma.InputJsonValue,
): Promise<bigint> {
    return prisma.$transaction(async (tx) => {
        await findOrCreateUser(userId);

        const user = await tx.user.update({
            where: {id: userId},
            data: {chips: {increment: amount}},
        });

        await tx.transaction.create({
            data: {
                userId,
                type,
                game: game ?? null,
                amount,
                balanceAfter: user.chips,
                metadata: metadata ?? Prisma.JsonNull,
            },
        });

        return user.chips;
    });
}

export async function removeChips(
    userId: string,
    amount: bigint,
    type: TransactionType,
    game?: GameType,
    metadata?: Prisma.InputJsonValue,
): Promise<bigint> {
    return prisma.$transaction(async (tx) => {
        await findOrCreateUser(userId);

        // Atomic check-and-decrement: read current balance inside transaction
        const current = await tx.user.findUniqueOrThrow({where: {id: userId}});
        if (current.chips < amount) {
            throw new Error('Insufficient chips');
        }

        const user = await tx.user.update({
            where: {id: userId},
            data: {chips: {decrement: amount}},
        });

        await tx.transaction.create({
            data: {
                userId,
                type,
                game: game ?? null,
                amount: -amount,
                balanceAfter: user.chips,
                metadata: metadata ?? Prisma.JsonNull,
            },
        });

        return user.chips;
    });
}

export async function processGameResult(
    userId: string,
    game: GameType,
    betAmount: bigint,
    multiplier: number,
    metadata?: Record<string, unknown>,
): Promise<{
    newBalance: bigint;
    payout: bigint;
    net: bigint;
    newlyUnlocked: AchievementDefinition[];
    missionsCompleted: CompletedMission[];
    safetyNetUsed?: boolean
}> {
    // Use integer math to avoid BigInt→Number precision loss
    const multiplierInt = Math.round(multiplier * 1_000_000);
    let payout = (betAmount * BigInt(multiplierInt)) / 1_000_000n;

    // Apply bankruptcy penalty to winnings only
    if (payout > betAmount) {
        const penaltyMultiplier = await getBankruptcyPenaltyMultiplier(userId);
        if (penaltyMultiplier < 1.0) {
            const winnings = payout - betAmount;
            const penalizedWinnings = applyPenalty(winnings, penaltyMultiplier);
            payout = betAmount + penalizedWinnings;
        }
    }

    // Load inventory + buffs in 2 queries (batch) instead of ~12 individual queries
    let snapshot;
    try {
        snapshot = await loadUserItemsSnapshot(userId);
    } catch {
        snapshot = null;
    }

    // VIP bonuses (permanent VIP_CARD + temporary VIP_PASS) on wins
    if (payout > betAmount && snapshot) {
        let bonusPercent = 0n;
        const winnings = payout - betAmount;
        try {
            if (snapshotHasItem(snapshot, 'VIP_CARD')) {
                bonusPercent += SHOP_EFFECTS.VIP_BONUS_PERCENT;
            }
            if (snapshotHasBuff(snapshot, 'VIP_PASS')) {
                bonusPercent += SHOP_EFFECTS.VIP_BONUS_PERCENT;
            }
            if (snapshotHasItem(snapshot, 'COLLECTION_REWARD_GAMBLER')) {
                bonusPercent += SHOP_EFFECTS.COLLECTION_GAMBLER_PERCENT;
            }
            if (game === 'POKER' && snapshotHasItem(snapshot, 'POKER_FACE')) {
                bonusPercent += SHOP_EFFECTS.POKER_FACE_PERCENT;
            }
            if (game === 'HEIST' && snapshotHasItem(snapshot, 'HEIST_VAULT')) {
                bonusPercent += SHOP_EFFECTS.HEIST_VAULT_PERCENT;
            }
            payout += (winnings * bonusPercent) / 100n;
        } catch {
            // Bonus check should never block game
        }
    }

    let net = payout - betAmount;

    // LUCKY_CHARM: on loss, refund 50% of bet and consume item
    if (net < 0n && snapshot) {
        try {
            if (snapshotHasItem(snapshot, 'LUCKY_CHARM')) {
                const refund = (betAmount * SHOP_EFFECTS.LUCKY_CHARM_REFUND) / 100n;
                payout += refund;
                net = payout - betAmount;
                await consumeInventoryItem(userId, 'LUCKY_CHARM');
            }
        } catch {
            // Lucky charm check should never block game
        }
    }

    let newBalance = await prisma.$transaction(async (tx) => {
        await findOrCreateUser(userId);

        const current = await tx.user.findUniqueOrThrow({where: {id: userId}});
        if (current.chips + net < 0n) {
            throw new Error('Insufficient chips');
        }

        const updatedUser = net >= 0n
            ? await tx.user.update({where: {id: userId}, data: {chips: {increment: net}}})
            : await tx.user.update({where: {id: userId}, data: {chips: {decrement: -net}}});

        const isWin = net > 0n;
        await tx.transaction.create({
            data: {
                userId,
                type: isWin ? 'WIN' : 'LOSS',
                game,
                amount: net,
                balanceAfter: updatedUser.chips,
                metadata: {
                    betAmount: betAmount.toString(),
                    multiplier,
                    payout: payout.toString(),
                },
            },
        });

        await tx.user.update({
            where: {id: userId},
            data: {
                totalWon: {increment: isWin ? net : 0n},
                totalLost: {increment: isWin ? 0n : -net},
                totalGames: {increment: 1},
            },
        });

        return updatedUser.chips;
    });

    // SAFETY_NET / SUPER_SAFETY_NET: if balance hit 0, auto-refill
    let safetyNetUsed = false;
    if (newBalance === 0n && snapshot) {
        try {
            if (snapshotHasItem(snapshot, 'SUPER_SAFETY_NET')) {
                await consumeInventoryItem(userId, 'SUPER_SAFETY_NET');
                newBalance = await addChips(userId, SHOP_EFFECTS.SUPER_SAFETY_NET_AMOUNT, 'SHOP_REFUND');
                safetyNetUsed = true;
            } else if (snapshotHasItem(snapshot, 'SAFETY_NET')) {
                await consumeInventoryItem(userId, 'SAFETY_NET');
                newBalance = await addChips(userId, SHOP_EFFECTS.SAFETY_NET_AMOUNT, 'SHOP_REFUND');
                safetyNetUsed = true;
            }
        } catch {
            // Safety net should never block game
        }
    }

    // Achievement checks — share unlockedIds and cache across both calls
    const isWin = net > 0n;
    let newlyUnlocked: AchievementDefinition[] = [];
    try {
        const unlockedIds = await getUnlockedIds(userId);
        const achievementCache = new Map<string, unknown>();

        const gameCheck: AchievementCheckInput = {
            userId,
            context: 'game_result',
            gameType: game,
            gameResult: isWin ? 'win' : 'loss',
            netAmount: net,
            newBalance,
            metadata,
            _prefetchedUnlockedIds: unlockedIds,
            _cache: achievementCache,
        };
        const gameAchievements = await checkAchievements(gameCheck);

        // Update unlockedIds with newly unlocked achievements
        for (const a of gameAchievements) unlockedIds.add(a.id);

        const economyCheck: AchievementCheckInput = {
            userId,
            context: 'economy_change',
            newBalance,
            _prefetchedUnlockedIds: unlockedIds,
            _cache: achievementCache,
        };
        const economyAchievements = await checkAchievements(economyCheck);

        newlyUnlocked = [...gameAchievements, ...economyAchievements];
    } catch {
        // Achievement check should never block game result
    }

    // Mission progress hooks
    let missionsCompleted: CompletedMission[] = [];
    try {
        const betAmountNum = Number(betAmount);
        const playResults = await updateMissionProgress(userId, {type: 'game_play', gameType: game});
        missionsCompleted.push(...playResults);

        if (isWin) {
            const winResults = await updateMissionProgress(userId, {type: 'game_win', gameType: game});
            missionsCompleted.push(...winResults);

            const earnResults = await updateMissionProgress(userId, {type: 'chips_earned', amount: Number(net)});
            missionsCompleted.push(...earnResults);
        }

        const betResults = await updateMissionProgress(userId, {type: 'chips_bet', amount: betAmountNum});
        missionsCompleted.push(...betResults);
    } catch {
        // Mission check should never block game result
    }

    return {newBalance, payout, net, newlyUnlocked, missionsCompleted, safetyNetUsed};
}

export async function hasEnoughChips(
    userId: string,
    amount: bigint,
): Promise<boolean> {
    const balance = await getBalance(userId);
    return balance >= amount;
}
