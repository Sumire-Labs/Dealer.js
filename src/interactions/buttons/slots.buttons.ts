import {
  type ButtonInteraction,
  MessageFlags,
} from 'discord.js';
import { registerButtonHandler } from '../handler.js';
import { MIN_BET, MAX_BET_SLOTS } from '../../config/constants.js';
import { findOrCreateUser } from '../../database/repositories/user.repository.js';
import { processGameResult } from '../../database/services/economy.service.js';
import { spin } from '../../games/slots/slots.engine.js';
import { buildSlotsSpinningView } from '../../ui/builders/slots.builder.js';
import { playSlotsAnimation } from '../../ui/animations/slots.animation.js';
import { formatChips } from '../../utils/formatters.js';

const BET_STEPS = [100n, 500n, 1_000n, 5_000n, 10_000n, 50_000n];

// Session bet storage: userId -> current bet
export const slotsSessionManager = new Map<string, bigint>();

function getSessionBet(userId: string): bigint {
  return slotsSessionManager.get(userId) ?? MIN_BET;
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
    const lower = BET_STEPS.filter(s => s < currentBet).pop() ?? MIN_BET;
    currentBet = lower;
    slotsSessionManager.set(userId, currentBet);

    const user = await findOrCreateUser(userId);
    await interaction.update({
      components: [buildSlotsIdleViewWithButtons(currentBet, user.chips, userId)],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  if (action === 'bet_up') {
    const higher = BET_STEPS.find(s => s > currentBet) ?? MAX_BET_SLOTS;
    currentBet = higher;
    slotsSessionManager.set(userId, currentBet);

    const user = await findOrCreateUser(userId);
    await interaction.update({
      components: [buildSlotsIdleViewWithButtons(currentBet, user.chips, userId)],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  if (action === 'bet_max') {
    currentBet = MAX_BET_SLOTS;
    slotsSessionManager.set(userId, currentBet);

    const user = await findOrCreateUser(userId);
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
    const gameResult = await processGameResult(userId, 'SLOTS', currentBet, result.paytable.multiplier);

    // Play animation
    await playSlotsAnimation(
      interaction,
      result,
      currentBet,
      gameResult.payout,
      gameResult.newBalance,
      userId,
    );
    return;
  }
}

// Re-import here to avoid circular: inline builder for bet-change updates
import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { CasinoTheme } from '../../ui/themes/casino.theme.js';

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
          .setDisabled(bet <= MIN_BET),
        new ButtonBuilder()
          .setCustomId(`slots:spin:${userId}`)
          .setLabel('🎰 スピン')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`slots:bet_up:${userId}`)
          .setLabel('BET ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(bet >= MAX_BET_SLOTS),
        new ButtonBuilder()
          .setCustomId(`slots:bet_max:${userId}`)
          .setLabel('MAX BET')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(bet >= MAX_BET_SLOTS),
      ),
    );
}

registerButtonHandler('slots', handleSlotsButton as never);
