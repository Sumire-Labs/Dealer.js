import type { UserInventory, ActiveBuff } from '@prisma/client';
import { prisma } from '../client.js';

// ── Inventory ──

export async function getInventory(userId: string): Promise<UserInventory[]> {
  return prisma.userInventory.findMany({
    where: { userId },
    orderBy: { acquiredAt: 'asc' },
  });
}

export async function getInventoryItem(
  userId: string,
  itemId: string,
): Promise<UserInventory | null> {
  return prisma.userInventory.findUnique({
    where: { userId_itemId: { userId, itemId } },
  });
}

export async function getDistinctItemCount(userId: string): Promise<number> {
  const items = await prisma.userInventory.findMany({
    where: { userId, quantity: { gt: 0 } },
    select: { itemId: true },
  });
  return items.length;
}

export async function upsertInventoryItem(
  userId: string,
  itemId: string,
  quantityDelta: number,
  tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
): Promise<UserInventory> {
  const db = tx ?? prisma;
  return db.userInventory.upsert({
    where: { userId_itemId: { userId, itemId } },
    update: { quantity: { increment: quantityDelta } },
    create: { userId, itemId, quantity: quantityDelta },
  });
}

export async function decrementInventoryItem(
  userId: string,
  itemId: string,
  amount: number = 1,
  tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
): Promise<UserInventory | null> {
  const db = tx ?? prisma;
  const item = await db.userInventory.findUnique({
    where: { userId_itemId: { userId, itemId } },
  });
  if (!item || item.quantity < amount) return null;

  if (item.quantity === amount) {
    await db.userInventory.delete({
      where: { userId_itemId: { userId, itemId } },
    });
    return { ...item, quantity: 0 };
  }

  return db.userInventory.update({
    where: { userId_itemId: { userId, itemId } },
    data: { quantity: { decrement: amount } },
  });
}

// ── Active Buffs ──

export async function getActiveBuffs(userId: string): Promise<ActiveBuff[]> {
  const now = new Date();
  // Clean expired and return active
  await prisma.activeBuff.deleteMany({
    where: { userId, expiresAt: { lte: now } },
  });
  return prisma.activeBuff.findMany({
    where: { userId, expiresAt: { gt: now } },
  });
}

export async function getActiveBuff(
  userId: string,
  buffId: string,
): Promise<ActiveBuff | null> {
  const now = new Date();
  const buff = await prisma.activeBuff.findUnique({
    where: { userId_buffId: { userId, buffId } },
  });
  if (!buff) return null;
  if (buff.expiresAt <= now) {
    await prisma.activeBuff.delete({
      where: { userId_buffId: { userId, buffId } },
    });
    return null;
  }
  return buff;
}

export async function createActiveBuff(
  userId: string,
  buffId: string,
  durationMs: number,
  tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
): Promise<ActiveBuff> {
  const db = tx ?? prisma;
  const expiresAt = new Date(Date.now() + durationMs);
  return db.activeBuff.upsert({
    where: { userId_buffId: { userId, buffId } },
    update: { expiresAt },
    create: { userId, buffId, expiresAt },
  });
}

export async function removeActiveBuff(
  userId: string,
  buffId: string,
  tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
): Promise<void> {
  const db = tx ?? prisma;
  await db.activeBuff.deleteMany({
    where: { userId, buffId },
  });
}

// ── User cosmetic fields ──

export async function setActiveTitle(
  userId: string,
  titleId: string | null,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { activeTitle: titleId },
  });
}

export async function setActiveBadge(
  userId: string,
  badgeId: string | null,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { activeBadge: badgeId },
  });
}

export async function incrementLifetimeShopSpend(
  userId: string,
  amount: bigint,
  tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
): Promise<bigint> {
  const db = tx ?? prisma;
  const user = await db.user.update({
    where: { id: userId },
    data: { lifetimeShopSpend: { increment: amount } },
  });
  return user.lifetimeShopSpend;
}

export async function getUserShopProfile(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      activeTitle: true,
      activeBadge: true,
      lifetimeShopSpend: true,
    },
  });
}

// ── Ever-owned tracking (for collections) ──

export async function markEverOwned(
  userId: string,
  itemId: string,
  tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
): Promise<void> {
  const db = tx ?? prisma;
  await db.userInventory.upsert({
    where: { userId_itemId: { userId, itemId } },
    update: { everOwned: true },
    create: { userId, itemId, quantity: 0, everOwned: true },
  });
}

export async function getEverOwnedItems(userId: string): Promise<string[]> {
  const items = await prisma.userInventory.findMany({
    where: { userId, everOwned: true },
    select: { itemId: true },
  });
  return items.map(i => i.itemId);
}

export async function getLifetimeShopSpend(userId: string): Promise<bigint> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lifetimeShopSpend: true },
  });
  return user?.lifetimeShopSpend ?? 0n;
}
