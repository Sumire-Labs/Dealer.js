import {prisma} from '../../client.js';
import {decrementInventoryItem, getInventoryItem,} from '../../repositories/shop.repository.js';
import {checkAchievements} from '../achievement.service.js';
import type {AchievementDefinition} from '../../../config/achievements.js';
import {ITEM_MAP, SHOP_EFFECTS} from '../../../config/shop.js';

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
