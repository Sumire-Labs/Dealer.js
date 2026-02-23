import { prisma } from '../client.js';

export type LeaderboardCategory = 'chips' | 'net_worth' | 'total_won' | 'work_level' | 'shop_spend' | 'achievements';

export interface LeaderboardEntry {
  id: string;
  chips: bigint;
  bankBalance: bigint;
  totalWon: bigint;
  totalLost: bigint;
  totalGames: number;
  workLevel: number;
  workXp: number;
  lifetimeShopSpend: bigint;
  achievementCount: number;
}

export async function getTopPlayers(
  category: LeaderboardCategory,
  limit = 10,
  offset = 0,
): Promise<LeaderboardEntry[]> {
  if (category === 'achievements') {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        chips: true,
        bankBalance: true,
        totalWon: true,
        totalLost: true,
        totalGames: true,
        workLevel: true,
        workXp: true,
        lifetimeShopSpend: true,
        _count: { select: { achievements: true } },
      },
      orderBy: { achievements: { _count: 'desc' } },
      take: limit,
      skip: offset,
    });
    return users.map(u => ({
      id: u.id,
      chips: u.chips,
      bankBalance: u.bankBalance,
      totalWon: u.totalWon,
      totalLost: u.totalLost,
      totalGames: u.totalGames,
      workLevel: u.workLevel,
      workXp: u.workXp,
      lifetimeShopSpend: u.lifetimeShopSpend,
      achievementCount: u._count.achievements,
    }));
  }

  if (category === 'net_worth') {
    const rows = await prisma.$queryRaw<
      {
        id: string;
        chips: bigint;
        bankBalance: bigint;
        totalWon: bigint;
        totalLost: bigint;
        totalGames: number;
        workLevel: number;
        workXp: number;
        lifetimeShopSpend: bigint;
      }[]
    >`
      SELECT "id", "chips", "bankBalance", "totalWon", "totalLost", "totalGames",
             "workLevel", "workXp", "lifetimeShopSpend"
      FROM "User"
      ORDER BY ("chips" + "bankBalance") DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    // queryRaw returns numbers for Int columns — need achievementCount separately
    const ids = rows.map(r => r.id);
    const counts = await prisma.userAchievement.groupBy({
      by: ['userId'],
      where: { userId: { in: ids } },
      _count: true,
    });
    const countMap = new Map(counts.map(c => [c.userId, c._count]));

    return rows.map(r => ({
      id: r.id,
      chips: r.chips,
      bankBalance: r.bankBalance,
      totalWon: r.totalWon,
      totalLost: r.totalLost,
      totalGames: Number(r.totalGames),
      workLevel: Number(r.workLevel),
      workXp: Number(r.workXp),
      lifetimeShopSpend: r.lifetimeShopSpend,
      achievementCount: countMap.get(r.id) ?? 0,
    }));
  }

  // Standard orderBy categories
  const orderByMap: Record<string, object> = {
    chips: { chips: 'desc' },
    total_won: { totalWon: 'desc' },
    work_level: [{ workLevel: 'desc' }, { workXp: 'desc' }],
    shop_spend: { lifetimeShopSpend: 'desc' },
  };

  const users = await prisma.user.findMany({
    select: {
      id: true,
      chips: true,
      bankBalance: true,
      totalWon: true,
      totalLost: true,
      totalGames: true,
      workLevel: true,
      workXp: true,
      lifetimeShopSpend: true,
      _count: { select: { achievements: true } },
    },
    orderBy: orderByMap[category] as never,
    take: limit,
    skip: offset,
  });

  return users.map(u => ({
    id: u.id,
    chips: u.chips,
    bankBalance: u.bankBalance,
    totalWon: u.totalWon,
    totalLost: u.totalLost,
    totalGames: u.totalGames,
    workLevel: u.workLevel,
    workXp: u.workXp,
    lifetimeShopSpend: u.lifetimeShopSpend,
    achievementCount: u._count.achievements,
  }));
}

export async function getTotalPlayerCount(): Promise<number> {
  return prisma.user.count();
}

export async function getUserRank(userId: string, category: LeaderboardCategory): Promise<number> {
  if (category === 'achievements') {
    const userAchCount = await prisma.userAchievement.count({
      where: { userId },
    });
    // Count users with more achievements
    const allCounts = await prisma.userAchievement.groupBy({
      by: ['userId'],
      _count: true,
    });
    const higherCount = allCounts.filter(c => c._count > userAchCount).length;
    return higherCount + 1;
  }

  if (category === 'net_worth') {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { chips: true, bankBalance: true },
    });
    if (!user) return -1;
    const userNetWorth = user.chips + user.bankBalance;

    const count = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM "User"
      WHERE ("chips" + "bankBalance") > ${userNetWorth}
    `;
    return Number(count[0].count) + 1;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { chips: true, totalWon: true, workLevel: true, workXp: true, lifetimeShopSpend: true },
  });
  if (!user) return -1;

  if (category === 'work_level') {
    const count = await prisma.user.count({
      where: {
        OR: [
          { workLevel: { gt: user.workLevel } },
          { workLevel: user.workLevel, workXp: { gt: user.workXp } },
        ],
      },
    });
    return count + 1;
  }

  const fieldMap = {
    chips: 'chips',
    total_won: 'totalWon',
    shop_spend: 'lifetimeShopSpend',
  } as const;
  const field = fieldMap[category as keyof typeof fieldMap];
  const value = user[field];

  const count = await prisma.user.count({
    where: { [field]: { gt: value } },
  });
  return count + 1;
}
