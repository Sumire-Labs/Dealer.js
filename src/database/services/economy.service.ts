import { Prisma, type GameType, type TransactionType } from '@prisma/client';
import { prisma } from '../client.js';
import { findOrCreateUser } from '../repositories/user.repository.js';

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
  return prisma.$transaction(async (tx) => {
    await findOrCreateUser(userId);

    const user = await tx.user.update({
      where: { id: userId },
      data: { chips: { increment: amount } },
    });

    await tx.transaction.create({
      data: {
        userId,
        type,
        game: game ?? null,
        amount,
        balanceAfter: user.chips,
        metadata: metadata ?? Prisma.JsonNull,
      },
    });

    return user.chips;
  });
}

export async function removeChips(
  userId: string,
  amount: bigint,
  type: TransactionType,
  game?: GameType,
  metadata?: Prisma.InputJsonValue,
): Promise<bigint> {
  return prisma.$transaction(async (tx) => {
    await findOrCreateUser(userId);

    // Atomic check-and-decrement: read current balance inside transaction
    const current = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (current.chips < amount) {
      throw new Error('Insufficient chips');
    }

    const user = await tx.user.update({
      where: { id: userId },
      data: { chips: { decrement: amount } },
    });

    await tx.transaction.create({
      data: {
        userId,
        type,
        game: game ?? null,
        amount: -amount,
        balanceAfter: user.chips,
        metadata: metadata ?? Prisma.JsonNull,
      },
    });

    return user.chips;
  });
}

export async function processGameResult(
  userId: string,
  game: GameType,
  betAmount: bigint,
  multiplier: number,
): Promise<{ newBalance: bigint; payout: bigint; net: bigint }> {
  // Use integer math to avoid BigInt→Number precision loss
  const multiplierInt = Math.round(multiplier * 1_000_000);
  const payout = (betAmount * BigInt(multiplierInt)) / 1_000_000n;
  const net = payout - betAmount;

  const newBalance = await prisma.$transaction(async (tx) => {
    await findOrCreateUser(userId);

    const current = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (current.chips + net < 0n) {
      throw new Error('Insufficient chips');
    }

    const updatedUser = net >= 0n
      ? await tx.user.update({ where: { id: userId }, data: { chips: { increment: net } } })
      : await tx.user.update({ where: { id: userId }, data: { chips: { decrement: -net } } });

    const isWin = net > 0n;
    await tx.transaction.create({
      data: {
        userId,
        type: isWin ? 'WIN' : 'LOSS',
        game,
        amount: net,
        balanceAfter: updatedUser.chips,
        metadata: {
          betAmount: betAmount.toString(),
          multiplier,
          payout: payout.toString(),
        },
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        totalWon: { increment: isWin ? net : 0n },
        totalLost: { increment: isWin ? 0n : -net },
        totalGames: { increment: 1 },
      },
    });

    return updatedUser.chips;
  });

  return { newBalance, payout, net };
}

export async function hasEnoughChips(
  userId: string,
  amount: bigint,
): Promise<boolean> {
  const balance = await getBalance(userId);
  return balance >= amount;
}
