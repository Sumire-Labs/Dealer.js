import { prisma } from '../client.js';
import { findOrCreateUser } from '../repositories/user.repository.js';
import {
  LOAN_MAX_TOTAL,
  LOAN_INTEREST_RATE,
  LOAN_INTEREST_PERIOD_MS,
  BANKRUPTCY_CHIPS,
  BANKRUPTCY_PENALTY_DURATION_MS,
  BANKRUPTCY_PENALTY_RATE,
} from '../../config/constants.js';
import { checkAchievements } from './achievement.service.js';
import type { AchievementDefinition } from '../../config/achievements.js';
import { hasInventoryItem, consumeInventoryItem } from './shop.service.js';
import { SHOP_EFFECTS } from '../../config/shop.js';

export function calculateLoanInterest(loan: { principal: bigint; createdAt: Date }): bigint {
  const elapsedMs = BigInt(Date.now() - loan.createdAt.getTime());
  const periodMs = BigInt(LOAN_INTEREST_PERIOD_MS);
  return (loan.principal * LOAN_INTEREST_RATE * elapsedMs) / (100n * periodMs);
}

export interface LoanSummary {
  loanCount: number;
  totalPrincipal: bigint;
  totalInterest: bigint;
  totalOwed: bigint;
  remainingCapacity: bigint;
}

export async function getLoanSummary(userId: string): Promise<LoanSummary> {
  const loans = await prisma.loan.findMany({
    where: { userId, paidAt: null },
    orderBy: { createdAt: 'asc' },
  });

  let totalPrincipal = 0n;
  let totalInterest = 0n;
  for (const loan of loans) {
    totalPrincipal += loan.principal;
    totalInterest += calculateLoanInterest(loan);
  }

  const totalOwed = totalPrincipal + totalInterest;
  const remaining = LOAN_MAX_TOTAL - totalPrincipal;
  const remainingCapacity = remaining > 0n ? remaining : 0n;

  return {
    loanCount: loans.length,
    totalPrincipal,
    totalInterest,
    totalOwed,
    remainingCapacity,
  };
}

export async function borrowChips(userId: string, amount: bigint): Promise<{ newBalance: bigint; newlyUnlocked: AchievementDefinition[] }> {
  return prisma.$transaction(async (tx) => {
    await findOrCreateUser(userId);

    // Check outstanding principal against cap
    const loans = await tx.loan.findMany({
      where: { userId, paidAt: null },
    });
    const currentPrincipal = loans.reduce((sum, l) => sum + l.principal, 0n);
    if (currentPrincipal + amount > LOAN_MAX_TOTAL) {
      throw new Error('LOAN_LIMIT_EXCEEDED');
    }

    // Create loan record
    await tx.loan.create({ data: { userId, principal: amount } });

    // Add chips to user
    const user = await tx.user.update({
      where: { id: userId },
      data: { chips: { increment: amount } },
    });

    // Record transaction
    await tx.transaction.create({
      data: {
        userId,
        type: 'LOAN_BORROW',
        amount,
        balanceAfter: user.chips,
      },
    });

    // Achievement check
    let newlyUnlocked: AchievementDefinition[] = [];
    try {
      newlyUnlocked = await checkAchievements({
        userId,
        context: 'loan',
        newBalance: user.chips,
        metadata: { action: 'borrow' },
      });
    } catch {
      // Achievement check should never block borrow
    }

    return { newBalance: user.chips, newlyUnlocked };
  });
}

