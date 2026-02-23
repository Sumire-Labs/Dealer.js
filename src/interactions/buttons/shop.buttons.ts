import {
  type ButtonInteraction,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  type ModalActionRowComponentBuilder,
} from 'discord.js';
import { registerButtonHandler } from '../handler.js';
import { getBalance } from '../../database/services/economy.service.js';
import {
  purchaseItem,
  getDailyRotation,
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
import { playCraftAnimation } from '../../ui/animations/craft.animation.js';
import { buildAchievementNotification } from '../../database/services/achievement.service.js';
import { getLifetimeShopSpend } from '../../database/repositories/shop.repository.js';
import { getInventory } from '../../database/repositories/shop.repository.js';

// Session state per user
const shopState = new Map<string, { category: number; page: number; craftPage: number; collectionPage: number }>();

function getState(userId: string) {
  if (!shopState.has(userId)) {
    shopState.set(userId, { category: 0, page: 0, craftPage: 0, collectionPage: 0 });
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

    // ── Category selection (direct button) ──
    case 'cat_select': {
      const catIdx = parseInt(parts[3]);
      if (!isNaN(catIdx) && catIdx >= 0 && catIdx < SHOP_CATEGORIES.length) {
        state.category = catIdx;
        state.page = 0;
      }
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

    // ── Multi-buy modal ──
    case 'buy_qty': {
      const itemId = parts[3];
      const item = ITEM_MAP.get(itemId);
      if (!item) return;

      const modal = new ModalBuilder()
        .setCustomId(`shop_modal:buy_qty:${userId}:${itemId}`)
        .setTitle(`${item.name} を複数購入`);

      const qtyInput = new TextInputBuilder()
        .setCustomId('quantity')
        .setLabel('購入数量 (1〜10)')
        .setStyle(TextInputStyle.Short)
        .setMinLength(1)
        .setMaxLength(2)
        .setPlaceholder('1〜10')
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(qtyInput),
      );

      await interaction.showModal(modal);
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
