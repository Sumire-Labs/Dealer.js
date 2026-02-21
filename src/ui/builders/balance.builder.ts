import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
} from 'discord.js';
import { CasinoTheme } from '../themes/casino.theme.js';
import { formatChips } from '../../utils/formatters.js';

export interface BalanceDisplayData {
  userId: string;
  username: string;
  chips: bigint;
  totalWon: bigint;
  totalLost: bigint;
  totalGames: number;
  rank: number;
  isSelf: boolean;
}

export function buildBalanceView(data: BalanceDisplayData): ContainerBuilder {
  const { username, chips, totalWon, totalLost, totalGames, rank, isSelf } = data;

  const net = totalWon - totalLost;
  const winRate = totalGames > 0
    ? ((Number(totalWon) / (Number(totalWon) + Number(totalLost)) || 0) * 100).toFixed(1)
    : '0.0';

  const title = isSelf
    ? `${CasinoTheme.prefixes.balance}\n**あなたの残高**`
    : `${CasinoTheme.prefixes.balance}\n**${username} の残高**`;

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(title),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `💰 **チップ**: ${formatChips(chips)}`,
      ),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `🏆 **ランク**: #${rank}`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          '📊 **統計**',
          `> プレイ回数: **${totalGames}**`,
          `> 総獲得額: **${formatChips(totalWon)}**`,
          `> 総損失額: **${formatChips(totalLost)}**`,
          `> 収支: **${net >= 0n ? '+' : ''}${formatChips(net)}**`,
          `> 勝率: **${winRate}%**`,
        ].join('\n'),
      ),
    );

  return container;
}
