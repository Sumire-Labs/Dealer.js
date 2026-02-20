import { BLACKJACK_CONFIG } from '../../config/games.js';
import { Shoe, type Card } from './blackjack.deck.js';
import { evaluateHand, canSplit, canDoubleDown } from './blackjack.hand.js';
import { dealerPlay } from './blackjack.strategy.js';

export type GamePhase = 'playing' | 'dealer_turn' | 'resolved';
export type GameOutcome = 'blackjack' | 'win' | 'lose' | 'push' | 'bust' | 'dealer_bust';

export interface BlackjackHand {
  cards: Card[];
  bet: bigint;
  stood: boolean;
  doubled: boolean;
}

export interface BlackjackState {
  shoe: Shoe;
  playerHands: BlackjackHand[];
  activeHandIndex: number;
  dealerCards: Card[];
  phase: GamePhase;
  outcomes: GameOutcome[];
  multipliers: number[];
  insuranceBet: bigint;
  insurancePaid: boolean;
}

export function createGame(bet: bigint): BlackjackState {
  const shoe = new Shoe();

  const playerCard1 = shoe.draw();
  const dealerCard1 = shoe.draw();
  const playerCard2 = shoe.draw();
  const dealerCard2 = shoe.draw();

  const playerHand: BlackjackHand = {
    cards: [playerCard1, playerCard2],
    bet,
    stood: false,
    doubled: false,
  };

  const state: BlackjackState = {
    shoe,
    playerHands: [playerHand],
    activeHandIndex: 0,
    dealerCards: [dealerCard1, dealerCard2],
    phase: 'playing',
    outcomes: [],
    multipliers: [],
    insuranceBet: 0n,
    insurancePaid: false,
  };

  // Check for natural blackjack
  const playerValue = evaluateHand(playerHand.cards);
  const dealerValue = evaluateHand(state.dealerCards);

  if (playerValue.isBlackjack || dealerValue.isBlackjack) {
    return resolveGame(state);
  }

  return state;
}

export function hit(state: BlackjackState): BlackjackState {
  const hand = state.playerHands[state.activeHandIndex];
  hand.cards.push(state.shoe.draw());

  const value = evaluateHand(hand.cards);
  if (value.isBust) {
    hand.stood = true;
    return advanceHand(state);
  }

  if (value.best === 21) {
    hand.stood = true;
    return advanceHand(state);
  }

  return state;
}

export function stand(state: BlackjackState): BlackjackState {
  state.playerHands[state.activeHandIndex].stood = true;
  return advanceHand(state);
}

export function doubleDown(state: BlackjackState): BlackjackState {
  const hand = state.playerHands[state.activeHandIndex];
  if (!canDoubleDown(hand.cards)) return state;

  hand.bet *= 2n;
  hand.doubled = true;
  hand.cards.push(state.shoe.draw());
  hand.stood = true;

  return advanceHand(state);
}

export function split(state: BlackjackState): BlackjackState {
  const hand = state.playerHands[state.activeHandIndex];
  if (!canSplit(hand.cards)) return state;

  const card1 = hand.cards[0];
  const card2 = hand.cards[1];

  hand.cards = [card1, state.shoe.draw()];
  hand.stood = false;
  hand.doubled = false;

  const newHand: BlackjackHand = {
    cards: [card2, state.shoe.draw()],
    bet: hand.bet,
    stood: false,
    doubled: false,
  };

  state.playerHands.splice(state.activeHandIndex + 1, 0, newHand);
  return state;
}

export function canTakeInsurance(state: BlackjackState): boolean {
  return (
    state.dealerCards[0].rank === 'A' &&
    state.phase === 'playing' &&
    state.insuranceBet === 0n &&
    state.playerHands[0].cards.length === 2
  );
}

export function takeInsurance(state: BlackjackState): BlackjackState {
  const baseBet = state.playerHands[0].bet;
  state.insuranceBet = baseBet / 2n;
  return state;
}

