import type {ChinchiroTableSession, ChinchiroTablePlayer} from './chinchiro-table.session.js';
import {type ChinchiroHand, compareHands, evaluateRoll, rollDice} from './chinchiro.engine.js';

// ─── Round initialization ───────────────────────────────

export function initializeRound(session: ChinchiroTableSession): void {
    // Reset all players for new round
    for (const p of session.players) {
        p.currentHand = null;
        p.rollHistory = [];
        p.rollsRemaining = 3;
        p.done = false;
    }
    session.phase = 'banker_roll';
    session.currentPlayerIndex = session.bankerIndex;
}

// ─── Rolling ────────────────────────────────────────────

export function performRoll(player: ChinchiroTablePlayer): ChinchiroHand {
    const dice = rollDice();
    const hand = evaluateRoll(dice);
    player.rollHistory.push(hand);
    player.rollsRemaining--;

    if (hand.rank === 'menashi' && player.rollsRemaining > 0) {
        // Can reroll — don't finalize
        player.currentHand = null;
    } else {
        // Final result (either a valid hand or last menashi)
        player.currentHand = hand;
        player.done = true;
    }

    return hand;
}

// ─── Turn advancement ───────────────────────────────────

export function findNextNonBankerPlayer(
    session: ChinchiroTableSession,
    fromIndex: number,
): number {
    for (let i = 1; i < session.players.length; i++) {
        const idx = (fromIndex + i) % session.players.length;
        if (idx !== session.bankerIndex && !session.players[idx].done) {
            return idx;
        }
    }
    return -1;
}

export function advanceToNextPlayer(session: ChinchiroTableSession): boolean {
    const next = findNextNonBankerPlayer(session, session.currentPlayerIndex);
    if (next === -1) {
        // All players done
        return true;
    }
    session.currentPlayerIndex = next;
    return false;
}

// ─── Round resolution ───────────────────────────────────

export interface PlayerRoundResult {
    userId: string;
    outcome: 'win' | 'lose' | 'draw';
    multiplier: number;       // effective multiplier for chip calc
    hand: ChinchiroHand | null;
}

export function resolveRound(session: ChinchiroTableSession): PlayerRoundResult[] {
    const banker = session.players[session.bankerIndex];
    const bankerHand = banker.currentHand;
    const results: PlayerRoundResult[] = [];

    for (const player of session.players) {
        if (player.userId === banker.userId) continue;

        const playerHand = player.currentHand;

        // Banker menashi = auto-lose (all players win with their multiplier)
        if (!bankerHand || bankerHand.rank === 'menashi') {
            if (!playerHand || playerHand.rank === 'menashi') {
                results.push({ userId: player.userId, outcome: 'draw', multiplier: 1, hand: playerHand });
            } else if (playerHand.rank === 'hifumi') {
                // Player hifumi vs banker menashi — player still auto-loses
                results.push({ userId: player.userId, outcome: 'lose', multiplier: 2, hand: playerHand });
            } else {
                results.push({ userId: player.userId, outcome: 'win', multiplier: playerHand.multiplier, hand: playerHand });
            }
            continue;
        }

        // Banker hifumi = all players auto-win 2x
        if (bankerHand.rank === 'hifumi') {
            if (!playerHand || playerHand.rank === 'menashi') {
                // Player menashi vs banker hifumi — player wins 1x (return bet)
                results.push({ userId: player.userId, outcome: 'win', multiplier: 1, hand: playerHand });
            } else {
                results.push({ userId: player.userId, outcome: 'win', multiplier: 2, hand: playerHand });
            }
            continue;
        }

        // Player menashi = auto-lose
        if (!playerHand || playerHand.rank === 'menashi') {
            results.push({ userId: player.userId, outcome: 'lose', multiplier: 1, hand: playerHand });
            continue;
        }

        // Player hifumi = auto-lose 2x
        if (playerHand.rank === 'hifumi') {
            results.push({ userId: player.userId, outcome: 'lose', multiplier: 2, hand: playerHand });
            continue;
        }

        // Normal comparison
        const cmp = compareHands(playerHand, bankerHand);
        if (cmp > 0) {
            results.push({ userId: player.userId, outcome: 'win', multiplier: playerHand.multiplier, hand: playerHand });
        } else if (cmp < 0) {
            results.push({ userId: player.userId, outcome: 'lose', multiplier: 1, hand: playerHand });
        } else {
            results.push({ userId: player.userId, outcome: 'draw', multiplier: 1, hand: playerHand });
        }
    }

    return results;
}

// ─── Banker rotation ────────────────────────────────────

export function rotateBanker(session: ChinchiroTableSession): boolean {
    session.completedRotations++;
    if (session.completedRotations >= session.players.length) {
        return true; // All players have been banker
    }
    session.bankerIndex = (session.bankerIndex + 1) % session.players.length;
    return false;
}
