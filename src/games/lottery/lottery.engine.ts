import {secureRandomInt} from '../../utils/random.js';
import {LOTTERY_NUMBER_MAX, LOTTERY_NUMBER_MIN, LOTTERY_NUMBERS_COUNT,} from '../../config/constants.js';

export function drawWinningNumbers(): number[] {
    const numbers: number[] = [];
    for (let i = 0; i < LOTTERY_NUMBERS_COUNT; i++) {
        numbers.push(secureRandomInt(LOTTERY_NUMBER_MIN, LOTTERY_NUMBER_MAX));
    }
    return numbers;
}

/**
 * Count matching numbers between ticket and winning numbers.
 * Uses multiset comparison (order doesn't matter, duplicates count).
 *
 * Example: ticket=[3,3,7] vs winning=[3,7,5] → 2 matches
 */
export function countMatches(ticketNumbers: number[], winningNumbers: number[]): number {
    const remaining = [...winningNumbers];
    let matches = 0;

    for (const num of ticketNumbers) {
        const idx = remaining.indexOf(num);
        if (idx !== -1) {
            remaining.splice(idx, 1);
            matches++;
        }
    }

    return matches;
}

export interface LotteryPayoutResult {
    threeMatchUsers: Map<string, bigint>;
    twoMatchUsers: Map<string, bigint>;
    oneMatchUsers: Map<string, bigint>;
    nextRoundCarryover: bigint;
}

export function calculateLotteryPayouts(
    tickets: { userId: string; numbers: number[] }[],
    winningNumbers: number[],
    jackpot: bigint,
    payoutRate3: bigint,
    payoutRate2: bigint,
    ticketPrice: bigint,
): LotteryPayoutResult {
    const threeMatchUsers = new Map<string, bigint>();
    const twoMatchUsers = new Map<string, bigint>();
    const oneMatchUsers = new Map<string, bigint>();

    // Categorize tickets by match count
    for (const ticket of tickets) {
        const matches = countMatches(ticket.numbers, winningNumbers);

        if (matches === 3) {
            const prev = threeMatchUsers.get(ticket.userId) ?? 0n;
            threeMatchUsers.set(ticket.userId, prev + 1n);
        } else if (matches === 2) {
            const prev = twoMatchUsers.get(ticket.userId) ?? 0n;
            twoMatchUsers.set(ticket.userId, prev + 1n);
        } else if (matches === 1) {
            const prev = oneMatchUsers.get(ticket.userId) ?? 0n;
            oneMatchUsers.set(ticket.userId, prev + 1n);
        }
    }

    // Calculate pool allocations
    const threeMatchPool = (jackpot * payoutRate3) / 100n;
    const twoMatchPool = (jackpot * payoutRate2) / 100n;

    // Calculate total ticket counts for each tier
    let totalThreeMatchTickets = 0n;
    for (const count of threeMatchUsers.values()) totalThreeMatchTickets += count;

    let totalTwoMatchTickets = 0n;
    for (const count of twoMatchUsers.values()) totalTwoMatchTickets += count;

    // Distribute payouts
    const threePayouts = new Map<string, bigint>();
    if (totalThreeMatchTickets > 0n) {
        const perTicket = threeMatchPool / totalThreeMatchTickets;
        for (const [userId, count] of threeMatchUsers) {
            threePayouts.set(userId, perTicket * count);
        }
    }

    const twoPayouts = new Map<string, bigint>();
    if (totalTwoMatchTickets > 0n) {
        const perTicket = twoMatchPool / totalTwoMatchTickets;
        for (const [userId, count] of twoMatchUsers) {
            twoPayouts.set(userId, perTicket * count);
        }
    }

    // 1-match: ticket price refund per ticket
    const onePayouts = new Map<string, bigint>();
    for (const [userId, count] of oneMatchUsers) {
        onePayouts.set(userId, ticketPrice * count);
    }

    // Calculate carryover: what wasn't paid out from the jackpot
    let totalPaidFromPot = 0n;
    for (const amount of threePayouts.values()) totalPaidFromPot += amount;
    for (const amount of twoPayouts.values()) totalPaidFromPot += amount;

    const nextRoundCarryover = jackpot - totalPaidFromPot;

    return {
        threeMatchUsers: threePayouts,
        twoMatchUsers: twoPayouts,
        oneMatchUsers: onePayouts,
        nextRoundCarryover: nextRoundCarryover > 0n ? nextRoundCarryover : 0n,
    };
}
