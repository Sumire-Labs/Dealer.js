import { type ButtonInteraction, MessageFlags } from 'discord.js';
import { registerButtonHandler } from '../handler.js';
import { getBalance } from '../../database/services/economy.service.js';
import {
  purchaseItem,
  useItem,
  equipCosmetic,
  unequipCosmetic,
  openMysteryBox,
  getDailyRotation,
  getUserInventorySummary,
  recycleItem,
  craftItem,
  getFlashSale,
} from '../../database/services/shop.service.js';
import { getCollectionProgress } from '../../database/services/collection.service.js';
import {
  SHOP_CATEGORIES,
  ITEM_MAP,
} from '../../config/shop.js';
import { CRAFT_RECIPES } from '../../config/crafting.js';
import { getShopRank, getNextRank } from '../../config/shop-ranks.js';
import {
  buildShopView,
  buildPurchaseConfirmView,
  buildInventoryView,
  buildUseItemResultView,
  buildRecycleConfirmView,
} from '../../ui/builders/shop.builder.js';
import { buildDailyRotationView } from '../../ui/builders/daily-shop.builder.js';
import {
  buildCraftListView,
  buildCraftConfirmView,
} from '../../ui/builders/craft.builder.js';
import {
  buildCollectionListView,
  buildCollectionDetailView,
} from '../../ui/builders/collection.builder.js';
import { playMysteryBoxAnimation } from '../../ui/animations/mystery-box.animation.js';
import { playCraftAnimation } from '../../ui/animations/craft.animation.js';
import { buildAchievementNotification } from '../../database/services/achievement.service.js';
import { formatChips } from '../../utils/formatters.js';
import { getLifetimeShopSpend } from '../../database/repositories/shop.repository.js';
import { getInventory } from '../../database/repositories/shop.repository.js';

// Session state per user
const shopState = new Map<string, { category: number; page: number; invPage: number; craftPage: number; collectionPage: number }>();

function getState(userId: string) {
  if (!shopState.has(userId)) {
    shopState.set(userId, { category: 0, page: 0, invPage: 0, craftPage: 0, collectionPage: 0 });
  }
  return shopState.get(userId)!;
}

async function getRankInfo(userId: string) {
  const spend = await getLifetimeShopSpend(userId);
  const rank = getShopRank(spend);
  const nextRank = getNextRank(rank);
  return { rank, nextRank, lifetimeSpend: spend };
}

