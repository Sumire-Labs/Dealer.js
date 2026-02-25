import {MessageFlags, type ModalSubmitInteraction} from 'discord.js';
import {registerModalHandler} from '../handler.js';
import {purchaseItem} from '../../database/services/shop.service.js';
import {getBalance} from '../../database/services/economy.service.js';
import {ITEM_MAP} from '../../config/shop.js';
import {buildPurchaseResultView} from '../../ui/builders/shop.builder.js';
import {buildAchievementNotification} from '../../database/services/achievement.service.js';

async function handleShopModal(interaction: ModalSubmitInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const action = parts[1];
  const ownerId = parts[2];

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: 'これはあなたのパネルではありません！',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const userId = interaction.user.id;

  if (action === 'buy_qty') {
    const itemId = parts[3];
    const qtyStr = interaction.fields.getTextInputValue('quantity').trim();
    const quantity = parseInt(qtyStr);

    if (isNaN(quantity) || quantity < 1 || quantity > 10) {
      await interaction.reply({
        content: '1〜10の数量を入力してください。',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const item = ITEM_MAP.get(itemId);
    if (!item) {
      await interaction.reply({
        content: 'アイテムが見つかりません。',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Purchase multiple
    let lastResult;
    for (let i = 0; i < quantity; i++) {
      lastResult = await purchaseItem(userId, itemId);
      if (!lastResult.success) {
        await interaction.reply({
          content: `${i}個目まで購入完了。${lastResult.error}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    const balance = lastResult?.newBalance ?? await getBalance(userId);
    const view = buildPurchaseResultView(userId, item, balance);
    await interaction.reply({
      components: [view],
      flags: MessageFlags.IsComponentsV2,
    });

    if (lastResult?.newlyUnlocked && lastResult.newlyUnlocked.length > 0) {
      await interaction.followUp({
        content: buildAchievementNotification(lastResult.newlyUnlocked),
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

registerModalHandler('shop_modal', handleShopModal as never);
