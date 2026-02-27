// ── Barrel re-exports ──

export {purchaseItem, type PurchaseResult} from './shop/purchase.service.js';
export {recycleItem, type RecycleResult} from './shop/recycle.service.js';
export {craftItem, type CraftResult, craftItemBulk, type BulkCraftResult} from './shop/craft.service.js';
export {
    useItem, type UseItemResult, equipCosmetic, unequipCosmetic, type EquipResult
} from './shop/consumable.service.js';
export {openMysteryBox, type OpenBoxResult, openMysteryBoxBulk, type BulkOpenBoxResult} from './shop/mystery-box.service.js';
export {getFlashSale, generateFlashSale, checkAndRefreshFlashSale, type FlashSale} from './shop/flash-sale.service.js';
export {
    getDailyRotation, generateDailyRotation, checkAndRefreshRotation, type DailyRotation
} from './shop/daily-rotation.service.js';
export {
    hasActiveBuff, hasInventoryItem, getInventoryQuantity, getStackedBonus, consumeInventoryItem, getUserInventorySummary
} from './shop/inventory-query.service.js';
export {
    loadUserItemsSnapshot, snapshotHasItem, snapshotHasBuff, type InventorySnapshot
} from './shop/batch-inventory.service.js';
