import {
  type ButtonInteraction,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js';
import { registerButtonHandler } from '../handler.js';
import { configService } from '../../config/config.service.js';
import { S } from '../../config/setting-defs.js';
import { findOrCreateUser, getTodayStats } from '../../database/repositories/user.repository.js';
import { processGameResult } from '../../database/services/economy.service.js';
import {
  spinRoulette,
  evaluateBet,
} from '../../games/roulette/roulette.engine.js';
import {
  type OutsideBetType,
  type RouletteBet,
  getOutsideBetNumbers,
} from '../../config/roulette.js';
import {
  buildRouletteIdleView,
  buildRouletteInsideView,
  buildRouletteSpinningView,
} from '../../ui/builders/roulette.builder.js';
import { playRouletteAnimation } from '../../ui/animations/roulette.animation.js';
import { formatChips } from '../../utils/formatters.js';
import { buildAchievementNotification } from '../../database/services/achievement.service.js';
import { buildMissionNotification } from '../../database/services/mission.service.js';

const BET_STEPS = [100n, 500n, 1_000n, 5_000n, 10_000n, 50_000n, 100_000n];

export const rouletteSessionManager = new Map<string, bigint>();

function getSessionBet(userId: string): bigint {
  return rouletteSessionManager.get(userId) ?? configService.getBigInt(S.minBet);
}

const OUTSIDE_BET_ACTIONS = new Set<string>([
  'red', 'black', 'even', 'odd', 'low', 'high', '1st12', '2nd12', '3rd12',
]);

const OUTSIDE_BET_LABELS: Record<string, string> = {
  red: '赤',
  black: '黒',
  even: '偶数',
  odd: '奇数',
  low: 'Low (1-18)',
  high: 'High (19-36)',
  '1st12': '1st12 (1-12)',
  '2nd12': '2nd12 (13-24)',
  '3rd12': '3rd12 (25-36)',
};

const INSIDE_BET_MODAL_CONFIG: Record<string, { title: string; label: string; placeholder: string }> = {
  pick_straight: {
    title: 'ルーレット — ストレートベット',
    label: '番号 (0〜36)',
    placeholder: '例: 14',
  },
  pick_split: {
    title: 'ルーレット — スプリットベット',
    label: '隣接する2つの番号（カンマ区切り）',
    placeholder: '例: 14,15',
  },
  pick_street: {
    title: 'ルーレット — ストリートベット',
    label: '行の先頭番号 (1,4,7,...34)',
    placeholder: '例: 4 → 4,5,6',
  },
  pick_corner: {
    title: 'ルーレット — コーナーベット',
    label: '左上の番号',
    placeholder: '例: 4 → 4,5,7,8',
  },
  pick_sixline: {
    title: 'ルーレット — シックスラインベット',
    label: '行の先頭番号 (1,4,7,...31)',
    placeholder: '例: 4 → 4,5,6,7,8,9',
  },
};

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
    rouletteSessionManager.set(userId, currentBet);
    const user = await findOrCreateUser(userId);
    const view = buildRouletteIdleView(currentBet, user.chips, userId);
    await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  if (action === 'bet_up') {
    const higher = BET_STEPS.find(s => s > currentBet) ?? configService.getBigInt(S.maxRoulette);
    currentBet = higher;
    rouletteSessionManager.set(userId, currentBet);
    const user = await findOrCreateUser(userId);
    const view = buildRouletteIdleView(currentBet, user.chips, userId);
    await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  if (action === 'bet_max') {
    currentBet = configService.getBigInt(S.maxRoulette);
    rouletteSessionManager.set(userId, currentBet);
    const user = await findOrCreateUser(userId);
    const view = buildRouletteIdleView(currentBet, user.chips, userId);
    await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  // Inside bet sub-panel
  if (action === 'inside') {
    const view = buildRouletteInsideView(currentBet, userId);
    await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  // Back to main panel
  if (action === 'back') {
    const user = await findOrCreateUser(userId);
    const view = buildRouletteIdleView(currentBet, user.chips, userId);
    await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  // Inside bet type selection → show modal
  if (action in INSIDE_BET_MODAL_CONFIG) {
    const config = INSIDE_BET_MODAL_CONFIG[action];
    const betType = action.replace('pick_', '');
    const modal = new ModalBuilder()
      .setCustomId(`roulette_modal:${betType}:${userId}`)
      .setTitle(config.title)
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('numbers')
            .setLabel(config.label)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(config.placeholder)
            .setRequired(true),
        ),
      );
    await interaction.showModal(modal);
    return;
  }

  // Outside bet → spin immediately
  if (OUTSIDE_BET_ACTIONS.has(action)) {
    const betType = action as OutsideBetType;
    const bet = getSessionBet(userId);

    const user = await findOrCreateUser(userId);
    if (user.chips < bet) {
      await interaction.reply({
        content: `チップが不足しています！ 残高: ${formatChips(user.chips)}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const rouletteBet: RouletteBet = {
      type: betType,
      numbers: getOutsideBetNumbers(betType),
    };

    await executeRouletteSpin(interaction, userId, bet, rouletteBet, OUTSIDE_BET_LABELS[action]);
  }
}

export async function executeRouletteSpin(
  interaction: ButtonInteraction,
  userId: string,
  bet: bigint,
  rouletteBet: RouletteBet,
  betLabel: string,
): Promise<void> {
  // Show spinning animation start
  const spinView = buildRouletteSpinningView([0, 17, 32]);
  await interaction.update({ components: [spinView], flags: MessageFlags.IsComponentsV2 });

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
