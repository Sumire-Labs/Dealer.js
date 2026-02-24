import {
  type ButtonInteraction,
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
} from 'discord.js';
import { registerButtonHandler } from '../handler.js';
import {
  type BlackjackState,
  hit,
  stand,
  doubleDown,
  split,
  takeInsurance,
  calculateTotalResult,
  createGame,
} from '../../games/blackjack/blackjack.engine.js';
import {
  buildBlackjackPlayingView,
  buildBlackjackResultView,
} from '../../ui/builders/blackjack.builder.js';
import { buildBjTableLobbyView } from '../../ui/builders/blackjack-table.builder.js';
import { findOrCreateUser, incrementGameStats } from '../../database/repositories/user.repository.js';
import { removeChips, addChips } from '../../database/services/economy.service.js';
import { getBankruptcyPenaltyMultiplier, applyPenalty } from '../../database/services/loan.service.js';
import { formatChips } from '../../utils/formatters.js';
import { updateMissionProgress, buildMissionNotification } from '../../database/services/mission.service.js';
import {
  getActiveTableSession,
  setActiveTableSession,
  type BlackjackTableSession,
} from '../../games/blackjack/blackjack-table.session.js';
import { Shoe } from '../../games/blackjack/blackjack.deck.js';
import { BJ_TABLE_LOBBY_DURATION_MS } from '../../config/constants.js';
import { startBjTableLobbyCountdown } from './blackjack-table.buttons.js';

// In-memory session storage: userId -> game state
export const bjSessionManager = new Map<string, BlackjackState>();

async function handleBlackjackButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const action = parts[1];

  switch (action) {
    case 'solo':
      await handleSolo(interaction, parts);
      return;
    case 'table':
      await handleTable(interaction, parts);
      return;
  }

  // Existing game action handling (hit/stand/double/split/insurance)
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

  switch (action) {
    case 'hit':
      hit(state);
      break;

    case 'stand':
      stand(state);
      break;

    case 'double': {
      const hand = state.playerHands[state.activeHandIndex];
      try {
        await removeChips(userId, hand.bet, 'LOSS', 'BLACKJACK');
      } catch {
        await interaction.reply({
          content: `ダブルに必要なチップが足りません！ 必要: ${formatChips(hand.bet)}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      doubleDown(state);
      break;
    }

    case 'split': {
      const hand = state.playerHands[state.activeHandIndex];
      try {
        await removeChips(userId, hand.bet, 'LOSS', 'BLACKJACK');
      } catch {
        await interaction.reply({
          content: `スプリットに必要なチップが足りません！ 必要: ${formatChips(hand.bet)}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      split(state);
      break;
    }

    case 'insurance': {
      const insBet = state.playerHands[0].bet / 2n;
      try {
        await removeChips(userId, insBet, 'LOSS', 'BLACKJACK');
      } catch {
        await interaction.reply({
          content: `インシュランスに必要なチップが足りません！ 必要: ${formatChips(insBet)}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
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

    // Mission hooks for blackjack
    try {
      const allCompleted = [];
      const playResults = await updateMissionProgress(userId, { type: 'game_play', gameType: 'BLACKJACK' });
      allCompleted.push(...playResults);

      if (net > 0n) {
        const winResults = await updateMissionProgress(userId, { type: 'game_win', gameType: 'BLACKJACK' });
        allCompleted.push(...winResults);
        const earnResults = await updateMissionProgress(userId, { type: 'chips_earned', amount: Number(net) });
        allCompleted.push(...earnResults);
      }

      const betResults = await updateMissionProgress(userId, { type: 'chips_bet', amount: Number(result.totalBet) });
      allCompleted.push(...betResults);

      if (allCompleted.length > 0) {
        await interaction.followUp({
          content: buildMissionNotification(allCompleted),
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch {
      // Mission check should never block game result
    }
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

// ─── Solo mode handler ─────────────────────────────────

async function handleSolo(interaction: ButtonInteraction, parts: string[]): Promise<void> {
  const ownerId = parts[2];
  const bet = BigInt(parts[3]);
  const userId = interaction.user.id;

  if (userId !== ownerId) {
    await interaction.reply({
      content: '他のプレイヤーの操作はできません。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (bjSessionManager.has(userId)) {
    await interaction.reply({
      content: '進行中のブラックジャックがあります！',
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

    const won = net > 0n ? net : 0n;
    const lost = net < 0n ? -net : 0n;
    await incrementGameStats(userId, won, lost);

    const resultView = buildBlackjackResultView(state, result.totalBet, totalPayout, net, newBalance);

    await interaction.update({
      components: [resultView],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  // Store session and show playing view
  bjSessionManager.set(userId, state);
  const updatedUser = await findOrCreateUser(userId);
  const playingView = buildBlackjackPlayingView(state, userId, updatedUser.chips);

  await interaction.update({
    components: [playingView],
    flags: MessageFlags.IsComponentsV2,
  });
}

// ─── Table mode handler ────────────────────────────────

async function handleTable(interaction: ButtonInteraction, parts: string[]): Promise<void> {
  const ownerId = parts[2];
  const bet = BigInt(parts[3]);
  const userId = interaction.user.id;

  if (userId !== ownerId) {
    await interaction.reply({
      content: '他のプレイヤーの操作はできません。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const channelId = interaction.channelId;

  // Check for existing table session
  const existing = getActiveTableSession(channelId);
  if (existing && existing.phase !== 'resolved' && existing.phase !== 'cancelled') {
    await interaction.reply({
      content: 'このチャンネルではすでにブラックジャックテーブルが進行中です！',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Check balance
  const user = await findOrCreateUser(userId);
  if (user.chips < bet) {
    await interaction.reply({
      content: `チップが不足しています！ 残高: ${formatChips(user.chips)}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Deduct bet
  await removeChips(userId, bet, 'LOSS', 'BLACKJACK');

  const displayName = interaction.user.displayName;

  // Create table session
  const session: BlackjackTableSession = {
    channelId,
    hostId: userId,
    bet,
    phase: 'waiting',
    lobbyDeadline: Date.now() + BJ_TABLE_LOBBY_DURATION_MS,
    shoe: new Shoe(),
    players: [{
      userId,
      displayName,
      bet,
      isHost: true,
      hands: [],
      activeHandIndex: 0,
      outcomes: [],
      multipliers: [],
      insuranceBet: 0n,
      insurancePaid: false,
      done: false,
    }],
    currentPlayerIndex: 0,
    dealerCards: [],
    turnDeadline: 0,
  };

  setActiveTableSession(channelId, session);

  // Dismiss ephemeral mode select
  await interaction.update({
    components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent('✅ テーブルを作成しました！'))],
    flags: MessageFlags.IsComponentsV2,
  });

  // Send public lobby message
  if (interaction.channel && 'send' in interaction.channel) {
    const remainingSeconds = Math.ceil(BJ_TABLE_LOBBY_DURATION_MS / 1000);
    const lobbyView = buildBjTableLobbyView(session, remainingSeconds);
    const msg = await interaction.channel.send({
      components: [lobbyView],
      flags: MessageFlags.IsComponentsV2,
    });
    session.messageId = msg.id;
    startBjTableLobbyCountdown(interaction.channel, session);
  }
}

registerButtonHandler('bj', handleBlackjackButton as never);
