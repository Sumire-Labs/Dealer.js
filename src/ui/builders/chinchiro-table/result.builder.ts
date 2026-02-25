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
import {formatDice} from '../../../games/chinchiro/chinchiro.engine.js';
import type {ChinchiroTableSession} from '../../../games/chinchiro/chinchiro-table.session.js';
import type {PlayerRoundResult} from '../../../games/chinchiro/chinchiro-table.engine.js';

// ─── Round result ──────────────────────────────────────

export function buildChinchiroRoundResultView(
    session: ChinchiroTableSession,
    roundResults: PlayerRoundResult[],
    bankerNet: bigint,
): ContainerBuilder {
    const banker = session.players[session.bankerIndex];
    const totalRounds = session.players.length;
    const currentRound = session.completedRotations + 1;

    const container = new ContainerBuilder()
        .setAccentColor(CasinoTheme.colors.gold)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(CasinoTheme.prefixes.chinchiroTable),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `🔄 ラウンド ${currentRound}/${totalRounds} 結果 — 親: ${banker.displayName}`,
            ),
        );

    // Banker hand
    if (banker.currentHand) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `🏠 親: ${formatDice(banker.currentHand.dice)} → ${banker.currentHand.displayName}`,
            ),
        );
    } else {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`🏠 親: 目なし`),
        );
    }

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    // Player results
    for (const result of roundResults) {
        const player = session.players.find(p => p.userId === result.userId)!;
        const handText = result.hand
            ? `${formatDice(result.hand.dice)} → ${result.hand.displayName}`
            : '目なし';

        let outcomeIcon: string;
        let outcomeText: string;

        if (result.outcome === 'win') {
            const winAmount = session.bet * BigInt(result.multiplier);
            outcomeIcon = '🏆';
            outcomeText = `勝ち!     +${formatChips(winAmount)}`;
        } else if (result.outcome === 'draw') {
            outcomeIcon = '🤝';
            outcomeText = `引き分け   ±$0`;
        } else {
            const loseAmount = session.bet * BigInt(result.multiplier);
            outcomeIcon = '💀';
            outcomeText = `負け      -${formatChips(loseAmount)}`;
        }

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `${outcomeIcon} ${player.displayName}: ${handText} → ${outcomeText}`,
            ),
        );
    }

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    // Banker net
    const bankerNetText = bankerNet > 0n
        ? `+${formatChips(bankerNet)}`
        : bankerNet === 0n ? '±$0' : formatChips(bankerNet);
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `親 ${banker.displayName}: ${bankerNetText}`,
        ),
    );

    // Next round button (if not final)
    if (session.completedRotations + 1 < session.players.length) {
        container.addActionRowComponents(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`ct:nextround:${session.channelId}:${session.hostId}`)
                    .setLabel('▶️ 次のラウンド')
                    .setStyle(ButtonStyle.Success),
            ),
        );
    }

    return container;
}

// ─── Final result ──────────────────────────────────────

export function buildChinchiroFinalResultView(
    session: ChinchiroTableSession,
): ContainerBuilder {
    const container = new ContainerBuilder()
        .setAccentColor(CasinoTheme.colors.gold)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(CasinoTheme.prefixes.chinchiroTable),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('🏁 最終結果'),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        );

    // Sort by net result descending
    const sorted = [...session.players].sort((a, b) => {
        if (a.netResult > b.netResult) return -1;
        if (a.netResult < b.netResult) return 1;
        return 0;
    });

    for (let i = 0; i < sorted.length; i++) {
        const player = sorted[i];
        let netText: string;
        if (player.netResult > 0n) {
            netText = `+${formatChips(player.netResult)}`;
        } else if (player.netResult === 0n) {
            netText = '±$0';
        } else {
            netText = formatChips(player.netResult);
        }

        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '▪️';
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `${medal} ${player.displayName}: ${netText}`,
            ),
        );
    }

    return container;
}

// ─── Cancelled view ────────────────────────────────────

export function buildChinchiroCancelledView(reason: string): ContainerBuilder {
    return new ContainerBuilder()
        .setAccentColor(CasinoTheme.colors.red)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(CasinoTheme.prefixes.chinchiroTable),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`❌ ${reason}`),
        );
}
