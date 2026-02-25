import {prisma} from '../client.js';
import {findOrCreateUser} from '../repositories/user.repository.js';
import {LOAN_INTEREST_PERIOD_MS,} from '../../config/constants.js';
import {configService} from '../../config/config.service.js';
import {S} from '../../config/setting-defs.js';
import {checkAchievements} from './achievement.service.js';
import type {AchievementDefinition} from '../../config/achievements.js';
import {consumeInventoryItem, hasActiveBuff, hasInventoryItem} from './shop.service.js';
import {SHOP_EFFECTS} from '../../config/shop.js';

export function calculateLoanInterest(loan: { principal: bigint; createdAt: Date }): bigint {
  const elapsedMs = BigInt(Date.now() - loan.createdAt.getTime());
  const periodMs = BigInt(LOAN_INTEREST_PERIOD_MS);
  return (loan.principal * configService.getBigInt(S.loanInterestRate) * elapsedMs) / (100n * periodMs);
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

  // LOAN_DISCOUNT buff: halve interest
  try {
    if (await hasActiveBuff(userId, 'LOAN_DISCOUNT')) {
      totalInterest = BigInt(Math.round(Number(totalInterest) * SHOP_EFFECTS.LOAN_DISCOUNT_RATE));
    }
  } catch {
    // Buff check should never block loan summary
  }

  const totalOwed = totalPrincipal + totalInterest;
  const remaining = configService.getBigInt(S.loanMaxTotal) - totalPrincipal;
  const remainingCapacity = remaining > 0n ? remaining : 0n;

  return {
    loanCount: loans.length,
    totalPrincipal,
    totalInterest,
    totalOwed,
    remainingCapacity,
  };
}

export interface IndividualLoanDetail {
  id: string;
  principal: bigint;
  interest: bigint;
  total: bigint;
  createdAt: Date;
  elapsedMs: number;
}

export async function getLoanDetails(userId: string): Promise<IndividualLoanDetail[]> {
  const loans = await prisma.loan.findMany({
    where: { userId, paidAt: null },
    orderBy: { createdAt: 'asc' },
  });

  let loanDiscountActive = false;
  try {
    loanDiscountActive = await hasActiveBuff(userId, 'LOAN_DISCOUNT');
  } catch { /* never block */ }

  return loans.map((loan) => {
    let interest = calculateLoanInterest(loan);
    if (loanDiscountActive) {
      interest = BigInt(Math.round(Number(interest) * SHOP_EFFECTS.LOAN_DISCOUNT_RATE));
    }
    return {
      id: loan.id,
      principal: loan.principal,
      interest,
      total: loan.principal + interest,
      createdAt: loan.createdAt,
      elapsedMs: Date.now() - loan.createdAt.getTime(),
    };
  });
}

export async function borrowChips(userId: string, amount: bigint): Promise<{ newBalance: bigint; newlyUnlocked: AchievementDefinition[] }> {
  return prisma.$transaction(async (tx) => {
    await findOrCreateUser(userId);

    // Check outstanding principal against cap
    const loans = await tx.loan.findMany({
      where: { userId, paidAt: null },
    });
    const currentPrincipal = loans.reduce((sum, l) => sum + l.principal, 0n);
    if (currentPrincipal + amount > configService.getBigInt(S.loanMaxTotal)) {
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

    // Check LOAN_DISCOUNT buff once before the loop
    let loanDiscountActive = false;
    try {
      loanDiscountActive = await hasActiveBuff(userId, 'LOAN_DISCOUNT');
    } catch {
      // Buff check should never block repay
    }

    let remaining = amount;
    for (const loan of loans) {
      if (remaining <= 0n) break;

      let interest = calculateLoanInterest(loan);
      // LOAN_DISCOUNT buff: halve interest
      if (loanDiscountActive) {
        interest = BigInt(Math.round(Number(interest) * SHOP_EFFECTS.LOAN_DISCOUNT_RATE));
      }
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
          // Payment covers only part of (or exactly) the interest.
          // Since interest is dynamically calculated and can't be stored,
          // set new principal = loanTotal - remaining and reset createdAt
          // so accrued interest resets to 0. This ensures the loan's real
          // value (principal + interest) decreases by exactly `remaining`.
          const newPrincipal = loanTotal - remaining;
          if (newPrincipal <= 0n) {
            await tx.loan.update({
              where: { id: loan.id },
              data: { paidAt: new Date() },
            });
          } else {
            await tx.loan.update({
              where: { id: loan.id },
              data: { principal: newPrincipal, createdAt: new Date() },
            });
          }
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
    const finalChips = configService.getBigInt(S.bankruptcyChips) + bankruptcyBonus;
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
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { bankruptAt: true },
  });
  if (!user?.bankruptAt) return 1.0;

  const elapsed = Date.now() - user.bankruptAt.getTime();
  if (elapsed >= configService.getNumber(S.bankruptcyPenaltyDuration)) return 1.0;

  return 1.0 - configService.getNumber(S.bankruptcyPenaltyRate) / 100;
}

export function getBankruptcyPenaltyRemaining(bankruptAt: Date | null): number {
  if (!bankruptAt) return 0;
  const elapsed = Date.now() - bankruptAt.getTime();
  const remaining = configService.getNumber(S.bankruptcyPenaltyDuration) - elapsed;
  return remaining > 0 ? remaining : 0;
}

export function applyPenalty(payout: bigint, multiplier: number): bigint {
  if (multiplier >= 1.0) return payout;
  const multiplierInt = Math.round(multiplier * 1_000_000);
  return (payout * BigInt(multiplierInt)) / 1_000_000n;
}
