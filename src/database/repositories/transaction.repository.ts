import { Prisma, type GameType, type TransactionType } from '@prisma/client';
import { prisma } from '../client.js';

export interface CreateTransactionInput {
  userId: string;
  type: TransactionType;
  game?: GameType;
  amount: bigint;
  balanceAfter: bigint;
  metadata?: Prisma.InputJsonValue;
}

export async function createTransaction(input: CreateTransactionInput) {
  return prisma.transaction.create({
    data: {
      userId: input.userId,
      type: input.type,
      game: input.game ?? null,
      amount: input.amount,
      balanceAfter: input.balanceAfter,
      metadata: input.metadata ?? Prisma.JsonNull,
    },
  });
}

export async function getUserTransactions(
  userId: string,
  limit = 20,
  offset = 0,
) {
  return prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });
}
