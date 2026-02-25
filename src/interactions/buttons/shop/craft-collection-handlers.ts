import {type ButtonInteraction, ContainerBuilder, MessageFlags, TextDisplayBuilder,} from 'discord.js';
import {craftItem} from '../../../database/services/shop.service.js';
import {getCollectionProgress} from '../../../database/services/collection.service.js';
import {CRAFT_RECIPES} from '../../../config/crafting.js';
import {buildCraftConfirmView, buildCraftListView} from '../../../ui/builders/craft.builder.js';
import {buildCollectionDetailView} from '../../../ui/builders/collection.builder.js';
import {playCraftAnimation} from '../../../ui/animations/craft.animation.js';
import {buildAchievementNotification} from '../../../database/services/achievement.service.js';
import {getInventory} from '../../../database/repositories/shop.repository.js';
import {getState} from './state.js';

export async function handleCraft(interaction: ButtonInteraction, userId: string, parts: string[]): Promise<void> {
  const recipeId = parts[3];
  const recipe = CRAFT_RECIPES.find(r => r.id === recipeId);
  if (!recipe) return;
  const inventory = await getInventory(userId);
  const invMap = new Map(inventory.map(i => [i.itemId, i.quantity]));
  const canCraft = recipe.materials.every(m => (invMap.get(m.itemId) ?? 0) >= m.quantity);
  const view = buildCraftConfirmView(userId, recipe, canCraft);
  await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
}

export async function handleConfirmCraft(interaction: ButtonInteraction, userId: string, parts: string[]): Promise<void> {
  const craftRecipeId = parts[3];
  const recipe = CRAFT_RECIPES.find(r => r.id === craftRecipeId);
  if (!recipe) return;

  // Show processing state for animation
  await interaction.update({
    components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent('⏳ 合成中...'))],
    flags: MessageFlags.IsComponentsV2,
  });

  const result = await craftItem(userId, craftRecipeId);
  if (!result.success) {
    await interaction.followUp({ content: result.error ?? '合成に失敗しました。', flags: MessageFlags.Ephemeral });
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
    await interaction.followUp({ content: buildAchievementNotification(result.newlyUnlocked), flags: MessageFlags.Ephemeral });
  }
}

export async function handleCraftPrev(interaction: ButtonInteraction, userId: string): Promise<void> {
  const state = getState(userId);
  state.craftPage = Math.max(0, state.craftPage - 1);
  const inventory = await getInventory(userId);
  const view = buildCraftListView(userId, CRAFT_RECIPES, inventory, state.craftPage);
  await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
}

export async function handleCraftNext(interaction: ButtonInteraction, userId: string): Promise<void> {
  const state = getState(userId);
  state.craftPage += 1;
  const inventory = await getInventory(userId);
  const view = buildCraftListView(userId, CRAFT_RECIPES, inventory, state.craftPage);
  await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
}

export async function handleCollectionDetail(interaction: ButtonInteraction, userId: string, parts: string[]): Promise<void> {
  const collectionKey = parts[3];
  const progress = await getCollectionProgress(userId);
  const detail = progress.find(p => p.collection.key === collectionKey);
  if (!detail) return;
  const view = buildCollectionDetailView(userId, detail);
  await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
}
