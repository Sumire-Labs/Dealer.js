import { prisma } from '../../client.js';
import {
  getInventoryItem,
  decrementInventoryItem,
  setActiveTitle,
  setActiveBadge,
} from '../../repositories/shop.repository.js';
import { ITEM_MAP } from '../../../config/shop.js';
import { deleteCooldownsForUser } from '../../../utils/cooldown.js';
import { assignDailyMissions } from '../mission.service.js';

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
