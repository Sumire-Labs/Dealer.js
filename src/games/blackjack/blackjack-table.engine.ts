import {BLACKJACK_CONFIG} from '../../config/games.js';
import {type Card, Shoe} from './blackjack.deck.js';
import {canDoubleDown, canSplit, evaluateHand} from './blackjack.hand.js';
import {dealerPlay} from './blackjack.strategy.js';
import type {BlackjackHand} from './blackjack.engine.js';
import type {BlackjackTableSession, TablePlayer} from './blackjack-table.session.js';

// ─── Table initialization ──────────────────────────────

export function initializeTable(session: BlackjackTableSession): void {
  session.shoe = new Shoe();
  session.phase = 'playing';

  // Deal 2 cards to each player
  for (const player of session.players) {
    const card1 = session.shoe.draw();
    const card2 = session.shoe.draw();
    player.hands = [{
      cards: [card1, card2],
      bet: player.bet,
      stood: false,
      doubled: false,
    }];
    player.activeHandIndex = 0;
    player.outcomes = [];
    player.multipliers = [];
    player.insuranceBet = 0n;
    player.insurancePaid = false;
    player.done = false;
  }

  // Deal dealer cards
  session.dealerCards = [session.shoe.draw(), session.shoe.draw()];

  // Check natural blackjacks — resolve instantly for those players
  for (const player of session.players) {
    const hand = player.hands[0];
    const value = evaluateHand(hand.cards);
    if (value.isBlackjack) {
      hand.stood = true;
      player.done = true;
    }
  }

  // Set first non-done player
  session.currentPlayerIndex = findNextActivePlayer(session, -1);

  // If all players have natural BJ, go to dealer turn
  if (session.currentPlayerIndex === -1) {
    resolveTable(session);
  }
}

// ─── Player actions ────────────────────────────────────

export function tableHit(session: BlackjackTableSession, player: TablePlayer): void {
  const hand = player.hands[player.activeHandIndex];
  hand.cards.push(session.shoe.draw());

  const value = evaluateHand(hand.cards);
  if (value.isBust || value.best === 21) {
    hand.stood = true;
    advancePlayerHand(player);
  }
}

export function tableStand(_session: BlackjackTableSession, player: TablePlayer): void {
  const hand = player.hands[player.activeHandIndex];
  hand.stood = true;
  advancePlayerHand(player);
}

export function tableDoubleDown(session: BlackjackTableSession, player: TablePlayer): void {
  const hand = player.hands[player.activeHandIndex];
  if (!canDoubleDown(hand.cards)) return;

  hand.bet *= 2n;
  hand.doubled = true;
  hand.cards.push(session.shoe.draw());
  hand.stood = true;
  advancePlayerHand(player);
}

export function tableSplit(session: BlackjackTableSession, player: TablePlayer): void {
  const hand = player.hands[player.activeHandIndex];
  if (!canSplit(hand.cards)) return;

  const card1 = hand.cards[0];
  const card2 = hand.cards[1];

  hand.cards = [card1, session.shoe.draw()];
  hand.stood = false;
  hand.doubled = false;

  const newHand: BlackjackHand = {
    cards: [card2, session.shoe.draw()],
    bet: hand.bet,
    stood: false,
    doubled: false,
  };

  player.hands.splice(player.activeHandIndex + 1, 0, newHand);
}

export function tableInsurance(player: TablePlayer): void {
  const baseBet = player.hands[0].bet;
  player.insuranceBet = baseBet / 2n;
}

// ─── Hand / turn advancement ───────────────────────────

function advancePlayerHand(player: TablePlayer): void {
  // Find next unresolved hand within this player
  for (let i = player.activeHandIndex + 1; i < player.hands.length; i++) {
    if (!player.hands[i].stood) {
      player.activeHandIndex = i;
      return;
    }
  }
  // All hands stood — player is done
  player.done = true;
}

export function isPlayerDone(player: TablePlayer): boolean {
  return player.done;
}

export function advanceTableTurn(session: BlackjackTableSession): boolean {
  const nextIndex = findNextActivePlayer(session, session.currentPlayerIndex);
  if (nextIndex === -1) {
    // All players done — resolve
    resolveTable(session);
    return true; // resolved
  }
  session.currentPlayerIndex = nextIndex;
  return false; // not resolved yet
}

