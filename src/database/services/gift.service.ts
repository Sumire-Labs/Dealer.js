import { prisma } from '../client.js';
import { findOrCreateUser } from '../repositories/user.repository.js';
import {
  getInventoryItem,
  upsertInventoryItem,
  decrementInventoryItem,
  markEverOwned,
} from '../repositories/shop.repository.js';
import { checkAchievements } from './achievement.service.js';
import { ITEM_MAP, SHOP_EFFECTS } from '../../config/shop.js';
import type { AchievementDefinition } from '../../config/achievements.js';
import { getSetting, upsertSetting } from '../repositories/setting.repository.js';

const MAX_GIFTS_PER_DAY = 5;

// ── Gift count tracking ──

function getGiftCountKey(userId: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `gift_count:${userId}:${today}`;
}

async function getGiftCount(userId: string): Promise<number> {
  const val = await getSetting(getGiftCountKey(userId)) as number | null;
  return val ?? 0;
}

async function incrementGiftCount(userId: string): Promise<void> {
  const key = getGiftCountKey(userId);
  const current = await getGiftCount(userId);
  await upsertSetting(key, current + 1);
}

// ── Send gift item ──

export interface GiftItemResult {
  success: boolean;
  error?: string;
  newlyUnlocked?: AchievementDefinition[];
}

export async function sendGiftItem(
  senderId: string,
  receiverId: string,
  itemId: string,
  quantity: number = 1,
): Promise<GiftItemResult> {
  if (senderId === receiverId) {
    return { success: false, error: '自分自身にギフトは送れません。' };
  }

  const item = ITEM_MAP.get(itemId);
  if (!item) return { success: false, error: 'アイテムが見つかりません。' };
  if (!item.giftable) return { success: false, error: 'このアイテムはギフトできません。' };

  // Check daily limit
  const giftCount = await getGiftCount(senderId);
  if (giftCount >= MAX_GIFTS_PER_DAY) {
    return { success: false, error: `本日のギフト上限（${MAX_GIFTS_PER_DAY}回）に達しています。` };
  }

  return prisma.$transaction(async (tx) => {
    // Ensure both users exist
    await findOrCreateUser(senderId);
    await findOrCreateUser(receiverId);

    // Check sender inventory
    const inv = await getInventoryItem(senderId, itemId);
    if (!inv || inv.quantity < quantity) {
      return { success: false, error: 'アイテムが不足しています。' };
    }

    // Transfer: decrement sender, increment receiver
    const decremented = await decrementInventoryItem(senderId, itemId, quantity, tx);
    if (!decremented) {
      return { success: false, error: 'アイテムの消費に失敗しました。' };
    }
    await upsertInventoryItem(receiverId, itemId, quantity, tx);
    await markEverOwned(receiverId, itemId, tx);

    // Record transactions
    const senderUser = await tx.user.findUniqueOrThrow({ where: { id: senderId } });
    const receiverUser = await tx.user.findUniqueOrThrow({ where: { id: receiverId } });

    await tx.transaction.create({
      data: {
        userId: senderId,
        type: 'GIFT_SEND',
        amount: 0n,
        balanceAfter: senderUser.chips,
        metadata: { itemId, itemName: item.name, quantity, receiverId },
      },
    });
    await tx.transaction.create({
      data: {
        userId: receiverId,
        type: 'GIFT_RECEIVE',
        amount: 0n,
        balanceAfter: receiverUser.chips,
        metadata: { itemId, itemName: item.name, quantity, senderId },
      },
    });

    // Increment gift count
    await incrementGiftCount(senderId);

    // Achievement checks
    let newlyUnlocked: AchievementDefinition[] = [];
    try {
      const totalGifts = (await getGiftCount(senderId));
      newlyUnlocked = await checkAchievements({
        userId: senderId,
        context: 'shop',
        metadata: { action: 'gift_send', giftCount: totalGifts },
      });
    } catch {
      // Never block
    }

    return { success: true, newlyUnlocked };
  });
}

// ── Send gift chips ──

export interface GiftChipsResult {
  success: boolean;
  error?: string;
  fee?: bigint;
  netAmount?: bigint;
  senderBalance?: bigint;
  receiverBalance?: bigint;
  newlyUnlocked?: AchievementDefinition[];
}

export async function sendGiftChips(
  senderId: string,
  receiverId: string,
  amount: bigint,
): Promise<GiftChipsResult> {
  if (senderId === receiverId) {
    return { success: false, error: '自分自身にチップは送れません。' };
  }
  if (amount <= 0n) {
    return { success: false, error: '送金額は1以上にしてください。' };
  }

  // Check daily limit
  const giftCount = await getGiftCount(senderId);
  if (giftCount >= MAX_GIFTS_PER_DAY) {
    return { success: false, error: `本日のギフト上限（${MAX_GIFTS_PER_DAY}回）に達しています。` };
  }

  const fee = (amount * BigInt(SHOP_EFFECTS.GIFT_FEE_RATE)) / 100n;
  const totalDeduction = amount + fee;

  return prisma.$transaction(async (tx) => {
    const sender = await tx.user.findUniqueOrThrow({ where: { id: senderId } });
    await findOrCreateUser(receiverId);

    if (sender.chips < totalDeduction) {
      return { success: false, error: `チップが不足しています（手数料${SHOP_EFFECTS.GIFT_FEE_RATE}%込み）。` };
    }

    // Transfer
    const updatedSender = await tx.user.update({
      where: { id: senderId },
      data: { chips: { decrement: totalDeduction } },
    });
    const updatedReceiver = await tx.user.update({
      where: { id: receiverId },
      data: { chips: { increment: amount } },
    });

    // Record transactions
    await tx.transaction.create({
      data: {
        userId: senderId,
        type: 'GIFT_SEND',
        amount: -totalDeduction,
        balanceAfter: updatedSender.chips,
        metadata: { chips: amount.toString(), fee: fee.toString(), receiverId },
      },
    });
    await tx.transaction.create({
      data: {
        userId: receiverId,
        type: 'GIFT_RECEIVE',
        amount,
        balanceAfter: updatedReceiver.chips,
        metadata: { chips: amount.toString(), senderId },
      },
    });

    // Increment gift count
    await incrementGiftCount(senderId);

    // Achievement checks
    let newlyUnlocked: AchievementDefinition[] = [];
    try {
      const totalGifts = (await getGiftCount(senderId));
      newlyUnlocked = await checkAchievements({
        userId: senderId,
        context: 'shop',
        metadata: { action: 'gift_send', giftCount: totalGifts },
      });
    } catch {
      // Never block
    }

    return {
      success: true,
      fee,
      netAmount: amount,
      senderBalance: updatedSender.chips,
      receiverBalance: updatedReceiver.chips,
      newlyUnlocked,
    };
  });
}

export async function getRemainingGifts(userId: string): Promise<number> {
  const count = await getGiftCount(userId);
  return Math.max(0, MAX_GIFTS_PER_DAY - count);
}
