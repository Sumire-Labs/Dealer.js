import {type ButtonInteraction, MessageFlags} from 'discord.js';
import {getBalance} from '../../../database/services/economy.service.js';
import {getDailyRotation, getFlashSale} from '../../../database/services/shop.service.js';
import {getCollectionProgress} from '../../../database/services/collection.service.js';
import {CRAFT_RECIPES} from '../../../config/crafting.js';
import {buildShopView} from '../../../ui/builders/shop.builder.js';
import {buildDailyRotationView} from '../../../ui/builders/daily-shop.builder.js';
import {buildCraftListView} from '../../../ui/builders/craft.builder.js';
import {buildCollectionListView} from '../../../ui/builders/collection.builder.js';
import {getInventory} from '../../../database/repositories/shop.repository.js';
import {getRankInfo, getState} from './state.js';

export async function handleTabShop(interaction: ButtonInteraction, userId: string): Promise<void> {
    const state = getState(userId);
    const [balance, rankInfo, flashSale] = await Promise.all([
        getBalance(userId),
        getRankInfo(userId),
        getFlashSale(),
    ]);
    const view = buildShopView(userId, state.category, state.page, balance, rankInfo, flashSale);
    await interaction.update({components: [view], flags: MessageFlags.IsComponentsV2});
}

export async function handleTabDaily(interaction: ButtonInteraction, userId: string): Promise<void> {
    const balance = await getBalance(userId);
    const rotation = await getDailyRotation();
    const tomorrow = new Date();
    tomorrow.setUTCHours(24, 0, 0, 0);
    const nextReset = Math.floor(tomorrow.getTime() / 1000);
    const view = buildDailyRotationView(userId, rotation.items, balance, nextReset);
    await interaction.update({components: [view], flags: MessageFlags.IsComponentsV2});
}

export async function handleTabCraft(interaction: ButtonInteraction, userId: string): Promise<void> {
    const state = getState(userId);
    const inventory = await getInventory(userId);
    state.craftPage = 0;
    const view = buildCraftListView(userId, CRAFT_RECIPES, inventory, state.craftPage);
    await interaction.update({components: [view], flags: MessageFlags.IsComponentsV2});
}

export async function handleTabCollection(interaction: ButtonInteraction, userId: string): Promise<void> {
    const progress = await getCollectionProgress(userId);
    const view = buildCollectionListView(userId, progress);
    await interaction.update({components: [view], flags: MessageFlags.IsComponentsV2});
}

export async function handlePagePrev(interaction: ButtonInteraction, userId: string): Promise<void> {
    const state = getState(userId);
    state.page = Math.max(0, state.page - 1);
    const [balance, rankInfo, flashSale] = await Promise.all([
        getBalance(userId),
        getRankInfo(userId),
        getFlashSale(),
    ]);
    const view = buildShopView(userId, state.category, state.page, balance, rankInfo, flashSale);
    await interaction.update({components: [view], flags: MessageFlags.IsComponentsV2});
}

export async function handlePageNext(interaction: ButtonInteraction, userId: string): Promise<void> {
    const state = getState(userId);
    state.page += 1;
    const [balance, rankInfo, flashSale] = await Promise.all([
        getBalance(userId),
        getRankInfo(userId),
        getFlashSale(),
    ]);
    const view = buildShopView(userId, state.category, state.page, balance, rankInfo, flashSale);
    await interaction.update({components: [view], flags: MessageFlags.IsComponentsV2});
}
