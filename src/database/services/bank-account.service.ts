import { prisma } from '../client.js';
import { findOrCreateUser } from '../repositories/user.repository.js';
import {
  BANK_INTEREST_RATE,
  BANK_INTEREST_PERIOD_MS,
  BANK_MIN_BALANCE_FOR_INTEREST,
} from '../../config/constants.js';
import { hasActiveBuff, getInventoryQuantity } from './shop.service.js';
import { SHOP_EFFECTS } from '../../config/shop.js';

export interface BankAccountSummary {
  bankBalance: bigint;
  walletBalance: bigint;
  lastInterestAt: Date | null;
  estimatedInterest: bigint;
}

export async function getBankAccountSummary(userId: string): Promise<BankAccountSummary> {
  const user = await findOrCreateUser(userId);

  let estimatedInterest = 0n;
  if (user.bankBalance >= BANK_MIN_BALANCE_FOR_INTEREST) {
    estimatedInterest = (user.bankBalance * BANK_INTEREST_RATE) / 100n;
  }

  return {
    bankBalance: user.bankBalance,
    walletBalance: user.chips,
    lastInterestAt: user.lastInterestAt,
    estimatedInterest,
  };
}

export async function depositChips(
  userId: string,
  amount: bigint,
): Promise<{ walletBalance: bigint; bankBalance: bigint }> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

    if (user.chips < amount) {
      throw new Error('INSUFFICIENT_CHIPS');
    }

    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        chips: { decrement: amount },
        bankBalance: { increment: amount },
      },
    });

    await tx.transaction.create({
      data: {
        userId,
        type: 'BANK_DEPOSIT',
        amount: -amount,
        balanceAfter: updated.chips,
      },
    });

    return { walletBalance: updated.chips, bankBalance: updated.bankBalance };
  });
}

export async function withdrawChips(
  userId: string,
  amount: bigint,
): Promise<{ walletBalance: bigint; bankBalance: bigint }> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

    if (user.bankBalance < amount) {
      throw new Error('INSUFFICIENT_BANK_BALANCE');
    }

    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        chips: { increment: amount },
        bankBalance: { decrement: amount },
      },
    });

    await tx.transaction.create({
      data: {
        userId,
        type: 'BANK_WITHDRAW',
        amount,
        balanceAfter: updated.chips,
      },
    });

    return { walletBalance: updated.chips, bankBalance: updated.bankBalance };
  });
}

export async function transferChips(
  senderId: string,
  recipientId: string,
  amount: bigint,
): Promise<{ senderBankBalance: bigint; recipientBankBalance: bigint }> {
  if (senderId === recipientId) {
    throw new Error('SELF_TRANSFER');
  }

  return prisma.$transaction(async (tx) => {
    const sender = await tx.user.findUniqueOrThrow({ where: { id: senderId } });

    if (sender.bankBalance < amount) {
      throw new Error('INSUFFICIENT_BANK_BALANCE');
    }

    const recipient = await tx.user.findUnique({ where: { id: recipientId } });
    if (!recipient) {
      throw new Error('RECIPIENT_NOT_FOUND');
    }

    const updatedSender = await tx.user.update({
      where: { id: senderId },
      data: { bankBalance: { decrement: amount } },
    });

    const updatedRecipient = await tx.user.update({
      where: { id: recipientId },
      data: { bankBalance: { increment: amount } },
    });

    await tx.transaction.create({
      data: {
        userId: senderId,
        type: 'BANK_TRANSFER_SEND',
        amount: -amount,
        balanceAfter: updatedSender.bankBalance,
        metadata: { recipientId },
      },
    });

    await tx.transaction.create({
      data: {
        userId: recipientId,
        type: 'BANK_TRANSFER_RECV',
        amount,
        balanceAfter: updatedRecipient.bankBalance,
        metadata: { senderId },
      },
    });

    return {
      senderBankBalance: updatedSender.bankBalance,
      recipientBankBalance: updatedRecipient.bankBalance,
    };
  });
}

export async function applyInterest(userId: string): Promise<bigint | null> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

    if (user.bankBalance < BANK_MIN_BALANCE_FOR_INTEREST) {
      return null;
    }

    // Check cooldown
    if (user.lastInterestAt) {
      const elapsed = Date.now() - user.lastInterestAt.getTime();
      if (elapsed < BANK_INTEREST_PERIOD_MS) {
        return null;
      }
    }

    // Calculate effective interest rate with shop upgrades
    let effectiveRate = BANK_INTEREST_RATE;
    try {
      // BANK_EXPANSION: +1% per stack
      const expansionCount = await getInventoryQuantity(userId, 'BANK_EXPANSION');
      if (expansionCount > 0) {
        effectiveRate += SHOP_EFFECTS.BANK_EXPANSION_RATE * BigInt(expansionCount);
      }
    } catch {
      // Never block interest
    }

    let interest = (user.bankBalance * effectiveRate) / 100n;
    if (interest <= 0n) return null;

    // INTEREST_BOOSTER: double interest
    try {
      if (await hasActiveBuff(userId, 'INTEREST_BOOSTER')) {
        interest *= 2n;
      }
    } catch {
      // Never block interest
    }

    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        bankBalance: { increment: interest },
        lastInterestAt: new Date(),
      },
    });

    await tx.transaction.create({
      data: {
        userId,
        type: 'BANK_INTEREST',
        amount: interest,
        balanceAfter: updated.bankBalance,
      },
    });

    return interest;
  });
}

export async function applyInterestToAll(): Promise<number> {
  const cutoff = new Date(Date.now() - BANK_INTEREST_PERIOD_MS);

  const eligibleUsers = await prisma.user.findMany({
    where: {
      bankBalance: { gte: BANK_MIN_BALANCE_FOR_INTEREST },
      OR: [
        { lastInterestAt: null },
        { lastInterestAt: { lte: cutoff } },
      ],
    },
    select: { id: true },
  });

  let count = 0;
  for (const user of eligibleUsers) {
    const result = await applyInterest(user.id);
    if (result !== null) count++;
  }

  return count;
}
