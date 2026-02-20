import type { Prisma, GameType, TransactionType } from '@prisma/client';
import { prisma } from '../client.js';
import { createTransaction } from '../repositories/transaction.repository.js';
import { findOrCreateUser, incrementGameStats } from '../repositories/user.repository.js';

export async function getBalance(userId: string): Promise<bigint> {
  const user = await findOrCreateUser(userId);
  return user.chips;
}

export async function addChips(
  userId: string,
  amount: bigint,
  type: TransactionType,
  game?: GameType,
  metadata?: Prisma.InputJsonValue,
): Promise<bigint> {
  const user = await findOrCreateUser(userId);
  const newBalance = user.chips + amount;

  await prisma.user.update({
    where: { id: userId },
    data: { chips: newBalance },
  });

  await createTransaction({
    userId,
    type,
    game,
    amount,
    balanceAfter: newBalance,
    metadata,
  });

  return newBalance;
}

export async function removeChips(
  userId: string,
  amount: bigint,
  type: TransactionType,
  game?: GameType,
  metadata?: Prisma.InputJsonValue,
): Promise<bigint> {
  const user = await findOrCreateUser(userId);
  const newBalance = user.chips - amount;

  if (newBalance < 0n) {
    throw new Error('Insufficient chips');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { chips: newBalance },
  });

  await createTransaction({
    userId,
    type,
    game,
    amount: -amount,
    balanceAfter: newBalance,
    metadata,
  });

  return newBalance;
}

export async function processGameResult(
  userId: string,
  game: GameType,
  betAmount: bigint,
  multiplier: number,
): Promise<{ newBalance: bigint; payout: bigint; net: bigint }> {
  const user = await findOrCreateUser(userId);
  const payout = BigInt(Math.floor(Number(betAmount) * multiplier));
  const net = payout - betAmount;
  const newBalance = user.chips + net;

  if (newBalance < 0n) {
    throw new Error('Insufficient chips');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { chips: newBalance },
  });

  const isWin = net > 0n;
  await createTransaction({
    userId,
    type: isWin ? 'WIN' : 'LOSS',
    game,
    amount: net,
    balanceAfter: newBalance,
    metadata: {
      betAmount: betAmount.toString(),
      multiplier,
      payout: payout.toString(),
    },
  });

  await incrementGameStats(
    userId,
    isWin ? net : 0n,
    isWin ? 0n : -net,
  );

  return { newBalance, payout, net };
}

export async function hasEnoughChips(
  userId: string,
  amount: bigint,
): Promise<boolean> {
  const balance = await getBalance(userId);
  return balance >= amount;
}