function findNextActivePlayer(session: BlackjackTableSession, fromIndex: number): number {
  for (let i = fromIndex + 1; i < session.players.length; i++) {
    if (!session.players[i].done) {
      return i;
    }
  }
  return -1;
}

// ─── Table resolution ──────────────────────────────────

export function resolveTable(session: BlackjackTableSession): void {
  session.phase = 'dealer_turn';

  const dealerValue = evaluateHand(session.dealerCards);

  // Check if all players busted
  const allBust = session.players.every(p =>
    p.hands.every(h => evaluateHand(h.cards).isBust),
  );

  // Dealer plays if not all bust and no dealer natural BJ
  if (!allBust && !dealerValue.isBlackjack) {
    session.dealerCards = dealerPlay(session.dealerCards, () => session.shoe.draw());
  }

  // Resolve each player
  for (const player of session.players) {
    calculatePlayerResult(player, session.dealerCards);
  }

  session.phase = 'resolved';
}

export function calculatePlayerResult(player: TablePlayer, dealerCards: Card[]): void {
  const dealerValue = evaluateHand(dealerCards);
  const finalDealerValue = evaluateHand(dealerCards);

  player.outcomes = [];
  player.multipliers = [];

  for (let i = 0; i < player.hands.length; i++) {
    const hand = player.hands[i];
    const pv = evaluateHand(hand.cards);

    // Natural blackjack check (only for single hand, 2 cards)
    if (player.hands.length === 1 && pv.isBlackjack) {
      if (dealerValue.isBlackjack) {
        player.outcomes.push('push');
        player.multipliers.push(1);
      } else {
        player.outcomes.push('blackjack');
        player.multipliers.push(1 + BLACKJACK_CONFIG.blackjackPayout);
      }
      continue;
    }

    // Dealer natural BJ beats all non-BJ hands
    if (dealerValue.isBlackjack) {
      player.outcomes.push('lose');
      player.multipliers.push(0);
      continue;
    }

    if (pv.isBust) {
      player.outcomes.push('bust');
      player.multipliers.push(0);
    } else if (finalDealerValue.isBust) {
      player.outcomes.push('dealer_bust');
      player.multipliers.push(1 + BLACKJACK_CONFIG.normalPayout);
    } else if (pv.best > finalDealerValue.best) {
      player.outcomes.push('win');
      player.multipliers.push(1 + BLACKJACK_CONFIG.normalPayout);
    } else if (pv.best === finalDealerValue.best) {
      player.outcomes.push('push');
      player.multipliers.push(1);
    } else {
      player.outcomes.push('lose');
      player.multipliers.push(0);
    }
  }

  // Resolve insurance
  if (player.insuranceBet > 0n) {
    player.insurancePaid = dealerValue.isBlackjack;
  }
}

export interface PlayerPayoutResult {
  totalBet: bigint;
  totalPayout: bigint;
  net: bigint;
}

export function calculatePlayerPayout(player: TablePlayer): PlayerPayoutResult {
  let totalBet = 0n;
  let totalPayout = 0n;

  for (let i = 0; i < player.hands.length; i++) {
    const hand = player.hands[i];
    totalBet += hand.bet;
    const payout = BigInt(Math.floor(Number(hand.bet) * player.multipliers[i]));
    totalPayout += payout;
  }

  // Insurance
  totalBet += player.insuranceBet;
  if (player.insurancePaid) {
    totalPayout += player.insuranceBet * BigInt(BLACKJACK_CONFIG.insurancePayout + 1);
  }

  return { totalBet, totalPayout, net: totalPayout - totalBet };
}

// ─── Available actions ─────────────────────────────────

export function getTableAvailableActions(session: BlackjackTableSession, player: TablePlayer): string[] {
  if (session.phase !== 'playing' || player.done) return [];

  const hand = player.hands[player.activeHandIndex];
  const actions = ['hit', 'stand'];

  if (canDoubleDown(hand.cards)) {
    actions.push('double');
  }

  if (canSplit(hand.cards) && player.hands.length === 1) {
    actions.push('split');
  }

  if (
    session.dealerCards[0].rank === 'A' &&
    player.insuranceBet === 0n &&
    hand.cards.length === 2 &&
    player.activeHandIndex === 0
  ) {
    actions.push('insurance');
  }

  return actions;
}