export async function repayChips(userId: string, amount: bigint): Promise<{ newBalance: bigint; repaid: bigint; newlyUnlocked: AchievementDefinition[] }> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.chips < amount) {
      throw new Error('INSUFFICIENT_CHIPS');
    }

    const loans = await tx.loan.findMany({
      where: { userId, paidAt: null },
      orderBy: { createdAt: 'asc' },
    });

    if (loans.length === 0) {
      throw new Error('NO_LOANS');
    }

    let remaining = amount;
    for (const loan of loans) {
      if (remaining <= 0n) break;

      const interest = calculateLoanInterest(loan);
      const loanTotal = loan.principal + interest;

      if (remaining >= loanTotal) {
        // Fully pay off this loan
        remaining -= loanTotal;
        await tx.loan.update({
          where: { id: loan.id },
          data: { paidAt: new Date() },
        });
      } else {
        // Partial payment: interest first, then principal
        if (remaining <= interest) {
          // Can only cover part of interest — reduce principal to reflect
          // Since we can't store partial interest, we reduce the principal
          // so that the loan's total value decreases by the payment amount.
          // New principal = (loanTotal - remaining) - recalculated_interest
          // Simpler approach: reduce principal by (payment - interest_covered)
          // Since interest is dynamic, we reduce principal proportionally
          const newPrincipal = loan.principal - (remaining > interest ? remaining - interest : 0n);
          await tx.loan.update({
            where: { id: loan.id },
            data: { principal: newPrincipal > 0n ? newPrincipal : 0n },
          });
        } else {
          // Covers all interest + part of principal
          const principalPayment = remaining - interest;
          const newPrincipal = loan.principal - principalPayment;
          if (newPrincipal <= 0n) {
            await tx.loan.update({
              where: { id: loan.id },
              data: { paidAt: new Date() },
            });
          } else {
            // Reset the loan with reduced principal and new createdAt
            // to zero out accrued interest (since we paid it)
            await tx.loan.update({
              where: { id: loan.id },
              data: { principal: newPrincipal, createdAt: new Date() },
            });
          }
        }
        remaining = 0n;
      }
    }

    const repaid = amount - remaining;

    // Deduct chips
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { chips: { decrement: repaid } },
    });

    // Record transaction
    await tx.transaction.create({
      data: {
        userId,
        type: 'LOAN_REPAY',
        amount: -repaid,
        balanceAfter: updatedUser.chips,
      },
    });

    // Achievement check
    let newlyUnlocked: AchievementDefinition[] = [];
    try {
      newlyUnlocked = await checkAchievements({
        userId,
        context: 'loan',
        newBalance: updatedUser.chips,
        metadata: { action: 'repay' },
      });
    } catch {
      // Achievement check should never block repay
    }

    return { newBalance: updatedUser.chips, repaid, newlyUnlocked };
  });
}

export async function declareBankruptcy(userId: string): Promise<{ newBalance: bigint; newlyUnlocked: AchievementDefinition[] }> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

    // Check has outstanding loans
    const loans = await tx.loan.findMany({
      where: { userId, paidAt: null },
    });
    if (loans.length === 0) {
      throw new Error('NO_LOANS');
    }

    // Mark all loans paid
    await tx.loan.updateMany({
      where: { userId, paidAt: null },
      data: { paidAt: new Date() },
    });

    // Check bankruptcy insurance
    let bankruptcyBonus = 0n;
    try {
      if (await hasInventoryItem(userId, 'BANKRUPTCY_INSURANCE')) {
        bankruptcyBonus = SHOP_EFFECTS.BANKRUPTCY_INSURANCE_BONUS;
        await consumeInventoryItem(userId, 'BANKRUPTCY_INSURANCE');
      }
    } catch {
      // Never block bankruptcy
    }

    // Set chips to bankruptcy amount (+ insurance bonus), clear bank balance
    const finalChips = BANKRUPTCY_CHIPS + bankruptcyBonus;
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        chips: finalChips,
        bankBalance: 0n,
        bankruptAt: new Date(),
      },
    });

    // Record transaction — net change
    const netChange = finalChips - user.chips;
    await tx.transaction.create({
      data: {
        userId,
        type: 'BANKRUPTCY',
        amount: netChange,
        balanceAfter: finalChips,
      },
    });

    // Achievement check
    let newlyUnlocked: AchievementDefinition[] = [];
    try {
      newlyUnlocked = await checkAchievements({
        userId,
        context: 'bankruptcy',
        newBalance: finalChips,
      });
    } catch {
      // Achievement check should never block bankruptcy
    }

    return { newBalance: updatedUser.chips, newlyUnlocked };
  });
}

export async function getBankruptcyPenaltyMultiplier(userId: string): Promise<number> {
  const user = await findOrCreateUser(userId);
  if (!user.bankruptAt) return 1.0;

  const elapsed = Date.now() - user.bankruptAt.getTime();
  if (elapsed >= BANKRUPTCY_PENALTY_DURATION_MS) return 1.0;

  return 1.0 - BANKRUPTCY_PENALTY_RATE / 100;
}

export function getBankruptcyPenaltyRemaining(bankruptAt: Date | null): number {
  if (!bankruptAt) return 0;
  const elapsed = Date.now() - bankruptAt.getTime();
  const remaining = BANKRUPTCY_PENALTY_DURATION_MS - elapsed;
  return remaining > 0 ? remaining : 0;
}

export function applyPenalty(payout: bigint, multiplier: number): bigint {
  if (multiplier >= 1.0) return payout;
  const multiplierInt = Math.round(multiplier * 1_000_000);
  return (payout * BigInt(multiplierInt)) / 1_000_000n;
}
