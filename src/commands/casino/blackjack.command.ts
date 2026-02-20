import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { registerCommand } from '../registry.js';
import { MIN_BET, MAX_BET_BLACKJACK } from '../../config/constants.js';
import { findOrCreateUser } from '../../database/repositories/user.repository.js';
import { removeChips, addChips } from '../../database/services/economy.service.js';
import { createGame, calculateTotalResult } from '../../games/blackjack/blackjack.engine.js';
import {
  buildBlackjackPlayingView,
  buildBlackjackResultView,
} from '../../ui/builders/blackjack.builder.js';
import { bjSessionManager } from '../../interactions/buttons/blackjack.buttons.js';
import { formatChips } from '../../utils/formatters.js';

const data = new SlashCommandBuilder()
  .setName('blackjack')
  .setDescription('Play Blackjack against the dealer')
  .addIntegerOption(option =>
    option
      .setName('bet')
      .setDescription('Bet amount')
      .setRequired(true)
      .setMinValue(Number(MIN_BET))
      .setMaxValue(Number(MAX_BET_BLACKJACK)),
  )
  .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  const bet = BigInt(interaction.options.getInteger('bet', true));

  // Check for existing session
  if (bjSessionManager.has(userId)) {
    await interaction.reply({
      content: 'You already have an active Blackjack game! Finish it first.',
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

  // Deduct initial bet
  await removeChips(userId, bet, 'LOSS', 'BLACKJACK');

  // Create game
  const state = createGame(bet);

  // If resolved immediately (natural blackjack), show result
  if (state.phase === 'resolved') {
    const result = calculateTotalResult(state);
    let newBalance = (await findOrCreateUser(userId)).chips;

    if (result.totalPayout > 0n) {
      newBalance = await addChips(userId, result.totalPayout, 'WIN', 'BLACKJACK');
    }

    const resultView = buildBlackjackResultView(
      state,
      result.totalBet,
      result.totalPayout,
      result.net,
      newBalance,
    );

    await interaction.reply({
      components: [resultView],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  // Store session and show playing view
  bjSessionManager.set(userId, state);

  const updatedUser = await findOrCreateUser(userId);
  const playingView = buildBlackjackPlayingView(state, userId, updatedUser.chips);

  await interaction.reply({
    components: [playingView],
    flags: MessageFlags.IsComponentsV2,
  });
}

registerCommand({ data, execute: execute as never });
