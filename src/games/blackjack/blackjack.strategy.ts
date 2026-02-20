import { BLACKJACK_CONFIG } from '../../config/games.js';
import type { Card } from './blackjack.deck.js';
import { evaluateHand } from './blackjack.hand.js';

export type DealerAction = 'hit' | 'stand';

export function dealerShouldHit(hand: Card[]): boolean {
  const value = evaluateHand(hand);
  return value.best < BLACKJACK_CONFIG.dealerStandValue;
}

export function dealerPlay(hand: Card[], drawCard: () => Card): Card[] {
  const cards = [...hand];
  while (dealerShouldHit(cards)) {
    cards.push(drawCard());
  }
  return cards;
}
