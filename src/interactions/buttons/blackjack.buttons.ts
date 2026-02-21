import { type ButtonInteraction, MessageFlags } from 'discord.js';
import { registerButtonHandler } from '../handler.js';
import {
  type BlackjackState,
  hit,
  stand,
  doubleDown,
  split,
  takeInsurance,
  calculateTotalResult,
} from '../../games/blackjack/blackjack.engine.js';
import {
  buildBlackjackPlayingView,
  buildBlackjackResultView,
} from '../../ui/builders/blackjack.builder.js';
import { findOrCreateUser, incrementGameStats } from '../../database/repositories/user.repository.js';
import { removeChips, addChips } from '../../database/services/economy.service.js';
import { getBankruptcyPenaltyMultiplier, applyPenalty } from '../../database/services/loan.service.js';
import { formatChips } from '../../utils/formatters.js';

// In-memory session storage: userId -> game state
export const bjSessionManager = new Map<string, BlackjackState>();

async function handleBlackjackButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const action = parts[1];
  const ownerId = parts[2];

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: 'これはあなたのゲームではありません！ `/blackjack` で遊んでください。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const userId = interaction.user.id;
  const state = bjSessionManager.get(userId);
  if (!state) {
    await interaction.reply({
      content: 'セッションが期限切れです。`/blackjack` で新しいゲームを始めてください。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (state.phase !== 'playing') {
    await interaction.reply({
      content: 'このゲームは既に終了しています。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const user = await findOrCreateUser(userId);

  switch (action) {
    case 'hit':
      hit(state);
      break;

    case 'stand':
      stand(state);
      break;

    case 'double': {
      const hand = state.playerHands[state.activeHandIndex];
      if (user.chips < hand.bet) {
        await interaction.reply({
          content: `ダブルに必要なチップが足りません！ 必要: ${formatChips(hand.bet)}、残高: ${formatChips(user.chips)}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      // Deduct extra bet for double
      await removeChips(userId, hand.bet, 'LOSS', 'BLACKJACK');
      doubleDown(state);
      break;
    }

    case 'split': {
      const hand = state.playerHands[state.activeHandIndex];
      if (user.chips < hand.bet) {
        await interaction.reply({
          content: `スプリットに必要なチップが足りません！ 必要: ${formatChips(hand.bet)}、残高: ${formatChips(user.chips)}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      // Deduct extra bet for split
      await removeChips(userId, hand.bet, 'LOSS', 'BLACKJACK');
      split(state);
      break;
    }

    case 'insurance': {
      const insBet = state.playerHands[0].bet / 2n;
      if (user.chips < insBet) {
        await interaction.reply({
          content: `インシュランスに必要なチップが足りません！ 必要: ${formatChips(insBet)}、残高: ${formatChips(user.chips)}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await removeChips(userId, insBet, 'LOSS', 'BLACKJACK');
      takeInsurance(state);
      break;
    }

    default:
      return;
  }

  // If game resolved, show result
  if ((state.phase as string) === 'resolved') {
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

    // Process net result: add back payout (we already deducted initial bet in command)
    const updatedUser = await findOrCreateUser(userId);
    let newBalance = updatedUser.chips;

    if (totalPayout > 0n) {
      newBalance = await addChips(userId, totalPayout, 'WIN', 'BLACKJACK');
    }

    const resultView = buildBlackjackResultView(
      state,
      result.totalBet,
      totalPayout,
      net,
      newBalance,
    );

    // Update game stats
    const won = net > 0n ? net : 0n;
    const lost = net < 0n ? -net : 0n;
    await incrementGameStats(userId, won, lost);

    bjSessionManager.delete(userId);

    await interaction.update({
      components: [resultView],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  // Still playing — update view
  const updatedUser = await findOrCreateUser(userId);
  const playingView = buildBlackjackPlayingView(state, userId, updatedUser.chips);

  await interaction.update({
    components: [playingView],
    flags: MessageFlags.IsComponentsV2,
  });
}

registerButtonHandler('bj', handleBlackjackButton as never);
