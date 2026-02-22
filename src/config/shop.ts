export type ShopCategory =
  | 'consumable'
  | 'buff'
  | 'upgrade'
  | 'cosmetic'
  | 'mystery'
  | 'insurance'
  | 'tool';

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

// ── Consumables ──

export const CONSUMABLES: ShopItem[] = [
  {
    id: 'MISSION_REROLL',
    name: 'ミッション再抽選',
    emoji: '🎲',
    description: 'ミッションをリセットして再抽選する',
    price: 3_000n,
    category: 'consumable',
    dailyEligible: true,
  },
  {
    id: 'WORK_COOLDOWN_SKIP',
    name: 'クールダウンスキップ',
    emoji: '⚡',
    description: 'シフトのクールダウンを即時リセット',
    price: 5_000n,
    category: 'consumable',
    dailyEligible: true,
  },
  {
    id: 'DAILY_BOOST',
    name: 'デイリーブースト',
    emoji: '📦',
    description: '次回デイリー受取額を2倍にする',
    price: 8_000n,
    category: 'consumable',
    dailyEligible: true,
  },
  {
    id: 'LUCKY_CHARM',
    name: 'ラッキーチャーム',
    emoji: '🍀',
    description: '次の敗北時に賭け金50%返金',
    price: 15_000n,
    category: 'consumable',
    dailyEligible: true,
  },
];

// ── Buffs (24h ActiveBuff) ──

const BUFF_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export const BUFFS: ShopItem[] = [
  {
    id: 'XP_BOOSTER',
    name: 'XPブースター',
    emoji: '🧪',
    description: '24時間、労働XP獲得量+50%',
    price: 10_000n,
    category: 'buff',
    buffDurationMs: BUFF_DURATION_MS,
    dailyEligible: true,
  },
  {
    id: 'INTEREST_BOOSTER',
    name: '利息ブースター',
    emoji: '📈',
    description: '24時間、銀行利息2倍',
    price: 20_000n,
    category: 'buff',
    buffDurationMs: BUFF_DURATION_MS,
    dailyEligible: true,
  },
  {
    id: 'VIP_PASS',
    name: 'VIPパス',
    emoji: '🎫',
    description: '24時間、全ゲーム報酬+5%',
    price: 50_000n,
    category: 'buff',
    buffDurationMs: BUFF_DURATION_MS,
    dailyEligible: true,
  },
];

// ── Permanent Upgrades ──

export const UPGRADES: ShopItem[] = [
  {
    id: 'MISSION_SLOT_PLUS',
    name: 'ミッション枠+1',
    emoji: '📋',
    description: 'デイリーミッション枠を+1する（最大5枠）',
    price: 75_000n,
    category: 'upgrade',
    maxStack: 2,
  },
  {
    id: 'BANK_EXPANSION',
    name: '銀行拡張',
    emoji: '🏦',
    description: '銀行利率を+1%する',
    price: 100_000n,
    category: 'upgrade',
    maxStack: 3,
  },
  {
    id: 'CHIP_FOUNTAIN',
    name: 'チップの泉',
    emoji: '⛲',
    description: 'デイリーボーナス+$500永続',
    price: 150_000n,
    category: 'upgrade',
    maxStack: 1,
  },
  {
    id: 'VIP_CARD',
    name: 'VIPカード',
    emoji: '💎',
    description: '全ゲーム報酬+5%永続',
    price: 500_000n,
    category: 'upgrade',
    maxStack: 1,
  },
  {
    id: 'GOLDEN_DICE',
    name: 'ゴールデンダイス',
    emoji: '🎲',
    description: 'ミッション報酬+20%',
    price: 300_000n,
    category: 'upgrade',
    maxStack: 1,
  },
];

// ── Cosmetics ──

