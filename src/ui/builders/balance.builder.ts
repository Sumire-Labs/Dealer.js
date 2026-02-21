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

export interface BalanceDisplayData {
  userId: string;
  targetId: string;
  username: string;
  chips: bigint;
  totalWon: bigint;
  totalLost: bigint;
  totalGames: number;
  rank: number;
  isSelf: boolean;
}

export type BalanceTab = 'balance' | 'stats';

export function buildBalanceView(data: BalanceDisplayData, tab: BalanceTab = 'balance'): ContainerBuilder {
  const { username, chips, totalWon, totalLost, totalGames, rank, isSelf, userId, targetId } = data;

  const title = isSelf
    ? CasinoTheme.prefixes.balance
    : `${CasinoTheme.prefixes.balance}\n**${username}**`;

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(title),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  if (tab === 'balance') {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `💰 **チップ**: ${formatChips(chips)}\n` +
        `🏆 **ランク**: #${rank}`,
      ),
    );
  } else {
    const net = totalWon - totalLost;
    const winRate = totalGames > 0
      ? ((Number(totalWon) / (Number(totalWon) + Number(totalLost)) || 0) * 100).toFixed(1)
      : '0.0';

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `🎮 プレイ回数: **${totalGames}**`,
          `📈 総獲得額: **${formatChips(totalWon)}**`,
          `📉 総損失額: **${formatChips(totalLost)}**`,
          `💹 収支: **${net >= 0n ? '+' : ''}${formatChips(net)}**`,
          `🎯 勝率: **${winRate}%**`,
        ].join('\n'),
      ),
    );
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`bal:balance:${userId}:${targetId}`)
        .setLabel('💰 残高')
        .setStyle(tab === 'balance' ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(tab === 'balance'),
      new ButtonBuilder()
        .setCustomId(`bal:stats:${userId}:${targetId}`)
        .setLabel('📊 統計')
        .setStyle(tab === 'stats' ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(tab === 'stats'),
    ),
  );

  return container;
}
