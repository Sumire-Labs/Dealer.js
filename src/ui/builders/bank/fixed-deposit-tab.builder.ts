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
import type {FixedDepositInfo} from '../../../database/services/fixed-deposit.service.js';
import type {BankViewData} from './types.js';

export function buildFixedDepositTab(container: ContainerBuilder, data: BankViewData): void {
    const {userId, bankBalance} = data;
    const deposits = data.fixedDeposits ?? [];

    // Plan description
    let info = `📌 定期預金\n\n`;
    info += `口座残高から預入し、満期時に倍率分を受取ります。\n`;
    info += `早期解約の場合、元金のみ返却されます。\n\n`;
    info += `📋 プラン一覧\n`;

    info += `　7日プラン: 元金 × 倍率\n`;
    info += `　30日プラン: 元金 × 倍率\n\n`;
    info += `🏦 口座残高: ${formatChips(bankBalance)}`;

    if (deposits.length > 0) {
        info += `\n\n📌 アクティブ預金 (${deposits.length}件)`;
        deposits.forEach((d, i) => {
            const remaining = d.remainingMs > 0 ? formatTimeDelta(d.remainingMs) : '満期！';
            info += `\n**#${i + 1}**　${formatChips(d.amount)} × ${d.interestRate} (${d.termDays}日)　残り: ${remaining}`;
        });
    } else {
        info += `\n\n　アクティブな定期預金はありません。`;
    }

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(info),
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    // Actions
    container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`bank:fixed_create_7:${userId}`)
                .setLabel('📌 7日プラン')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`bank:fixed_create_30:${userId}`)
                .setLabel('📌 30日プラン')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`bank:fixed_early_withdraw:${userId}`)
                .setLabel('⚠️ 早期解約')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(deposits.length === 0),
            new ButtonBuilder()
                .setCustomId(`bank:tab_account:${userId}`)
                .setLabel('🔙 戻る')
                .setStyle(ButtonStyle.Secondary),
        ),
    );
}

export function buildFixedDepositWithdrawView(
    userId: string,
    deposits: FixedDepositInfo[],
): ContainerBuilder {
    const container = new ContainerBuilder()
        .setAccentColor(CasinoTheme.colors.red)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('⚠️ 早期解約 — 元金のみ返却されます'),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        );

    let text = '';
    deposits.forEach((d, i) => {
        const remaining = d.remainingMs > 0 ? formatTimeDelta(d.remainingMs) : '満期！';
        text += `**#${i + 1}**　${formatChips(d.amount)} (${d.termDays}日)　残り: ${remaining}\n`;
    });

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(text),
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    // Buttons for each deposit (max 5 per row)
    const buttons = deposits.slice(0, 5).map((d, i) =>
        new ButtonBuilder()
            .setCustomId(`bank:fixed_withdraw_confirm:${userId}:${d.id}`)
            .setLabel(`#${i + 1} 解約`)
            .setStyle(ButtonStyle.Danger),
    );

    buttons.push(
        new ButtonBuilder()
            .setCustomId(`bank:tab_fixed:${userId}`)
            .setLabel('🔙 戻る')
            .setStyle(ButtonStyle.Secondary),
    );

    container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons),
    );

    return container;
}
