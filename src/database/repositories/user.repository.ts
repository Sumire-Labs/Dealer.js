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
