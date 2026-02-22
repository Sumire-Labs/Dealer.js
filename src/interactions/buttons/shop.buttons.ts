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
} from '../../database/services/shop.service.js';
import {
  SHOP_CATEGORIES,
  ITEM_MAP,
} from '../../config/shop.js';
import {
  buildShopView,
  buildPurchaseConfirmView,
  buildInventoryView,
  buildDailyRotationView,
  buildUseItemResultView,
} from '../../ui/builders/shop.builder.js';
import { playMysteryBoxAnimation } from '../../ui/animations/mystery-box.animation.js';
import { buildAchievementNotification } from '../../database/services/achievement.service.js';
import { formatChips } from '../../utils/formatters.js';

// Session state per user: category index + page
const shopState = new Map<string, { category: number; page: number; invPage: number }>();

function getState(userId: string) {
  if (!shopState.has(userId)) {
    shopState.set(userId, { category: 0, page: 0, invPage: 0 });
  }
  return shopState.get(userId)!;
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
      const balance = await getBalance(userId);
      const view = buildShopView(userId, state.category, state.page, balance);
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

    // ── Category navigation ──
    case 'cat_prev': {
      state.category = (state.category - 1 + SHOP_CATEGORIES.length) % SHOP_CATEGORIES.length;
      state.page = 0;
      const balance = await getBalance(userId);
      const view = buildShopView(userId, state.category, state.page, balance);
      await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
      break;
    }

    case 'cat_next': {
      state.category = (state.category + 1) % SHOP_CATEGORIES.length;
      state.page = 0;
      const balance = await getBalance(userId);
      const view = buildShopView(userId, state.category, state.page, balance);
      await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
      break;
    }

    // ── Page navigation ──
    case 'page_prev': {
      state.page = Math.max(0, state.page - 1);
      const balance = await getBalance(userId);
      const view = buildShopView(userId, state.category, state.page, balance);
      await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
      break;
    }

    case 'page_next': {
      state.page += 1;
      const balance = await getBalance(userId);
      const view = buildShopView(userId, state.category, state.page, balance);
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
      const view = buildShopView(userId, state.category, state.page, balance);
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
      const balance = await getBalance(userId);
      const view = buildShopView(userId, state.category, state.page, balance);
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
      // Refresh inventory
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

      // Show opening animation
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

      // Get current balance
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

      // Achievement notification
      if (result.newlyUnlocked && result.newlyUnlocked.length > 0) {
        await interaction.followUp({
          content: buildAchievementNotification(result.newlyUnlocked),
          flags: MessageFlags.Ephemeral,
        });
      }
      break;
    }
  }
}

registerButtonHandler('shop', handleShopButton as never);
