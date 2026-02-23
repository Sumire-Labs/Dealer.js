import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { registerCommand } from '../registry.js';
import { S } from '../../config/setting-defs.js';
import { findOrCreateUser, incrementGameStats } from '../../database/repositories/user.repository.js';
import { removeChips, addChips } from '../../database/services/economy.service.js';
import { getBankruptcyPenaltyMultiplier, applyPenalty } from '../../database/services/loan.service.js';
import { createGame, calculateTotalResult } from '../../games/blackjack/blackjack.engine.js';
import {
  buildBlackjackPlayingView,
  buildBlackjackResultView,
} from '../../ui/builders/blackjack.builder.js';
import { bjSessionManager } from '../../interactions/buttons/blackjack.buttons.js';
import { formatChips } from '../../utils/formatters.js';

const data = new SlashCommandBuilder()
  .setName('blackjack')
  .setDescription('ディーラーとブラックジャックで対戦')
  .addIntegerOption(option =>
    option
      .setName('bet')
      .setDescription('ベット額')
      .setRequired(true)
      .setMinValue(Number(S.minBet.defaultValue))
      .setMaxValue(Number(S.maxBlackjack.defaultValue)),
  )
  .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  const bet = BigInt(interaction.options.getInteger('bet', true));

  // Check for existing session
  if (bjSessionManager.has(userId)) {
    await interaction.reply({
      content: '進行中のブラックジャックがあります！ 先にそちらを終わらせてください。',
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

  // Deduct initial bet
  await removeChips(userId, bet, 'LOSS', 'BLACKJACK');

  // Create game
  const state = createGame(bet);

  // If resolved immediately (natural blackjack), show result
  if (state.phase === 'resolved') {
    const result = calculateTotalResult(state);
    let { totalPayout, net } = result;

    // Apply bankruptcy penalty to winnings
    if (totalPayout > 0n) {
      const penaltyMultiplier = await getBankruptcyPenaltyMultiplier(userId);
      if (penaltyMultiplier < 1.0) {
        totalPayout = applyPenalty(totalPayout, penaltyMultiplier);
        net = totalPayout - result.totalBet;
      }
    }

    let newBalance = (await findOrCreateUser(userId)).chips;

    if (totalPayout > 0n) {
      newBalance = await addChips(userId, totalPayout, 'WIN', 'BLACKJACK');
    }

    // Update game stats for natural blackjack
    const won = net > 0n ? net : 0n;
    const lost = net < 0n ? -net : 0n;
    await incrementGameStats(userId, won, lost);

    const resultView = buildBlackjackResultView(
      state,
      result.totalBet,
      totalPayout,
      net,
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
