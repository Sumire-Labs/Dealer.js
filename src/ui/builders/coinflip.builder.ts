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
import { getEffectiveMax } from '../../utils/bet.js';
import type { CoinSide } from '../../games/coinflip/coinflip.engine.js';
import type { TodayStats } from '../../database/repositories/user.repository.js';

const SIDE_DISPLAY: Record<CoinSide, { emoji: string; label: string }> = {
  heads: { emoji: '👑', label: 'オモテ' },
  tails: { emoji: '🦅', label: 'ウラ' },
};

function buildCoinflipButtons(bet: bigint, balance: bigint, userId: string): ActionRowBuilder<ButtonBuilder> {
  const effectiveMax = getEffectiveMax(configService.getBigInt(S.maxCoinflip), balance);
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`coinflip:bet_down:${userId}`)
      .setLabel('◀ BET')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(bet <= configService.getBigInt(S.minBet)),
    new ButtonBuilder()
      .setCustomId(`coinflip:heads:${userId}`)
      .setLabel('👑 オモテ')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`coinflip:tails:${userId}`)
      .setLabel('🦅 ウラ')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`coinflip:bet_up:${userId}`)
      .setLabel('BET ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(bet >= effectiveMax),
  );
}

function formatTodayStats(stats: TodayStats): string {
  const sign = stats.netAmount >= 0n ? '+' : '';
  return `📊 今日: ${stats.wins}勝${stats.losses}敗（${sign}${formatChips(stats.netAmount)}）`;
}

export function buildCoinflipIdleView(
  bet: bigint,
  balance: bigint,
  userId: string,
): ContainerBuilder {
  return new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.silver)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.coinflip),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `BET: **${formatChips(bet)}** | 残高: ${formatChips(balance)}\n\n面を選んでください:`,
      ),
    )
    .addActionRowComponents(buildCoinflipButtons(bet, balance, userId));
}

export function buildCoinflipChoiceView(
  bet: bigint,
  balance: bigint,
  userId: string,
): ContainerBuilder {
  return new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.silver)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.coinflip),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `BET: **${formatChips(bet)}** | 残高: ${formatChips(balance)}\n\n面を選んでください:`,
      ),
    )
    .addActionRowComponents(buildCoinflipButtons(bet, balance, userId));
}

export function buildCoinflipFlippingView(): ContainerBuilder {
  return new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.silver)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.coinflip),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('🪙 *コインが回っています...*'),
    );
}

export function buildCoinflipResultView(
  outcome: CoinSide,
  playerChoice: CoinSide,
  won: boolean,
  bet: bigint,
  payout: bigint,
  newBalance: bigint,
  userId: string,
  todayStats?: TodayStats,
): ContainerBuilder {
  const outcomeDisplay = SIDE_DISPLAY[outcome];
  const choiceDisplay = SIDE_DISPLAY[playerChoice];

  let resultText: string;
  if (won) {
    resultText = `✅ **勝ち！** +${formatChips(payout - bet)}`;
  } else {
    resultText = `❌ **負け！** -${formatChips(bet)}`;
  }

  let balanceLine = `残高: ${formatChips(newBalance)}`;
  if (todayStats) {
    balanceLine += `\n${formatTodayStats(todayStats)}`;
  }

  return new ContainerBuilder()
    .setAccentColor(won ? CasinoTheme.colors.gold : CasinoTheme.colors.red)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.coinflip),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `🪙 コインの結果は... **${outcomeDisplay.label}！** ${outcomeDisplay.emoji}`,
      ),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `あなたの選択: ${choiceDisplay.emoji} ${choiceDisplay.label}`,
      ),
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
    .addActionRowComponents(buildCoinflipButtons(bet, newBalance, userId));
}
