import {
  ActionRowBuilder,
  type ButtonInteraction,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import {findOrCreateUser} from '../../../database/repositories/user.repository.js';
import {declareBankruptcy, getLoanSummary} from '../../../database/services/loan.service.js';
import {buildBankViewData} from '../../../database/services/bank-view.service.js';
import {buildBankMainView, buildBankruptcyConfirmView} from '../../../ui/builders/bank.builder.js';
import {formatChips} from '../../../utils/formatters.js';
import {configService} from '../../../config/config.service.js';
import {S} from '../../../config/setting-defs.js';
import {bankLoanPage, setPageGuarded} from './page-state.js';

export async function handleBorrow(interaction: ButtonInteraction): Promise<void> {
    const modal = new ModalBuilder()
        .setCustomId(`bank_modal:borrow`)
        .setTitle('借入')
        .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('amount')
                    .setLabel(`金額（${Number(configService.getBigInt(S.loanMinAmount)).toLocaleString()}〜${Number(configService.getBigInt(S.loanMaxAmount)).toLocaleString()}）`)
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('例: 10000, 10k, 1m')
                    .setRequired(true),
            ),
        );
    await interaction.showModal(modal);
}

export async function handleRepay(interaction: ButtonInteraction, userId: string): Promise<void> {
    const summary = await getLoanSummary(userId);
    const modal = new ModalBuilder()
        .setCustomId(`bank_modal:repay`)
        .setTitle('返済')
        .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('amount')
                    .setLabel(`返済額（総返済額: ${formatChips(summary.totalOwed)}）`)
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('例: 5000, 5k')
                    .setRequired(true),
            ),
        );
    await interaction.showModal(modal);
}

export async function handleBankrupt(interaction: ButtonInteraction, userId: string): Promise<void> {
    const user = await findOrCreateUser(userId);
    const summary = await getLoanSummary(userId);

    if (summary.loanCount === 0) {
        await interaction.reply({content: '借金がないため、破産できません。', flags: MessageFlags.Ephemeral});
        return;
    }

    const confirmView = buildBankruptcyConfirmView(userId, summary.totalOwed, user.chips, user.bankBalance);
    await interaction.update({components: [confirmView], flags: MessageFlags.IsComponentsV2});
}

export async function handleConfirmBankrupt(interaction: ButtonInteraction, userId: string): Promise<void> {
    try {
        await declareBankruptcy(userId);
        const data = await buildBankViewData(userId);
        const view = buildBankMainView(data, 'loan');
        await interaction.update({components: [view], flags: MessageFlags.IsComponentsV2});
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === 'NO_LOANS') {
            await interaction.reply({content: '借金がないため、破産できません。', flags: MessageFlags.Ephemeral});
        } else {
            throw error;
        }
    }
}

export async function handleCancel(interaction: ButtonInteraction, userId: string): Promise<void> {
    const data = await buildBankViewData(userId);
    const view = buildBankMainView(data, 'loan');
    await interaction.update({components: [view], flags: MessageFlags.IsComponentsV2});
}

export async function handleLoanPrev(interaction: ButtonInteraction, userId: string): Promise<void> {
    const current = bankLoanPage.get(userId) ?? 1;
    const newPage = Math.max(1, current - 1);
    setPageGuarded(bankLoanPage, userId, newPage);
    const data = await buildBankViewData(userId);
    data.loanPage = newPage;
    const view = buildBankMainView(data, 'loan');
    await interaction.update({components: [view], flags: MessageFlags.IsComponentsV2});
}

export async function handleLoanNext(interaction: ButtonInteraction, userId: string): Promise<void> {
    const current = bankLoanPage.get(userId) ?? 1;
    const newPage = current + 1;
    setPageGuarded(bankLoanPage, userId, newPage);
    const data = await buildBankViewData(userId);
    data.loanPage = newPage;
    const view = buildBankMainView(data, 'loan');
    await interaction.update({components: [view], flags: MessageFlags.IsComponentsV2});
}
