import { type ButtonInteraction, MessageFlags } from 'discord.js';
import { registerButtonHandler } from '../handler.js';
import { configService } from '../../config/config.service.js';
import { S } from '../../config/setting-defs.js';
import { findOrCreateUser, getTodayStats } from '../../database/repositories/user.repository.js';
import { processGameResult } from '../../database/services/economy.service.js';
import { playCoinflip, type CoinSide } from '../../games/coinflip/coinflip.engine.js';
import {
  buildCoinflipFlippingView,
  buildCoinflipResultView,
  buildCoinflipIdleView,
} from '../../ui/builders/coinflip.builder.js';
import { formatChips } from '../../utils/formatters.js';
import { getEffectiveMax } from '../../utils/bet.js';
import { buildAchievementNotification } from '../../database/services/achievement.service.js';
import { buildMissionNotification } from '../../database/services/mission.service.js';

const BET_STEPS = [100n, 500n, 1_000n, 5_000n, 10_000n, 50_000n, 100_000n, 500_000n, 1_000_000n];

// Session storage: userId -> bet amount
export const coinflipSessionManager = new Map<string, bigint>();

export function setSessionBet(userId: string, bet: bigint): void {
  if (coinflipSessionManager.size > 10_000) coinflipSessionManager.clear();
  coinflipSessionManager.set(userId, bet);
}

function getSessionBet(userId: string): bigint {
  return coinflipSessionManager.get(userId) ?? configService.getBigInt(S.minBet);
}

async function handleCoinflipButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const action = parts[1];
  const ownerId = parts[2];

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: 'これはあなたのコインフリップではありません！ `/coinflip` で遊んでください。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const userId = interaction.user.id;
  let currentBet = getSessionBet(userId);

  if (action === 'bet_down') {
    const lower = BET_STEPS.filter(s => s < currentBet).pop() ?? configService.getBigInt(S.minBet);
    currentBet = lower;
    setSessionBet(userId, currentBet);

    const user = await findOrCreateUser(userId);
    const idleView = buildCoinflipIdleView(currentBet, user.chips, userId);
    await interaction.update({
      components: [idleView],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  if (action === 'bet_up') {
    const user = await findOrCreateUser(userId);
    const effectiveMax = getEffectiveMax(configService.getBigInt(S.maxCoinflip), user.chips);
    const higher = BET_STEPS.find(s => s > currentBet) ?? effectiveMax;
    currentBet = higher > effectiveMax ? effectiveMax : higher;
    setSessionBet(userId, currentBet);

    const idleView = buildCoinflipIdleView(currentBet, user.chips, userId);
    await interaction.update({
      components: [idleView],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  // heads or tails — play the game
  const choice = action as CoinSide;

  const bet = coinflipSessionManager.get(userId);
  if (!bet) {
    await interaction.reply({
      content: 'セッションが期限切れです。`/coinflip` で新しいゲームを始めてください。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const user = await findOrCreateUser(userId);
  if (user.chips < bet) {
    await interaction.reply({
      content: `チップが不足しています！ 残高: ${formatChips(user.chips)}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Show flipping animation
  const flippingView = buildCoinflipFlippingView();
  await interaction.update({
    components: [flippingView],
    flags: MessageFlags.IsComponentsV2,
  });

  // Wait for suspense
  await sleep(1500);

  // Resolve game
  const result = playCoinflip(choice);
  const gameResult = await processGameResult(userId, 'COINFLIP', bet, result.multiplier);

  // Get today's stats
  const todayStats = await getTodayStats(userId);

  // Show result with replay buttons (keep session alive)
  const resultView = buildCoinflipResultView(
    result.outcome,
    result.playerChoice,
    result.won,
    bet,
    gameResult.payout,
    gameResult.newBalance,
    userId,
    todayStats,
  );
  await interaction.editReply({
    components: [resultView],
    flags: MessageFlags.IsComponentsV2,
  });

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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

registerButtonHandler('coinflip', handleCoinflipButton as never);
