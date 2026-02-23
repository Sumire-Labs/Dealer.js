import { prisma } from '../client.js';
import { findOrCreateUser } from '../repositories/user.repository.js';
import {
  getInventoryItem,
  upsertInventoryItem,
  decrementInventoryItem,
  createActiveBuff,
  getActiveBuffs,
  getInventory,
  incrementLifetimeShopSpend,
  setActiveTitle,
  setActiveBadge,
  markEverOwned,
  getLifetimeShopSpend,
} from '../repositories/shop.repository.js';
import { addChips } from './economy.service.js';
import { checkAchievements } from './achievement.service.js';
import type { AchievementDefinition } from '../../config/achievements.js';
import {
  ITEM_MAP,
  MYSTERY_BOX_MAP,
  DAILY_ELIGIBLE_ITEMS,
  DAILY_ROTATION_COUNT,
  DAILY_DISCOUNT_RATE,
  SHOP_EFFECTS,
  GOLDEN_BOX_LOOT,
  type ShopItem,
  type MysteryBoxLoot,
  type ItemRarity,
  RARITY_EMOJI,
  RARITY_LABELS,
} from '../../config/shop.js';
import { SHOP_RANKS, getShopRank, getRankDiscount } from '../../config/shop-ranks.js';
import { RECIPE_MAP } from '../../config/crafting.js';
import { getSetting, upsertSetting } from '../repositories/setting.repository.js';
import { weightedRandom, secureRandomInt, shuffleArray } from '../../utils/random.js';
import { deleteCooldownsForUser } from '../../utils/cooldown.js';
import { assignDailyMissions } from './mission.service.js';
import { checkAndCompleteCollections } from './collection.service.js';

// ── Purchase ──

export interface PurchaseResult {
  success: boolean;
  error?: string;
  newBalance?: bigint;
  newlyUnlocked?: AchievementDefinition[];
}

export async function purchaseItem(
  userId: string,
  itemId: string,
  priceOverride?: bigint,
): Promise<PurchaseResult> {
  const item = ITEM_MAP.get(itemId);
  if (!item) return { success: false, error: 'アイテムが見つかりません。' };

  // Rank restriction check
  if (item.rankRequired) {
    const spend = await getLifetimeShopSpend(userId);
    const rank = getShopRank(spend);
    const requiredIdx = SHOP_RANKS.findIndex(r => r.rank === item.rankRequired);
    const currentIdx = SHOP_RANKS.findIndex(r => r.rank === rank.rank);
    if (currentIdx < requiredIdx) {
      return { success: false, error: `ランク「${SHOP_RANKS[requiredIdx].label}」以上が必要です。` };
    }
  }

  // Apply rank discount if no override
  let price = priceOverride ?? item.price;
  if (!priceOverride && item.price > 0n) {
    const spend = await getLifetimeShopSpend(userId);
    const discount = getRankDiscount(spend);
    if (discount > 0) {
      price = price - (price * BigInt(discount)) / 100n;
    }
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

    if (user.chips < price) {
      return { success: false, error: 'チップが不足しています。' };
    }

    // Check max stack for upgrades/cosmetics
    if (item.maxStack) {
      const existing = await getInventoryItem(userId, itemId);
      if (existing && existing.quantity >= item.maxStack) {
        return { success: false, error: 'これ以上購入できません（上限）。' };
      }
    }

    // Deduct chips
    const updated = await tx.user.update({
      where: { id: userId },
      data: { chips: { decrement: price } },
    });

    // Record transaction
    await tx.transaction.create({
      data: {
        userId,
        type: 'SHOP_BUY',
        amount: -price,
        balanceAfter: updated.chips,
        metadata: { itemId, itemName: item.name },
      },
    });

    // Add to inventory or activate buff
    if (item.category === 'buff' || (item.category === 'insurance' && item.buffDurationMs)) {
      await createActiveBuff(userId, itemId, item.buffDurationMs!, tx);
    } else {
      await upsertInventoryItem(userId, itemId, 1, tx);
    }

    // Mark as ever owned (for collections)
    await markEverOwned(userId, itemId, tx);

    // Track lifetime spend
    const totalSpend = await incrementLifetimeShopSpend(userId, price, tx);

    // Achievement checks
    let newlyUnlocked: AchievementDefinition[] = [];
    try {
      newlyUnlocked = await checkAchievements({
        userId,
        context: 'shop',
        newBalance: updated.chips,
        metadata: {
          action: 'buy',
          itemId,
          lifetimeShopSpend: Number(totalSpend),
        },
      });
    } catch {
      // Never block purchase
    }

    // Check collections
    try {
      const collResult = await checkAndCompleteCollections(userId);
      if (collResult.newlyUnlocked.length > 0) {
        newlyUnlocked.push(...collResult.newlyUnlocked);
      }
    } catch {
      // Never block
    }

    return {
      success: true,
      newBalance: updated.chips,
      newlyUnlocked,
    };
  });
}

