import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { registerCommand } from '../registry.js';
import { MIN_BET, MAX_BET_COINFLIP } from '../../config/constants.js';
import { findOrCreateUser } from '../../database/repositories/user.repository.js';
import { buildCoinflipChoiceView } from '../../ui/builders/coinflip.builder.js';
import { coinflipSessionManager } from '../../interactions/buttons/coinflip.buttons.js';
import { formatChips } from '../../utils/formatters.js';

const data = new SlashCommandBuilder()
  .setName('coinflip')
  .setDescription('Flip a coin — double or nothing!')
  .addIntegerOption(option =>
    option
      .setName('bet')
      .setDescription('Bet amount')
      .setRequired(true)
      .setMinValue(Number(MIN_BET))
      .setMaxValue(Number(MAX_BET_COINFLIP)),
  )
  .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  const bet = BigInt(interaction.options.getInteger('bet', true));

  const user = await findOrCreateUser(userId);
  if (user.chips < bet) {
    await interaction.reply({
      content: `Insufficient chips! You have ${formatChips(user.chips)}.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Store bet for button handler
  coinflipSessionManager.set(userId, bet);

  const choiceView = buildCoinflipChoiceView(bet, user.chips, userId);
  await interaction.reply({
    components: [choiceView],
    flags: MessageFlags.IsComponentsV2,
  });
}

registerCommand({ data, execute: execute as never });
