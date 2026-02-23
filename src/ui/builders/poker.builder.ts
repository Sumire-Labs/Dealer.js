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
import type { PokerPlayer, WinnerInfo, PotInfo } from '../../games/poker/poker.engine.js';
import { canCheck } from '../../games/poker/poker.engine.js';
import { formatCard, formatHidden } from '../../games/poker/poker.deck.js';
import type { PokerPhase } from '../../games/poker/poker.engine.js';
import { evaluateBestHand } from '../../games/poker/poker.hand.js';

// ─── Helpers ──────────────────────────────────────────

const PHASE_LABELS: Record<PokerPhase, string> = {
  preflop: 'PRE-FLOP',
  flop: 'FLOP',
  turn: 'TURN',
  river: 'RIVER',
  showdown: 'SHOWDOWN',
};

const PHASE_PROGRESS: Record<PokerPhase, string> = {
  preflop: '▶ ━ ━ ━',
  flop: '✅ ▶ ━ ━',
  turn: '✅ ✅ ▶ ━',
  river: '✅ ✅ ✅ ▶',
  showdown: '✅ ✅ ✅ ✅',
};

function positionTag(playerIndex: number, dealerIndex: number, playerCount: number): string {
  if (playerIndex === dealerIndex) return '`D `';
  const sbIndex = playerCount === 2 ? dealerIndex : (dealerIndex + 1) % playerCount;
  const bbIndex = playerCount === 2 ? (dealerIndex + 1) % playerCount : (dealerIndex + 2) % playerCount;
  if (playerIndex === sbIndex) return '`SB`';
  if (playerIndex === bbIndex) return '`BB`';
  return '`  `';
}

function buildCommunityLine(communityCards: { suit: string; rank: string }[]): string {
  const cards: string[] = [];
  for (let i = 0; i < 5; i++) {
    if (i < communityCards.length) {
      cards.push(formatCard(communityCards[i] as never));
    } else {
      cards.push(formatHidden());
    }
  }
  return cards.join('  ');
}

function getHandStrengthText(holeCards: { suit: string; rank: string }[], communityCards: { suit: string; rank: string }[]): string {
  const allCards = [...holeCards, ...communityCards];
  if (allCards.length < 5) return '';
  const result = evaluateBestHand(allCards as never);
  return `🃏 ベストハンド: **${result.name}**`;
}

function getPotOddsText(callAmount: bigint, totalPot: bigint): string {
  if (callAmount <= 0n) return '';
  const potAfterCall = totalPot + callAmount;
  // pot odds = potAfterCall : callAmount
  const ratioX10 = potAfterCall * 10n / callAmount;
  const ratio = (Number(ratioX10) / 10).toFixed(1);
  return `📊 ポットオッズ: ${ratio} : 1`;
}

// ─── Lobby ────────────────────────────────────────────