// ── Recycle ──

export interface RecycleResult {
  success: boolean;
  error?: string;
  refundAmount?: bigint;
  newBalance?: bigint;
  newlyUnlocked?: AchievementDefinition[];
}

export async function recycleItem(
  userId: string,
  itemId: string,
  quantity: number = 1,
): Promise<RecycleResult> {
  const item = ITEM_MAP.get(itemId);
  if (!item) return { success: false, error: 'アイテムが見つかりません。' };
  if (item.price <= 0n) return { success: false, error: 'このアイテムはリサイクルできません。' };
  if (item.category === 'craft') return { success: false, error: 'クラフトアイテムはリサイクルできません。' };

  const refundPerItem = (item.price * BigInt(SHOP_EFFECTS.RECYCLE_REFUND_RATE)) / 100n;
  const totalRefund = refundPerItem * BigInt(quantity);

  return prisma.$transaction(async (tx) => {
    // Check inventory
    const inv = await getInventoryItem(userId, itemId);
    if (!inv || inv.quantity < quantity) {
      return { success: false, error: 'アイテムが不足しています。' };
    }

    // Decrement inventory
    await decrementInventoryItem(userId, itemId, quantity, tx);

    // Add chips
    const updated = await tx.user.update({
      where: { id: userId },
      data: { chips: { increment: totalRefund } },
    });

    // Record transaction
    await tx.transaction.create({
      data: {
        userId,
        type: 'SHOP_RECYCLE',
        amount: totalRefund,
        balanceAfter: updated.chips,
        metadata: { itemId, itemName: item.name, quantity, refundPerItem: refundPerItem.toString() },
      },
    });

    // Achievement checks
    let newlyUnlocked: AchievementDefinition[] = [];
    try {
      newlyUnlocked = await checkAchievements({
        userId,
        context: 'shop',
        newBalance: updated.chips,
        metadata: { action: 'recycle', itemId },
      });
    } catch {
      // Never block
    }

    return {
      success: true,
      refundAmount: totalRefund,
      newBalance: updated.chips,
      newlyUnlocked,
    };
  });
}

// ── Craft ──

export interface CraftResult {
  success: boolean;
  error?: string;
  resultItem?: ShopItem;
  newlyUnlocked?: AchievementDefinition[];
}

