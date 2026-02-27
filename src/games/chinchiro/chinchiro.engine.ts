import {secureRandomInt} from '../../utils/random.js';
import {CHINCHIRO_CONFIG} from '../../config/games.js';

// ─── Types ──────────────────────────────────────────────

export type ChinchiroHandRank = 'pinzoro' | 'trips' | 'shigoro' | 'point' | 'menashi' | 'hifumi';

export interface ChinchiroHand {
    dice: [number, number, number];
    rank: ChinchiroHandRank;
    pointValue: number;       // 1-6 for 'point', 0 otherwise
    multiplier: number;       // from CHINCHIRO_CONFIG.payouts
    displayName: string;
}

export interface ChinchiroSoloResult {
    outcome: 'win' | 'lose' | 'draw';
    effectiveMultiplier: number;
}

// ─── Dice Unicode ───────────────────────────────────────

const DICE_FACES: Record<number, string> = {
    1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅',
};

export function diceToEmoji(value: number): string {
    return DICE_FACES[value] ?? '?';
}

export function formatDice(dice: [number, number, number]): string {
    return dice.map(d => `【 ${diceToEmoji(d)} 】`).join('');
}

// ─── Core Logic ─────────────────────────────────────────

export function rollDice(): [number, number, number] {
    return [secureRandomInt(1, 6), secureRandomInt(1, 6), secureRandomInt(1, 6)];
}

export function evaluateRoll(dice: [number, number, number]): ChinchiroHand {
    const sorted = [...dice].sort((a, b) => a - b) as [number, number, number];
    const [a, b, c] = sorted;
    const payouts = CHINCHIRO_CONFIG.payouts;

    // Hifumi (1-2-3) — auto-lose
    if (a === 1 && b === 2 && c === 3) {
        return { dice, rank: 'hifumi', pointValue: 0, multiplier: payouts.hifumi, displayName: 'ヒフミ (1-2-3)' };
    }

    // Shigoro (4-5-6) — auto-win
    if (a === 4 && b === 5 && c === 6) {
        return { dice, rank: 'shigoro', pointValue: 0, multiplier: payouts.shigoro, displayName: 'シゴロ (4-5-6)' };
    }

    // Pinzoro (1-1-1) — strongest
    if (a === 1 && b === 1 && c === 1) {
        return { dice, rank: 'pinzoro', pointValue: 0, multiplier: payouts.pinzoro, displayName: 'ピンゾロ (1-1-1)' };
    }

    // Trips (2-2-2 ~ 6-6-6)
    if (a === b && b === c) {
        return { dice, rank: 'trips', pointValue: a, multiplier: payouts.trips, displayName: `ゾロ目 (${a}-${a}-${a})` };
    }

    // Point — pair + one different
    if (a === b) {
        return { dice, rank: 'point', pointValue: c, multiplier: payouts.point, displayName: `出目 ${c}` };
    }
    if (b === c) {
        return { dice, rank: 'point', pointValue: a, multiplier: payouts.point, displayName: `出目 ${a}` };
    }
    if (a === c) {
        return { dice, rank: 'point', pointValue: b, multiplier: payouts.point, displayName: `出目 ${b}` };
    }

    // Menashi — no matching pair
    return { dice, rank: 'menashi', pointValue: 0, multiplier: payouts.menashi, displayName: '目なし' };
}

// Rank ordering for comparison (higher = stronger)
const RANK_ORDER: Record<ChinchiroHandRank, number> = {
    hifumi: 0,
    menashi: 1,
    point: 2,
    shigoro: 3,
    trips: 4,
    pinzoro: 5,
};

export function compareHands(hand1: ChinchiroHand, hand2: ChinchiroHand): number {
    const r1 = RANK_ORDER[hand1.rank];
    const r2 = RANK_ORDER[hand2.rank];
    if (r1 !== r2) return r1 - r2;

    // Same rank — compare within rank
    if (hand1.rank === 'point' && hand2.rank === 'point') {
        return hand1.pointValue - hand2.pointValue;
    }
    if (hand1.rank === 'trips' && hand2.rank === 'trips') {
        return hand1.pointValue - hand2.pointValue;
    }

    return 0; // draw
}

export function resolveSoloGame(
    dealerHand: ChinchiroHand,
    playerHand: ChinchiroHand,
): ChinchiroSoloResult {
    // Special cases: menashi always loses
    if (playerHand.rank === 'menashi') {
        return { outcome: 'lose', effectiveMultiplier: 0 };
    }
    if (dealerHand.rank === 'menashi') {
        // Dealer menashi = player auto-wins with their multiplier
        // +1 because processGameResult treats multiplier as total payout (including bet return)
        return { outcome: 'win', effectiveMultiplier: playerHand.multiplier + 1 };
    }

    // Hifumi (player) = auto-lose with -1 multiplier
    if (playerHand.rank === 'hifumi') {
        return { outcome: 'lose', effectiveMultiplier: playerHand.multiplier };
    }
    // Hifumi (dealer) = player auto-wins with 2x profit (3x total payout)
    if (dealerHand.rank === 'hifumi') {
        return { outcome: 'win', effectiveMultiplier: 3 };
    }

    const cmp = compareHands(playerHand, dealerHand);
    if (cmp > 0) {
        return { outcome: 'win', effectiveMultiplier: playerHand.multiplier + 1 };
    }
    if (cmp < 0) {
        return { outcome: 'lose', effectiveMultiplier: 0 };
    }
    return { outcome: 'draw', effectiveMultiplier: 1 }; // return bet
}
