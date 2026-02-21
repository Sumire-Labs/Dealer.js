import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type TextBasedChannel,
  MessageFlags,
} from 'discord.js';
import { registerCommand } from '../registry.js';
import {
  POKER_LOBBY_DURATION_MS,
  POKER_MIN_PLAYERS,
  POKER_ACTION_TIMEOUT_MS,
} from '../../config/constants.js';
import { POKER_CONFIG } from '../../config/games.js';
import { createDeck } from '../../games/poker/poker.deck.js';
import {
  postBlinds,
  getFirstToAct,
  getNextActivePlayer,
  getActivePlayers,
  getActionablePlayers,
  resetBettingRound,
  isBettingRoundComplete,
  processAction,
  calculatePots,
  determineWinners,
  type PokerPhase,
} from '../../games/poker/poker.engine.js';
import {
  getActiveSession,
  setActiveSession,
  removeActiveSession,
  type PokerSessionState,
} from '../../games/poker/poker.session.js';
import { addChips } from '../../database/services/economy.service.js';
import { incrementGameStats } from '../../database/repositories/user.repository.js';
import {
  buildPokerLobbyView,
  buildPokerTableView,
  buildPokerResultView,
  buildPokerFoldWinView,
  buildPokerCancelledView,
} from '../../ui/builders/poker.builder.js';
import { logger } from '../../utils/logger.js';
import { secureRandomInt } from '../../utils/random.js';

