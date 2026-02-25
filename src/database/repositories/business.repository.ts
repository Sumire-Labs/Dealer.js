import {prisma} from '../client.js';

export async function createBusiness(ownerId: string, type: string) {
  return prisma.business.create({
    data: {
      ownerId,
      type,
      level: 1,
      lastCollectedAt: new Date(),
    },
    include: { employees: true },
  });
}

export async function getBusiness(ownerId: string) {
  return prisma.business.findUnique({
    where: { ownerId },
    include: { employees: true },
  });
}

export async function upgradeBusiness(ownerId: string) {
  return prisma.business.update({
    where: { ownerId },
    data: { level: { increment: 1 } },
    include: { employees: true },
  });
}

export async function updateLastCollected(ownerId: string, timestamp: Date, earnedAmount: bigint) {
  return prisma.business.update({
    where: { ownerId },
    data: {
      lastCollectedAt: timestamp,
      totalEarned: { increment: earnedAmount },
    },
  });
}

export async function addEmployee(businessId: string, userId: string) {
  return prisma.businessEmployee.create({
    data: { businessId, userId },
  });
}

export async function removeEmployee(businessId: string, userId: string) {
  return prisma.businessEmployee.delete({
    where: { businessId_userId: { businessId, userId } },
  });
}

export async function getEmployees(businessId: string) {
  return prisma.businessEmployee.findMany({
    where: { businessId },
  });
}

export async function getEmploymentInfo(userId: string) {
  const employment = await prisma.businessEmployee.findFirst({
    where: { userId },
    include: { business: true },
  });
  return employment;
}

export async function deleteBusiness(ownerId: string) {
  const business = await prisma.business.findUnique({ where: { ownerId } });
  if (!business) return;
  await prisma.businessEmployee.deleteMany({ where: { businessId: business.id } });
  await prisma.business.delete({ where: { ownerId } });
}