async function handleShopButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const action = parts[1];
  const ownerId = parts[2];

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: 'これはあなたのパネルではありません！ `/shop` で開いてください。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const userId = interaction.user.id;
  const state = getState(userId);

  switch (action) {
    // ── Tab navigation ──
    case 'tab_shop': {
      const [balance, rankInfo, flashSale] = await Promise.all([
        getBalance(userId),
        getRankInfo(userId),
        getFlashSale(),
      ]);
      const view = buildShopView(userId, state.category, state.page, balance, rankInfo, flashSale);
      await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
      break;
    }

    case 'tab_inventory': {
      const summary = await getUserInventorySummary(userId);
      const view = buildInventoryView(
        userId,
        summary.inventory,
        summary.activeBuffs,
        summary.activeTitle,
        summary.activeBadge,
        state.invPage,
      );
      await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
      break;
    }

    case 'tab_daily': {
      const balance = await getBalance(userId);
      const rotation = await getDailyRotation();
      const tomorrow = new Date();
      tomorrow.setUTCHours(24, 0, 0, 0);
      const nextReset = Math.floor(tomorrow.getTime() / 1000);

      const view = buildDailyRotationView(userId, rotation.items, balance, nextReset);
      await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
      break;
    }

    case 'tab_craft': {
      const inventory = await getInventory(userId);
      state.craftPage = 0;
      const view = buildCraftListView(userId, CRAFT_RECIPES, inventory, state.craftPage);
      await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
      break;
    }

    case 'tab_collection': {
      const progress = await getCollectionProgress(userId);
      const view = buildCollectionListView(userId, progress);
      await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
      break;
    }

    // ── Category navigation ──
    case 'cat_prev': {
      state.category = (state.category - 1 + SHOP_CATEGORIES.length) % SHOP_CATEGORIES.length;
      state.page = 0;
      const [balance, rankInfo, flashSale] = await Promise.all([
        getBalance(userId),
        getRankInfo(userId),
        getFlashSale(),
      ]);
      const view = buildShopView(userId, state.category, state.page, balance, rankInfo, flashSale);
      await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
      break;
    }

    case 'cat_next': {
      state.category = (state.category + 1) % SHOP_CATEGORIES.length;
      state.page = 0;
      const [balance, rankInfo, flashSale] = await Promise.all([
        getBalance(userId),
        getRankInfo(userId),
        getFlashSale(),
      ]);
      const view = buildShopView(userId, state.category, state.page, balance, rankInfo, flashSale);
      await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
      break;
    }

    // ── Page navigation ──
    case 'page_prev': {
      state.page = Math.max(0, state.page - 1);
      const [balance, rankInfo, flashSale] = await Promise.all([
        getBalance(userId),
        getRankInfo(userId),
        getFlashSale(),
      ]);
      const view = buildShopView(userId, state.category, state.page, balance, rankInfo, flashSale);
      await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
      break;
    }

    case 'page_next': {
      state.page += 1;
      const [balance, rankInfo, flashSale] = await Promise.all([
        getBalance(userId),
        getRankInfo(userId),
        getFlashSale(),
      ]);
      const view = buildShopView(userId, state.category, state.page, balance, rankInfo, flashSale);
      await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
      break;
    }

    // ── Inventory pagination ──
    case 'inv_prev': {
      state.invPage = Math.max(0, state.invPage - 1);
      const summary = await getUserInventorySummary(userId);
      const view = buildInventoryView(
        userId, summary.inventory, summary.activeBuffs,
        summary.activeTitle, summary.activeBadge, state.invPage,
      );
      await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
      break;
    }

    case 'inv_next': {
      state.invPage += 1;
      const summary = await getUserInventorySummary(userId);
      const view = buildInventoryView(
        userId, summary.inventory, summary.activeBuffs,
        summary.activeTitle, summary.activeBadge, state.invPage,
      );
      await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
      break;
    }

    // ── Buy item (show confirmation) ──
    case 'buy': {
      const itemId = parts[3];
      const item = ITEM_MAP.get(itemId);
      if (!item) return;
      const balance = await getBalance(userId);
      const view = buildPurchaseConfirmView(userId, item, balance);
      await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
      break;
    }

    // ── Daily buy (show confirmation with discount) ──
    case 'daily_buy': {
      const dailyIndex = parseInt(parts[3]);
      const rotation = await getDailyRotation();
      const entry = rotation.items[dailyIndex];
      if (!entry) return;
      const item = ITEM_MAP.get(entry.itemId);
      if (!item) return;
      const balance = await getBalance(userId);
      const view = buildPurchaseConfirmView(userId, item, balance, entry.discountedPrice, dailyIndex);
      await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
      break;
    }

    // ── Flash sale buy ──
    case 'flash_buy': {
      const flashItemId = parts[3];
      const flashSale = await getFlashSale();
      if (!flashSale || flashSale.itemId !== flashItemId) {
        await interaction.reply({
          content: 'フラッシュセールは終了しました。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const result = await purchaseItem(userId, flashItemId, flashSale.salePrice);
      if (!result.success) {
        await interaction.reply({
          content: result.error ?? '購入に失敗しました。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const balance = result.newBalance!;
      const [rankInfo, updatedFlashSale] = await Promise.all([
        getRankInfo(userId),
        getFlashSale(),
      ]);
      const view = buildShopView(userId, state.category, state.page, balance, rankInfo, updatedFlashSale);
      await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
      const flashItem = ITEM_MAP.get(flashItemId);
      await interaction.followUp({
        content: `⚡ **${flashItem?.name ?? flashItemId}** をフラッシュセール価格で購入しました！`,
        flags: MessageFlags.Ephemeral,
      });
      if (result.newlyUnlocked && result.newlyUnlocked.length > 0) {
        await interaction.followUp({
          content: buildAchievementNotification(result.newlyUnlocked),
          flags: MessageFlags.Ephemeral,
        });
      }
      break;
    }

    // ── Confirm purchase ──
    case 'confirm_buy': {
      const itemId = parts[3];
      let price: bigint | undefined;

      // Check if this is a daily purchase
      if (parts[4] === 'daily' && parts[5]) {
        const dailyIndex = parseInt(parts[5]);
        const rotation = await getDailyRotation();
        const entry = rotation.items[dailyIndex];
        if (entry) price = entry.discountedPrice;
      }

      const result = await purchaseItem(userId, itemId, price);
      if (!result.success) {
        await interaction.reply({
          content: result.error ?? '購入に失敗しました。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Return to shop view
      const balance = result.newBalance!;
      const [rankInfo, flashSale2] = await Promise.all([
        getRankInfo(userId),
        getFlashSale(),
      ]);
      const view = buildShopView(userId, state.category, state.page, balance, rankInfo, flashSale2);
      await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });

      const item = ITEM_MAP.get(itemId);
      await interaction.followUp({
        content: `✅ **${item?.name ?? itemId}** を購入しました！`,
        flags: MessageFlags.Ephemeral,
      });

      // Achievement notification
      if (result.newlyUnlocked && result.newlyUnlocked.length > 0) {
        await interaction.followUp({
          content: buildAchievementNotification(result.newlyUnlocked),
          flags: MessageFlags.Ephemeral,
        });
      }
      break;
    }

    // ── Cancel purchase ──
    case 'cancel_buy': {
      const [balance, rankInfo, flashSale3] = await Promise.all([
        getBalance(userId),
        getRankInfo(userId),
        getFlashSale(),
      ]);
      const view = buildShopView(userId, state.category, state.page, balance, rankInfo, flashSale3);
      await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
      break;
    }

    // ── Use consumable ──
    case 'use': {
      const itemId = parts[3];
      const result = await useItem(userId, itemId);
      if (!result.success) {
        await interaction.reply({
          content: result.error ?? '使用に失敗しました。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const item = ITEM_MAP.get(itemId);
      const view = buildUseItemResultView(
        userId,
        item?.emoji ?? '✅',
        item?.name ?? itemId,
        result.message ?? '使用しました！',
      );
      await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
      break;
    }

    // ── Equip cosmetic ──
    case 'equip': {
      const itemId = parts[3];
      const result = await equipCosmetic(userId, itemId);
      if (!result.success) {
        await interaction.reply({
          content: result.error ?? '装備に失敗しました。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const summary = await getUserInventorySummary(userId);
      const view = buildInventoryView(
        userId, summary.inventory, summary.activeBuffs,
        summary.activeTitle, summary.activeBadge, state.invPage,
      );
      await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
      break;
    }

    // ── Unequip cosmetic ──
    case 'unequip': {
      const itemId = parts[3];
      const item = ITEM_MAP.get(itemId);
      const cosmeticType = item?.cosmeticType;
      if (cosmeticType) {
        await unequipCosmetic(userId, cosmeticType);
      }
      const summary = await getUserInventorySummary(userId);
      const view = buildInventoryView(
        userId, summary.inventory, summary.activeBuffs,
        summary.activeTitle, summary.activeBadge, state.invPage,
      );
      await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
      break;
    }

    // ── Open mystery box ──
    case 'open_box': {
      const boxId = parts[3];
      const box = ITEM_MAP.get(boxId);
      if (!box) return;

      await interaction.update({
        components: [],
        flags: MessageFlags.IsComponentsV2,
      });

      const result = await openMysteryBox(userId, boxId);
      if (!result.success) {
        await interaction.followUp({
          content: result.error ?? '開封に失敗しました。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const resultName = result.loot!.type === 'chips'
        ? `${formatChips(result.chipsAwarded!)} チップ`
        : (result.lootItem?.name ?? '不明なアイテム');
      const resultEmoji = result.loot!.type === 'chips'
        ? '💰'
        : (result.lootItem?.emoji ?? '❓');

      const balance = result.newBalance ?? await getBalance(userId);

      await playMysteryBoxAnimation(
        interaction,
        userId,
        box.emoji,
        resultEmoji,
        resultName,
        result.rarity!,
        result.chipsAwarded,
        balance,
      );

      if (result.newlyUnlocked && result.newlyUnlocked.length > 0) {
        await interaction.followUp({
          content: buildAchievementNotification(result.newlyUnlocked),
          flags: MessageFlags.Ephemeral,
        });
      }
      break;
    }

    // ── Recycle (show confirmation) ──
    case 'recycle': {
      const itemId = parts[3];
      const item = ITEM_MAP.get(itemId);
      if (!item) return;
      const summary = await getUserInventorySummary(userId);
      const inv = summary.inventory.find(i => i.itemId === itemId);
      const qty = inv?.quantity ?? 0;
      const view = buildRecycleConfirmView(userId, item, 1, qty);
      await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
      break;
    }

    // ── Confirm recycle ──
    case 'confirm_recycle': {
      const recycleItemId = parts[3];
      const recycleQty = parseInt(parts[4]) || 1;
      const result = await recycleItem(userId, recycleItemId, recycleQty);
      if (!result.success) {
        await interaction.reply({
          content: result.error ?? 'リサイクルに失敗しました。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const summary = await getUserInventorySummary(userId);
      const view = buildInventoryView(
        userId, summary.inventory, summary.activeBuffs,
        summary.activeTitle, summary.activeBadge, state.invPage,
      );
      await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });

      const recycledItem = ITEM_MAP.get(recycleItemId);
      await interaction.followUp({
        content: `♻️ **${recycledItem?.name ?? recycleItemId}** をリサイクルし、${formatChips(result.refundAmount!)} を受け取りました！`,
        flags: MessageFlags.Ephemeral,
      });

      if (result.newlyUnlocked && result.newlyUnlocked.length > 0) {
        await interaction.followUp({
          content: buildAchievementNotification(result.newlyUnlocked),
          flags: MessageFlags.Ephemeral,
        });
      }
      break;
    }

    // ── Craft (show confirmation) ──
    case 'craft': {
      const recipeId = parts[3];
      const recipe = CRAFT_RECIPES.find(r => r.id === recipeId);
      if (!recipe) return;
      const inventory = await getInventory(userId);
      const invMap = new Map(inventory.map(i => [i.itemId, i.quantity]));
      const canCraft = recipe.materials.every(m => (invMap.get(m.itemId) ?? 0) >= m.quantity);
      const view = buildCraftConfirmView(userId, recipe, canCraft);
      await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
      break;
    }

    // ── Confirm craft ──
    case 'confirm_craft': {
      const craftRecipeId = parts[3];
      const recipe = CRAFT_RECIPES.find(r => r.id === craftRecipeId);
      if (!recipe) return;

      // Clear UI for animation
      await interaction.update({
        components: [],
        flags: MessageFlags.IsComponentsV2,
      });

      const result = await craftItem(userId, craftRecipeId);
      if (!result.success) {
        await interaction.followUp({
          content: result.error ?? '合成に失敗しました。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await playCraftAnimation(
        interaction,
        userId,
        recipe.name,
        result.resultItem?.emoji ?? '❓',
        result.resultItem?.name ?? 'アイテム',
      );

      if (result.newlyUnlocked && result.newlyUnlocked.length > 0) {
        await interaction.followUp({
          content: buildAchievementNotification(result.newlyUnlocked),
          flags: MessageFlags.Ephemeral,
        });
      }
      break;
    }

    // ── Craft pagination ──
    case 'craft_prev': {
      state.craftPage = Math.max(0, state.craftPage - 1);
      const inventory = await getInventory(userId);
      const view = buildCraftListView(userId, CRAFT_RECIPES, inventory, state.craftPage);
      await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
      break;
    }

    case 'craft_next': {
      state.craftPage += 1;
      const inventory = await getInventory(userId);
      const view = buildCraftListView(userId, CRAFT_RECIPES, inventory, state.craftPage);
      await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
      break;
    }

    // ── Collection detail ──
    case 'collection_detail': {
      const collectionKey = parts[3];
      const progress = await getCollectionProgress(userId);
      const detail = progress.find(p => p.collection.key === collectionKey);
      if (!detail) return;
      const view = buildCollectionDetailView(userId, detail);
      await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
      break;
    }
  }
}

registerButtonHandler('shop', handleShopButton as never);
