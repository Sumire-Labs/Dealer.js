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
import {type ChinchiroHand, formatDice} from '../../../games/chinchiro/chinchiro.engine.js';

// ─── Animation frame ───────────────────────────────────

export function buildChinchiroSoloRollingView(
    dice: [string, string, string],
): ContainerBuilder {
    return new ContainerBuilder()
        .setAccentColor(CasinoTheme.colors.darkGreen)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(CasinoTheme.prefixes.chinchiro),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `🎲 ダイスロール中...\n【 ${dice[0]} 】【 ${dice[1]} 】【 ${dice[2]} 】`,
            ),
        );
}

// ─── Dealer result + roll button ───────────────────────

export function buildChinchiroSoloDealerView(
    dealerHand: ChinchiroHand,
    userId: string,
): ContainerBuilder {
    return new ContainerBuilder()
        .setAccentColor(CasinoTheme.colors.darkGreen)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(CasinoTheme.prefixes.chinchiro),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `🏠 ディーラー（親）:\n${formatDice(dealerHand.dice)} → ${dealerHand.displayName}`,
            ),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('あなたの番です！'),
        )
        .addActionRowComponents(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`chinchiro:roll:${userId}`)
                    .setLabel('🎲 振る')
                    .setStyle(ButtonStyle.Primary),
            ),
        );
}

// ─── Menashi reroll prompt ─────────────────────────────

export function buildChinchiroSoloRerollView(
    dealerHand: ChinchiroHand,
    rollHistory: ChinchiroHand[],
    rollsRemaining: number,
    userId: string,
): ContainerBuilder {
    const historyLines = rollHistory.map((h, i) =>
        `${i + 1}回目: ${formatDice(h.dice)} → ${h.displayName}`,
    ).join('\n');

    return new ContainerBuilder()
        .setAccentColor(CasinoTheme.colors.darkGreen)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(CasinoTheme.prefixes.chinchiro),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `🏠 ディーラー: ${formatDice(dealerHand.dice)} → ${dealerHand.displayName}`,
            ),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `あなた:\n${historyLines}\n残り振り直し: ${rollsRemaining}回`,
            ),
        )
        .addActionRowComponents(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`chinchiro:reroll:${userId}`)
                    .setLabel('🎲 振り直す')
                    .setStyle(ButtonStyle.Primary),
            ),
        );
}

// ─── Final result ──────────────────────────────────────

export function buildChinchiroSoloResultView(
    dealerHand: ChinchiroHand,
    playerHand: ChinchiroHand,
    outcome: 'win' | 'lose' | 'draw',
    bet: bigint,
    payout: bigint,
    newBalance: bigint,
    _userId: string,
): ContainerBuilder {
    const net = payout - bet;
    let outcomeText: string;
    if (outcome === 'win') {
        outcomeText = `🏆 勝ち！ +${formatChips(net)}`;
    } else if (outcome === 'draw') {
        outcomeText = `🤝 引き分け ±$0`;
    } else {
        outcomeText = `💀 負け ${formatChips(net)}`;
    }

    return new ContainerBuilder()
        .setAccentColor(outcome === 'win' ? CasinoTheme.colors.gold : CasinoTheme.colors.red)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(CasinoTheme.prefixes.chinchiro),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `🏠 ディーラー: ${formatDice(dealerHand.dice)} → ${dealerHand.displayName}\nあなた: ${formatDice(playerHand.dice)} → ${playerHand.displayName}`,
            ),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `${outcomeText}\n残高: ${formatChips(newBalance)}`,
            ),
        );
}
