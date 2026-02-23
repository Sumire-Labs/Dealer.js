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
import { evaluateHand, type HandValue } from '../../games/blackjack/blackjack.hand.js';
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
  if (value.isBlackjack) return '**21 ブラックジャック！**';
  if (value.isBust) return `~~${value.best}~~ バスト`;
  return value.isSoft ? `${value.best}（ソフト）` : `${value.best}`;
}

function getCardNumericValue(card: { rank: string }): number {
  if (card.rank === 'A') return 11;
  if (['J', 'Q', 'K'].includes(card.rank)) return 10;
  return parseInt(card.rank);
}

function getDealerUpcardHint(card: { rank: string }): string {
  const rank = card.rank;
  if (rank === 'A') return 'A — インシュランス可';
  if (['10', 'J', 'Q', 'K'].includes(rank)) return `${rank} — BJ警戒`;
  const val = parseInt(rank);
  if (val >= 2 && val <= 6) return `${rank} — バスト狙い目`;
  return `${rank} — 強めの手`;
}

function getBasicStrategyHint(playerValue: HandValue, dealerUpcard: { rank: string }): string {
  const pv = playerValue.best;
  const dv = getCardNumericValue(dealerUpcard);

  if (playerValue.isBust) return '';
  if (playerValue.isBlackjack) return '💡 ブラックジャック！';
  if (pv >= 17) return '💡 スタンド推奨';
  if (pv <= 8) return '💡 ヒット推奨';
  if (pv === 11) return '💡 ダブル推奨';
  if (pv === 10 && dv <= 9) return '💡 ダブル推奨';
  if (pv === 9 && dv >= 3 && dv <= 6) return '💡 ダブル推奨';
  if (pv >= 13 && pv <= 16 && dv >= 2 && dv <= 6) return '💡 スタンド推奨（ディーラーバスト狙い）';
  if (pv >= 13 && pv <= 16 && dv >= 7) return '💡 ヒット推奨';
  if (pv === 12 && dv >= 4 && dv <= 6) return '💡 スタンド推奨';
  if (pv === 12) return '💡 ヒット推奨';
  return '';
}

export function buildBlackjackPlayingView(
  state: BlackjackState,
  userId: string,
  balance: bigint,
): ContainerBuilder {
  const hideDealer = state.phase === 'playing';
  const dealerDisplay = renderHand(state.dealerCards, hideDealer);
  const dealerValueText = handValueText(state.dealerCards, hideDealer);

  // Dealer upcard hint
  const dealerHint = hideDealer ? `  (${getDealerUpcardHint(state.dealerCards[0])})` : '';

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
        `**ディーラー**: ${dealerDisplay}  →  ${dealerValueText}${dealerHint}`,
      ),
    );

  // Player hands
  for (let i = 0; i < state.playerHands.length; i++) {
    const hand = state.playerHands[i];
    const handDisplay = renderHand(hand.cards);
    const valueText = handValueText(hand.cards);
    const isActive = state.phase === 'playing' && i === state.activeHandIndex;
    const pointer = isActive ? ' 👈' : '';
    const handLabel = state.playerHands.length > 1 ? `ハンド ${i + 1}` : 'あなた';
    const betLabel = hand.doubled ? `${formatChips(hand.bet)}（ダブル）` : formatChips(hand.bet);

    // Strategy hint for active hand
    const playerValue = evaluateHand(hand.cards as never);
    const strategyHint = isActive ? getBasicStrategyHint(playerValue, state.dealerCards[0]) : '';
    const hintLine = strategyHint ? `\n${strategyHint}` : '';

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**${handLabel}**: ${handDisplay}  →  ${valueText}${pointer}\nBet: ${betLabel}${hintLine}`,
      ),
    );
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Bet info display
  const totalBet = state.playerHands.reduce((sum, h) => sum + h.bet, 0n);
  const insText = state.insuranceBet > 0n ? ` | 🛡️ インシュランス: ${formatChips(state.insuranceBet)}` : '';
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`💰 合計BET: ${formatChips(totalBet)}${insText} | 残高: ${formatChips(balance)}`),
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
        .setLabel('🂠 ヒット')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`bj:stand:${userId}`)
        .setLabel('✋ スタンド')
        .setStyle(ButtonStyle.Secondary),
    );

    if (canDouble) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`bj:double:${userId}`)
          .setLabel('💰 ダブル')
          .setStyle(ButtonStyle.Success),
      );
    }

    if (canSplitHand) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`bj:split:${userId}`)
          .setLabel('✂️ スプリット')
          .setStyle(ButtonStyle.Success),
      );
    }

    container.addActionRowComponents(row);

    if (showInsurance) {
      container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`bj:insurance:${userId}`)
            .setLabel('🛡️ インシュランス')
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
        `**ディーラー**: ${dealerDisplay}  →  ${dealerValueText}`,
      ),
    );

  for (let i = 0; i < state.playerHands.length; i++) {
    const hand = state.playerHands[i];
    const handDisplay = renderHand(hand.cards);
    const valueText = handValueText(hand.cards);
    const outcome = state.outcomes[i];
    const handLabel = state.playerHands.length > 1 ? `ハンド ${i + 1}` : 'あなた';

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
      ? `🛡️ インシュランス的中！ +${formatChips(state.insuranceBet * 2n)}`
      : `🛡️ インシュランス失敗: -${formatChips(state.insuranceBet)}`;
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(insResult),
    );
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  let summaryText: string;
  if (isWin) {
    summaryText = `✅ **勝ち！** +${formatChips(net)}`;
  } else if (isPush) {
    summaryText = '🤝 **引き分け** — ベット返却';
  } else {
    summaryText = `❌ **負け** ${formatChips(net)}`;
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(summaryText),
  );
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`残高: ${formatChips(newBalance)}`),
  );

  return container;
}

function outcomeToText(outcome: string): string {
  switch (outcome) {
    case 'blackjack': return '🂡 **ブラックジャック！** (3:2)';
    case 'win': return '✅ **勝ち！**';
    case 'dealer_bust': return '✅ **ディーラーバスト — あなたの勝ち！**';
    case 'push': return '🤝 **引き分け**';
    case 'bust': return '💥 **バスト**';
    case 'lose': return '❌ **負け**';
    default: return outcome;
  }
}
