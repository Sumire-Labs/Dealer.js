import { Prisma, type GameType, type TransactionType } from '@prisma/client';
import { prisma } from '../client.js';
import { findOrCreateUser } from '../repositories/user.repository.js';
import { getBankruptcyPenaltyMultiplier, applyPenalty } from './loan.service.js';
import { checkAchievements, type AchievementCheckInput } from './achievement.service.js';
import type { AchievementDefinition } from '../../config/achievements.js';
import { updateMissionProgress, type CompletedMission } from './mission.service.js';

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
      where: { id: userId },
      data: { chips: { increment: amount } },
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
    const current = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (current.chips < amount) {
      throw new Error('Insufficient chips');
    }

    const user = await tx.user.update({
      where: { id: userId },
      data: { chips: { decrement: amount } },
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
): Promise<{ newBalance: bigint; payout: bigint; net: bigint; newlyUnlocked: AchievementDefinition[]; missionsCompleted: CompletedMission[] }> {
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

  const net = payout - betAmount;

  const newBalance = await prisma.$transaction(async (tx) => {
    await findOrCreateUser(userId);

    const current = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (current.chips + net < 0n) {
      throw new Error('Insufficient chips');
    }

    const updatedUser = net >= 0n
      ? await tx.user.update({ where: { id: userId }, data: { chips: { increment: net } } })
      : await tx.user.update({ where: { id: userId }, data: { chips: { decrement: -net } } });

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
      where: { id: userId },
      data: {
        totalWon: { increment: isWin ? net : 0n },
        totalLost: { increment: isWin ? 0n : -net },
        totalGames: { increment: 1 },
      },
    });

    return updatedUser.chips;
  });

  // Achievement checks
  const isWin = net > 0n;
  let newlyUnlocked: AchievementDefinition[] = [];
  try {
    const gameCheck: AchievementCheckInput = {
      userId,
      context: 'game_result',
      gameType: game,
      gameResult: isWin ? 'win' : 'loss',
      netAmount: net,
      newBalance,
      metadata,
    };
    const gameAchievements = await checkAchievements(gameCheck);

    const economyCheck: AchievementCheckInput = {
      userId,
      context: 'economy_change',
      newBalance,
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
    const playResults = await updateMissionProgress(userId, { type: 'game_play', gameType: game });
    missionsCompleted.push(...playResults);

    if (isWin) {
      const winResults = await updateMissionProgress(userId, { type: 'game_win', gameType: game });
      missionsCompleted.push(...winResults);

      const earnResults = await updateMissionProgress(userId, { type: 'chips_earned', amount: Number(net) });
      missionsCompleted.push(...earnResults);
    }

    const betResults = await updateMissionProgress(userId, { type: 'chips_bet', amount: betAmountNum });
    missionsCompleted.push(...betResults);
  } catch {
    // Mission check should never block game result
  }

  return { newBalance, payout, net, newlyUnlocked, missionsCompleted };
}

export async function hasEnoughChips(
  userId: string,
  amount: bigint,
): Promise<boolean> {
  const balance = await getBalance(userId);
  return balance >= amount;
}
