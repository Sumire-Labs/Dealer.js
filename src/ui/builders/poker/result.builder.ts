import {ContainerBuilder, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder,} from 'discord.js';
import {CasinoTheme} from '../../themes/casino.theme.js';
import {formatChips} from '../../../utils/formatters.js';
import type {PokerSessionState} from '../../../games/poker/poker.session.js';
import type {PotInfo, WinnerInfo} from '../../../games/poker/poker.engine.js';
import {formatCard} from '../../../games/poker/poker.deck.js';

export function buildPokerResultView(
  session: PokerSessionState,
  winners: WinnerInfo[],
  pots: PotInfo[],
): ContainerBuilder {
  const communityDisplay = session.communityCards.map(c => formatCard(c)).join('  ');

  // Aggregate winnings per player
  const winMap = new Map<string, bigint>();
  for (const w of winners) {
    winMap.set(w.userId, (winMap.get(w.userId) ?? 0n) + w.amount);
  }

  // Player hands — winners first, then losers
  const nonFolded = session.players.filter(p => !p.folded);
  const winnerIds = new Set(winners.map(w => w.userId));
  const sorted = [
    ...nonFolded.filter(p => winnerIds.has(p.userId)),
    ...nonFolded.filter(p => !winnerIds.has(p.userId)),
  ];

  const handLines = sorted.map(p => {
    const cards = p.holeCards.map(c => formatCard(c)).join(' ');
    const hand = winners.find(w => w.userId === p.userId)?.hand;
    const handName = hand?.name ?? '';
    const totalWon = winMap.get(p.userId);
    const isWinner = totalWon !== undefined && totalWon > 0n;

    if (isWinner) {
      return `🏆 **${p.displayName}**  ${cards}\n> **${handName}**  →  獲得 **${formatChips(totalWon)}**`;
    }
    return `💀 ~~${p.displayName}~~  ${cards}\n> ${handName || 'ー'}  →  *-${formatChips(p.totalBet)}*`;
  }).join('\n');

  // Folded players
  const folded = session.players.filter(p => p.folded);
  const foldedLine = folded.length > 0
    ? folded.map(p => `> ~~${p.displayName}~~ — *Fold (-${formatChips(p.totalBet)})*`).join('\n')
    : '';

  // Pot summary
  const potLines = pots.map((pot, i) => {
    const label = i === 0 ? '💎 メインポット' : `💎 サイドポット #${i}`;
    return `${label}: **${formatChips(pot.amount)}**`;
  }).join('\n');

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('🃏 ━━━ **SHOWDOWN** ━━━ 🃏'),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(communityDisplay),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(potLines),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(handLines),
    );

  if (foldedLine) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(foldedLine),
    );
  }

  return container;
}

export function buildPokerFoldWinView(
  session: PokerSessionState,
  winnerUserId: string,
): ContainerBuilder {
  const winner = session.players.find(p => p.userId === winnerUserId);
  const totalPot = session.players.reduce((sum, p) => sum + p.totalBet, 0n);
  const winnerName = winner?.displayName ?? 'Unknown';

  const playerSummary = session.players.map(p => {
    if (p.userId === winnerUserId) {
      return `🏆 **${p.displayName}**  →  獲得 **${formatChips(totalPot)}**`;
    }
    return `> ~~${p.displayName}~~  —  *Fold (-${formatChips(p.totalBet)})*`;
  }).join('\n');

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
        `🏆 **${winnerName}** の勝利！\n*全員がフォールドしました*`,
      ),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `💎 ポット: **${formatChips(totalPot)}**`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(playerSummary),
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
