import { prisma } from '../client.js';

const INITIAL_CHIPS = 10000n;

export async function findOrCreateUser(userId: string) {
  return prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId, chips: INITIAL_CHIPS },
  });
}

export async function getUser(userId: string) {
  return prisma.user.findUnique({ where: { id: userId } });
}

export async function updateChips(userId: string, chips: bigint) {
  return prisma.user.update({
    where: { id: userId },
    data: { chips },
  });
}

export async function updateLastDaily(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { lastDaily: new Date() },
  });
}

export async function incrementGameStats(
  userId: string,
  won: bigint,
  lost: bigint,
) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      totalWon: { increment: won },
      totalLost: { increment: lost },
      totalGames: { increment: 1 },
    },
  });
}

export interface TodayStats {
  wins: number;
  losses: number;
  netAmount: bigint;
}

export async function getTodayStats(userId: string): Promise<TodayStats> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      createdAt: { gte: startOfDay },
      type: { in: ['WIN', 'LOSS'] },
    },
    select: { type: true, amount: true },
  });

  let wins = 0;
  let losses = 0;
  let netAmount = 0n;

  for (const tx of transactions) {
    if (tx.type === 'WIN') {
      wins++;
    } else {
      losses++;
    }
    netAmount += tx.amount;
  }

  return { wins, losses, netAmount };
}

export async function resetUser(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      chips: INITIAL_CHIPS,
      totalWon: 0n,
      totalLost: 0n,
      totalGames: 0,
      lastDaily: null,
    },
  });
}
