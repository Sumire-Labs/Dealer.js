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
import type {BankTab, BankViewData} from './types.js';
import {buildAccountTab} from './account-tab.builder.js';
import {buildLoanTab} from './loan-tab.builder.js';
import {buildHistoryTab} from './history-tab.builder.js';
import {buildFixedDepositTab} from './fixed-deposit-tab.builder.js';
import {buildTransferSelectTab} from './transfer-tab.builder.js';

// ── Tab bar builder ──────────────────────────────────────────────────

function buildTabRow(userId: string, currentTab: BankTab): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`bank:tab_account:${userId}`)
            .setLabel('🏦 口座')
            .setStyle(currentTab === 'account' ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setDisabled(currentTab === 'account'),
        new ButtonBuilder()
            .setCustomId(`bank:tab_loan:${userId}`)
            .setLabel('📋 ローン')
            .setStyle(currentTab === 'loan' ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setDisabled(currentTab === 'loan'),
        new ButtonBuilder()
            .setCustomId(`bank:tab_history:${userId}`)
            .setLabel('📜 履歴')
            .setStyle(currentTab === 'history' ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setDisabled(currentTab === 'history'),
    );
}

// ── Main view builder ────────────────────────────────────────────────

export function buildBankMainView(data: BankViewData, tab: BankTab = 'account'): ContainerBuilder {
    const container = new ContainerBuilder()
        .setAccentColor(CasinoTheme.colors.gold)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(CasinoTheme.prefixes.bank),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        );

    switch (tab) {
        case 'account':
            buildAccountTab(container, data);
            break;
        case 'loan':
            buildLoanTab(container, data);
            break;
        case 'history':
            buildHistoryTab(container, data);
            break;
        case 'fixed_deposit':
            buildFixedDepositTab(container, data);
            break;
        case 'transfer_select':
            buildTransferSelectTab(container, data);
            break;
    }

    // Tab bar (not for transfer_select or fixed_deposit — they have own back buttons)
    if (tab !== 'transfer_select' && tab !== 'fixed_deposit') {
        container.addActionRowComponents(buildTabRow(data.userId, tab));
    }

    return container;
}
