import {
  type StringSelectMenuInteraction,
  MessageFlags,
} from 'discord.js';
import { registerSelectMenuHandler } from '../handler.js';
import { getBalance } from '../../database/services/economy.service.js';
import { getFlashSale } from '../../database/services/shop.service.js';
import { SHOP_CATEGORIES } from '../../config/shop.js';
import { getState, getRankInfo } from '../buttons/shop.buttons.js';
import { buildShopView } from '../../ui/builders/shop.builder.js';

async function handleShopSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
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

  const catIdx = parseInt(interaction.values[0]);
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
}

registerSelectMenuHandler('shop_select', handleShopSelectMenu as never);
