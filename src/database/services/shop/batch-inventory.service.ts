import type {ActiveBuff, UserInventory} from '@prisma/client';
import {prisma} from '../../client.js';

/**
 * Snapshot of a user's inventory + active buffs loaded in 2 queries.
 * Used to avoid N+1 queries in processGameResult / claimDaily.
 */
export interface InventorySnapshot {
    items: UserInventory[];
    activeBuffs: ActiveBuff[];
}

/** Load all inventory items + active buffs for a user in 2 queries. */
export async function loadUserItemsSnapshot(userId: string): Promise<InventorySnapshot> {
    const now = new Date();
    const [items, activeBuffs] = await Promise.all([
        prisma.userInventory.findMany({where: {userId}}),
        prisma.activeBuff.findMany({where: {userId, expiresAt: {gt: now}}}),
    ]);
    return {items, activeBuffs};
}

/** Check if snapshot contains an inventory item with quantity > 0. */
export function snapshotHasItem(snapshot: InventorySnapshot, itemId: string): boolean {
    const item = snapshot.items.find(i => i.itemId === itemId);
    return item !== null && item !== undefined && item.quantity > 0;
}

/** Check if snapshot contains an active buff. */
export function snapshotHasBuff(snapshot: InventorySnapshot, buffId: string): boolean {
    return snapshot.activeBuffs.some(b => b.buffId === buffId);
}
