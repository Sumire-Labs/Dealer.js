import type {RaceStatus} from '@prisma/client';
import {prisma} from '../client.js';

export interface CreateRaceSessionInput {
  channelId: string;
  horses: unknown[];
  startsAt: Date;
}

export async function createRaceSession(input: CreateRaceSessionInput) {
  return prisma.raceSession.create({
    data: {
      channelId: input.channelId,
      horses: input.horses as never,
      startsAt: input.startsAt,
    },
  });
}

export async function getRaceSession(sessionId: string) {
  return prisma.raceSession.findUnique({
    where: { id: sessionId },
    include: { bets: true },
  });
}

export async function getActiveRaceInChannel(channelId: string) {
  return prisma.raceSession.findFirst({
    where: {
      channelId,
      status: { in: ['BETTING', 'RUNNING'] },
    },
    include: { bets: true },
  });
}

export async function updateRaceStatus(
  sessionId: string,
  status: RaceStatus,
  results?: unknown[],
) {
  return prisma.raceSession.update({
    where: { id: sessionId },
    data: {
      status,
      ...(results ? { results: results as never } : {}),
    },
  });
}

export async function placeBet(
  sessionId: string,
  userId: string,
  horseIndex: number,
  amount: bigint,
) {
  return prisma.raceBet.create({
    data: { sessionId, userId, horseIndex, amount },
  });
}

export async function getSessionBets(sessionId: string) {
  return prisma.raceBet.findMany({
    where: { sessionId },
    include: { user: true },
  });
}

export async function cleanupStaleSessions() {
  return prisma.raceSession.updateMany({
    where: {
      status: { in: ['BETTING', 'RUNNING'] },
      startsAt: { lt: new Date(Date.now() - 10 * 60 * 1000) },
    },
    data: { status: 'CANCELLED' },
  });
}
