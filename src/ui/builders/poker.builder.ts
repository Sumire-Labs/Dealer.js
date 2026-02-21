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
import type { PokerSessionState } from '../../games/poker/poker.session.js';
import type { WinnerInfo, PotInfo } from '../../games/poker/poker.engine.js';
import { canCheck } from '../../games/poker/poker.engine.js';
import { formatCard, formatHidden } from '../../games/poker/poker.deck.js';

function positionLabel(playerIndex: number, dealerIndex: number, playerCount: number): string {
  if (playerIndex === dealerIndex) return '(D) ';
  const sbIndex = playerCount === 2 ? dealerIndex : (dealerIndex + 1) % playerCount;
  const bbIndex = playerCount === 2 ? (dealerIndex + 1) % playerCount : (dealerIndex + 2) % playerCount;
  if (playerIndex === sbIndex) return '(SB)';
  if (playerIndex === bbIndex) return '(BB)';
  return '    ';
}

export function buildPokerLobbyView(
  session: PokerSessionState,
  remainingSeconds: number,
): ContainerBuilder {
  const playerList = session.players.length > 0
    ? session.players.map((p, i) => `${i + 1}. **${p.displayName}** — ${formatChips(p.stack)}`).join('\n')
    : '*参加者を待っています...*';

  return new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.darkGreen)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.poker),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**テキサスホールデム**\nバイイン: $2,000〜$100,000 | SB/BB: $100/$200`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**参加者 (${session.players.length}/6)**\n${playerList}`,
      ),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `⏰ 締切まで: **${remainingSeconds}秒**`,
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`poker:join:${session.id}`)
          .setLabel('🎮 参加')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`poker:start:${session.id}:${session.ownerId}`)
          .setLabel('▶️ ゲーム開始')
          .setStyle(ButtonStyle.Success),
      ),
    );
}

export function buildPokerTableView(
  session: PokerSessionState,
): ContainerBuilder {
  // Community cards
  const communityDisplay = [];
  for (let i = 0; i < 5; i++) {
    if (i < session.communityCards.length) {
      communityDisplay.push(formatCard(session.communityCards[i]));
    } else {
      communityDisplay.push(formatHidden());
    }
  }
  const communityLine = `コミュニティ: ${communityDisplay.join(' ')}`;

  // Total pot
  const totalPot = session.players.reduce((sum, p) => sum + p.totalBet, 0n);

  // Player list
  const playerLines = session.players.map((p, i) => {
    const pos = positionLabel(i, session.dealerIndex, session.players.length);
    const name = p.displayName;

    if (p.folded) {
      return `${pos} ~~${name}~~ — Folded`;
    }

    const stack = formatChips(p.stack);
    const bet = p.currentBet > 0n ? ` | Bet ${formatChips(p.currentBet)}` : '';
    const allIn = p.allIn ? ' **ALL-IN**' : '';
    const marker = i === session.currentPlayerIndex && !p.folded && !p.allIn ? ' ◀' : '';

    return `${pos} **${name}** ${stack}${bet}${allIn}${marker}`;
  }).join('\n');

  // Timer
  const remaining = Math.max(0, Math.ceil((session.turnDeadline - Date.now()) / 1000));
  const timerLine = `⏰ 残り **${remaining}秒**`;

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.darkGreen)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.poker),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(communityLine),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`ポット: **${formatChips(totalPot)}**`),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(playerLines),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(timerLine),
    );

  // Action buttons (only when game is active and it's someone's turn)
  const currentPlayer = session.players[session.currentPlayerIndex];
  if (currentPlayer && !currentPlayer.folded && !currentPlayer.allIn && session.phase !== 'showdown') {
    const isCheck = canCheck(currentPlayer, session.currentBet);
    const callAmount = session.currentBet - currentPlayer.currentBet;

    const buttons = [
      new ButtonBuilder()
        .setCustomId(`poker:view_hand:${session.id}`)
        .setLabel('🃏 手札を見る')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`poker:fold:${session.id}`)
        .setLabel('❌ フォールド')
        .setStyle(ButtonStyle.Danger),
    ];

    if (isCheck) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`poker:check:${session.id}`)
          .setLabel('✅ チェック')
          .setStyle(ButtonStyle.Primary),
      );
    } else {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`poker:call:${session.id}`)
          .setLabel(`✅ コール ${formatChips(callAmount)}`)
          .setStyle(ButtonStyle.Primary),
      );
    }

    buttons.push(
      new ButtonBuilder()
        .setCustomId(`poker:raise:${session.id}`)
        .setLabel('⬆️ レイズ')
        .setStyle(ButtonStyle.Success),
    );

    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons),
    );
  }

  return container;
}

export function buildPokerResultView(
  session: PokerSessionState,
  winners: WinnerInfo[],
  pots: PotInfo[],
): ContainerBuilder {
  // Community cards
  const communityDisplay = session.communityCards.map(c => formatCard(c)).join(' ');

  // Show each non-folded player's hand
  const handLines = session.players
    .filter(p => !p.folded)
    .map(p => {
      const cards = p.holeCards.map(c => formatCard(c)).join(' ');
      const winner = winners.find(w => w.userId === p.userId);
      const handName = winner?.hand?.name ?? '';
      const prize = winner ? ` → 獲得 **${formatChips(winner.amount)}**` : '';
      return `**${p.displayName}**: ${cards} ${handName}${prize}`;
    })
    .join('\n');

  // Pot summary
  const potLines = pots.map((pot, i) => {
    const label = i === 0 ? 'メインポット' : `サイドポット ${i}`;
    return `${label}: ${formatChips(pot.amount)}`;
  }).join('\n');

  // Winner announcement
  const winnerNames = [...new Set(winners.map(w => {
    const player = session.players.find(p => p.userId === w.userId);
    return player?.displayName ?? w.userId;
  }))];
  const winnerText = winnerNames.length === 1
    ? `🏆 **${winnerNames[0]}** の勝利！`
    : `🏆 **${winnerNames.join(', ')}** が勝利！`;

  return new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('🃏 ━━━ **ショーダウン** ━━━ 🃏'),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`コミュニティ: ${communityDisplay}`),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(handLines),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(potLines),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(winnerText),
    );
}

export function buildPokerFoldWinView(
  session: PokerSessionState,
  winnerUserId: string,
): ContainerBuilder {
  const winner = session.players.find(p => p.userId === winnerUserId);
  const totalPot = session.players.reduce((sum, p) => sum + p.totalBet, 0n);
  const winnerName = winner?.displayName ?? 'Unknown';

  return new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.poker),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `🏆 **${winnerName}** の勝利！\n全員がフォールドしました。\nポット: **${formatChips(totalPot)}**`,
      ),
    );
}

export function buildPokerCancelledView(reason: string): ContainerBuilder {
  return new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.red)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.poker),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`❌ **ゲーム中止**\n${reason}`),
    );
}
