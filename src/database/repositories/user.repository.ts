import {prisma} from '../client.js';
import {configService} from '../../config/config.service.js';
import {S} from '../../config/setting-defs.js';

export async function findOrCreateUser(userId: string) {
  return prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId, chips: configService.getBigInt(S.initialChips) },
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

  const groups = await prisma.transaction.groupBy({
    by: ['type'],
    where: {
      userId,
      createdAt: { gte: startOfDay },
      type: { in: ['WIN', 'LOSS'] },
    },
    _count: true,
    _sum: { amount: true },
  });

  let wins = 0;
  let losses = 0;
  let netAmount = 0n;

  for (const g of groups) {
    if (g.type === 'WIN') {
      wins = g._count;
    } else {
      losses = g._count;
    }
    netAmount += g._sum.amount ?? 0n;
  }

  return { wins, losses, netAmount };
}

export async function resetUser(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      chips: configService.getBigInt(S.initialChips),
      bankBalance: 0n,
      totalWon: 0n,
      totalLost: 0n,
      totalGames: 0,
      lastDaily: null,
      lastInterestAt: null,
    },
  });
}
