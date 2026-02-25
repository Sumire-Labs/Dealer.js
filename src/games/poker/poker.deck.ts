import {type Card, cardToString, type Rank, RANKS, type Suit, SUITS} from '../blackjack/blackjack.deck.js';
import {shuffleArray} from '../../utils/random.js';

export {type Card, type Suit, type Rank, cardToString};

const SUIT_EMOJI: Record<Suit, string> = {
    spades: '♠',
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
};

export function createDeck(): Card[] {
    const deck: Card[] = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({suit, rank});
        }
    }
    return shuffleArray(deck);
}

export function formatCard(card: Card): string {
    return `[${card.rank}${SUIT_EMOJI[card.suit]}]`;
}

export function formatHidden(): string {
    return '[ ? ]';
}
