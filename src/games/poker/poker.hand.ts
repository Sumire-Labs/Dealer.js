import type { Card } from './poker.deck.js';

export enum HandRank {
  HighCard = 0,
  OnePair = 1,
  TwoPair = 2,
  ThreeOfAKind = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  FourOfAKind = 7,
  StraightFlush = 8,
  RoyalFlush = 9,
}

const HAND_NAMES: Record<HandRank, string> = {
  [HandRank.HighCard]: 'ハイカード',
  [HandRank.OnePair]: 'ワンペア',
  [HandRank.TwoPair]: 'ツーペア',
  [HandRank.ThreeOfAKind]: 'スリーカード',
  [HandRank.Straight]: 'ストレート',
  [HandRank.Flush]: 'フラッシュ',
  [HandRank.FullHouse]: 'フルハウス',
  [HandRank.FourOfAKind]: 'フォーカード',
  [HandRank.StraightFlush]: 'ストレートフラッシュ',
  [HandRank.RoyalFlush]: 'ロイヤルフラッシュ',
};

export interface HandResult {
  rank: HandRank;
  score: number;
  name: string;
  bestCards: Card[];
}

const RANK_VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

function rankValue(card: Card): number {
  return RANK_VALUES[card.rank];
}

function combinations(cards: Card[], k: number): Card[][] {
  const result: Card[][] = [];
  function combine(start: number, current: Card[]): void {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < cards.length; i++) {
      current.push(cards[i]);
      combine(i + 1, current);
      current.pop();
    }
  }
  combine(0, []);
  return result;
}

/** Compute a score for tiebreaking: rank * 10^10 + kickers encoded */
function computeScore(handRank: HandRank, kickers: number[]): number {
  let score = handRank * 1e10;
  for (let i = 0; i < kickers.length && i < 5; i++) {
    score += kickers[i] * Math.pow(100, 4 - i);
  }
  return score;
}

function evaluate5(cards: Card[]): HandResult {
  const values = cards.map(rankValue).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);

  // Check straight (including A-low: A,2,3,4,5)
  let isStraight = false;
  let straightHigh = 0;

  // Normal straight check
  if (values[0] - values[4] === 4 && new Set(values).size === 5) {
    isStraight = true;
    straightHigh = values[0];
  }
  // Ace-low straight: A,5,4,3,2 → values sorted: [14,5,4,3,2]
  if (!isStraight && values[0] === 14 && values[1] === 5 && values[2] === 4 && values[3] === 3 && values[4] === 2) {
    isStraight = true;
    straightHigh = 5; // 5-high straight
  }

  // Count occurrences
  const counts = new Map<number, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  // Determine hand rank
  if (isFlush && isStraight) {
    if (straightHigh === 14) {
      return { rank: HandRank.RoyalFlush, score: computeScore(HandRank.RoyalFlush, [14]), name: HAND_NAMES[HandRank.RoyalFlush], bestCards: cards };
    }
    return { rank: HandRank.StraightFlush, score: computeScore(HandRank.StraightFlush, [straightHigh]), name: HAND_NAMES[HandRank.StraightFlush], bestCards: cards };
  }

  if (groups[0][1] === 4) {
    const quad = groups[0][0];
    const kicker = groups[1][0];
    return { rank: HandRank.FourOfAKind, score: computeScore(HandRank.FourOfAKind, [quad, kicker]), name: HAND_NAMES[HandRank.FourOfAKind], bestCards: cards };
  }

  if (groups[0][1] === 3 && groups[1][1] === 2) {
    const trips = groups[0][0];
    const pair = groups[1][0];
    return { rank: HandRank.FullHouse, score: computeScore(HandRank.FullHouse, [trips, pair]), name: HAND_NAMES[HandRank.FullHouse], bestCards: cards };
  }

  if (isFlush) {
    return { rank: HandRank.Flush, score: computeScore(HandRank.Flush, values), name: HAND_NAMES[HandRank.Flush], bestCards: cards };
  }

  if (isStraight) {
    return { rank: HandRank.Straight, score: computeScore(HandRank.Straight, [straightHigh]), name: HAND_NAMES[HandRank.Straight], bestCards: cards };
  }

  if (groups[0][1] === 3) {
    const trips = groups[0][0];
    const kickers = groups.slice(1).map(g => g[0]);
    return { rank: HandRank.ThreeOfAKind, score: computeScore(HandRank.ThreeOfAKind, [trips, ...kickers]), name: HAND_NAMES[HandRank.ThreeOfAKind], bestCards: cards };
  }

  if (groups[0][1] === 2 && groups[1][1] === 2) {
    const highPair = Math.max(groups[0][0], groups[1][0]);
    const lowPair = Math.min(groups[0][0], groups[1][0]);
    const kicker = groups[2][0];
    return { rank: HandRank.TwoPair, score: computeScore(HandRank.TwoPair, [highPair, lowPair, kicker]), name: HAND_NAMES[HandRank.TwoPair], bestCards: cards };
  }

  if (groups[0][1] === 2) {
    const pair = groups[0][0];
    const kickers = groups.slice(1).map(g => g[0]);
    return { rank: HandRank.OnePair, score: computeScore(HandRank.OnePair, [pair, ...kickers]), name: HAND_NAMES[HandRank.OnePair], bestCards: cards };
  }

  return { rank: HandRank.HighCard, score: computeScore(HandRank.HighCard, values), name: HAND_NAMES[HandRank.HighCard], bestCards: cards };
}

/** Evaluate 7 cards and return the best 5-card hand (C(7,5)=21 combinations) */
export function evaluateBestHand(cards: Card[]): HandResult {
  const combos = combinations(cards, 5);
  let best: HandResult | null = null;

  for (const combo of combos) {
    const result = evaluate5(combo);
    if (!best || result.score > best.score) {
      best = result;
    }
  }

  return best!;
}
