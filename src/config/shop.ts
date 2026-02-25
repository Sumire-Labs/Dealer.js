// ── Re-exports from sub-modules ──

export type {
    ShopCategory, CosmeticType, ItemRarity, ShopItem, MysteryBoxLoot, MysteryBoxDefinition
} from './shop-items/types.js';
export {CONSUMABLES, BUFFS, INSURANCE} from './shop-items/consumables.js';
export {UPGRADES, COSMETICS, RANK_LIMITED, CRAFT_ITEMS} from './shop-items/upgrades-cosmetics.js';
export {MYSTERY_BOXES, GOLDEN_BOX_LOOT} from './shop-items/mystery-boxes.js';
export {SHOP_EFFECTS, RARITY_LABELS, RARITY_EMOJI} from './shop-items/effects.js';

// ── Imports for aggregation ──

import type {MysteryBoxDefinition, ShopCategory, ShopItem} from './shop-items/types.js';
import {BUFFS, CONSUMABLES, INSURANCE} from './shop-items/consumables.js';
import {COSMETICS, CRAFT_ITEMS, RANK_LIMITED, UPGRADES} from './shop-items/upgrades-cosmetics.js';
import {MYSTERY_BOXES} from './shop-items/mystery-boxes.js';
import {WORK_TOOLS} from './work-tools.js';

// ── All items & lookup ──

export const ALL_ITEMS: ShopItem[] = [
    ...CONSUMABLES,
    ...BUFFS,
    ...UPGRADES,
    ...COSMETICS,
    ...RANK_LIMITED,
    ...MYSTERY_BOXES,
    ...INSURANCE,
    ...WORK_TOOLS,
    ...CRAFT_ITEMS,
];

export const ITEM_MAP = new Map<string, ShopItem>(
    ALL_ITEMS.map(item => [item.id, item]),
);

export const MYSTERY_BOX_MAP = new Map<string, MysteryBoxDefinition>(
    MYSTERY_BOXES.map(box => [box.id, box]),
);

// ── Category structure for UI (excludes craft-only) ──

export const SHOP_CATEGORIES: { key: ShopCategory; label: string; emoji: string; items: ShopItem[] }[] = [
    {key: 'consumable', label: '消耗品', emoji: '🧃', items: CONSUMABLES},
    {key: 'buff', label: 'バフ', emoji: '🧪', items: BUFFS},
    {key: 'upgrade', label: '永続UP', emoji: '⬆️', items: UPGRADES},
    {key: 'cosmetic', label: 'コスメ', emoji: '🎨', items: [...COSMETICS, ...RANK_LIMITED]},
    {key: 'mystery', label: 'ミステリー', emoji: '📦', items: MYSTERY_BOXES},
    {key: 'insurance', label: '保険', emoji: '🛡️', items: INSURANCE},
    {key: 'tool', label: '仕事道具', emoji: '🔧', items: WORK_TOOLS},
];

// ── Daily rotation pool ──

export const DAILY_ELIGIBLE_ITEMS = ALL_ITEMS.filter(item => item.dailyEligible);
export const DAILY_ROTATION_COUNT = 4;
export const DAILY_DISCOUNT_RATE = 20; // 20% off
