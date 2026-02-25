import type {Horse} from './race.horses.js';

export interface RaceBetEntry {
  userId: string;
  horseIndex: number;
  amount: bigint;
}

export interface PayoutEntry {
  userId: string;
  betAmount: bigint;
  payout: bigint;
  horseIndex: number;
}

export function calculatePayouts(
  bets: RaceBetEntry[],
  winnerIndex: number,
  horses: Horse[],
): PayoutEntry[] {
  const winner = horses[winnerIndex];
  const payouts: PayoutEntry[] = [];

  for (const bet of bets) {
    if (bet.horseIndex === winnerIndex) {
      // Use integer math to preserve BigInt precision
      const oddsInt = Math.round(winner.odds * 1_000_000);
      const payout = (bet.amount * BigInt(oddsInt)) / 1_000_000n;
      payouts.push({
        userId: bet.userId,
        betAmount: bet.amount,
        payout,
        horseIndex: bet.horseIndex,
      });
    }
  }

  return payouts;
}

export function getTotalPool(bets: RaceBetEntry[]): bigint {
  return bets.reduce((sum, b) => sum + b.amount, 0n);
}
