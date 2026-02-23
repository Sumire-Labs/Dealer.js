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
import type { LeaderboardCategory } from '../../database/repositories/leaderboard.repository.js';

export const LEADERBOARD_PAGE_SIZE = 10;

export const LEADERBOARD_CATEGORIES: { id: LeaderboardCategory; label: string; emoji: string }[] = [
  { id: 'chips', label: 'チップ', emoji: '💰' },
  { id: 'net_worth', label: '総資産', emoji: '🏦' },
  { id: 'total_won', label: '累計勝利', emoji: '🏆' },
  { id: 'work_level', label: '仕事Lv', emoji: '💼' },
  { id: 'shop_spend', label: 'ショップ', emoji: '🛒' },
  { id: 'achievements', label: '実績', emoji: '🏅' },
];

export interface LeaderboardDisplayEntry {
  userId: string;
  value: string;
  subValue?: string;
}

export interface LeaderboardDisplayData {
  entries: LeaderboardDisplayEntry[];
  category: LeaderboardCategory;
  categoryLabel: string;
  requesterId: string;
  requesterRank: number;
  requesterValue: string;
  page: number;
  totalPages: number;
}

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

export function buildLeaderboardView(data: LeaderboardDisplayData): ContainerBuilder {
  const {
    entries, category, categoryLabel,
    requesterId, requesterRank, requesterValue,
    page, totalPages,
  } = data;

  const offset = page * LEADERBOARD_PAGE_SIZE;
  const lines = entries.map((entry, i) => {
    const absoluteRank = offset + i;
    const medal = RANK_MEDALS[absoluteRank] ?? `**${absoluteRank + 1}.**`;
    const isRequester = entry.userId === requesterId;
    const name = isRequester ? '**あなた**' : `<@${entry.userId}>`;
    const highlight = isRequester ? ' ◀' : '';
    return `${medal} ${name} — ${entry.value}${highlight}`;
  });

  const boardText = lines.length > 0
    ? lines.join('\n')
    : '*まだプレイヤーがいません。*';

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.leaderboard),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`${categoryLabel}\n${boardText}`),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `あなたの順位: **#${requesterRank}** | ${requesterValue}\nページ: ${page + 1} / ${totalPages}`,
      ),
    );

  // Category buttons — row 1 (first 3) and row 2 (last 3)
  const catRow1 = new ActionRowBuilder<ButtonBuilder>();
  const catRow2 = new ActionRowBuilder<ButtonBuilder>();

  LEADERBOARD_CATEGORIES.forEach((cat, i) => {
    const btn = new ButtonBuilder()
      .setCustomId(`lb:cat:${requesterId}:${cat.id}`)
      .setLabel(`${cat.emoji} ${cat.label}`)
      .setStyle(cat.id === category ? ButtonStyle.Primary : ButtonStyle.Secondary);
    if (i < 3) catRow1.addComponents(btn);
    else catRow2.addComponents(btn);
  });

  container.addActionRowComponents(catRow1);
  container.addActionRowComponents(catRow2);

  // Pagination buttons
  if (totalPages > 1) {
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`lb:prev:${requesterId}:${page}:${category}`)
          .setLabel('◀ 前へ')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page <= 0),
        new ButtonBuilder()
          .setCustomId(`lb:next:${requesterId}:${page}:${category}`)
          .setLabel('▶ 次へ')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= totalPages - 1),
      ),
    );
  }

  return container;
}
