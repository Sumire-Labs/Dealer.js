import { prisma } from '../client.js';

export interface LeaderboardEntry {
  id: string;
  chips: bigint;
  totalWon: bigint;
  totalLost: bigint;
  totalGames: number;
}

export async function getTopPlayers(limit = 10): Promise<LeaderboardEntry[]> {
  return prisma.user.findMany({
    select: {
      id: true,
      chips: true,
      totalWon: true,
      totalLost: true,
      totalGames: true,
    },
    orderBy: { chips: 'desc' },
    take: limit,
  });
}

export async function getUserRank(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { chips: true },
  });
  if (!user) return -1;

  const count = await prisma.user.count({
    where: { chips: { gt: user.chips } },
  });
  return count + 1;
}
