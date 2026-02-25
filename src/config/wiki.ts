import {ALL_ITEMS, type ShopItem} from './shop.js';
import {CRAFT_RECIPES, type CraftRecipe} from './crafting.js';
import {COLLECTION_SETS, type CollectionSet} from './collections.js';

export interface WikiCategory {
  key: string;
  label: string;
  emoji: string;
}

export const WIKI_CATEGORIES: WikiCategory[] = [
  { key: 'consumable', label: '消耗品',     emoji: '🧃' },
  { key: 'buff',       label: 'バフ',       emoji: '🧪' },
  { key: 'upgrade',    label: '永続UP',     emoji: '⬆️' },
  { key: 'cosmetic',   label: 'コスメ',     emoji: '🎨' },
  { key: 'mystery',    label: 'ミステリー', emoji: '📦' },
  { key: 'insurance',  label: '保険',       emoji: '🛡️' },
  { key: 'tool',       label: '仕事道具',   emoji: '🔧' },
  { key: 'craft',      label: 'クラフト',   emoji: '🔨' },
];

export const WIKI_CATEGORY_MAP = new Map<string, WikiCategory>(
  WIKI_CATEGORIES.map(c => [c.key, c]),
);

/** Get all items for a given category key */
export function getItemsByCategory(key: string): ShopItem[] {
  return ALL_ITEMS.filter(item => item.category === key);
}

/** Get collection sets that include a given item */
export function getCollectionsForItem(itemId: string): CollectionSet[] {
  return COLLECTION_SETS.filter(c => c.requiredItems.includes(itemId));
}

/** Get the recipe that produces a given item */
export function getRecipeForItem(itemId: string): CraftRecipe | undefined {
  return CRAFT_RECIPES.find(r => r.resultItemId === itemId);
}

/** Get recipes that use a given item as a material */
export function getRecipesUsingItem(itemId: string): CraftRecipe[] {
  return CRAFT_RECIPES.filter(r => r.materials.some(m => m.itemId === itemId));
}
