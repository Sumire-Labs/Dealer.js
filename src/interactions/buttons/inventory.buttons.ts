import { type ButtonInteraction, MessageFlags, ContainerBuilder, TextDisplayBuilder } from 'discord.js';
import { registerButtonHandler } from '../handler.js';
import { getBalance } from '../../database/services/economy.service.js';
import {
  useItem,
  equipCosmetic,
  unequipCosmetic,
  openMysteryBox,
  getUserInventorySummary,
  recycleItem,
} from '../../database/services/shop.service.js';
import { ITEM_MAP } from '../../config/shop.js';
import {
  buildInventoryView,
  buildUseItemResultView,
  buildRecycleConfirmView,
} from '../../ui/builders/inventory.builder.js';
import { playMysteryBoxAnimation } from '../../ui/animations/mystery-box.animation.js';
import { buildAchievementNotification } from '../../database/services/achievement.service.js';
import { formatChips } from '../../utils/formatters.js';

// Session state per user
const invState = new Map<string, { page: number; filter: string }>();

export function getInvState(userId: string) {
  if (!invState.has(userId)) {
    if (invState.size > 10_000) invState.clear();
    invState.set(userId, { page: 0, filter: 'all' });
  }
  return invState.get(userId)!;
}

async function handleInventoryButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const action = parts[1];
  const ownerId = parts[2];

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: 'これはあなたのインベントリではありません！ `/inv` で開いてください。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const userId = interaction.user.id;
  const state = getInvState(userId);

  switch (action) {
    // ── Back to inventory ──
    case 'back': {
      const summary = await getUserInventorySummary(userId);
      const view = buildInventoryView(
        userId, summary.inventory, summary.activeBuffs,
        summary.activeTitle, summary.activeBadge, state.page, state.filter,
      );
      await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
      break;
    }

    // ── Pagination ──
    case 'prev': {
      state.page = Math.max(0, state.page - 1);
      const summary = await getUserInventorySummary(userId);
      const view = buildInventoryView(
        userId, summary.inventory, summary.activeBuffs,
        summary.activeTitle, summary.activeBadge, state.page, state.filter,
      );
      await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
      break;
    }

    case 'next': {
      state.page += 1;
      const summary = await getUserInventorySummary(userId);
      const view = buildInventoryView(
        userId, summary.inventory, summary.activeBuffs,
        summary.activeTitle, summary.activeBadge, state.page, state.filter,
      );
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
        summary.activeTitle, summary.activeBadge, state.page, state.filter,
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
        summary.activeTitle, summary.activeBadge, state.page, state.filter,
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
        components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent('⏳ 開封中...'))],
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
        summary.activeTitle, summary.activeBadge, state.page, state.filter,
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
  }
}

registerButtonHandler('inv', handleInventoryButton as never);
