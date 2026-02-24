import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { CasinoTheme } from '../../themes/casino.theme.js';
import { formatChips } from '../../../utils/formatters.js';
import { cardToString } from '../../../games/blackjack/blackjack.deck.js';
import { evaluateHand } from '../../../games/blackjack/blackjack.hand.js';
import type { BlackjackTableSession, TablePlayer } from '../../../games/blackjack/blackjack-table.session.js';
import { getTableAvailableActions } from '../../../games/blackjack/blackjack-table.engine.js';

function renderHand(cards: { suit: string; rank: string }[], hideSecond = false): string {
  if (hideSecond && cards.length >= 2) {
    return `${cardToString(cards[0] as never)}  🂠`;
  }
  return cards.map(c => cardToString(c as never)).join('  ');
}

function handValueText(cards: { suit: string; rank: string }[], hideSecond = false): string {
  if (hideSecond) return '?';
  const value = evaluateHand(cards as never);
  if (value.isBlackjack) return '**21 BJ!**';
  if (value.isBust) return `~~${value.best}~~ バスト`;
  return value.isSoft ? `${value.best}（ソフト）` : `${value.best}`;
}

function getCardNumericValue(card: { rank: string }): number {
  if (card.rank === 'A') return 11;
  if (['J', 'Q', 'K'].includes(card.rank)) return 10;
  return parseInt(card.rank);
}

function getBasicStrategyHint(playerBest: number, _playerSoft: boolean, dealerUpcard: { rank: string }): string {
  const dv = getCardNumericValue(dealerUpcard);
  if (playerBest >= 17) return '💡 スタンド推奨';
  if (playerBest <= 8) return '💡 ヒット推奨';
  if (playerBest === 11) return '💡 ダブル推奨';
  if (playerBest === 10 && dv <= 9) return '💡 ダブル推奨';
  if (playerBest === 9 && dv >= 3 && dv <= 6) return '💡 ダブル推奨';
  if (playerBest >= 13 && playerBest <= 16 && dv >= 2 && dv <= 6) return '💡 スタンド推奨';
  if (playerBest >= 13 && playerBest <= 16 && dv >= 7) return '💡 ヒット推奨';
  if (playerBest === 12 && dv >= 4 && dv <= 6) return '💡 スタンド推奨';
  if (playerBest === 12) return '💡 ヒット推奨';
  return '';
}

function renderPlayerLine(
  player: TablePlayer,
  index: number,
  session: BlackjackTableSession,
): string {
  const isCurrent = session.currentPlayerIndex === index && session.phase === 'playing' && !player.done;
  const lines: string[] = [];

  for (let h = 0; h < player.hands.length; h++) {
    const hand = player.hands[h];
    const handDisplay = renderHand(hand.cards);
    const valueText = handValueText(hand.cards);
    const handLabel = player.hands.length > 1 ? ` H${h + 1}` : '';

    let statusIcon: string;
    if (player.done) {
      statusIcon = '✅';
    } else if (isCurrent) {
      statusIcon = '👈';
    } else {
      statusIcon = '⏳';
    }

    let statusText: string;
    if (player.done) {
      statusText = '完了';
    } else if (isCurrent) {
      statusText = 'あなたのターン';
    } else {
      statusText = '待機中';
    }

    const betLabel = hand.doubled ? `${formatChips(hand.bet)}（ダブル）` : formatChips(hand.bet);
    let line = `${statusIcon} ${player.displayName}${handLabel}: ${handDisplay}  →  ${valueText}           ${statusText}`;

    if (isCurrent && h === player.activeHandIndex) {
      const pv = evaluateHand(hand.cards);
      const hint = getBasicStrategyHint(pv.best, pv.isSoft, session.dealerCards[0]);
      line += `\n   Bet: ${betLabel}${hint ? ` | ${hint}` : ''}`;
    } else {
      line += `\n   Bet: ${betLabel}`;
    }

    lines.push(line);
  }

  return lines.join('\n');
}

export function buildBjTablePlayingView(session: BlackjackTableSession): ContainerBuilder {
  const hideDealer = session.phase === 'playing';
  const dealerDisplay = renderHand(session.dealerCards, hideDealer);
  const dealerValueText = handValueText(session.dealerCards, hideDealer);

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.darkGreen)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.blackjackTable),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**ディーラー**: ${dealerDisplay}  →  ${dealerValueText}`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  // Player lines
  for (let i = 0; i < session.players.length; i++) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(renderPlayerLine(session.players[i], i, session)),
    );
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Current player info + timer
  if (session.phase === 'playing') {
    const currentPlayer = session.players[session.currentPlayerIndex];
    if (currentPlayer && !currentPlayer.done) {
      const remainingSec = Math.max(0, Math.ceil((session.turnDeadline - Date.now()) / 1000));
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `▶ ${currentPlayer.displayName} のターン · ⏰ ${remainingSec}秒`,
        ),
      );

      const actions = getTableAvailableActions(session, currentPlayer);
      const userId = currentPlayer.userId;
      const channelId = session.channelId;

      const row = new ActionRowBuilder<ButtonBuilder>();

      if (actions.includes('hit')) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`bjt:hit:${channelId}:${userId}`)
            .setLabel('🂠 ヒット')
            .setStyle(ButtonStyle.Primary),
        );
      }
      if (actions.includes('stand')) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`bjt:stand:${channelId}:${userId}`)
            .setLabel('✋ スタンド')
            .setStyle(ButtonStyle.Secondary),
        );
      }
      if (actions.includes('double')) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`bjt:double:${channelId}:${userId}`)
            .setLabel('💰 ダブル')
            .setStyle(ButtonStyle.Success),
        );
      }
      if (actions.includes('split')) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`bjt:split:${channelId}:${userId}`)
            .setLabel('✂️ スプリット')
            .setStyle(ButtonStyle.Success),
        );
      }

      container.addActionRowComponents(row);

      if (actions.includes('insurance')) {
        container.addActionRowComponents(
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`bjt:insurance:${channelId}:${userId}`)
              .setLabel('🛡️ インシュランス')
              .setStyle(ButtonStyle.Secondary),
          ),
        );
      }
    }
  }

  return container;
}