export const COSMETICS: ShopItem[] = [
  {
    id: 'TITLE_HIGH_ROLLER',
    name: 'ハイローラー',
    emoji: '🎰',
    description: '称号: ハイローラー',
    price: 25_000n,
    category: 'cosmetic',
    cosmeticType: 'title',
    maxStack: 1,
  },
  {
    id: 'TITLE_LUCKY_STAR',
    name: 'ラッキースター',
    emoji: '⭐',
    description: '称号: ラッキースター',
    price: 25_000n,
    category: 'cosmetic',
    cosmeticType: 'title',
    maxStack: 1,
  },
  {
    id: 'TITLE_CASINO_KING',
    name: 'カジノの王',
    emoji: '👑',
    description: '称号: カジノの王',
    price: 100_000n,
    category: 'cosmetic',
    cosmeticType: 'title',
    maxStack: 1,
  },
  {
    id: 'TITLE_PHANTOM_THIEF',
    name: '怪盗',
    emoji: '🎭',
    description: '称号: 怪盗',
    price: 50_000n,
    category: 'cosmetic',
    cosmeticType: 'title',
    maxStack: 1,
  },
  {
    id: 'BADGE_DIAMOND',
    name: 'ダイヤバッジ',
    emoji: '💎',
    description: 'バッジ: ダイヤモンド',
    price: 30_000n,
    category: 'cosmetic',
    cosmeticType: 'badge',
    maxStack: 1,
  },
  {
    id: 'BADGE_FLAME',
    name: 'フレイムバッジ',
    emoji: '🔥',
    description: 'バッジ: フレイム',
    price: 30_000n,
    category: 'cosmetic',
    cosmeticType: 'badge',
    maxStack: 1,
  },
  {
    id: 'BADGE_CROWN',
    name: 'クラウンバッジ',
    emoji: '👑',
    description: 'バッジ: クラウン',
    price: 50_000n,
    category: 'cosmetic',
    cosmeticType: 'badge',
    maxStack: 1,
  },
];

// ── Mystery Boxes ──

export const MYSTERY_BOXES: MysteryBoxDefinition[] = [
  {
    id: 'BOX_BRONZE',
    name: 'ブロンズボックス',
    emoji: '📦',
    description: 'チップや消耗品が入ったお手頃ボックス',
    price: 5_000n,
    category: 'mystery',
    dailyEligible: true,
    lootTable: [
      { type: 'chips', chipsMin: 500n, chipsMax: 1_000n, rarity: 'common', weight: 50 },
      { type: 'item', itemId: 'MISSION_REROLL', rarity: 'uncommon', weight: 10 },
      { type: 'item', itemId: 'WORK_COOLDOWN_SKIP', rarity: 'uncommon', weight: 10 },
      { type: 'item', itemId: 'DAILY_BOOST', rarity: 'uncommon', weight: 5 },
      { type: 'item', itemId: 'XP_BOOSTER', rarity: 'rare', weight: 7 },
      { type: 'item', itemId: 'STREAK_SHIELD', rarity: 'rare', weight: 5 },
      { type: 'chips', chipsMin: 2_000n, chipsMax: 3_000n, rarity: 'rare', weight: 10 },
      { type: 'item', itemId: 'BADGE_FLAME', rarity: 'epic', weight: 3 },
    ],
  },
  {
    id: 'BOX_SILVER',
    name: 'シルバーボックス',
    emoji: '🎁',
    description: 'バフやコスメが出やすい上質ボックス',
    price: 25_000n,
    category: 'mystery',
    dailyEligible: true,
    lootTable: [
      { type: 'chips', chipsMin: 5_000n, chipsMax: 10_000n, rarity: 'common', weight: 40 },
      { type: 'item', itemId: 'XP_BOOSTER', rarity: 'uncommon', weight: 10 },
      { type: 'item', itemId: 'INTEREST_BOOSTER', rarity: 'uncommon', weight: 8 },
      { type: 'item', itemId: 'LUCKY_CHARM', rarity: 'uncommon', weight: 7 },
      { type: 'item', itemId: 'TITLE_HIGH_ROLLER', rarity: 'rare', weight: 5 },
      { type: 'item', itemId: 'TITLE_LUCKY_STAR', rarity: 'rare', weight: 5 },
      { type: 'item', itemId: 'BADGE_DIAMOND', rarity: 'rare', weight: 3 },
      { type: 'chips', chipsMin: 15_000n, chipsMax: 20_000n, rarity: 'epic', weight: 10 },
      { type: 'item', itemId: 'VIP_PASS', rarity: 'epic', weight: 5 },
      { type: 'item', itemId: 'SAFETY_NET', rarity: 'epic', weight: 5 },
      { type: 'item', itemId: 'MISSION_SLOT_PLUS', rarity: 'legendary', weight: 2 },
    ],
  },
  {
    id: 'BOX_GOLD',
    name: 'ゴールドボックス',
    emoji: '✨',
    description: '永続アップグレードも出る最高級ボックス',
    price: 100_000n,
    category: 'mystery',
    lootTable: [
      { type: 'chips', chipsMin: 25_000n, chipsMax: 50_000n, rarity: 'common', weight: 30 },
      { type: 'item', itemId: 'VIP_PASS', rarity: 'uncommon', weight: 10 },
      { type: 'item', itemId: 'INTEREST_BOOSTER', rarity: 'uncommon', weight: 8 },
      { type: 'item', itemId: 'SAFETY_NET', rarity: 'uncommon', weight: 7 },
      { type: 'item', itemId: 'TITLE_CASINO_KING', rarity: 'rare', weight: 5 },
      { type: 'item', itemId: 'TITLE_PHANTOM_THIEF', rarity: 'rare', weight: 5 },
      { type: 'item', itemId: 'BADGE_CROWN', rarity: 'rare', weight: 6 },
      { type: 'chips', chipsMin: 60_000n, chipsMax: 80_000n, rarity: 'epic', weight: 5 },
      { type: 'item', itemId: 'MISSION_SLOT_PLUS', rarity: 'epic', weight: 4 },
      { type: 'item', itemId: 'BANK_EXPANSION', rarity: 'epic', weight: 4 },
      { type: 'item', itemId: 'GOLDEN_DICE', rarity: 'legendary', weight: 6 },
      { type: 'item', itemId: 'CHIP_FOUNTAIN', rarity: 'legendary', weight: 5 },
      { type: 'item', itemId: 'VIP_CARD', rarity: 'legendary', weight: 5 },
    ],
  },
];

