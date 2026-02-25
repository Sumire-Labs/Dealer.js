import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
} from 'discord.js';
import {CasinoTheme} from '../../themes/casino.theme.js';
import {formatChips} from '../../../utils/formatters.js';
import type {PokerSessionState} from '../../../games/poker/poker.session.js';
import type {PokerPlayer} from '../../../games/poker/poker.engine.js';
import {canCheck} from '../../../games/poker/poker.engine.js';
import {formatCard} from '../../../games/poker/poker.deck.js';
import {
  buildCommunityLine,
  getHandStrengthText,
  getPotOddsText,
  PHASE_LABELS,
  PHASE_PROGRESS,
  positionTag,
} from './helpers.js';

export interface PlayerPanelData {
    content: string;
    components: ActionRowBuilder<ButtonBuilder>[];
}

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
        return {content: lines.join('\n'), components: []};
    }

    if (player.allIn) {
        lines.push('', '🔥 *ALL-IN*');
        return {content: lines.join('\n'), components: []};
    }

    if (!isCurrentTurn) {
        const currentName = session.players[session.currentPlayerIndex]?.displayName ?? '?';
        lines.push('', `⏳ *${currentName} のターンを待っています...*`);
        return {content: lines.join('\n'), components: []};
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

    return {content: lines.join('\n'), components: [actionRow]};
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
