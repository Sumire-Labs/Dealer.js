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
import type {SlotSymbol} from '../../games/slots/slots.symbols.js';
import type {PaytableResult} from '../../games/slots/slots.paytable.js';
import type {TodayStats} from '../../database/repositories/user.repository.js';

function renderReels(symbols: [string, string, string]): string {
  return `【 ${symbols[0]} 】【 ${symbols[1]} 】【 ${symbols[2]} 】`;
}

export function buildSlotsIdleView(
  reels: SlotSymbol[],
  bet: bigint,
  balance: bigint,
  userId: string,
): ContainerBuilder {
  const reelEmojis = reels.map(r => r.emoji) as [string, string, string];

  return new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.slots),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(renderReels(reelEmojis)),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `BET: ${formatChips(bet)} | 残高: ${formatChips(balance)}`,
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`slots:bet_down:${userId}`)
          .setLabel('◀ BET')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`slots:spin:${userId}`)
          .setLabel('🎰 スピン')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`slots:bet_up:${userId}`)
          .setLabel('BET ▶')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`slots:bet_max:${userId}`)
          .setLabel('MAX BET')
          .setStyle(ButtonStyle.Danger),
      ),
    );
}

export function buildSlotsSpinningView(
  symbols: [string, string, string],
): ContainerBuilder {
  return new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.slots),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(renderReels(symbols)),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('🔄 *回転中...*'),
    );
}

export function buildSlotsResultView(
  reels: SlotSymbol[],
  paytable: PaytableResult,
  bet: bigint,
  payout: bigint,
  newBalance: bigint,
  userId: string,
  todayStats?: TodayStats,
): ContainerBuilder {
  const reelEmojis = reels.map(r => r.emoji) as [string, string, string];
  const isJackpot = paytable.multiplier >= 500;
  const isWin = paytable.multiplier > 0;
  const header = isJackpot ? CasinoTheme.prefixes.jackpot : CasinoTheme.prefixes.slots;

  let resultText: string;
  if (isWin) {
    resultText = `**${paytable.label}** (${paytable.multiplier}x)\nBET: ${formatChips(bet)} → 獲得: ${formatChips(payout)}! 🎉`;
  } else {
    resultText = `**${paytable.label}**\nBET: ${formatChips(bet)} → ハズレ`;
  }

  let balanceLine = `残高: ${formatChips(newBalance)}`;
  if (todayStats) {
    const sign = todayStats.netAmount >= 0n ? '+' : '';
    balanceLine += `\n📊 今日: ${todayStats.wins}勝${todayStats.losses}敗（${sign}${formatChips(todayStats.netAmount)}）`;
  }

  return new ContainerBuilder()
    .setAccentColor(isWin ? CasinoTheme.colors.gold : CasinoTheme.colors.red)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(header),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(renderReels(reelEmojis)),
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
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`slots:bet_down:${userId}`)
          .setLabel('◀ BET')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`slots:spin:${userId}`)
          .setLabel('🎰 もう一回')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`slots:bet_up:${userId}`)
          .setLabel('BET ▶')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`slots:bet_max:${userId}`)
          .setLabel('MAX BET')
          .setStyle(ButtonStyle.Danger),
      ),
    );
}
