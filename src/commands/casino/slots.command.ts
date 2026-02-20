import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { registerCommand } from '../registry.js';
import { MIN_BET, MAX_BET_SLOTS } from '../../config/constants.js';
import { findOrCreateUser } from '../../database/repositories/user.repository.js';
import { processGameResult } from '../../database/services/economy.service.js';
import { spin } from '../../games/slots/slots.engine.js';
import { buildSlotsSpinningView } from '../../ui/builders/slots.builder.js';
import { playSlotsAnimation } from '../../ui/animations/slots.animation.js';
import { formatChips } from '../../utils/formatters.js';
import { slotsSessionManager } from '../../interactions/buttons/slots.buttons.js';

const data = new SlashCommandBuilder()
  .setName('slots')
  .setDescription('Play the Diamond Casino slot machine')
  .addIntegerOption(option =>
    option
      .setName('bet')
      .setDescription('Bet amount')
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
      content: `Bet must be between ${formatChips(MIN_BET)} and ${formatChips(MAX_BET_SLOTS)}.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const user = await findOrCreateUser(userId);
  if (user.chips < bet) {
    await interaction.reply({
      content: `Insufficient chips! You have ${formatChips(user.chips)}.`,
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
  const gameResult = await processGameResult(userId, 'SLOTS', bet, result.paytable.multiplier);

  // Play animation
  await playSlotsAnimation(
    interaction,
    result,
    bet,
    gameResult.payout,
    gameResult.newBalance,
    userId,
  );
}

registerCommand({ data, execute: execute as never });