export function buildPokerLobbyView(
  session: PokerSessionState,
  remainingSeconds: number,
): ContainerBuilder {
  const playerList = session.players.length > 0
    ? session.players.map((p, i) =>
      `> **${i + 1}.** ${p.displayName}  —  ${formatChips(p.stack)}`,
    ).join('\n')
    : '> *参加者を待っています...*';

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
        '**Texas Hold\'em**\n`バイイン` $2,000 ~ $100,000  |  `SB / BB` $100 / $200',
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**参加者 (${session.players.length} / 6)**\n${playerList}`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `⏰ 締切まで **${remainingSeconds}** 秒`,
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

// ─── Table (shared, read-only + panel button) ─────────

export function buildPokerTableView(
  session: PokerSessionState,
): ContainerBuilder {
  const phase = session.phase;
  const communityLine = buildCommunityLine(session.communityCards);
  const totalPot = session.players.reduce((sum, p) => sum + p.totalBet, 0n);

  // Phase progress bar
  const progressBar = PHASE_PROGRESS[phase];

  // Player rows
  const playerBlock = session.players.map((p, i) => {
    const tag = positionTag(i, session.dealerIndex, session.players.length);
    const isTurn = i === session.currentPlayerIndex && !p.folded && !p.allIn && phase !== 'showdown';

    if (p.folded) {
      return `${tag}  ~~${p.displayName}~~  —  *Fold*`;
    }

    const statusParts: string[] = [];
    if (p.allIn) statusParts.push('**ALL-IN**');
    if (p.currentBet > 0n) statusParts.push(`Bet ${formatChips(p.currentBet)}`);

    const turnMarker = isTurn ? '  ▶' : '';
    const stackLine = `💰 ${formatChips(p.stack)}`;
    const statusLine = statusParts.length > 0 ? `  |  ${statusParts.join(' · ')}` : '';

    return `${tag}  **${p.displayName}**${turnMarker}\n> ${stackLine}${statusLine}`;
  }).join('\n');

  // Turn indicator
  const currentPlayer = session.players[session.currentPlayerIndex];
  const remaining = Math.max(0, Math.ceil((session.turnDeadline - Date.now()) / 1000));
  const turnText = currentPlayer && !currentPlayer.folded && !currentPlayer.allIn && phase !== 'showdown'
    ? `▶ **${currentPlayer.displayName}** のターン  ·  ⏰ **${remaining}** 秒`
    : `⏰ **${remaining}** 秒`;

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.darkGreen)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.poker),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `━━  **${PHASE_LABELS[phase]}**  ━━  ${progressBar}\n${communityLine}`,
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
      new TextDisplayBuilder().setContent(playerBlock),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(turnText),
    );

  // Single button: open personal panel
  if (phase !== 'showdown') {
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`poker:panel:${session.id}`)
          .setLabel('🃏 手札 / アクション')
          .setStyle(ButtonStyle.Primary),
      ),
    );
  }

  return container;
}

// ─── Player Panel (Ephemeral, per-player) ─────────────

export interface PlayerPanelData {
  content: string;
  components: ActionRowBuilder<ButtonBuilder>[];
}

export function buildPlayerPanel(
  session: PokerSessionState,
  player: PokerPlayer,
): PlayerPanelData {
  const handDisplay = player.holeCards.map(c => formatCard(c)).join('  ');
  const phase = session.phase;
  const totalPot = session.players.reduce((sum, p) => sum + p.totalBet, 0n);
  const remaining = Math.max(0, Math.ceil((session.turnDeadline - Date.now()) / 1000));

  // Community cards
  const communityLine = session.communityCards.length > 0
    ? session.communityCards.map(c => formatCard(c)).join('  ')
    : '*まだ公開されていません*';

  const isCurrentTurn =
    session.players[session.currentPlayerIndex]?.userId === player.userId
    && !player.folded
    && !player.allIn
    && phase !== 'showdown';

  // Header section
  const lines: string[] = [
    `🃏 **あなたの手札**:  ${handDisplay}`,
    '',
    `📋 ${communityLine}`,
    `💎 ポット: **${formatChips(totalPot)}**  ·  💰 スタック: **${formatChips(player.stack)}**`,
  ];

  // Hand strength (flop onwards, 5+ cards available)
  const handStrength = getHandStrengthText(player.holeCards, session.communityCards);
  if (handStrength) {
    lines.push(handStrength);
  }

  if (player.folded) {
    lines.push('', '❌ *フォールド済み*');
    return { content: lines.join('\n'), components: [] };
  }

  if (player.allIn) {
    lines.push('', '🔥 *ALL-IN*');
    return { content: lines.join('\n'), components: [] };
  }

  if (!isCurrentTurn) {
    const currentName = session.players[session.currentPlayerIndex]?.displayName ?? '?';
    lines.push('', `⏳ *${currentName} のターンを待っています...*`);
    return { content: lines.join('\n'), components: [] };
  }

  // It's this player's turn — add action info + buttons
  lines.push(
    '',
    `━━ **あなたのターン** ━━  ⏰ **${remaining}** 秒`,
  );

  const isCheck = canCheck(player, session.currentBet);
  const callAmount = session.currentBet - player.currentBet;

  // Pot odds display (only when calling)
  if (!isCheck && callAmount > 0n) {
    const potOdds = getPotOddsText(callAmount, totalPot);
    if (potOdds) {
      lines.push(potOdds);
    }
  }

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`poker:fold:${session.id}`)
      .setLabel('❌ フォールド')
      .setStyle(ButtonStyle.Danger),
  );

  if (isCheck) {
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`poker:check:${session.id}`)
        .setLabel('✅ チェック')
        .setStyle(ButtonStyle.Primary),
    );
  } else {
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`poker:call:${session.id}`)
        .setLabel(`✅ コール ${formatChips(callAmount)}`)
        .setStyle(ButtonStyle.Primary),
    );
  }

  actionRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`poker:raise:${session.id}`)
      .setLabel('⬆️ レイズ')
      .setStyle(ButtonStyle.Success),
  );

  return { content: lines.join('\n'), components: [actionRow] };
}

/** Message shown after a player takes an action from the ephemeral panel */
export function buildActionConfirmation(
  action: string,
  amount?: bigint,
): string {
  switch (action) {
    case 'fold':
      return '❌ **フォールド** しました。';
    case 'check':
      return '✅ **チェック** しました。';
    case 'call':
      return `✅ **コール** しました。 (${amount !== undefined ? formatChips(amount) : ''})`;
    case 'raise':
      return `⬆️ **レイズ** しました。 → ${amount !== undefined ? formatChips(amount) : ''}`;
    default:
      return 'アクション完了。';
  }
}

// ─── Showdown Result ──────────────────────────────────

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

// ─── Fold Win ─────────────────────────────────────────

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

// ─── Cancelled ────────────────────────────────────────

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
