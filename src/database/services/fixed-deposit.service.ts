import {prisma} from '../client.js';
import {
    getActiveDepositCount,
    getActiveDeposits,
    getMatureDeposits,
} from '../repositories/fixed-deposit.repository.js';
import {configService} from '../../config/config.service.js';
import {S} from '../../config/setting-defs.js';
import {logger} from '../../utils/logger.js';

export interface FixedDepositInfo {
  id: string;
  amount: bigint;
  termDays: number;
  interestRate: bigint;
  depositedAt: Date;
  maturesAt: Date;
  remainingMs: number;
  expectedPayout: bigint;
}

export interface TermOption {
  termDays: number;
  multiplier: number;
  label: string;
}

export function getTermOptions(): TermOption[] {
  return [
    { termDays: 7, multiplier: configService.getNumber(S.fixedDeposit7dMultiplier), label: '7日' },
    { termDays: 30, multiplier: configService.getNumber(S.fixedDeposit30dMultiplier), label: '30日' },
  ];
}

export async function getFixedDepositsForDisplay(userId: string): Promise<FixedDepositInfo[]> {
  const deposits = await getActiveDeposits(userId);
  return deposits.map((d) => {
    const remainingMs = d.maturesAt.getTime() - Date.now();
    return {
      id: d.id,
      amount: d.amount,
      termDays: d.termDays,
      interestRate: d.interestRate,
      depositedAt: d.depositedAt,
      maturesAt: d.maturesAt,
      remainingMs: remainingMs > 0 ? remainingMs : 0,
      expectedPayout: d.amount * d.interestRate,
    };
  });
}

export async function createFixedDeposit(
  userId: string,
  amount: bigint,
  termDays: number,
): Promise<{ deposit: FixedDepositInfo }> {
  const minAmount = configService.getBigInt(S.fixedDepositMinAmount);
  if (amount < minAmount) {
    throw new Error('BELOW_MINIMUM');
  }

  const termOption = getTermOptions().find((t) => t.termDays === termDays);
  if (!termOption) {
    throw new Error('INVALID_TERM');
  }

  const interestRate = BigInt(termOption.multiplier);
  const maturesAt = new Date(Date.now() + termDays * 24 * 60 * 60 * 1000);

  return prisma.$transaction(async (tx) => {
    // Slot check inside tx to prevent race condition
    const maxSlots = configService.getNumber(S.fixedDepositMaxSlots);
    const activeCount = await getActiveDepositCount(userId, tx);
    if (activeCount >= maxSlots) {
      throw new Error('MAX_SLOTS_REACHED');
    }

    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

    if (user.bankBalance < amount) {
      throw new Error('INSUFFICIENT_BANK_BALANCE');
    }

    // Deduct from bank balance
    await tx.user.update({
      where: { id: userId },
      data: { bankBalance: { decrement: amount } },
    });

    // Record transaction
    await tx.transaction.create({
      data: {
        userId,
        type: 'FIXED_DEPOSIT_CREATE',
        amount: -amount,
        balanceAfter: user.bankBalance - amount,
        metadata: { termDays, multiplier: termOption.multiplier },
      },
    });

    // Create deposit record (outside tx since it uses a different model)
    const created = await tx.fixedDeposit.create({
      data: {
        userId,
        amount,
        termDays,
        interestRate,
        maturesAt,
      },
    });

    const remainingMs = maturesAt.getTime() - Date.now();
    return {
      deposit: {
        id: created.id,
        amount: created.amount,
        termDays: created.termDays,
        interestRate: created.interestRate,
        depositedAt: created.depositedAt,
        maturesAt: created.maturesAt,
        remainingMs: remainingMs > 0 ? remainingMs : 0,
        expectedPayout: created.amount * created.interestRate,
      },
    };
  });
}

export async function earlyWithdrawFixedDeposit(
  userId: string,
  depositId: string,
): Promise<{ returnedAmount: bigint }> {
  return prisma.$transaction(async (tx) => {
    const deposit = await tx.fixedDeposit.findUnique({ where: { id: depositId } });
    if (!deposit || deposit.userId !== userId || deposit.withdrawnAt) {
      throw new Error('DEPOSIT_NOT_FOUND');
    }

    // Early withdrawal: return principal only (no interest)
    await tx.fixedDeposit.update({
      where: { id: depositId },
      data: { withdrawnAt: new Date() },
    });

    const user = await tx.user.update({
      where: { id: userId },
      data: { bankBalance: { increment: deposit.amount } },
    });

    await tx.transaction.create({
      data: {
        userId,
        type: 'FIXED_DEPOSIT_EARLY_WITHDRAW',
        amount: deposit.amount,
        balanceAfter: user.bankBalance,
        metadata: { depositId, termDays: deposit.termDays, principalOnly: true },
      },
    });

    return { returnedAmount: deposit.amount };
  });
}

export async function matureFixedDeposit(depositId: string): Promise<{ userId: string; payout: bigint }> {
  return prisma.$transaction(async (tx) => {
    const deposit = await tx.fixedDeposit.findUnique({ where: { id: depositId } });
    if (!deposit || deposit.withdrawnAt) {
      throw new Error('DEPOSIT_NOT_FOUND');
    }

    const payout = deposit.amount * deposit.interestRate;

    await tx.fixedDeposit.update({
      where: { id: depositId },
      data: { withdrawnAt: new Date() },
    });

    const user = await tx.user.update({
      where: { id: deposit.userId },
      data: { bankBalance: { increment: payout } },
    });

    await tx.transaction.create({
      data: {
        userId: deposit.userId,
        type: 'FIXED_DEPOSIT_MATURE',
        amount: payout,
        balanceAfter: user.bankBalance,
        metadata: {
          depositId,
          termDays: deposit.termDays,
          principal: deposit.amount.toString(),
          multiplier: Number(deposit.interestRate),
        },
      },
    });

    return { userId: deposit.userId, payout };
  });
}

export async function processMatureDeposits(): Promise<number> {
  const matureDeposits = await getMatureDeposits();
  let count = 0;

  for (const deposit of matureDeposits) {
    try {
      await matureFixedDeposit(deposit.id);
      count++;
    } catch (err) {
      logger.error('Failed to mature fixed deposit', {
        depositId: deposit.id,
        error: String(err),
      });
    }
  }

  return count;
}