export async function craftItem(
  userId: string,
  recipeId: string,
): Promise<CraftResult> {
  const recipe = RECIPE_MAP.get(recipeId);
  if (!recipe) return { success: false, error: 'レシピが見つかりません。' };

  const resultItem = ITEM_MAP.get(recipe.resultItemId);
  if (!resultItem) return { success: false, error: '成果物が見つかりません。' };

  return prisma.$transaction(async (tx) => {
    // Check all materials
    for (const mat of recipe.materials) {
      const inv = await getInventoryItem(userId, mat.itemId);
      if (!inv || inv.quantity < mat.quantity) {
        const matItem = ITEM_MAP.get(mat.itemId);
        return {
          success: false,
          error: `素材「${matItem?.name ?? mat.itemId}」が不足しています（${inv?.quantity ?? 0}/${mat.quantity}）。`,
        };
      }
    }

    // Consume materials
    for (const mat of recipe.materials) {
      await decrementInventoryItem(userId, mat.itemId, mat.quantity, tx);
    }

    // Grant result
    if (resultItem.buffDurationMs) {
      await createActiveBuff(userId, recipe.resultItemId, resultItem.buffDurationMs, tx);
    } else {
      await upsertInventoryItem(userId, recipe.resultItemId, recipe.resultQuantity, tx);
    }
    await markEverOwned(userId, recipe.resultItemId, tx);

    // Record transaction
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    await tx.transaction.create({
      data: {
        userId,
        type: 'SHOP_CRAFT',
        amount: 0n,
        balanceAfter: user.chips,
        metadata: {
          recipeId,
          recipeName: recipe.name,
          resultItemId: recipe.resultItemId,
        },
      },
    });

    // Achievement checks
    let newlyUnlocked: AchievementDefinition[] = [];
    try {
      newlyUnlocked = await checkAchievements({
        userId,
        context: 'shop',
        metadata: { action: 'craft', recipeId },
      });
    } catch {
      // Never block
    }

    // Check collections
    try {
      const collResult = await checkAndCompleteCollections(userId);
      if (collResult.newlyUnlocked.length > 0) {
        newlyUnlocked.push(...collResult.newlyUnlocked);
      }
    } catch {
      // Never block
    }

    return { success: true, resultItem, newlyUnlocked };
  });
}

// ── Use consumable ──

export interface UseItemResult {
  success: boolean;
  error?: string;
  message?: string;
  newBalance?: bigint;
}

export async function useItem(
  userId: string,
  itemId: string,
): Promise<UseItemResult> {
  const item = ITEM_MAP.get(itemId);
  if (!item) return { success: false, error: 'アイテムが見つかりません。' };

  switch (itemId) {
    case 'MISSION_REROLL':
      return useMissionReroll(userId);
    case 'WORK_COOLDOWN_SKIP':
      return useWorkCooldownSkip(userId);
    default:
      return { success: false, error: 'このアイテムは直接使用できません。' };
  }
}

async function useMissionReroll(userId: string): Promise<UseItemResult> {
  const consumed = await decrementInventoryItem(userId, 'MISSION_REROLL');
  if (!consumed) return { success: false, error: 'アイテムを所持していません。' };

  const today = new Date().toISOString().slice(0, 10);

  // Delete today's incomplete missions
  await prisma.dailyMission.deleteMany({
    where: { userId, date: today, completed: false },
  });

  // Re-assign missions
  await assignDailyMissions(userId);

  return { success: true, message: 'ミッションを再抽選しました！' };
}

async function useWorkCooldownSkip(userId: string): Promise<UseItemResult> {
  const consumed = await decrementInventoryItem(userId, 'WORK_COOLDOWN_SKIP');
  if (!consumed) return { success: false, error: 'アイテムを所持していません。' };

  // Delete all work-related cooldowns
  deleteCooldownsForUser(userId, 'work_');

  return { success: true, message: 'シフトのクールダウンをリセットしました！' };
}

// ── Equip cosmetic ──

export interface EquipResult {
  success: boolean;
  error?: string;
}

export async function equipCosmetic(
  userId: string,
  itemId: string,
): Promise<EquipResult> {
  const item = ITEM_MAP.get(itemId);
  if (!item || item.category !== 'cosmetic') {
    return { success: false, error: 'コスメアイテムではありません。' };
  }

  // Check ownership
  const inv = await getInventoryItem(userId, itemId);
  if (!inv || inv.quantity <= 0) {
    return { success: false, error: 'アイテムを所持していません。' };
  }

  if (item.cosmeticType === 'title') {
    await setActiveTitle(userId, itemId);
  } else {
    await setActiveBadge(userId, itemId);
  }

  return { success: true };
}

export async function unequipCosmetic(
  userId: string,
  type: 'title' | 'badge',
): Promise<void> {
  if (type === 'title') {
    await setActiveTitle(userId, null);
  } else {
    await setActiveBadge(userId, null);
  }
}

// ── Open mystery box ──

