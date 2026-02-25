import {ContainerBuilder, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder,} from 'discord.js';
import {CasinoTheme} from '../../themes/casino.theme.js';
import {formatChips} from '../../../utils/formatters.js';
import {cardToString} from '../../../games/blackjack/blackjack.deck.js';
import {evaluateHand} from '../../../games/blackjack/blackjack.hand.js';
import type {BlackjackTableSession, TablePlayer} from '../../../games/blackjack/blackjack-table.session.js';
import {calculatePlayerPayout} from '../../../games/blackjack/blackjack-table.engine.js';

function renderHand(cards: { suit: string; rank: string }[]): string {
    return cards.map(c => cardToString(c as never)).join('  ');
}

function handValueText(cards: { suit: string; rank: string }[]): string {
    const value = evaluateHand(cards as never);
    if (value.isBlackjack) return '**21 BJ!**';
    if (value.isBust) return `~~${value.best}~~ バスト`;
    return value.isSoft ? `${value.best}（ソフト）` : `${value.best}`;
}

function outcomeIcon(outcome: string): string {
    switch (outcome) {
        case 'blackjack':
            return '🂡';
        case 'win':
        case 'dealer_bust':
            return '🏆';
        case 'push':
            return '🤝';
        case 'bust':
        case 'lose':
            return '💀';
        default:
            return '❓';
    }
}

function outcomeLabel(outcome: string): string {
    switch (outcome) {
        case 'blackjack':
            return 'BJ!';
        case 'win':
            return '勝ち！';
        case 'dealer_bust':
            return '勝ち！';
        case 'push':
            return '引き分け';
        case 'bust':
            return 'バスト';
        case 'lose':
            return '負け';
        default:
            return outcome;
    }
}

function renderPlayerResult(player: TablePlayer, penaltyNet?: bigint): string {
    const result = calculatePlayerPayout(player);
    const net = penaltyNet !== undefined ? penaltyNet : result.net;
    const lines: string[] = [];

    for (let h = 0; h < player.hands.length; h++) {
        const hand = player.hands[h];
        const handDisplay = renderHand(hand.cards);
        const valueText = handValueText(hand.cards);
        const outcome = player.outcomes[h];
        const icon = outcomeIcon(outcome);
        const label = outcomeLabel(outcome);
        const handLabel = player.hands.length > 1 ? ` H${h + 1}` : '';

        lines.push(`${icon} ${player.displayName}${handLabel}: ${handDisplay}  →  ${valueText}  ${label}`);
    }

    // Net result
    let netText: string;
    if (net > 0n) {
        netText = `+${formatChips(net)}`;
    } else if (net === 0n) {
        netText = `±$0`;
    } else {
        netText = formatChips(net);
    }
    lines.push(`   ${netText}`);

    // Insurance
    if (player.insuranceBet > 0n) {
        const insText = player.insurancePaid
            ? `🛡️ インシュランス的中！`
            : `🛡️ インシュランス失敗`;
        lines.push(`   ${insText}`);
    }

    return lines.join('\n');
}

export function buildBjTableResultView(
    session: BlackjackTableSession,
    playerNets?: Map<string, bigint>,
): ContainerBuilder {
    const dealerDisplay = renderHand(session.dealerCards);
    const dealerValueText = handValueText(session.dealerCards);

    const container = new ContainerBuilder()
        .setAccentColor(CasinoTheme.colors.gold)
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

    for (const player of session.players) {
        const penaltyNet = playerNets?.get(player.userId);
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(renderPlayerResult(player, penaltyNet)),
        );
    }

    return container;
}

export function buildBjTableCancelledView(reason: string): ContainerBuilder {
    return new ContainerBuilder()
        .setAccentColor(CasinoTheme.colors.red)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(CasinoTheme.prefixes.blackjackTable),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`❌ ${reason}`),
        );
}
