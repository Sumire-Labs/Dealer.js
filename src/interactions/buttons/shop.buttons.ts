import {type ButtonInteraction, MessageFlags} from 'discord.js';
import {registerButtonHandler} from '../handler.js';
import {
  handlePageNext,
  handlePagePrev,
  handleSelDown,
  handleSelUp,
  handleTabCollection,
  handleTabCraft,
  handleTabDaily,
  handleTabShop
} from './shop/navigation-handlers.js';
import {
  handleBuy,
  handleBuyQty,
  handleCancelBuy,
  handleConfirmBuy,
  handleDailyBuy,
  handleFlashBuy
} from './shop/purchase-handlers.js';
import {
  handleCollectionDetail,
  handleConfirmCraft,
  handleCraft,
  handleCraftNext,
  handleCraftPrev
} from './shop/craft-collection-handlers.js';

// Re-export externally referenced state
export {shopState, getState, getRankInfo} from './shop/state.js';

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

    switch (action) {
        // Tab navigation
        case 'tab_shop':
            return handleTabShop(interaction, userId);
        case 'tab_daily':
            return handleTabDaily(interaction, userId);
        case 'tab_craft':
            return handleTabCraft(interaction, userId);
        case 'tab_collection':
            return handleTabCollection(interaction, userId);

        // Page navigation
        case 'page_prev':
            return handlePagePrev(interaction, userId);
        case 'page_next':
            return handlePageNext(interaction, userId);

        // Cursor navigation
        case 'sel_up':
            return handleSelUp(interaction, userId);
        case 'sel_down':
            return handleSelDown(interaction, userId);

        // Purchase flow
        case 'buy':
            return handleBuy(interaction, userId, parts);
        case 'daily_buy':
            return handleDailyBuy(interaction, userId, parts);
        case 'flash_buy':
            return handleFlashBuy(interaction, userId, parts);
        case 'confirm_buy':
            return handleConfirmBuy(interaction, userId, parts);
        case 'cancel_buy':
            return handleCancelBuy(interaction, userId);
        case 'buy_qty':
            return handleBuyQty(interaction, userId, parts);

        // Craft & collection
        case 'craft':
            return handleCraft(interaction, userId, parts);
        case 'confirm_craft':
            return handleConfirmCraft(interaction, userId, parts);
        case 'craft_prev':
            return handleCraftPrev(interaction, userId);
        case 'craft_next':
            return handleCraftNext(interaction, userId);
        case 'collection_detail':
            return handleCollectionDetail(interaction, userId, parts);
    }
}

registerButtonHandler('shop', handleShopButton as never);
