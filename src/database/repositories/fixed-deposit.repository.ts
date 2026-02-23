import { prisma } from '../client.js';

export async function getActiveDeposits(userId: string) {
  return prisma.fixedDeposit.findMany({
    where: { userId, withdrawnAt: null },
    orderBy: { depositedAt: 'asc' },
  });
}

export async function getActiveDepositCount(userId: string) {
  return prisma.fixedDeposit.count({
    where: { userId, withdrawnAt: null },
  });
}

export async function createDeposit(data: {
  userId: string;
  amount: bigint;
  termDays: number;
  interestRate: bigint;
  maturesAt: Date;
}) {
  return prisma.fixedDeposit.create({
    data: {
      userId: data.userId,
      amount: data.amount,
      termDays: data.termDays,
      interestRate: data.interestRate,
      maturesAt: data.maturesAt,
    },
  });
}

export async function withdrawDeposit(depositId: string) {
  return prisma.fixedDeposit.update({
    where: { id: depositId },
    data: { withdrawnAt: new Date() },
  });
}

export async function getMatureDeposits() {
  return prisma.fixedDeposit.findMany({
    where: {
      maturesAt: { lte: new Date() },
      withdrawnAt: null,
    },
  });
}

export async function getDepositById(depositId: string) {
  return prisma.fixedDeposit.findUnique({
    where: { id: depositId },
  });
}
