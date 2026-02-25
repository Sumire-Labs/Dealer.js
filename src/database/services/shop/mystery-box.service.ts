import {
    createActiveBuff,
    decrementInventoryItem,
    markEverOwned,
    upsertInventoryItem,
} from '../../repositories/shop.repository.js';
import {addChips} from '../economy.service.js';
import {checkAchievements} from '../achievement.service.js';
import type {AchievementDefinition} from '../../../config/achievements.js';
import {
    GOLDEN_BOX_LOOT,
    ITEM_MAP,
    type ItemRarity,
    MYSTERY_BOX_MAP,
    type MysteryBoxLoot,
    RARITY_EMOJI,
    RARITY_LABELS,
    type ShopItem,
} from '../../../config/shop.js';
import {secureRandomInt, weightedRandom} from '../../../utils/random.js';
import {checkAndCompleteCollections} from '../collection.service.js';

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
