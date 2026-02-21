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
import {
  ACHIEVEMENTS,
  ACHIEVEMENTS_BY_CATEGORY,
  type AchievementCategory,
  type AchievementDefinition,
} from '../../config/achievements.js';

export type AchievementTab = 'all' | AchievementCategory;

const ITEMS_PER_PAGE = 5;

const TAB_LABELS: Record<AchievementTab, string> = {
  all: '全て',
  gaming: '🎮',
  economy: '💰',
  social: '🤝',
  special: '⭐',
};

export function buildAchievementsView(
  userId: string,
  targetId: string,
  username: string,
  unlockedIds: Set<string>,
  tab: AchievementTab = 'all',
  page: number = 0,
): ContainerBuilder {
  const achievements = tab === 'all'
    ? ACHIEVEMENTS
    : ACHIEVEMENTS_BY_CATEGORY.get(tab) ?? [];

  const totalUnlocked = ACHIEVEMENTS.filter(a => unlockedIds.has(a.id)).length;
  const totalCount = ACHIEVEMENTS.length;
  const totalPages = Math.max(1, Math.ceil(achievements.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages - 1);
  const start = currentPage * ITEMS_PER_PAGE;
  const pageItems = achievements.slice(start, start + ITEMS_PER_PAGE);

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${CasinoTheme.prefixes.achievements}\n**${username}** (${totalUnlocked}/${totalCount} 解除)`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  // Achievement list
  const lines = pageItems.map(a => formatAchievementLine(a, unlockedIds));
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(lines.join('\n') || 'なし'),
  );

  // Pagination
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  if (totalPages > 1) {
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`ach:page:${userId}:${targetId}:${tab}:${currentPage - 1}`)
          .setLabel('◀')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage === 0),
        new ButtonBuilder()
          .setCustomId(`ach:info:${userId}`)
          .setLabel(`${currentPage + 1}/${totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`ach:page:${userId}:${targetId}:${tab}:${currentPage + 1}`)
          .setLabel('▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage >= totalPages - 1),
      ),
    );
  }

  // Tab buttons
  const tabs: AchievementTab[] = ['all', 'gaming', 'economy', 'social', 'special'];
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...tabs.map(t =>
        new ButtonBuilder()
          .setCustomId(`ach:tab:${userId}:${targetId}:${t}`)
          .setLabel(TAB_LABELS[t])
          .setStyle(t === tab ? ButtonStyle.Primary : ButtonStyle.Secondary)
          .setDisabled(t === tab),
      ),
    ),
  );

  return container;
}

function formatAchievementLine(
  achievement: AchievementDefinition,
  unlockedIds: Set<string>,
): string {
  const isUnlocked = unlockedIds.has(achievement.id);

  if (isUnlocked) {
    return `${achievement.emoji} **${achievement.name}** ✅`;
  }

  if (achievement.hidden) {
    return '❓ **???** 🔒 ???';
  }

  return `${achievement.emoji} **${achievement.name}** 🔒 ${achievement.description}`;
}
