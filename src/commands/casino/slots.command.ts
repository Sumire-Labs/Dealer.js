import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { registerCommand } from '../registry.js';
import { MIN_BET, MAX_BET_SLOTS } from '../../config/constants.js';
import { findOrCreateUser, getTodayStats } from '../../database/repositories/user.repository.js';
import { processGameResult } from '../../database/services/economy.service.js';
import { spin } from '../../games/slots/slots.engine.js';
import { buildSlotsSpinningView } from '../../ui/builders/slots.builder.js';
import { playSlotsAnimation } from '../../ui/animations/slots.animation.js';
import { formatChips } from '../../utils/formatters.js';
import { slotsSessionManager } from '../../interactions/buttons/slots.buttons.js';
import { buildAchievementNotification } from '../../database/services/achievement.service.js';

const data = new SlashCommandBuilder()
  .setName('slots')
  .setDescription('ダイヤモンドカジノのスロットマシンで遊ぶ')
  .addIntegerOption(option =>
    option
      .setName('bet')
      .setDescription('ベット額')
      .setRequired(false)
      .setMinValue(Number(MIN_BET))
      .setMaxValue(Number(MAX_BET_SLOTS)),
  )
  .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  const betInput = interaction.options.getInteger('bet');
  const bet = betInput ? BigInt(betInput) : MIN_BET;

  if (bet < MIN_BET || bet > MAX_BET_SLOTS) {
    await interaction.reply({
      content: `ベット額は${formatChips(MIN_BET)}〜${formatChips(MAX_BET_SLOTS)}の範囲で指定してください。`,
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

  // Store session bet for button interactions
  slotsSessionManager.set(userId, bet);

  // Show spinning placeholder and defer
  const spinPlaceholder = buildSlotsSpinningView(['🔄', '🔄', '🔄']);
  await interaction.reply({
    components: [spinPlaceholder],
    flags: MessageFlags.IsComponentsV2,
  });

  // Run the game
  const result = spin();
  const gameResult = await processGameResult(userId, 'SLOTS', bet, result.paytable.multiplier, {
    multiplier: result.paytable.multiplier,
  });

  // Get today's stats
  const todayStats = await getTodayStats(userId);

  // Play animation
  await playSlotsAnimation(
    interaction,
    result,
    bet,
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
}

registerCommand({ data, execute: execute as never });
