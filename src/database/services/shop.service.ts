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
  type ShopItem,
  type MysteryBoxLoot,
  type ItemRarity,
  RARITY_EMOJI,
  RARITY_LABELS,
} from '../../config/shop.js';
import { getSetting, upsertSetting } from '../repositories/setting.repository.js';
import { weightedRandom, secureRandomInt, shuffleArray } from '../../utils/random.js';
import { deleteCooldownsForUser } from '../../utils/cooldown.js';
import { assignDailyMissions } from './mission.service.js';

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

  const price = priceOverride ?? item.price;

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

    return {
      success: true,
      newBalance: updated.chips,
      newlyUnlocked,
    };
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
  };
}
