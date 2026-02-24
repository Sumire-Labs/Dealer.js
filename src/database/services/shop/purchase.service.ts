import { prisma } from '../../client.js';
import {
  getInventoryItem,
  upsertInventoryItem,
  createActiveBuff,
  incrementLifetimeShopSpend,
  markEverOwned,
  getLifetimeShopSpend,
} from '../../repositories/shop.repository.js';
import { checkAchievements } from '../achievement.service.js';
import type { AchievementDefinition } from '../../../config/achievements.js';
import { ITEM_MAP } from '../../../config/shop.js';
import { SHOP_RANKS, getShopRank, getRankDiscount } from '../../../config/shop-ranks.js';
import { checkAndCompleteCollections } from '../collection.service.js';

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