// ── Insurance ──

export const INSURANCE: ShopItem[] = [
  {
    id: 'STREAK_SHIELD',
    name: 'ストリークシールド',
    emoji: '🛡️',
    description: '24時間、デイリーストリーク切れ防止',
    price: 10_000n,
    category: 'insurance',
    buffDurationMs: BUFF_DURATION_MS,
    dailyEligible: true,
  },
  {
    id: 'BANKRUPTCY_INSURANCE',
    name: '破産保険',
    emoji: '🏥',
    description: '次回破産時に+$5,000',
    price: 30_000n,
    category: 'insurance',
    maxStack: 1,
    dailyEligible: true,
  },
  {
    id: 'SAFETY_NET',
    name: 'セーフティネット',
    emoji: '🪢',
    description: '残高0到達時に+$2,500自動補填（3回分）',
    price: 50_000n,
    category: 'insurance',
    maxStack: 3,
    dailyEligible: true,
  },
];

// ── Work Tools (imported) ──

import { WORK_TOOLS } from './work-tools.js';

// ── All items & lookup ──

export const ALL_ITEMS: ShopItem[] = [
  ...CONSUMABLES,
  ...BUFFS,
  ...UPGRADES,
  ...COSMETICS,
  ...MYSTERY_BOXES,
  ...INSURANCE,
  ...WORK_TOOLS,
];

export const ITEM_MAP = new Map<string, ShopItem>(
  ALL_ITEMS.map(item => [item.id, item]),
);

export const MYSTERY_BOX_MAP = new Map<string, MysteryBoxDefinition>(
  MYSTERY_BOXES.map(box => [box.id, box]),
);

// ── Category structure for UI ──

export const SHOP_CATEGORIES: { key: ShopCategory; label: string; emoji: string; items: ShopItem[] }[] = [
  { key: 'consumable', label: '消耗品', emoji: '🧃', items: CONSUMABLES },
  { key: 'buff', label: 'バフ', emoji: '🧪', items: BUFFS },
  { key: 'upgrade', label: '永続UP', emoji: '⬆️', items: UPGRADES },
  { key: 'cosmetic', label: 'コスメ', emoji: '🎨', items: COSMETICS },
  { key: 'mystery', label: 'ミステリー', emoji: '📦', items: MYSTERY_BOXES },
  { key: 'insurance', label: '保険', emoji: '🛡️', items: INSURANCE },
  { key: 'tool', label: '仕事道具', emoji: '🔧', items: WORK_TOOLS },
];

// ── Daily rotation pool ──

export const DAILY_ELIGIBLE_ITEMS = ALL_ITEMS.filter(item => item.dailyEligible);
export const DAILY_ROTATION_COUNT = 4;
export const DAILY_DISCOUNT_RATE = 20; // 20% off

// ── Rarity display ──

export const RARITY_LABELS: Record<ItemRarity, string> = {
  common: 'コモン',
  uncommon: 'アンコモン',
  rare: 'レア',
  epic: 'エピック',
  legendary: '伝説',
};

export const RARITY_EMOJI: Record<ItemRarity, string> = {
  common: '⬜',
  uncommon: '🟩',
  rare: '🟦',
  epic: '🟪',
  legendary: '🟨',
};

// ── Buff effect constants ──

export const SHOP_EFFECTS = {
  VIP_BONUS_PERCENT: 5n,       // VIP_CARD & VIP_PASS: +5%
  LUCKY_CHARM_REFUND: 50n,     // 50% of bet refunded
  SAFETY_NET_AMOUNT: 2_500n,
  XP_BOOSTER_MULTIPLIER: 1.5,
  CHIP_FOUNTAIN_BONUS: 500n,
  BANK_EXPANSION_RATE: 1n,     // +1% per stack
  GOLDEN_DICE_PERCENT: 20n,    // +20% mission reward
  BANKRUPTCY_INSURANCE_BONUS: 5_000n,
} as const;
