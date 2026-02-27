import {
    ActionRowBuilder,
    type ButtonInteraction,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import {buildBankViewData} from '../../../database/services/bank-view.service.js';
import {buildBankMainView, buildFixedDepositWithdrawView} from '../../../ui/builders/bank.builder.js';
import {
    earlyWithdrawFixedDeposit,
    getFixedDepositsForDisplay
} from '../../../database/services/fixed-deposit.service.js';
import {formatChips} from '../../../utils/formatters.js';
import {configService} from '../../../config/config.service.js';
import {S} from '../../../config/setting-defs.js';

export async function handleFixedCreate(interaction: ButtonInteraction, action: string): Promise<void> {
    const termDays = action === 'fixed_create_7' ? 7 : 30;
    const modal = new ModalBuilder()
        .setCustomId(`bank_modal:fixed_create:${termDays}`)
        .setTitle(`定期預金 — ${termDays}日プラン`)
        .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('amount')
                    .setLabel(`預入額（最低: ${Number(configService.getBigInt(S.fixedDepositMinAmount)).toLocaleString()}）`)
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('例: 50000, 50k, 1m')
                    .setRequired(true),
            ),
        );
    await interaction.showModal(modal);
}

export async function handleFixedEarlyWithdraw(interaction: ButtonInteraction, userId: string): Promise<void> {
    const deposits = await getFixedDepositsForDisplay(userId);
    if (deposits.length === 0) {
        await interaction.reply({content: 'アクティブな定期預金がありません。', flags: MessageFlags.Ephemeral});
        return;
    }
    const view = buildFixedDepositWithdrawView(userId, deposits);
    await interaction.update({components: [view], flags: MessageFlags.IsComponentsV2});
}

export async function handleFixedWithdrawConfirm(interaction: ButtonInteraction, userId: string, depositId: string): Promise<void> {
    try {
        const result = await earlyWithdrawFixedDeposit(userId, depositId);
        await interaction.reply({
            content: `早期解約完了。元金 ${formatChips(result.returnedAmount)} を口座に返却しました。`,
            flags: MessageFlags.Ephemeral,
        });
        // Update the view behind
        const data = await buildBankViewData(userId);
        const view = buildBankMainView(data, 'fixed_deposit');
        await interaction.message.edit({components: [view], flags: MessageFlags.IsComponentsV2});
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === 'DEPOSIT_NOT_FOUND') {
            await interaction.reply({
                content: 'この預金は見つかりません。既に解約済みの可能性があります。',
                flags: MessageFlags.Ephemeral,
            });
        } else {
            throw error;
        }
    }
}
