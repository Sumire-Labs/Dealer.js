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
    ? `${CasinoTheme.prefixes.balance}\n**Your Balance**`
    : `${CasinoTheme.prefixes.balance}\n**${username}'s Balance**`;

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
        `💰 **Chips**: ${formatChips(chips)}`,
      ),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `🏆 **Rank**: #${rank}`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          '📊 **Stats**',
          `> Games Played: **${totalGames}**`,
          `> Total Won: **${formatChips(totalWon)}**`,
          `> Total Lost: **${formatChips(totalLost)}**`,
          `> Net: **${net >= 0n ? '+' : ''}${formatChips(net)}**`,
          `> Win Rate: **${winRate}%**`,
        ].join('\n'),
      ),
    );

  return container;
}
