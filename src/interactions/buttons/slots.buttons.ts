// Re-import here to avoid circular: inline builder for bet-change updates
import {
    ActionRowBuilder,
    ButtonBuilder,
    type ButtonInteraction,
    ButtonStyle,
    ContainerBuilder,
    MessageFlags,
    SeparatorBuilder,
    SeparatorSpacingSize,
    TextDisplayBuilder,
} from 'discord.js';
import {registerButtonHandler} from '../handler.js';
import {configService} from '../../config/config.service.js';
import {S} from '../../config/setting-defs.js';
import {findOrCreateUser, getTodayStats} from '../../database/repositories/user.repository.js';
import {processGameResult} from '../../database/services/economy.service.js';
import {spin} from '../../games/slots/slots.engine.js';
import {buildSlotsSpinningView} from '../../ui/builders/slots.builder.js';
import {playSlotsAnimation} from '../../ui/animations/slots.animation.js';
import {formatChips} from '../../utils/formatters.js';
import {getEffectiveMax} from '../../utils/bet.js';
import {buildAchievementNotification} from '../../database/services/achievement.service.js';
import {buildMissionNotification} from '../../database/services/mission.service.js';
import {CasinoTheme} from '../../ui/themes/casino.theme.js';

const BET_STEPS = [100n, 500n, 1_000n, 5_000n, 10_000n, 50_000n, 100_000n, 500_000n, 1_000_000n];

// Session bet storage: userId -> current bet
export const slotsSessionManager = new Map<string, bigint>();

export function setSessionBet(userId: string, bet: bigint): void {
  if (slotsSessionManager.size > 10_000) slotsSessionManager.clear();
  slotsSessionManager.set(userId, bet);
}

function getSessionBet(userId: string): bigint {
  return slotsSessionManager.get(userId) ?? configService.getBigInt(S.minBet);
}

async function handleSlotsButton(interaction: ButtonInteraction): Promise<void> {
  const customId = interaction.customId;
  const parts = customId.split(':');
  const action = parts[1];
  const ownerId = parts[2];

  // Only the original user can interact
  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: 'これはあなたのスロットではありません！ `/slots` で遊んでください。',
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
    await interaction.update({
      components: [buildSlotsIdleViewWithButtons(currentBet, user.chips, userId)],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  if (action === 'bet_up') {
    const user = await findOrCreateUser(userId);
    const effectiveMax = getEffectiveMax(configService.getBigInt(S.maxSlots), user.chips);
    const higher = BET_STEPS.find(s => s > currentBet) ?? effectiveMax;
    currentBet = higher > effectiveMax ? effectiveMax : higher;
    setSessionBet(userId, currentBet);

    await interaction.update({
      components: [buildSlotsIdleViewWithButtons(currentBet, user.chips, userId)],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  if (action === 'bet_max') {
    const user = await findOrCreateUser(userId);
    currentBet = getEffectiveMax(configService.getBigInt(S.maxSlots), user.chips);
    setSessionBet(userId, currentBet);

    await interaction.update({
      components: [buildSlotsIdleViewWithButtons(currentBet, user.chips, userId)],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  if (action === 'spin') {
    const user = await findOrCreateUser(userId);

    if (user.chips < currentBet) {
      await interaction.reply({
        content: `チップが不足しています！ 残高: ${formatChips(user.chips)}。ベット額を下げてください。`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Show spinning state
    const spinPlaceholder = buildSlotsSpinningView(['🔄', '🔄', '🔄']);
    await interaction.update({
      components: [spinPlaceholder],
      flags: MessageFlags.IsComponentsV2,
    });

    // Run the game
    const result = spin();
    const gameResult = await processGameResult(userId, 'SLOTS', currentBet, result.paytable.multiplier, {
      multiplier: result.paytable.multiplier,
    });

    // Get today's stats
    const todayStats = await getTodayStats(userId);

    // Play animation
    await playSlotsAnimation(
      interaction,
      result,
      currentBet,
      gameResult.payout,
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
    return;
  }
}

function buildSlotsIdleViewWithButtons(
  bet: bigint,
  balance: bigint,
  userId: string,
): ContainerBuilder {
  return new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.slots),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '【 🎰 】【 🎰 】【 🎰 】',
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `BET: ${formatChips(bet)} | 残高: ${formatChips(balance)}`,
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`slots:bet_down:${userId}`)
          .setLabel('◀ BET')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(bet <= configService.getBigInt(S.minBet)),
        new ButtonBuilder()
          .setCustomId(`slots:spin:${userId}`)
          .setLabel('🎰 スピン')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`slots:bet_up:${userId}`)
          .setLabel('BET ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(bet >= getEffectiveMax(configService.getBigInt(S.maxSlots), balance)),
        new ButtonBuilder()
          .setCustomId(`slots:bet_max:${userId}`)
          .setLabel('MAX BET')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(bet >= getEffectiveMax(configService.getBigInt(S.maxSlots), balance)),
      ),
    );
}

registerButtonHandler('slots', handleSlotsButton as never);