export interface OpenBoxResult {
  success: boolean;
  error?: string;
  loot?: MysteryBoxLoot;
  lootItem?: ShopItem;
  chipsAwarded?: bigint;
  rarity?: ItemRarity;
  rarityLabel?: string;
  rarityEmoji?: string;
  newBalance?: bigint;
  newlyUnlocked?: AchievementDefinition[];
}

export async function openMysteryBox(
  userId: string,
  boxId: string,
): Promise<OpenBoxResult> {
  // Handle Golden Box (craft-only legendary box)
  if (boxId === 'GOLDEN_BOX') {
    return openGoldenBox(userId);
  }

  const box = MYSTERY_BOX_MAP.get(boxId);
  if (!box) return { success: false, error: 'ボックスが見つかりません。' };

  // Check & consume from inventory
  const consumed = await decrementInventoryItem(userId, boxId);
  if (!consumed) return { success: false, error: 'ボックスを所持していません。' };

  // Roll loot
  const lootEntries = box.lootTable.map(entry => ({
    value: entry,
    weight: entry.weight,
  }));
  const loot = weightedRandom(lootEntries);

  let chipsAwarded = 0n;
  let newBalance: bigint | undefined;

  if (loot.type === 'chips') {
    const min = Number(loot.chipsMin!);
    const max = Number(loot.chipsMax!);
    chipsAwarded = BigInt(secureRandomInt(min, max));
    newBalance = await addChips(userId, chipsAwarded, 'SHOP_REFUND');
  } else if (loot.itemId) {
    const lootItemDef = ITEM_MAP.get(loot.itemId);
    if (lootItemDef) {
      if (lootItemDef.category === 'buff' || (lootItemDef.category === 'insurance' && lootItemDef.buffDurationMs)) {
        await createActiveBuff(userId, loot.itemId, lootItemDef.buffDurationMs!);
      } else {
        await upsertInventoryItem(userId, loot.itemId, 1);
      }
      await markEverOwned(userId, loot.itemId);
    }
  }

  const lootItem = loot.itemId ? ITEM_MAP.get(loot.itemId) : undefined;

  // Achievement check for legendary loot
  let newlyUnlocked: AchievementDefinition[] = [];
  try {
    if (loot.rarity === 'legendary') {
      newlyUnlocked = await checkAchievements({
        userId,
        context: 'shop',
        metadata: { action: 'open_box', rarity: loot.rarity, boxId },
      });
    }
  } catch {
    // Never block box opening
  }

  // Check collections
  try {
    const collResult = await checkAndCompleteCollections(userId);
    if (collResult.newlyUnlocked.length > 0) {
      newlyUnlocked.push(...collResult.newlyUnlocked);
    }
  } catch {
    // Never block
  }

  return {
    success: true,
    loot,
    lootItem,
    chipsAwarded,
    rarity: loot.rarity,
    rarityLabel: RARITY_LABELS[loot.rarity],
    rarityEmoji: RARITY_EMOJI[loot.rarity],
    newBalance,
    newlyUnlocked,
  };
}

async function openGoldenBox(userId: string): Promise<OpenBoxResult> {
  const consumed = await decrementInventoryItem(userId, 'GOLDEN_BOX');
  if (!consumed) return { success: false, error: 'ボックスを所持していません。' };

  const lootEntries = GOLDEN_BOX_LOOT.map(entry => ({
    value: entry,
    weight: entry.weight,
  }));
  const loot = weightedRandom(lootEntries);

  let chipsAwarded = 0n;
  let newBalance: bigint | undefined;

  if (loot.type === 'chips') {
    const min = Number(loot.chipsMin!);
    const max = Number(loot.chipsMax!);
    chipsAwarded = BigInt(secureRandomInt(min, max));
    newBalance = await addChips(userId, chipsAwarded, 'SHOP_REFUND');
  } else if (loot.itemId) {
    const lootItemDef = ITEM_MAP.get(loot.itemId);
    if (lootItemDef) {
      await upsertInventoryItem(userId, loot.itemId, 1);
      await markEverOwned(userId, loot.itemId);
    }
  }

  const lootItem = loot.itemId ? ITEM_MAP.get(loot.itemId) : undefined;

  let newlyUnlocked: AchievementDefinition[] = [];
  try {
    newlyUnlocked = await checkAchievements({
      userId,
      context: 'shop',
      metadata: { action: 'open_box', rarity: 'legendary', boxId: 'GOLDEN_BOX' },
    });
  } catch { /* Never block */ }

  return {
    success: true,
    loot,
    lootItem,
    chipsAwarded,
    rarity: 'legendary',
    rarityLabel: RARITY_LABELS.legendary,
    rarityEmoji: RARITY_EMOJI.legendary,
    newBalance,
    newlyUnlocked,
  };
}

