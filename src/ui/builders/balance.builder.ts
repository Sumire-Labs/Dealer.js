import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    TextDisplayBuilder,
} from 'discord.js';
import {CasinoTheme} from '../themes/casino.theme.js';
import {formatChips} from '../../utils/formatters.js';

export interface TodayStatsData {
  wins: number;
  losses: number;
  netAmount: bigint;
}

export interface BalanceDisplayData {
  userId: string;
  targetId: string;
  username: string;
  chips: bigint;
  bankBalance: bigint;
  totalWon: bigint;
  totalLost: bigint;
  totalGames: number;
  rank: number;
  isSelf: boolean;
  todayStats?: TodayStatsData;
}

export type BalanceTab = 'balance' | 'stats' | 'profile';

export function buildBalanceView(data: BalanceDisplayData, tab: BalanceTab = 'balance'): ContainerBuilder {
  const { username, chips, bankBalance, totalWon, totalLost, totalGames, rank, isSelf, userId, targetId } = data;

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
        `🏦 **口座**: ${formatChips(bankBalance)}\n` +
        `🏆 **ランク**: #${rank}`,
      ),
    );
  } else {
    const net = totalWon - totalLost;
    const winRate = totalGames > 0 && (totalWon + totalLost) > 0n
      ? (Number(totalWon * 1000n / (totalWon + totalLost)) / 10).toFixed(1)
      : '0.0';

    const statsLines = [
      `🎮 プレイ回数: **${totalGames}**`,
      `📈 総獲得額: **${formatChips(totalWon)}**`,
      `📉 総損失額: **${formatChips(totalLost)}**`,
      `💹 収支: **${net >= 0n ? '+' : ''}${formatChips(net)}**`,
      `🎯 勝率: **${winRate}%**`,
    ];

    // Today's stats section
    if (data.todayStats) {
      const ts = data.todayStats;
      const todayTotal = ts.wins + ts.losses;
      const todayWinRate = todayTotal > 0 ? ((ts.wins / todayTotal) * 100).toFixed(1) : '0.0';
      statsLines.push(
        '',
        '**📅 今日の成績:**',
        `🎮 ${ts.wins}勝 ${ts.losses}敗 (勝率 ${todayWinRate}%)`,
        `💹 収支: **${ts.netAmount >= 0n ? '+' : ''}${formatChips(ts.netAmount)}**`,
      );
    }

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(statsLines.join('\n')),
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
      new ButtonBuilder()
        .setCustomId(`bal:profile:${userId}:${targetId}`)
        .setLabel('👤 プロフィール')
        .setStyle(tab === 'profile' ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(tab === 'profile'),
    ),
  );

  return container;
}
