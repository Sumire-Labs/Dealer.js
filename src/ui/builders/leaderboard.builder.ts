import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
} from 'discord.js';
import { CasinoTheme } from '../themes/casino.theme.js';
import { formatChips } from '../../utils/formatters.js';

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
}

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

export function buildLeaderboardView(data: LeaderboardDisplayData): ContainerBuilder {
  const { entries, requesterId, requesterRank, requesterChips } = data;

  const lines = entries.map((entry, i) => {
    const medal = RANK_MEDALS[i] ?? `**${i + 1}.**`;
    const isRequester = entry.userId === requesterId;
    const name = isRequester ? '**You**' : `<@${entry.userId}>`;
    const highlight = isRequester ? ' ◀' : '';
    return `${medal} ${name} — ${formatChips(entry.chips)} (${entry.totalGames} games)${highlight}`;
  });

  const boardText = lines.length > 0
    ? lines.join('\n')
    : '*No players yet.*';

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
        `Your Rank: **#${requesterRank}** | ${formatChips(requesterChips)}`,
      ),
    );

  return container;
}
