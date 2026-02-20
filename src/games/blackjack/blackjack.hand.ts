import type { Card } from './blackjack.deck.js';

export interface HandValue {
  values: number[];  // all possible values (accounting for soft aces)
  best: number;      // best non-bust value, or lowest if all bust
  isSoft: boolean;   // has a counted-as-11 ace
  isBust: boolean;
  isBlackjack: boolean;
}

function cardValue(card: Card): number[] {
  switch (card.rank) {
    case 'A': return [1, 11];
    case 'J': case 'Q': case 'K': return [10];
    default: return [parseInt(card.rank)];
  }
}

export function evaluateHand(cards: Card[]): HandValue {
  let totals = [0];

  for (const card of cards) {
    const values = cardValue(card);
    const newTotals: number[] = [];
    for (const total of totals) {
      for (const v of values) {
        newTotals.push(total + v);
      }
    }
    // Deduplicate
    totals = [...new Set(newTotals)];
  }

  const nonBust = totals.filter(t => t <= 21);
  const best = nonBust.length > 0 ? Math.max(...nonBust) : Math.min(...totals);
  const isBust = nonBust.length === 0;
  const isBlackjack = cards.length === 2 && best === 21;
  const isSoft = !isBust && totals.some(t => t <= 21) && cards.some(c => c.rank === 'A') && best !== totals.filter(t => t <= 21).reduce((min, t) => Math.min(min, t), 22);

  return { values: totals, best, isSoft, isBust, isBlackjack };
}

export function canSplit(cards: Card[]): boolean {
  if (cards.length !== 2) return false;
  const v1 = cards[0].rank === 'A' ? 11 : (cards[0].rank === 'J' || cards[0].rank === 'Q' || cards[0].rank === 'K' ? 10 : parseInt(cards[0].rank));
  const v2 = cards[1].rank === 'A' ? 11 : (cards[1].rank === 'J' || cards[1].rank === 'Q' || cards[1].rank === 'K' ? 10 : parseInt(cards[1].rank));
  return v1 === v2;
}

export function canDoubleDown(cards: Card[]): boolean {
  return cards.length === 2;
}
