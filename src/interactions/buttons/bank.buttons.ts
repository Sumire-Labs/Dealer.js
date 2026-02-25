import {type ButtonInteraction, MessageFlags} from 'discord.js';
import {registerButtonHandler} from '../handler.js';
import {handleTabAccount, handleTabFixed, handleTabHistory, handleTabLoan} from './bank/tab-handlers.js';
import {
    handleDeposit,
    handleQuickDepositAll,
    handleQuickDepositHalf,
    handleQuickWithdrawAll,
    handleTransfer,
    handleWithdraw
} from './bank/account-handlers.js';
import {
    handleBankrupt,
    handleBorrow,
    handleCancel,
    handleConfirmBankrupt,
    handleLoanNext,
    handleLoanPrev,
    handleRepay
} from './bank/loan-handlers.js';
import {handleHistoryNext, handleHistoryPrev} from './bank/history-handlers.js';
import {
    handleFixedCreate,
    handleFixedEarlyWithdraw,
    handleFixedWithdrawConfirm
} from './bank/fixed-deposit-handlers.js';

async function handleBankButton(interaction: ButtonInteraction): Promise<void> {
    const parts = interaction.customId.split(':');
    const action = parts[1];
    const ownerId = parts[2];

    if (interaction.user.id !== ownerId) {
        await interaction.reply({
            content: 'これはあなたのパネルではありません！ `/bank` で開いてください。',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const userId = interaction.user.id;

    switch (action) {
        // Tab switching
        case 'tab_account':
            return handleTabAccount(interaction, userId);
        case 'tab_loan':
            return handleTabLoan(interaction, userId);
        case 'tab_history':
            return handleTabHistory(interaction, userId);
        case 'tab_fixed':
            return handleTabFixed(interaction, userId);

        // Account actions (modal)
        case 'deposit':
            return handleDeposit(interaction);
        case 'withdraw':
            return handleWithdraw(interaction);
        case 'transfer':
            return handleTransfer(interaction, userId);

        // Quick actions
        case 'quick_deposit_all':
            return handleQuickDepositAll(interaction, userId);
        case 'quick_withdraw_all':
            return handleQuickWithdrawAll(interaction, userId);
        case 'quick_deposit_half':
            return handleQuickDepositHalf(interaction, userId);

        // Loan actions
        case 'borrow':
            return handleBorrow(interaction);
        case 'repay':
            return handleRepay(interaction, userId);
        case 'bankrupt':
            return handleBankrupt(interaction, userId);
        case 'confirm_bankrupt':
            return handleConfirmBankrupt(interaction, userId);
        case 'cancel':
            return handleCancel(interaction, userId);
        case 'loan_prev':
            return handleLoanPrev(interaction, userId);
        case 'loan_next':
            return handleLoanNext(interaction, userId);

        // History pagination
        case 'history_prev':
            return handleHistoryPrev(interaction, userId);
        case 'history_next':
            return handleHistoryNext(interaction, userId);

        // Fixed deposit actions
        case 'fixed_create_7':
        case 'fixed_create_30':
            return handleFixedCreate(interaction, action);
        case 'fixed_early_withdraw':
            return handleFixedEarlyWithdraw(interaction, userId);
        case 'fixed_withdraw_confirm':
            return handleFixedWithdrawConfirm(interaction, userId, parts[3]);

        // Ignore disabled info buttons
        case 'loan_page_info':
        case 'history_page_info':
            break;
    }
}

registerButtonHandler('bank', handleBankButton as never);
