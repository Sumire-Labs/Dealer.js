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
import { HELP_TOP_CONTENT, HELP_CATEGORIES, HELP_CATEGORY_MAP } from '../../config/help.js';

function addCategoryButtons(container: ContainerBuilder, userId: string, activeCategoryId?: string): void {
  const row1 = new ActionRowBuilder<ButtonBuilder>();
  const row2 = new ActionRowBuilder<ButtonBuilder>();

  HELP_CATEGORIES.forEach((cat, i) => {
    const isActive = cat.id === activeCategoryId;
    const btn = new ButtonBuilder()
      .setCustomId(`help:cat:${userId}:${cat.id}`)
      .setLabel(`${cat.emoji} ${cat.label}`)
      .setStyle(isActive ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(isActive);
    if (i < 4) row1.addComponents(btn);
    else row2.addComponents(btn);
  });

  container.addActionRowComponents(row1);
  container.addActionRowComponents(row2);
}

export function buildHelpTopView(userId: string): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.help),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(HELP_TOP_CONTENT),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  addCategoryButtons(container, userId);
  return container;
}

export function buildHelpCategoryView(userId: string, categoryId: string): ContainerBuilder {
  const category = HELP_CATEGORY_MAP.get(categoryId);
  if (!category) return buildHelpTopView(userId);

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.help),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(category.content),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  // Back to top button
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`help:top:${userId}`)
        .setLabel('🔙 トップに戻る')
        .setStyle(ButtonStyle.Primary),
    ),
  );

  addCategoryButtons(container, userId, categoryId);
  return container;
}
