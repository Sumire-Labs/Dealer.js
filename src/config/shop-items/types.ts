import type { ShopRank } from '../shop-ranks.js';

export type ShopCategory =
  | 'consumable'
  | 'buff'
  | 'upgrade'
  | 'cosmetic'
  | 'mystery'
  | 'insurance'
  | 'tool'
  | 'craft';

export type CosmeticType = 'title' | 'badge';

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface ShopItem {
  id: string;
  name: string;
  emoji: string;
  description: string;
  price: bigint;
  category: ShopCategory;
  maxStack?: number;        // For upgrades (default: unlimited for consumables)
  buffDurationMs?: number;  // For buffs / insurance with ActiveBuff
  cosmeticType?: CosmeticType;
  dailyEligible?: boolean;  // Can appear in daily rotation
  rankRequired?: ShopRank;  // Minimum shop rank to purchase
  giftable?: boolean;       // Can be sent as a gift
  sourceHint?: string;      // Hint for how to obtain this item (shown in craft view)
}

export interface MysteryBoxLoot {
  type: 'chips' | 'item';
  itemId?: string;
  chipsMin?: bigint;
  chipsMax?: bigint;
  rarity: ItemRarity;
  weight: number;
}

export interface MysteryBoxDefinition extends ShopItem {
  lootTable: MysteryBoxLoot[];
}
