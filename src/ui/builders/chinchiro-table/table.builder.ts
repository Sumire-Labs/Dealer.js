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
import {formatDice} from '../../../games/chinchiro/chinchiro.engine.js';
import type {ChinchiroTableSession, ChinchiroTablePlayer} from '../../../games/chinchiro/chinchiro-table.session.js';

function renderPlayerLine(
    player: ChinchiroTablePlayer,
    index: number,
    session: ChinchiroTableSession,
): string {
    const isBanker = index === session.bankerIndex;
    const isCurrent = session.currentPlayerIndex === index && !player.done;

    let statusIcon: string;
    let statusText: string;

    if (player.done && player.currentHand) {
        statusIcon = '✅';
        statusText = '完了';
    } else if (isCurrent) {
        statusIcon = '👈';
        statusText = 'あなたのターン';
    } else if (isBanker && session.phase === 'player_roll') {
        statusIcon = '🏠';
        statusText = '親';
    } else {
        statusIcon = '⏳';
        statusText = '待機中';
    }

    const roleTag = isBanker ? ' (親)' : '';
    const handText = player.currentHand
        ? `${formatDice(player.currentHand.dice)} → ${player.currentHand.displayName}`
        : '待機中...';

    return `${statusIcon} ${player.displayName}${roleTag}: ${handText}           ${statusText}`;
}

export function buildChinchiroTableView(session: ChinchiroTableSession): ContainerBuilder {
    const banker = session.players[session.bankerIndex];
    const totalRounds = session.players.length;
    const currentRound = session.completedRotations + 1;

    const container = new ContainerBuilder()
        .setAccentColor(CasinoTheme.colors.darkGreen)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(CasinoTheme.prefixes.chinchiroTable),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `🔄 ラウンド ${currentRound}/${totalRounds} — 親: ${banker.displayName}`,
            ),
        );

    // Show banker hand if phase is player_roll
    if (session.phase === 'player_roll' && banker.currentHand) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `🏠 親: ${formatDice(banker.currentHand.dice)} → ${banker.currentHand.displayName}`,
            ),
        );
    }

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    // Player lines
    for (let i = 0; i < session.players.length; i++) {
        if (i === session.bankerIndex && session.phase === 'player_roll') continue; // banker shown above
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(renderPlayerLine(session.players[i], i, session)),
        );
    }

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    // Current player info + buttons
    const currentPlayer = session.players[session.currentPlayerIndex];
    if (currentPlayer && !currentPlayer.done) {
        const remainingSec = Math.max(0, Math.ceil((session.turnDeadline - Date.now()) / 1000));
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `▶ ${currentPlayer.displayName} のターン · ⏰ ${remainingSec}秒`,
            ),
        );

        // Show reroll info if player has history
        if (currentPlayer.rollHistory.length > 0 && currentPlayer.rollsRemaining > 0) {
            const lastRoll = currentPlayer.rollHistory[currentPlayer.rollHistory.length - 1];
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `前回: ${formatDice(lastRoll.dice)} → ${lastRoll.displayName} | 残り振り直し: ${currentPlayer.rollsRemaining}回`,
                ),
            );
            container.addActionRowComponents(
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`ct:reroll:${session.channelId}:${currentPlayer.userId}`)
                        .setLabel('🎲 振り直す')
                        .setStyle(ButtonStyle.Primary),
                ),
            );
        } else {
            container.addActionRowComponents(
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`ct:roll:${session.channelId}:${currentPlayer.userId}`)
                        .setLabel('🎲 振る')
                        .setStyle(ButtonStyle.Primary),
                ),
            );
        }
    }

    return container;
}