const data = new SlashCommandBuilder()
  .setName('poker')
  .setDescription('テキサスホールデム・ポーカーを開始する')
  .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const channelId = interaction.channelId;

  const existing = getActiveSession(channelId);
  if (existing) {
    await interaction.reply({
      content: 'このチャンネルではすでにポーカーが進行中です！',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const sessionId = `poker_${Date.now()}_${secureRandomInt(1000, 9999)}`;
  const session: PokerSessionState = {
    id: sessionId,
    channelId,
    ownerId: interaction.user.id,
    status: 'waiting',
    lobbyDeadline: Date.now() + POKER_LOBBY_DURATION_MS,
    players: [],
    deck: [],
    communityCards: [],
    dealerIndex: 0,
    phase: 'preflop',
    currentBet: 0n,
    minRaise: POKER_CONFIG.bigBlind,
    currentPlayerIndex: 0,
    lastRaiserIndex: -1,
    turnDeadline: 0,
  };

  setActiveSession(channelId, session);

  const remainingSeconds = Math.ceil(POKER_LOBBY_DURATION_MS / 1000);
  const lobbyView = buildPokerLobbyView(session, remainingSeconds);

  const reply = await interaction.reply({
    components: [lobbyView],
    flags: MessageFlags.IsComponentsV2,
    withResponse: true,
  });

  session.messageId = reply.resource?.message?.id;

  startLobbyCountdown(interaction.channel, session);
}

function startLobbyCountdown(
  channel: TextBasedChannel | null,
  session: PokerSessionState,
): void {
  const updateInterval = 15_000;

  session.lobbyTimer = setInterval(async () => {
    const now = Date.now();
    const remaining = session.lobbyDeadline - now;

    if (remaining <= 0 || session.status !== 'waiting') {
      if (session.lobbyTimer) clearInterval(session.lobbyTimer);
      if (session.status === 'waiting') {
        await tryStartGame(channel, session);
      }
      return;
    }

    try {
      if (session.messageId && channel && 'messages' in channel) {
        const remainingSec = Math.ceil(remaining / 1000);
        const view = buildPokerLobbyView(session, remainingSec);
        await channel.messages.edit(session.messageId, {
          components: [view],
          flags: MessageFlags.IsComponentsV2,
        });
      }
    } catch (err) {
      logger.error('Failed to update poker lobby', { error: String(err) });
    }
  }, updateInterval);
}

export async function tryStartGame(
  channel: TextBasedChannel | null,
  session: PokerSessionState,
): Promise<void> {
  if (session.lobbyTimer) clearInterval(session.lobbyTimer);

  if (session.players.length < POKER_MIN_PLAYERS) {
    session.status = 'cancelled';

    // Refund all buy-ins
    for (const p of session.players) {
      await addChips(p.userId, p.stack, 'WIN', 'POKER');
    }

    const cancelView = buildPokerCancelledView(
      `参加者不足（${session.players.length}/${POKER_MIN_PLAYERS}）。全バイインを返金しました。`,
    );

    try {
      if (session.messageId && channel && 'messages' in channel) {
        await channel.messages.edit(session.messageId, {
          components: [cancelView],
          flags: MessageFlags.IsComponentsV2,
        });
      }
    } catch {
      // ignore
    }

    removeActiveSession(session.channelId);
    return;
  }

  // Start the game
  session.status = 'playing';
  session.deck = createDeck();
  session.dealerIndex = secureRandomInt(0, session.players.length - 1);

  // Post blinds
  postBlinds(session.players, session.dealerIndex, POKER_CONFIG.smallBlind, POKER_CONFIG.bigBlind);
  session.currentBet = POKER_CONFIG.bigBlind;
  session.minRaise = POKER_CONFIG.bigBlind;

  // Deal hole cards
  for (const player of session.players) {
    player.holeCards = [session.deck.pop()!, session.deck.pop()!];
  }

  // Set first to act
  session.phase = 'preflop';
  session.currentPlayerIndex = getFirstToAct(session.players, session.dealerIndex, 'preflop');

  // If no one can act (all-in from blinds), go straight through phases
  if (session.currentPlayerIndex === -1 || getActionablePlayers(session.players).length <= 1) {
    await runRemainingPhases(channel, session);
    return;
  }

  // Set turn timer and update UI
  startTurnTimer(channel, session);
  await updateTableMessage(channel, session);
}

export async function advanceGame(
  channel: TextBasedChannel | null,
  session: PokerSessionState,
): Promise<void> {
  // Check if only 1 player remaining (all others folded)
  const active = getActivePlayers(session.players);
  if (active.length === 1) {
    await handleFoldWin(channel, session, active[0].userId);
    return;
  }

  // Check if betting round is complete
  if (!isBettingRoundComplete(session.players, session.currentBet)) {
    // Move to next player
    const next = getNextActivePlayer(session.players, session.currentPlayerIndex);
    if (next !== -1 && next !== session.currentPlayerIndex) {
      session.currentPlayerIndex = next;
      startTurnTimer(channel, session);
      await updateTableMessage(channel, session);
      return;
    }
  }

  // Betting round complete — advance to next phase
  resetBettingRound(session.players);
  session.currentBet = 0n;
  session.minRaise = POKER_CONFIG.bigBlind;
  session.lastRaiserIndex = -1;

  const nextPhase = getNextPhase(session.phase);
  session.phase = nextPhase;

  if (nextPhase === 'showdown') {
    await handleShowdown(channel, session);
    return;
  }

  // Deal community cards
  dealCommunityCards(session);

  // Check if anyone can actually act
  const actionable = getActionablePlayers(session.players);
  if (actionable.length <= 1) {
    // No one to bet — run remaining phases
    await runRemainingPhases(channel, session);
    return;
  }

  session.currentPlayerIndex = getFirstToAct(session.players, session.dealerIndex, nextPhase);
  if (session.currentPlayerIndex === -1) {
    await runRemainingPhases(channel, session);
    return;
  }

  startTurnTimer(channel, session);
  await updateTableMessage(channel, session);
}

function getNextPhase(current: PokerPhase): PokerPhase {
  const order: PokerPhase[] = ['preflop', 'flop', 'turn', 'river', 'showdown'];
  const idx = order.indexOf(current);
  return order[idx + 1] ?? 'showdown';
}

function dealCommunityCards(session: PokerSessionState): void {
  if (session.phase === 'flop') {
    session.deck.pop(); // burn
    session.communityCards.push(session.deck.pop()!, session.deck.pop()!, session.deck.pop()!);
  } else if (session.phase === 'turn' || session.phase === 'river') {
    session.deck.pop(); // burn
    session.communityCards.push(session.deck.pop()!);
  }
}

async function runRemainingPhases(
  channel: TextBasedChannel | null,
  session: PokerSessionState,
): Promise<void> {
  // Deal out remaining community cards
  while (session.communityCards.length < 5) {
    if (session.communityCards.length === 0) {
      session.deck.pop(); // burn
      session.communityCards.push(session.deck.pop()!, session.deck.pop()!, session.deck.pop()!);
    } else {
      session.deck.pop(); // burn
      session.communityCards.push(session.deck.pop()!);
    }
  }

  session.phase = 'showdown';
  await handleShowdown(channel, session);
}

async function handleShowdown(
  channel: TextBasedChannel | null,
  session: PokerSessionState,
): Promise<void> {
  if (session.turnTimer) clearTimeout(session.turnTimer);

  const pots = calculatePots(session.players);
  const winners = determineWinners(pots, session.players, session.communityCards);

  // Pay out winners
  for (const w of winners) {
    await addChips(w.userId, w.amount, 'WIN', 'POKER');
  }

  // Return remaining stacks (unbet chips) to all players
  for (const p of session.players) {
    if (p.stack > 0n) {
      await addChips(p.userId, p.stack, 'WIN', 'POKER');
    }
  }

  // Update game stats for all players
  for (const p of session.players) {
    const winAmount = winners
      .filter(w => w.userId === p.userId)
      .reduce((sum, w) => sum + w.amount, 0n);
    const net = winAmount - p.totalBet;
    const won = net > 0n ? net : 0n;
    const lost = net < 0n ? -net : 0n;
    await incrementGameStats(p.userId, won, lost);
  }

  session.status = 'finished';

  const resultView = buildPokerResultView(session, winners, pots);

  try {
    if (session.messageId && channel && 'messages' in channel) {
      await channel.messages.edit(session.messageId, {
        components: [resultView],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  } catch (err) {
    logger.error('Failed to show poker result', { error: String(err) });
  }

  removeActiveSession(session.channelId);
}

async function handleFoldWin(
  channel: TextBasedChannel | null,
  session: PokerSessionState,
  winnerUserId: string,
): Promise<void> {
  if (session.turnTimer) clearTimeout(session.turnTimer);

  const totalPot = session.players.reduce((sum, p) => sum + p.totalBet, 0n);
  await addChips(winnerUserId, totalPot, 'WIN', 'POKER');

  // Return remaining stacks (unbet chips) to all players
  for (const p of session.players) {
    if (p.stack > 0n) {
      await addChips(p.userId, p.stack, 'WIN', 'POKER');
    }
  }

  // Update game stats for all players
  for (const p of session.players) {
    if (p.userId === winnerUserId) {
      const net = totalPot - p.totalBet;
      await incrementGameStats(p.userId, net > 0n ? net : 0n, 0n);
    } else {
      await incrementGameStats(p.userId, 0n, p.totalBet);
    }
  }

  session.status = 'finished';

  const foldView = buildPokerFoldWinView(session, winnerUserId);

  try {
    if (session.messageId && channel && 'messages' in channel) {
      await channel.messages.edit(session.messageId, {
        components: [foldView],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  } catch (err) {
    logger.error('Failed to show poker fold win', { error: String(err) });
  }

  removeActiveSession(session.channelId);
}

function startTurnTimer(
  channel: TextBasedChannel | null,
  session: PokerSessionState,
): void {
  if (session.turnTimer) clearTimeout(session.turnTimer);

  session.turnDeadline = Date.now() + POKER_ACTION_TIMEOUT_MS;

  session.turnTimer = setTimeout(async () => {
    // Auto-fold on timeout
    const player = session.players[session.currentPlayerIndex];
    if (player && !player.folded && !player.allIn) {
      processAction('fold', player, session.currentBet);
      await advanceGame(channel, session);
    }
  }, POKER_ACTION_TIMEOUT_MS);
}

export async function updateTableMessage(
  channel: TextBasedChannel | null,
  session: PokerSessionState,
): Promise<void> {
  try {
    if (session.messageId && channel && 'messages' in channel) {
      const view = buildPokerTableView(session);
      // Use channel.messages.edit directly — avoids an extra fetch API call
      await channel.messages.edit(session.messageId, {
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  } catch (err) {
    logger.error('Failed to update poker table', { error: String(err) });
  }
}

registerCommand({ data, execute: execute as never });
