import {prisma} from '../client.js';
import type {Prisma, WorkMastery} from '@prisma/client';

export async function getMastery(
  userId: string,
  jobId: string,
  tx?: Prisma.TransactionClient,
): Promise<WorkMastery | null> {
  const client = tx ?? prisma;
  return client.workMastery.findUnique({
    where: { userId_jobId: { userId, jobId } },
  });
}

export async function getAllMasteries(userId: string): Promise<WorkMastery[]> {
  return prisma.workMastery.findMany({
    where: { userId },
  });
}

export async function incrementShifts(
  userId: string,
  jobId: string,
  tx?: Prisma.TransactionClient,
): Promise<WorkMastery> {
  const client = tx ?? prisma;
  return client.workMastery.upsert({
    where: { userId_jobId: { userId, jobId } },
    create: { userId, jobId, shiftsCompleted: 1, masteryLevel: 0 },
    update: { shiftsCompleted: { increment: 1 } },
  });
}

export async function updateMasteryLevel(
  userId: string,
  jobId: string,
  level: number,
  tx?: Prisma.TransactionClient,
): Promise<WorkMastery> {
  const client = tx ?? prisma;
  return client.workMastery.update({
    where: { userId_jobId: { userId, jobId } },
    data: { masteryLevel: level },
  });
}
