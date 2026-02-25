import {type ButtonInteraction, MessageFlags} from 'discord.js';
import {buildBankViewData} from '../../../database/services/bank-view.service.js';
import {buildBankMainView} from '../../../ui/builders/bank.builder.js';
import {bankHistoryPage, bankLoanPage} from './page-state.js';

export async function handleTabAccount(interaction: ButtonInteraction, userId: string): Promise<void> {
    const data = await buildBankViewData(userId);
    const view = buildBankMainView(data, 'account');
    await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
    });
}

export async function handleTabLoan(interaction: ButtonInteraction, userId: string): Promise<void> {
    const page = bankLoanPage.get(userId) ?? 1;
    const data = await buildBankViewData(userId);
    data.loanPage = page;
    const view = buildBankMainView(data, 'loan');
    await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
    });
}

export async function handleTabHistory(interaction: ButtonInteraction, userId: string): Promise<void> {
    const page = bankHistoryPage.get(userId) ?? 1;
    const data = await buildBankViewData(userId, {historyPage: page});
    const view = buildBankMainView(data, 'history');
    await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
    });
}

export async function handleTabFixed(interaction: ButtonInteraction, userId: string): Promise<void> {
    const data = await buildBankViewData(userId);
    const view = buildBankMainView(data, 'fixed_deposit');
    await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
    });
}