// ── Flash Sale ──

export interface FlashSale {
  itemId: string;
  originalPrice: bigint;
  salePrice: bigint;
  expiresAt: number; // unix ms
}

export async function getFlashSale(): Promise<FlashSale | null> {
  const stored = await getSetting('flash_sale') as {
    itemId: string;
    originalPrice: string;
    salePrice: string;
    expiresAt: number;
  } | null;

  if (!stored) return null;
  if (Date.now() > stored.expiresAt) return null;

  return {
    itemId: stored.itemId,
    originalPrice: BigInt(stored.originalPrice),
    salePrice: BigInt(stored.salePrice),
    expiresAt: stored.expiresAt,
  };
}

export async function generateFlashSale(): Promise<FlashSale | null> {
  const eligible = DAILY_ELIGIBLE_ITEMS.filter(i => i.price > 0n);
  if (eligible.length === 0) return null;

  const shuffled = shuffleArray(eligible);
  const pick = shuffled[0];
  const salePrice = pick.price - (pick.price * 40n) / 100n; // 40% off
  const expiresAt = Date.now() + 2 * 60 * 60 * 1000; // 2 hours

  const sale: FlashSale = {
    itemId: pick.id,
    originalPrice: pick.price,
    salePrice,
    expiresAt,
  };

  await upsertSetting('flash_sale', {
    itemId: sale.itemId,
    originalPrice: sale.originalPrice.toString(),
    salePrice: sale.salePrice.toString(),
    expiresAt: sale.expiresAt,
  });

  return sale;
}

export async function checkAndRefreshFlashSale(): Promise<boolean> {
  const current = await getFlashSale();
  if (!current) {
    await generateFlashSale();
    return true;
  }
  return false;
}

// ── Daily rotation ──

export interface DailyRotation {
  date: string;
  items: { itemId: string; originalPrice: bigint; discountedPrice: bigint }[];
}

export async function getDailyRotation(): Promise<DailyRotation> {
  const today = new Date().toISOString().slice(0, 10);

  // Check if already generated for today
  const stored = await getSetting('shop_rotation') as { date: string; items: { itemId: string; originalPrice: string; discountedPrice: string }[] } | null;
  if (stored && stored.date === today) {
    return {
      date: stored.date,
      items: stored.items.map(i => ({
        itemId: i.itemId,
        originalPrice: BigInt(i.originalPrice),
        discountedPrice: BigInt(i.discountedPrice),
      })),
    };
  }

  // Generate new rotation
  return generateDailyRotation(today);
}

export async function generateDailyRotation(date: string): Promise<DailyRotation> {
  const shuffled = shuffleArray(DAILY_ELIGIBLE_ITEMS);
  const picks = shuffled.slice(0, DAILY_ROTATION_COUNT);

  const items = picks.map(item => ({
    itemId: item.id,
    originalPrice: item.price,
    discountedPrice: item.price - (item.price * BigInt(DAILY_DISCOUNT_RATE)) / 100n,
  }));

  // Persist
  await upsertSetting('shop_rotation', {
    date,
    items: items.map(i => ({
      itemId: i.itemId,
      originalPrice: i.originalPrice.toString(),
      discountedPrice: i.discountedPrice.toString(),
    })),
  });

  return { date, items };
}

export async function checkAndRefreshRotation(): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const stored = await getSetting('shop_rotation') as { date: string } | null;

  if (!stored || stored.date !== today) {
    await generateDailyRotation(today);
    return true;
  }
  return false;
}

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
