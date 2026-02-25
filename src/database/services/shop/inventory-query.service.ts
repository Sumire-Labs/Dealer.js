import {prisma} from '../../client.js';
import {findOrCreateUser} from '../../repositories/user.repository.js';
import {
  decrementInventoryItem,
  getActiveBuffs,
  getInventory,
  getInventoryItem,
} from '../../repositories/shop.repository.js';

// ── Buff query helpers (used by other services) ──

export async function hasActiveBuff(userId: string, buffId: string): Promise<boolean> {
    const buffs = await getActiveBuffs(userId);
    return buffs.some(b => b.buffId === buffId);
}

export async function hasInventoryItem(userId: string, itemId: string): Promise<boolean> {
    const item = await getInventoryItem(userId, itemId);
    return item !== null && item.quantity > 0;
}

export async function getInventoryQuantity(userId: string, itemId: string): Promise<number> {
    const item = await getInventoryItem(userId, itemId);
    return item?.quantity ?? 0;
}

export async function consumeInventoryItem(
    userId: string,
    itemId: string,
    amount: number = 1,
    tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
): Promise<boolean> {
    const result = await decrementInventoryItem(userId, itemId, amount, tx);
    return result !== null;
}

// ── User inventory summary ──

export async function getUserInventorySummary(userId: string) {
    const [inventory, activeBuffs, user] = await Promise.all([
        getInventory(userId),
        getActiveBuffs(userId),
        findOrCreateUser(userId),
    ]);

    return {
        inventory,
        activeBuffs,
        activeTitle: user.activeTitle,
        activeBadge: user.activeBadge,
        lifetimeShopSpend: user.lifetimeShopSpend,
    };
}
