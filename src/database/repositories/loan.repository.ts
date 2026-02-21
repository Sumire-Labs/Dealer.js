import { prisma } from '../client.js';

export async function getOutstandingLoans(userId: string) {
  return prisma.loan.findMany({
    where: { userId, paidAt: null },
    orderBy: { createdAt: 'asc' },
  });
}

export async function createLoan(userId: string, principal: bigint) {
  return prisma.loan.create({
    data: { userId, principal },
  });
}

export async function markLoanPaid(loanId: string) {
  return prisma.loan.update({
    where: { id: loanId },
    data: { paidAt: new Date() },
  });
}

export async function markAllLoansPaid(userId: string) {
  return prisma.loan.updateMany({
    where: { userId, paidAt: null },
    data: { paidAt: new Date() },
  });
}
