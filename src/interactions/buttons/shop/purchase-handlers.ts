import {
  type ButtonInteraction,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  type ModalActionRowComponentBuilder,
} from 'discord.js';
import { getBalance } from '../../../database/services/economy.service.js';
import { purchaseItem, getDailyRotation, getFlashSale } from '../../../database/services/shop.service.js';
import { ITEM_MAP } from '../../../config/shop.js';
import { buildShopView, buildPurchaseConfirmView, buildPurchaseResultView } from '../../../ui/builders/shop.builder.js';
import { buildAchievementNotification } from '../../../database/services/achievement.service.js';
import { getState, getRankInfo } from './state.js';

export async function handleBuy(interaction: ButtonInteraction, userId: string, parts: string[]): Promise<void> {
  const itemId = parts[3];
  const item = ITEM_MAP.get(itemId);
  if (!item) return;
  const balance = await getBalance(userId);
  const view = buildPurchaseConfirmView(userId, item, balance);
  await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
}

export async function handleDailyBuy(interaction: ButtonInteraction, userId: string, parts: string[]): Promise<void> {
  const dailyIndex = parseInt(parts[3]);
  const rotation = await getDailyRotation();
  const entry = rotation.items[dailyIndex];
  if (!entry) return;
  const item = ITEM_MAP.get(entry.itemId);
  if (!item) return;
  const balance = await getBalance(userId);
  const view = buildPurchaseConfirmView(userId, item, balance, entry.discountedPrice, dailyIndex);
  await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
}

export async function handleFlashBuy(interaction: ButtonInteraction, userId: string, parts: string[]): Promise<void> {
  const flashItemId = parts[3];
  const flashSale = await getFlashSale();
  if (!flashSale || flashSale.itemId !== flashItemId) {
    await interaction.reply({ content: 'フラッシュセールは終了しました。', flags: MessageFlags.Ephemeral });
    return;
  }
  const result = await purchaseItem(userId, flashItemId, flashSale.salePrice);
  if (!result.success) {
    await interaction.reply({ content: result.error ?? '購入に失敗しました。', flags: MessageFlags.Ephemeral });
    return;
  }
  const item = ITEM_MAP.get(flashItemId);
  const view = buildPurchaseResultView(userId, item!, result.newBalance!);
  await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
  if (result.newlyUnlocked && result.newlyUnlocked.length > 0) {
    await interaction.followUp({ content: buildAchievementNotification(result.newlyUnlocked), flags: MessageFlags.Ephemeral });
  }
}

export async function handleConfirmBuy(interaction: ButtonInteraction, userId: string, parts: string[]): Promise<void> {
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
    await interaction.reply({ content: result.error ?? '購入に失敗しました。', flags: MessageFlags.Ephemeral });
    return;
  }

  const item = ITEM_MAP.get(itemId);
  const view = buildPurchaseResultView(userId, item!, result.newBalance!);
  await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });

  if (result.newlyUnlocked && result.newlyUnlocked.length > 0) {
    await interaction.followUp({ content: buildAchievementNotification(result.newlyUnlocked), flags: MessageFlags.Ephemeral });
  }
}

export async function handleCancelBuy(interaction: ButtonInteraction, userId: string): Promise<void> {
  const state = getState(userId);
  const [balance, rankInfo, flashSale] = await Promise.all([getBalance(userId), getRankInfo(userId), getFlashSale()]);
  const view = buildShopView(userId, state.category, state.page, balance, rankInfo, flashSale);
  await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
}

export async function handleBuyQty(interaction: ButtonInteraction, userId: string, parts: string[]): Promise<void> {
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
}
