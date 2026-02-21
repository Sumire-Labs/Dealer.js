import { shuffleArray } from '../../utils/random.js';
import { BLACKJACK_CONFIG } from '../../config/games.js';

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  suit: Suit;
  rank: Rank;
}

export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
export const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

export function cardToString(card: Card): string {
  return `${card.rank}${SUIT_SYMBOLS[card.suit]}`;
}

export function createShoe(): Card[] {
  const shoe: Card[] = [];
  for (let d = 0; d < BLACKJACK_CONFIG.deckCount; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        shoe.push({ suit, rank });
      }
    }
  }
  return shuffleArray(shoe);
}

export class Shoe {
  private cards: Card[];

  constructor() {
    this.cards = createShoe();
  }

  draw(): Card {
    if (this.cards.length === 0) {
      this.cards = createShoe();
    }
    return this.cards.pop()!;
  }

  get remaining(): number {
    return this.cards.length;
  }
}