function advanceHand(state: BlackjackState): BlackjackState {
  // Find next unresolved hand
  for (let i = state.activeHandIndex + 1; i < state.playerHands.length; i++) {
    if (!state.playerHands[i].stood) {
      state.activeHandIndex = i;
      return state;
    }
  }

  // All hands stood — dealer's turn
  return resolveGame(state);
}

function resolveGame(state: BlackjackState): BlackjackState {
  state.phase = 'dealer_turn';

  const dealerValue = evaluateHand(state.dealerCards);
  const playerFirstHand = evaluateHand(state.playerHands[0].cards);

  // Check natural blackjacks first (only applies to initial 2-card hands, no splits)
  if (state.playerHands.length === 1 && playerFirstHand.isBlackjack) {
    if (dealerValue.isBlackjack) {
      state.outcomes = ['push'];
      state.multipliers = [1]; // return bet
      state.phase = 'resolved';
      resolveInsurance(state, true);
      return state;
    }
    state.outcomes = ['blackjack'];
    state.multipliers = [1 + BLACKJACK_CONFIG.blackjackPayout]; // 2.5x
    state.phase = 'resolved';
    resolveInsurance(state, false);
    return state;
  }

  if (dealerValue.isBlackjack) {
    state.outcomes = state.playerHands.map(() => 'lose');
    state.multipliers = state.playerHands.map(() => 0);
    state.phase = 'resolved';
    resolveInsurance(state, true);
    return state;
  }

  // Dealer plays
  const allBust = state.playerHands.every(h => evaluateHand(h.cards).isBust);
  if (!allBust) {
    state.dealerCards = dealerPlay(state.dealerCards, () => state.shoe.draw());
  }

  const finalDealerValue = evaluateHand(state.dealerCards);

  state.outcomes = [];
  state.multipliers = [];

  for (const hand of state.playerHands) {
    const pv = evaluateHand(hand.cards);

    if (pv.isBust) {
      state.outcomes.push('bust');
      state.multipliers.push(0);
    } else if (finalDealerValue.isBust) {
      state.outcomes.push('dealer_bust');
      state.multipliers.push(1 + BLACKJACK_CONFIG.normalPayout); // 2x
    } else if (pv.best > finalDealerValue.best) {
      state.outcomes.push('win');
      state.multipliers.push(1 + BLACKJACK_CONFIG.normalPayout);
    } else if (pv.best === finalDealerValue.best) {
      state.outcomes.push('push');
      state.multipliers.push(1);
    } else {
      state.outcomes.push('lose');
      state.multipliers.push(0);
    }
  }

  state.phase = 'resolved';
  resolveInsurance(state, finalDealerValue.isBlackjack);
  return state;
}

function resolveInsurance(state: BlackjackState, dealerBlackjack: boolean): void {
  if (state.insuranceBet > 0n) {
    state.insurancePaid = dealerBlackjack;
  }
}

export function getAvailableActions(state: BlackjackState): string[] {
  if (state.phase !== 'playing') return [];

  const hand = state.playerHands[state.activeHandIndex];
  const actions = ['hit', 'stand'];

  if (canDoubleDown(hand.cards)) {
    actions.push('double');
  }

  if (canSplit(hand.cards) && state.playerHands.length === 1) {
    actions.push('split');
  }

  if (canTakeInsurance(state) && state.insuranceBet === 0n) {
    actions.push('insurance');
  }

  return actions;
}

export function calculateTotalResult(
  state: BlackjackState,
): { totalBet: bigint; totalPayout: bigint; net: bigint } {
  let totalBet = 0n;
  let totalPayout = 0n;

  for (let i = 0; i < state.playerHands.length; i++) {
    const hand = state.playerHands[i];
    totalBet += hand.bet;
    const payout = BigInt(Math.floor(Number(hand.bet) * state.multipliers[i]));
    totalPayout += payout;
  }

  // Insurance
  totalBet += state.insuranceBet;
  if (state.insurancePaid) {
    totalPayout += state.insuranceBet * BigInt(BLACKJACK_CONFIG.insurancePayout + 1);
  }

  return { totalBet, totalPayout, net: totalPayout - totalBet };
}
