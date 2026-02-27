import {type ButtonInteraction, MessageFlags} from 'discord.js';
import {getBalance} from '../../../database/services/economy.service.js';
import {getDailyRotation, getFlashSale} from '../../../database/services/shop.service.js';
import {getCollectionProgress} from '../../../database/services/collection.service.js';
import {CRAFT_RECIPES} from '../../../config/crafting.js';
import {SHOP_CATEGORIES} from '../../../config/shop.js';
import {buildShopView, ITEMS_PER_PAGE} from '../../../ui/builders/shop.builder.js';
import {buildDailyRotationView} from '../../../ui/builders/daily-shop.builder.js';
import {buildCraftListView} from '../../../ui/builders/craft.builder.js';
import {buildCollectionListView} from '../../../ui/builders/collection.builder.js';
import {getInventory} from '../../../database/repositories/shop.repository.js';
import {getRankInfo, getState} from './state.js';

const RECIPES_PER_PAGE = 3;

export async function handleTabShop(interaction: ButtonInteraction, userId: string): Promise<void> {
    const state = getState(userId);
    state.selected = 0;
    const [balance, rankInfo, flashSale] = await Promise.all([
        getBalance(userId),
        getRankInfo(userId),
        getFlashSale(),
    ]);
    const view = buildShopView(userId, state.category, state.page, balance, rankInfo, flashSale, state.selected);
    await interaction.update({components: [view], flags: MessageFlags.IsComponentsV2});
}

export async function handleTabDaily(interaction: ButtonInteraction, userId: string): Promise<void> {
    const state = getState(userId);
    state.dailySelected = 0;
    const balance = await getBalance(userId);
    const rotation = await getDailyRotation();
    const tomorrow = new Date();
    tomorrow.setUTCHours(24, 0, 0, 0);
    const nextReset = Math.floor(tomorrow.getTime() / 1000);
    const view = buildDailyRotationView(userId, rotation.items, balance, nextReset, state.dailySelected);
    await interaction.update({components: [view], flags: MessageFlags.IsComponentsV2});
}

export async function handleTabCraft(interaction: ButtonInteraction, userId: string): Promise<void> {
    const state = getState(userId);
    const inventory = await getInventory(userId);
    state.craftPage = 0;
    state.craftSelected = 0;
    const view = buildCraftListView(userId, CRAFT_RECIPES, inventory, state.craftPage, state.craftSelected);
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
    state.selected = 0;
    const [balance, rankInfo, flashSale] = await Promise.all([
        getBalance(userId),
        getRankInfo(userId),
        getFlashSale(),
    ]);
    const view = buildShopView(userId, state.category, state.page, balance, rankInfo, flashSale, state.selected);
    await interaction.update({components: [view], flags: MessageFlags.IsComponentsV2});
}

export async function handlePageNext(interaction: ButtonInteraction, userId: string): Promise<void> {
    const state = getState(userId);
    state.page += 1;
    state.selected = 0;
    const [balance, rankInfo, flashSale] = await Promise.all([
        getBalance(userId),
        getRankInfo(userId),
        getFlashSale(),
    ]);
    const view = buildShopView(userId, state.category, state.page, balance, rankInfo, flashSale, state.selected);
    await interaction.update({components: [view], flags: MessageFlags.IsComponentsV2});
}

export async function handleSelUp(interaction: ButtonInteraction, userId: string): Promise<void> {
    const state = getState(userId);
    const cat = SHOP_CATEGORIES[state.category];
    const count = Math.min(ITEMS_PER_PAGE, cat.items.length - state.page * ITEMS_PER_PAGE);
    state.selected = (state.selected - 1 + count) % count;
    const [balance, rankInfo, flashSale] = await Promise.all([
        getBalance(userId),
        getRankInfo(userId),
        getFlashSale(),
    ]);
    const view = buildShopView(userId, state.category, state.page, balance, rankInfo, flashSale, state.selected);
    await interaction.update({components: [view], flags: MessageFlags.IsComponentsV2});
}

export async function handleSelDown(interaction: ButtonInteraction, userId: string): Promise<void> {
    const state = getState(userId);
    const cat = SHOP_CATEGORIES[state.category];
    const count = Math.min(ITEMS_PER_PAGE, cat.items.length - state.page * ITEMS_PER_PAGE);
    state.selected = (state.selected + 1) % count;
    const [balance, rankInfo, flashSale] = await Promise.all([
        getBalance(userId),
        getRankInfo(userId),
        getFlashSale(),
    ]);
    const view = buildShopView(userId, state.category, state.page, balance, rankInfo, flashSale, state.selected);
    await interaction.update({components: [view], flags: MessageFlags.IsComponentsV2});
}

// ── Craft cursor navigation ──

export async function handleCraftSelUp(interaction: ButtonInteraction, userId: string): Promise<void> {
    const state = getState(userId);
    const count = Math.min(RECIPES_PER_PAGE, CRAFT_RECIPES.length - state.craftPage * RECIPES_PER_PAGE);
    if (count > 0) {
        state.craftSelected = (state.craftSelected - 1 + count) % count;
    }
    const inventory = await getInventory(userId);
    const view = buildCraftListView(userId, CRAFT_RECIPES, inventory, state.craftPage, state.craftSelected);
    await interaction.update({components: [view], flags: MessageFlags.IsComponentsV2});
}

export async function handleCraftSelDown(interaction: ButtonInteraction, userId: string): Promise<void> {
    const state = getState(userId);
    const count = Math.min(RECIPES_PER_PAGE, CRAFT_RECIPES.length - state.craftPage * RECIPES_PER_PAGE);
    if (count > 0) {
        state.craftSelected = (state.craftSelected + 1) % count;
    }
    const inventory = await getInventory(userId);
    const view = buildCraftListView(userId, CRAFT_RECIPES, inventory, state.craftPage, state.craftSelected);
    await interaction.update({components: [view], flags: MessageFlags.IsComponentsV2});
}

// ── Daily cursor navigation ──

export async function handleDailySelUp(interaction: ButtonInteraction, userId: string): Promise<void> {
    const state = getState(userId);
    const rotation = await getDailyRotation();
    const count = rotation.items.length;
    if (count > 0) {
        state.dailySelected = (state.dailySelected - 1 + count) % count;
    }
    const balance = await getBalance(userId);
    const tomorrow = new Date();
    tomorrow.setUTCHours(24, 0, 0, 0);
    const nextReset = Math.floor(tomorrow.getTime() / 1000);
    const view = buildDailyRotationView(userId, rotation.items, balance, nextReset, state.dailySelected);
    await interaction.update({components: [view], flags: MessageFlags.IsComponentsV2});
}

export async function handleDailySelDown(interaction: ButtonInteraction, userId: string): Promise<void> {
    const state = getState(userId);
    const rotation = await getDailyRotation();
    const count = rotation.items.length;
    if (count > 0) {
        state.dailySelected = (state.dailySelected + 1) % count;
    }
    const balance = await getBalance(userId);
    const tomorrow = new Date();
    tomorrow.setUTCHours(24, 0, 0, 0);
    const nextReset = Math.floor(tomorrow.getTime() / 1000);
    const view = buildDailyRotationView(userId, rotation.items, balance, nextReset, state.dailySelected);
    await interaction.update({components: [view], flags: MessageFlags.IsComponentsV2});
}
