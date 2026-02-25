import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    TextDisplayBuilder,
} from 'discord.js';
import {CasinoTheme} from '../themes/casino.theme.js';
import {formatChips} from '../../utils/formatters.js';
import {configService} from '../../config/config.service.js';
import {S} from '../../config/setting-defs.js';
import {getEffectiveMax} from '../../utils/bet.js';
import {getNumberColor, getNumberEmoji} from '../../config/roulette.js';
import type {TodayStats} from '../../database/repositories/user.repository.js';

function formatTodayStats(stats: TodayStats): string {
  const sign = stats.netAmount >= 0n ? '+' : '';
  return `📊 今日: ${stats.wins}勝${stats.losses}敗（${sign}${formatChips(stats.netAmount)}）`;
}

function buildBetRow(bet: bigint, balance: bigint, userId: string): ActionRowBuilder<ButtonBuilder> {
  const effectiveMax = getEffectiveMax(configService.getBigInt(S.maxRoulette), balance);
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
      .setDisabled(bet >= effectiveMax),
    new ButtonBuilder()
      .setCustomId(`roulette:bet_max:${userId}`)
      .setLabel('MAX BET')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(bet >= effectiveMax),
  );
}

export function buildBetSelectMenu(userId: string): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`roulette_select:bet:${userId}`)
      .setPlaceholder('ベットタイプを選択...')
      .addOptions(
        // Outside bets
        new StringSelectMenuOptionBuilder().setLabel('🔴 赤').setValue('red').setDescription('赤の数字に賭ける — 配当 2倍'),
        new StringSelectMenuOptionBuilder().setLabel('⚫ 黒').setValue('black').setDescription('黒の数字に賭ける — 配当 2倍'),
        new StringSelectMenuOptionBuilder().setLabel('偶数').setValue('even').setDescription('偶数の数字に賭ける — 配当 2倍'),
        new StringSelectMenuOptionBuilder().setLabel('奇数').setValue('odd').setDescription('奇数の数字に賭ける — 配当 2倍'),
        new StringSelectMenuOptionBuilder().setLabel('⬇ Low (1-18)').setValue('low').setDescription('1〜18に賭ける — 配当 2倍'),
        new StringSelectMenuOptionBuilder().setLabel('⬆ High (19-36)').setValue('high').setDescription('19〜36に賭ける — 配当 2倍'),
        new StringSelectMenuOptionBuilder().setLabel('1st12 (1-12)').setValue('1st12').setDescription('1〜12のダズンに賭ける — 配当 3倍'),
        new StringSelectMenuOptionBuilder().setLabel('2nd12 (13-24)').setValue('2nd12').setDescription('13〜24のダズンに賭ける — 配当 3倍'),
        new StringSelectMenuOptionBuilder().setLabel('3rd12 (25-36)').setValue('3rd12').setDescription('25〜36のダズンに賭ける — 配当 3倍'),
        // Inside bets
        new StringSelectMenuOptionBuilder().setLabel('🎯 ストレート').setValue('straight').setDescription('1つの番号に賭ける — 配当 36倍'),
        new StringSelectMenuOptionBuilder().setLabel('↔ スプリット').setValue('split').setDescription('隣接する2つの番号に賭ける — 配当 18倍'),
        new StringSelectMenuOptionBuilder().setLabel('📏 ストリート').setValue('street').setDescription('1行3つの番号に賭ける — 配当 12倍'),
        new StringSelectMenuOptionBuilder().setLabel('⬜ コーナー').setValue('corner').setDescription('4つの番号に賭ける — 配当 9倍'),
        new StringSelectMenuOptionBuilder().setLabel('📐 シックスライン').setValue('sixline').setDescription('2行6つの番号に賭ける — 配当 6倍'),
      ),
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
    .addActionRowComponents(buildBetRow(bet, balance, userId))
    .addActionRowComponents(buildBetSelectMenu(userId));
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
    .addActionRowComponents(buildBetRow(bet, newBalance, userId))
    .addActionRowComponents(buildBetSelectMenu(userId));
}
