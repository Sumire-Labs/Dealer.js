import type {Card} from './blackjack.deck.js';

export interface HandValue {
  values: number[];  // all possible values (accounting for soft aces)
  best: number;      // best non-bust value, or lowest if all bust
  isSoft: boolean;   // has a counted-as-11 ace
  isBust: boolean;
  isBlackjack: boolean;
}

function cardNumericValue(card: Card): number {
  if (card.rank === 'A') return 11;
  if (['J', 'Q', 'K'].includes(card.rank)) return 10;
  return parseInt(card.rank);
}

export function evaluateHand(cards: Card[]): HandValue {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    if (card.rank === 'A') {
      aces++;
      total += 11;
    } else {
      total += cardNumericValue(card);
    }
  }

  // Downgrade aces from 11 to 1 as needed
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  const isBust = total > 21;
  const isSoft = aces > 0 && !isBust; // at least one ace still counted as 11
  const isBlackjack = cards.length === 2 && total === 21;

  return { values: [total], best: total, isSoft, isBust, isBlackjack };
}

export function canSplit(cards: Card[]): boolean {
  if (cards.length !== 2) return false;
  return cardNumericValue(cards[0]) === cardNumericValue(cards[1]);
}

export function canDoubleDown(cards: Card[]): boolean {
  if (cards.length !== 2) return false;
  const value = evaluateHand(cards);
  // Cannot double down on blackjack
  return !value.isBlackjack;
}
