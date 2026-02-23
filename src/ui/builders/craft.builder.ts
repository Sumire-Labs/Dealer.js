import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { CasinoTheme } from '../themes/casino.theme.js';
import { ITEM_MAP } from '../../config/shop.js';
import type { CraftRecipe } from '../../config/crafting.js';
import type { UserInventory } from '@prisma/client';

const RECIPES_PER_PAGE = 3;

export function buildCraftListView(
  userId: string,
  recipes: CraftRecipe[],
  inventory: UserInventory[],
  page: number,
): ContainerBuilder {
  const totalPages = Math.max(1, Math.ceil(recipes.length / RECIPES_PER_PAGE));
  const start = page * RECIPES_PER_PAGE;
  const pageRecipes = recipes.slice(start, start + RECIPES_PER_PAGE);
  const invMap = new Map(inventory.map(i => [i.itemId, i.quantity]));

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('🔨 **クラフト**'),
  );
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  if (pageRecipes.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('レシピがありません。'),
    );
  } else {
    const lines: string[] = [];
    for (const recipe of pageRecipes) {
      const materialLines = recipe.materials.map(m => {
        const item = ITEM_MAP.get(m.itemId);
        const owned = invMap.get(m.itemId) ?? 0;
        const enough = owned >= m.quantity ? '✅' : '❌';
        return `  ${enough} ${item?.emoji ?? '❓'} ${item?.name ?? m.itemId} (${owned}/${m.quantity})`;
      });
      const resultItem = ITEM_MAP.get(recipe.resultItemId);
      lines.push(`${recipe.emoji} **${recipe.name}**`);
      lines.push(`  → ${resultItem?.emoji ?? '❓'} ${resultItem?.name ?? recipe.resultItemId}`);
      lines.push(...materialLines);
      lines.push('');
    }
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(lines.join('\n')),
    );
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Craft buttons
  if (pageRecipes.length > 0) {
    const craftRow = new ActionRowBuilder<ButtonBuilder>();
    for (const recipe of pageRecipes) {
      const canCraft = recipe.materials.every(m => (invMap.get(m.itemId) ?? 0) >= m.quantity);
      craftRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`shop:craft:${userId}:${recipe.id}`)
          .setLabel(`${recipe.emoji} 合成`)
          .setStyle(canCraft ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setDisabled(!canCraft),
      );
    }
    container.addActionRowComponents(craftRow);
  }

  // Pagination
  if (totalPages > 1) {
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`shop:craft_prev:${userId}`)
          .setLabel('◀')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId(`shop:craft_info:${userId}`)
          .setLabel(`${page + 1}/${totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`shop:craft_next:${userId}`)
          .setLabel('▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= totalPages - 1),
      ),
    );
  }

  return container;
}

export function buildCraftConfirmView(
  userId: string,
  recipe: CraftRecipe,
  canCraft: boolean,
): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold);

  const resultItem = ITEM_MAP.get(recipe.resultItemId);
  const materialLines = recipe.materials.map(m => {
    const item = ITEM_MAP.get(m.itemId);
    return `  ${item?.emoji ?? '❓'} ${item?.name ?? m.itemId} x${m.quantity}`;
  });

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('🔨 **クラフト確認**'),
  );
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      [
        `${recipe.emoji} **${recipe.name}**`,
        `${recipe.description}`,
        '',
        '📦 素材:',
        ...materialLines,
        '',
        `→ ${resultItem?.emoji ?? '❓'} **${resultItem?.name ?? recipe.resultItemId}** x${recipe.resultQuantity}`,
      ].join('\n'),
    ),
  );
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`shop:confirm_craft:${userId}:${recipe.id}`)
        .setLabel('✅ 合成する')
        .setStyle(ButtonStyle.Success)
        .setDisabled(!canCraft),
      new ButtonBuilder()
        .setCustomId(`shop:tab_craft:${userId}`)
        .setLabel('❌ キャンセル')
        .setStyle(ButtonStyle.Danger),
    ),
  );

  return container;
}

export function buildCraftResultView(
  userId: string,
  _recipeName: string,
  resultEmoji: string,
  resultName: string,
): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('🔨 **クラフト完了！**'),
  );
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `${resultEmoji} **${resultName}** を入手しました！`,
    ),
  );
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`shop:tab_craft:${userId}`)
        .setLabel('🔨 クラフトに戻る')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`shop:tab_inventory:${userId}`)
        .setLabel('🎒 インベントリ')
        .setStyle(ButtonStyle.Secondary),
    ),
  );

  return container;
}
