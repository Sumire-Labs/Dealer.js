import {type ButtonInteraction, MessageFlags} from 'discord.js';
import {buildBankViewData} from '../../../database/services/bank-view.service.js';
import {buildBankMainView} from '../../../ui/builders/bank.builder.js';
import {bankHistoryPage, setPageGuarded} from './page-state.js';

export async function handleHistoryPrev(interaction: ButtonInteraction, userId: string): Promise<void> {
    const current = bankHistoryPage.get(userId) ?? 1;
    const newPage = Math.max(1, current - 1);
    setPageGuarded(bankHistoryPage, userId, newPage);
    const data = await buildBankViewData(userId, {historyPage: newPage});
    const view = buildBankMainView(data, 'history');
    await interaction.update({components: [view], flags: MessageFlags.IsComponentsV2});
}

export async function handleHistoryNext(interaction: ButtonInteraction, userId: string): Promise<void> {
    const current = bankHistoryPage.get(userId) ?? 1;
    const newPage = current + 1;
    setPageGuarded(bankHistoryPage, userId, newPage);
    const data = await buildBankViewData(userId, {historyPage: newPage});
    const view = buildBankMainView(data, 'history');
    await interaction.update({components: [view], flags: MessageFlags.IsComponentsV2});
}
