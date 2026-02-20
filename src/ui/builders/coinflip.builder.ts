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
import type { CoinSide } from '../../games/coinflip/coinflip.engine.js';

const SIDE_DISPLAY: Record<CoinSide, { emoji: string; label: string }> = {
  heads: { emoji: '👑', label: 'HEADS' },
  tails: { emoji: '🦅', label: 'TAILS' },
};

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
        `BET: **${formatChips(bet)}**\nBalance: ${formatChips(balance)}\n\nChoose your side:`,
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`coinflip:heads:${userId}`)
          .setLabel('👑 Heads')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`coinflip:tails:${userId}`)
          .setLabel('🦅 Tails')
          .setStyle(ButtonStyle.Primary),
      ),
    );
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
      new TextDisplayBuilder().setContent('🪙 *The coin is spinning...*'),
    );
}

export function buildCoinflipResultView(
  outcome: CoinSide,
  playerChoice: CoinSide,
  won: boolean,
  bet: bigint,
  payout: bigint,
  newBalance: bigint,
): ContainerBuilder {
  const outcomeDisplay = SIDE_DISPLAY[outcome];
  const choiceDisplay = SIDE_DISPLAY[playerChoice];

  let resultText: string;
  if (won) {
    resultText = `✅ **YOU WIN!** +${formatChips(payout - bet)}`;
  } else {
    resultText = `❌ **YOU LOSE!** -${formatChips(bet)}`;
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
        `🪙 The coin lands... **${outcomeDisplay.label}!** ${outcomeDisplay.emoji}`,
      ),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `Your pick: ${choiceDisplay.emoji} ${choiceDisplay.label}`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(resultText),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`Balance: ${formatChips(newBalance)}`),
    );
}
