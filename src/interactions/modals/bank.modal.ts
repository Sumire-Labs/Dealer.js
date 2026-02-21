import {
  type ModalSubmitInteraction,
  MessageFlags,
} from 'discord.js';
import { registerModalHandler } from '../handler.js';
import {
  LOAN_MIN_AMOUNT,
  LOAN_MAX_AMOUNT,
} from '../../config/constants.js';
import { findOrCreateUser } from '../../database/repositories/user.repository.js';
import {
  borrowChips,
  repayChips,
  getLoanSummary,
  getBankruptcyPenaltyRemaining,
} from '../../database/services/loan.service.js';
import { buildBankMainView } from '../../ui/builders/bank.builder.js';
import { formatChips } from '../../utils/formatters.js';

async function handleBankModal(interaction: ModalSubmitInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const action = parts[1];

  const userId = interaction.user.id;
  const amountStr = interaction.fields.getTextInputValue('amount').trim();
  const parsed = parseInt(amountStr);

  if (isNaN(parsed) || parsed <= 0) {
    await interaction.reply({
      content: '有効な数値を入力してください。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const amount = BigInt(parsed);

  switch (action) {
    case 'borrow': {
      if (amount < LOAN_MIN_AMOUNT || amount > LOAN_MAX_AMOUNT) {
        await interaction.reply({
          content: `借入額は${formatChips(LOAN_MIN_AMOUNT)}〜${formatChips(LOAN_MAX_AMOUNT)}の範囲で指定してください。`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      try {
        const newBalance = await borrowChips(userId, amount);
        const summary = await getLoanSummary(userId);
        const user = await findOrCreateUser(userId);
        const penaltyRemaining = getBankruptcyPenaltyRemaining(user.bankruptAt);
        const view = buildBankMainView(userId, newBalance, summary, penaltyRemaining);

        await interaction.reply({
          components: [view],
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === 'LOAN_LIMIT_EXCEEDED') {
          const summary = await getLoanSummary(userId);
          await interaction.reply({
            content: `借入上限を超えています！ 追加借入可能額: ${formatChips(summary.remainingCapacity)}`,
            flags: MessageFlags.Ephemeral,
          });
        } else {
          throw error;
        }
      }
      break;
    }

    case 'repay': {
      if (amount <= 0n) {
        await interaction.reply({
          content: '1以上の金額を入力してください。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      try {
        const { newBalance } = await repayChips(userId, amount);
        const summary = await getLoanSummary(userId);
        const user = await findOrCreateUser(userId);
        const penaltyRemaining = getBankruptcyPenaltyRemaining(user.bankruptAt);
        const view = buildBankMainView(userId, newBalance, summary, penaltyRemaining);

        await interaction.reply({
          components: [view],
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === 'INSUFFICIENT_CHIPS') {
          const user = await findOrCreateUser(userId);
          await interaction.reply({
            content: `チップが不足しています！ 残高: ${formatChips(user.chips)}`,
            flags: MessageFlags.Ephemeral,
          });
        } else if (message === 'NO_LOANS') {
          await interaction.reply({
            content: '返済すべきローンがありません。',
            flags: MessageFlags.Ephemeral,
          });
        } else {
          throw error;
        }
      }
      break;
    }
  }
}

registerModalHandler('bank_modal', handleBankModal as never);
