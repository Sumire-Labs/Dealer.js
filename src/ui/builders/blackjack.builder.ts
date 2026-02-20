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
import type { BlackjackState } from '../../games/blackjack/blackjack.engine.js';
import { evaluateHand } from '../../games/blackjack/blackjack.hand.js';
import { cardToString } from '../../games/blackjack/blackjack.deck.js';

function renderHand(cards: { suit: string; rank: string }[], hideSecond = false): string {
  if (hideSecond && cards.length >= 2) {
    return `${cardToString(cards[0] as never)}  🂠`;
  }
  return cards.map(c => cardToString(c as never)).join('  ');
}

function handValueText(cards: { suit: string; rank: string }[], hideSecond = false): string {
  if (hideSecond) {
    return '?';
  }
  const value = evaluateHand(cards as never);
  if (value.isBlackjack) return '**21 Blackjack!**';
  if (value.isBust) return `~~${value.best}~~ BUST`;
  return value.isSoft ? `${value.best} (soft)` : `${value.best}`;
}

export function buildBlackjackPlayingView(
  state: BlackjackState,
  userId: string,
  balance: bigint,
): ContainerBuilder {
  const hideDealer = state.phase === 'playing';
  const dealerDisplay = renderHand(state.dealerCards, hideDealer);
  const dealerValueText = handValueText(state.dealerCards, hideDealer);

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.darkGreen)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.blackjack),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Dealer**: ${dealerDisplay}  →  ${dealerValueText}`,
      ),
    );

  // Player hands
  for (let i = 0; i < state.playerHands.length; i++) {
    const hand = state.playerHands[i];
    const handDisplay = renderHand(hand.cards);
    const valueText = handValueText(hand.cards);
    const isActive = state.phase === 'playing' && i === state.activeHandIndex;
    const pointer = isActive ? ' 👈' : '';
    const handLabel = state.playerHands.length > 1 ? `Hand ${i + 1}` : 'You';
    const betLabel = hand.doubled ? `${formatChips(hand.bet)} (Doubled)` : formatChips(hand.bet);

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**${handLabel}**: ${handDisplay}  →  ${valueText}${pointer}\nBet: ${betLabel}`,
      ),
    );
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`Balance: ${formatChips(balance)}`),
  );

  // Action buttons (only if playing)
  if (state.phase === 'playing') {
    const hand = state.playerHands[state.activeHandIndex];
    const value = evaluateHand(hand.cards);
    const canDouble = hand.cards.length === 2 && !value.isBust;
    const canSplitHand = hand.cards.length === 2 && state.playerHands.length === 1 &&
      getCardNumericValue(hand.cards[0]) === getCardNumericValue(hand.cards[1]);
    const showInsurance = state.dealerCards[0].rank === 'A' &&
      state.insuranceBet === 0n && hand.cards.length === 2;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`bj:hit:${userId}`)
        .setLabel('🂠 Hit')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`bj:stand:${userId}`)
        .setLabel('✋ Stand')
        .setStyle(ButtonStyle.Secondary),
    );

    if (canDouble) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`bj:double:${userId}`)
          .setLabel('💰 Double')
          .setStyle(ButtonStyle.Success),
      );
    }

    if (canSplitHand) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`bj:split:${userId}`)
          .setLabel('✂️ Split')
          .setStyle(ButtonStyle.Success),
      );
    }

    container.addActionRowComponents(row);

    if (showInsurance) {
      container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`bj:insurance:${userId}`)
            .setLabel('🛡️ Insurance')
            .setStyle(ButtonStyle.Secondary),
        ),
      );
    }
  }

  return container;
}

export function buildBlackjackResultView(
  state: BlackjackState,
  _totalBet: bigint,
  _totalPayout: bigint,
  net: bigint,
  newBalance: bigint,
): ContainerBuilder {
  const dealerDisplay = renderHand(state.dealerCards);
  const dealerValueText = handValueText(state.dealerCards);

  const isWin = net > 0n;
  const isPush = net === 0n;
  const accentColor = isWin ? CasinoTheme.colors.gold
    : isPush ? CasinoTheme.colors.silver
    : CasinoTheme.colors.red;

  const container = new ContainerBuilder()
    .setAccentColor(accentColor)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.blackjack),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Dealer**: ${dealerDisplay}  →  ${dealerValueText}`,
      ),
    );

  for (let i = 0; i < state.playerHands.length; i++) {
    const hand = state.playerHands[i];
    const handDisplay = renderHand(hand.cards);
    const valueText = handValueText(hand.cards);
    const outcome = state.outcomes[i];
    const handLabel = state.playerHands.length > 1 ? `Hand ${i + 1}` : 'You';

    const outcomeText = outcomeToText(outcome);

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**${handLabel}**: ${handDisplay}  →  ${valueText}\n${outcomeText}`,
      ),
    );
  }

  // Insurance result
  if (state.insuranceBet > 0n) {
    const insResult = state.insurancePaid
      ? `🛡️ Insurance pays! +${formatChips(state.insuranceBet * 2n)}`
      : `🛡️ Insurance lost: -${formatChips(state.insuranceBet)}`;
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(insResult),
    );
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  let summaryText: string;
  if (isWin) {
    summaryText = `✅ **WIN!** +${formatChips(net)}`;
  } else if (isPush) {
    summaryText = '🤝 **PUSH** — Bet returned';
  } else {
    summaryText = `❌ **LOSE** ${formatChips(net)}`;
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(summaryText),
  );
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`Balance: ${formatChips(newBalance)}`),
  );

  return container;
}

function outcomeToText(outcome: string): string {
  switch (outcome) {
    case 'blackjack': return '🂡 **BLACKJACK!** (3:2)';
    case 'win': return '✅ **WIN!**';
    case 'dealer_bust': return '✅ **Dealer BUST — You win!**';
    case 'push': return '🤝 **PUSH**';
    case 'bust': return '💥 **BUST**';
    case 'lose': return '❌ **LOSE**';
    default: return outcome;
  }
}

function getCardNumericValue(card: { rank: string }): number {
  if (card.rank === 'A') return 11;
  if (['J', 'Q', 'K'].includes(card.rank)) return 10;
  return parseInt(card.rank);
}
