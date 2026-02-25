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
import {formatChips, formatTimeDelta} from '../../../utils/formatters.js';
import type {BankViewData} from './types.js';

export function buildLoanTab(container: ContainerBuilder, data: BankViewData): void {
    const {userId, walletBalance, loanSummary, penaltyRemainingMs} = data;
    const loans = data.individualLoans ?? [];
    const page = data.loanPage ?? 1;
    const loansPerPage = 5;
    const totalPages = Math.max(1, Math.ceil(loans.length / loansPerPage));
    const startIdx = (page - 1) * loansPerPage;
    const pageLoans = loans.slice(startIdx, startIdx + loansPerPage);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`💰 ウォレット: ${formatChips(walletBalance)}`),
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    if (loans.length > 0) {
        let loanText = `📋 ローン詳細 (${loans.length}件)\n`;
        pageLoans.forEach((loan, i) => {
            const num = startIdx + i + 1;
            const elapsed = formatTimeDelta(loan.elapsedMs);
            loanText += `\n**#${num}**　元金: ${formatChips(loan.principal)}　利息: ${formatChips(loan.interest)}　経過: ${elapsed}`;
        });
        loanText += `\n\n　合計返済額: ${formatChips(loanSummary.totalOwed)}`;
        loanText += `\n　追加借入可能額: ${formatChips(loanSummary.remainingCapacity)}`;

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(loanText),
        );
    } else {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `📋 ローン状況\n　借入なし\n　借入可能額: ${formatChips(loanSummary.remainingCapacity)}`,
            ),
        );
    }

    if (penaltyRemainingMs > 0) {
        container.addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        );
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `⚠️ 破産ペナルティ中 — 報酬 -10%（残り ${formatTimeDelta(penaltyRemainingMs)}）`,
            ),
        );
    }

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    // Pagination row (only if more than 1 page)
    if (totalPages > 1) {
        container.addActionRowComponents(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`bank:loan_prev:${userId}`)
                    .setLabel('◀')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page <= 1),
                new ButtonBuilder()
                    .setCustomId(`bank:loan_page_info:${userId}`)
                    .setLabel(`${page}/${totalPages}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId(`bank:loan_next:${userId}`)
                    .setLabel('▶')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page >= totalPages),
            ),
        );
    }

    // Loan action buttons
    container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`bank:borrow:${userId}`)
                .setLabel('💵 借入')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`bank:repay:${userId}`)
                .setLabel('💳 返済')
                .setStyle(ButtonStyle.Success)
                .setDisabled(loanSummary.loanCount === 0),
            new ButtonBuilder()
                .setCustomId(`bank:bankrupt:${userId}`)
                .setLabel('💀 破産')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(loanSummary.loanCount === 0),
        ),
    );
}

export function buildBankruptcyConfirmView(
    userId: string,
    totalOwed: bigint,
    currentBalance: bigint,
    currentBankBalance: bigint,
): ContainerBuilder {
    return new ContainerBuilder()
        .setAccentColor(CasinoTheme.colors.red)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('⚠️ 破産申告の確認'),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `・全ローン（${formatChips(totalOwed)}）を帳消し\n` +
                `・全チップ（${formatChips(currentBalance)}）を没収\n` +
                `・口座残高（${formatChips(currentBankBalance)}）を没収\n` +
                `・${formatChips(2_500n)} を支給\n` +
                `・1時間のギャンブル報酬 -10% ペナルティ`,
            ),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addActionRowComponents(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`bank:confirm_bankrupt:${userId}`)
                    .setLabel('✅ 実行')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`bank:cancel:${userId}`)
                    .setLabel('❌ キャンセル')
                    .setStyle(ButtonStyle.Secondary),
            ),
        );
}
