import {type ButtonInteraction, type MessageComponentInteraction, MessageFlags,} from 'discord.js';
import {registerButtonHandler} from '../handler.js';
import {configService} from '../../config/config.service.js';
import {S} from '../../config/setting-defs.js';
import {findOrCreateUser, getTodayStats} from '../../database/repositories/user.repository.js';
import {processGameResult} from '../../database/services/economy.service.js';
import {evaluateBet, spinRoulette,} from '../../games/roulette/roulette.engine.js';
import type {RouletteBet} from '../../config/roulette.js';
import {buildRouletteIdleView, buildRouletteSpinningView,} from '../../ui/builders/roulette.builder.js';
import {playRouletteAnimation} from '../../ui/animations/roulette.animation.js';
import {buildAchievementNotification} from '../../database/services/achievement.service.js';
import {buildMissionNotification} from '../../database/services/mission.service.js';
import {getEffectiveMax} from '../../utils/bet.js';

const BET_STEPS = [100n, 500n, 1_000n, 5_000n, 10_000n, 50_000n, 100_000n, 500_000n, 1_000_000n];

export const rouletteSessionManager = new Map<string, bigint>();

export function setSessionBet(userId: string, bet: bigint): void {
    if (rouletteSessionManager.size > 10_000) rouletteSessionManager.clear();
    rouletteSessionManager.set(userId, bet);
}

export function getSessionBet(userId: string): bigint {
    return rouletteSessionManager.get(userId) ?? configService.getBigInt(S.minBet);
}

async function handleRouletteButton(interaction: ButtonInteraction): Promise<void> {
    const parts = interaction.customId.split(':');
    const action = parts[1];
    const ownerId = parts[2];

    if (interaction.user.id !== ownerId) {
        await interaction.reply({
            content: 'これはあなたのルーレットではありません！ `/roulette` で遊んでください。',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const userId = interaction.user.id;
    let currentBet = getSessionBet(userId);

    // Bet adjustment
    if (action === 'bet_down') {
        const lower = BET_STEPS.filter(s => s < currentBet).pop() ?? configService.getBigInt(S.minBet);
        currentBet = lower;
        setSessionBet(userId, currentBet);
        const user = await findOrCreateUser(userId);
        const view = buildRouletteIdleView(currentBet, user.chips, userId);
        await interaction.update({components: [view], flags: MessageFlags.IsComponentsV2});
        return;
    }

    if (action === 'bet_up') {
        const user = await findOrCreateUser(userId);
        const effectiveMax = getEffectiveMax(configService.getBigInt(S.maxRoulette), user.chips);
        const higher = BET_STEPS.find(s => s > currentBet) ?? effectiveMax;
        currentBet = higher > effectiveMax ? effectiveMax : higher;
        setSessionBet(userId, currentBet);
        const view = buildRouletteIdleView(currentBet, user.chips, userId);
        await interaction.update({components: [view], flags: MessageFlags.IsComponentsV2});
        return;
    }

    if (action === 'bet_max') {
        const user = await findOrCreateUser(userId);
        currentBet = getEffectiveMax(configService.getBigInt(S.maxRoulette), user.chips);
        setSessionBet(userId, currentBet);
        const view = buildRouletteIdleView(currentBet, user.chips, userId);
        await interaction.update({components: [view], flags: MessageFlags.IsComponentsV2});
        return;
    }
}

export async function executeRouletteSpin(
    interaction: MessageComponentInteraction,
    userId: string,
    bet: bigint,
    rouletteBet: RouletteBet,
    betLabel: string,
): Promise<void> {
    // Show spinning animation start
    const spinView = buildRouletteSpinningView([0, 17, 32]);
    await interaction.update({components: [spinView], flags: MessageFlags.IsComponentsV2});

    // Spin
    const result = spinRoulette();
    const multiplier = evaluateBet(result, rouletteBet);
    const won = multiplier > 0;

    // Process game result
    const gameResult = await processGameResult(
        userId,
        'ROULETTE',
        bet,
        multiplier,
        {
            betType: rouletteBet.type,
            numbers: rouletteBet.numbers,
            resultNumber: result.number,
            resultColor: result.color,
            isRouletteStraightWin: rouletteBet.type === 'straight' && won,
        },
    );

    const todayStats = await getTodayStats(userId);

    // Play animation + show result
    await playRouletteAnimation(
        interaction,
        result,
        betLabel,
        won,
        bet,
        gameResult.payout,
        gameResult.net,
        gameResult.newBalance,
        userId,
        todayStats,
    );

    // Achievement notification
    if (gameResult.newlyUnlocked.length > 0) {
        await interaction.followUp({
            content: buildAchievementNotification(gameResult.newlyUnlocked),
            flags: MessageFlags.Ephemeral,
        });
    }

    // Mission notification
    if (gameResult.missionsCompleted.length > 0) {
        await interaction.followUp({
            content: buildMissionNotification(gameResult.missionsCompleted),
            flags: MessageFlags.Ephemeral,
        });
    }
}

registerButtonHandler('roulette', handleRouletteButton as never);
