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
import { formatChips } from '../../utils/formatters.js';

export const LEADERBOARD_PAGE_SIZE = 10;

export interface LeaderboardDisplayEntry {
  userId: string;
  chips: bigint;
  totalGames: number;
}

export interface LeaderboardDisplayData {
  entries: LeaderboardDisplayEntry[];
  requesterId: string;
  requesterRank: number;
  requesterChips: bigint;
  page: number;
  totalPages: number;
}

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

export function buildLeaderboardView(data: LeaderboardDisplayData): ContainerBuilder {
  const { entries, requesterId, requesterRank, requesterChips, page, totalPages } = data;

  const offset = page * LEADERBOARD_PAGE_SIZE;
  const lines = entries.map((entry, i) => {
    const absoluteRank = offset + i;
    const medal = RANK_MEDALS[absoluteRank] ?? `**${absoluteRank + 1}.**`;
    const isRequester = entry.userId === requesterId;
    const name = isRequester ? '**あなた**' : `<@${entry.userId}>`;
    const highlight = isRequester ? ' ◀' : '';
    return `${medal} ${name} — ${formatChips(entry.chips)}（${entry.totalGames}回）${highlight}`;
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
      new TextDisplayBuilder().setContent(boardText),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `あなたの順位: **#${requesterRank}** | ${formatChips(requesterChips)}\nページ: ${page + 1} / ${totalPages}`,
      ),
    );

  if (totalPages > 1) {
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`lb:prev:${requesterId}:${page}`)
          .setLabel('◀')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page <= 0),
        new ButtonBuilder()
          .setCustomId(`lb:next:${requesterId}:${page}`)
          .setLabel('▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= totalPages - 1),
      ),
    );
  }

  return container;
}
