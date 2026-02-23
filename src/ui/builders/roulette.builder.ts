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
import { configService } from '../../config/config.service.js';
import { S } from '../../config/setting-defs.js';
import { getNumberEmoji, getNumberColor } from '../../config/roulette.js';
import type { TodayStats } from '../../database/repositories/user.repository.js';

function formatTodayStats(stats: TodayStats): string {
  const sign = stats.netAmount >= 0n ? '+' : '';
  return `📊 今日: ${stats.wins}勝${stats.losses}敗（${sign}${formatChips(stats.netAmount)}）`;
}

function buildBetRow(bet: bigint, userId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`roulette:bet_down:${userId}`)
      .setLabel('◀ BET')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(bet <= configService.getBigInt(S.minBet)),
    new ButtonBuilder()
      .setCustomId(`roulette:bet_up:${userId}`)
      .setLabel('BET ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(bet >= configService.getBigInt(S.maxRoulette)),
    new ButtonBuilder()
      .setCustomId(`roulette:bet_max:${userId}`)
      .setLabel('MAX BET')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(bet >= configService.getBigInt(S.maxRoulette)),
  );
}

function buildColorRow(userId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`roulette:red:${userId}`)
      .setLabel('🔴 赤')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`roulette:black:${userId}`)
      .setLabel('⚫ 黒')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`roulette:inside:${userId}`)
      .setLabel('🔢 Inside')
      .setStyle(ButtonStyle.Primary),
  );
}

function buildParityRow(userId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`roulette:even:${userId}`)
      .setLabel('偶数')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`roulette:odd:${userId}`)
      .setLabel('奇数')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`roulette:low:${userId}`)
      .setLabel('⬇ Low')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`roulette:high:${userId}`)
      .setLabel('⬆ High')
      .setStyle(ButtonStyle.Secondary),
  );
}

function buildDozenRow(userId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`roulette:1st12:${userId}`)
      .setLabel('1st12')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`roulette:2nd12:${userId}`)
      .setLabel('2nd12')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`roulette:3rd12:${userId}`)
      .setLabel('3rd12')
      .setStyle(ButtonStyle.Secondary),
  );
}

export function buildRouletteIdleView(
  bet: bigint,
  balance: bigint,
  userId: string,
): ContainerBuilder {
  return new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.darkGreen)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.roulette),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `💰 BET: **${formatChips(bet)}** | 残高: ${formatChips(balance)}`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addActionRowComponents(buildBetRow(bet, userId))
    .addActionRowComponents(buildColorRow(userId))
    .addActionRowComponents(buildParityRow(userId))
    .addActionRowComponents(buildDozenRow(userId));
}

export function buildRouletteInsideView(
  bet: bigint,
  userId: string,
): ContainerBuilder {
  return new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.darkGreen)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.roulette),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `💰 BET: **${formatChips(bet)}**\nインサイドベット:`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`roulette:pick_straight:${userId}`)
          .setLabel('🎯 ストレート (36x)')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`roulette:pick_split:${userId}`)
          .setLabel('↔️ スプリット (18x)')
          .setStyle(ButtonStyle.Primary),
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`roulette:pick_street:${userId}`)
          .setLabel('📏 ストリート (12x)')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`roulette:pick_corner:${userId}`)
          .setLabel('⬜ コーナー (9x)')
          .setStyle(ButtonStyle.Primary),
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`roulette:pick_sixline:${userId}`)
          .setLabel('📐 シックスライン (6x)')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`roulette:back:${userId}`)
          .setLabel('◀ 戻る')
          .setStyle(ButtonStyle.Secondary),
      ),
    );
}

export function buildRouletteSpinningView(
  frameNumbers: number[],
): ContainerBuilder {
  const display = frameNumbers.map(n => getNumberEmoji(n)).join(' → ');

  return new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.darkGreen)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.roulette),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `🎡 *ホイール回転中...*\n[ ${display} ]`,
      ),
    );
}

export function buildRouletteResultView(
  resultNumber: number,
  betLabel: string,
  won: boolean,
  bet: bigint,
  payout: bigint,
  net: bigint,
  newBalance: bigint,
  userId: string,
  todayStats?: TodayStats,
): ContainerBuilder {
  const resultEmoji = getNumberEmoji(resultNumber);
  const resultColorName = getNumberColor(resultNumber) === 'red' ? '赤' : getNumberColor(resultNumber) === 'black' ? '黒' : '緑';

  let resultText: string;
  if (won) {
    resultText = `✅ **${betLabel}** に賭けて的中！\n💰 BET: ${formatChips(bet)} → 獲得: ${formatChips(payout)} (${payout / bet}x)\n📊 収支: +${formatChips(net)}`;
  } else {
    resultText = `❌ **${betLabel}** に賭けてハズレ\n💰 BET: ${formatChips(bet)}\n📊 収支: -${formatChips(bet)}`;
  }

  let balanceLine = `💰 残高: ${formatChips(newBalance)}`;
  if (todayStats) {
    balanceLine += `\n${formatTodayStats(todayStats)}`;
  }

  return new ContainerBuilder()
    .setAccentColor(won ? CasinoTheme.colors.gold : CasinoTheme.colors.red)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.roulette),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`${resultEmoji} **${resultNumber}** (${resultColorName})`),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(resultText),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(balanceLine),
    )
    .addActionRowComponents(buildBetRow(bet, userId))
    .addActionRowComponents(buildColorRow(userId))
    .addActionRowComponents(buildParityRow(userId))
    .addActionRowComponents(buildDozenRow(userId));
}
