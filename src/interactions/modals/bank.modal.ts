import {
  type ModalSubmitInteraction,
  MessageFlags,
} from 'discord.js';
import { registerModalHandler } from '../handler.js';
import { S } from '../../config/setting-defs.js';
import { findOrCreateUser } from '../../database/repositories/user.repository.js';
import {
  borrowChips,
  repayChips,
  getLoanSummary,
  getBankruptcyPenaltyRemaining,
} from '../../database/services/loan.service.js';
import {
  depositChips,
  withdrawChips,
  transferChips,
  getBankAccountSummary,
} from '../../database/services/bank-account.service.js';
import { buildBankMainView, type BankViewData } from '../../ui/builders/bank.builder.js';
import { formatChips } from '../../utils/formatters.js';
import { configService } from '../../config/config.service.js';

async function buildViewData(userId: string): Promise<BankViewData> {
  const user = await findOrCreateUser(userId);
  const loanSummary = await getLoanSummary(userId);
  const accountSummary = await getBankAccountSummary(userId);
  const penaltyRemainingMs = getBankruptcyPenaltyRemaining(user.bankruptAt);

  return {
    userId,
    walletBalance: user.chips,
    bankBalance: accountSummary.bankBalance,
    loanSummary,
    penaltyRemainingMs,
    lastInterestAt: accountSummary.lastInterestAt,
    estimatedInterest: accountSummary.estimatedInterest,
    baseInterestRate: configService.getBigInt(S.bankInterestRate),
  };
}

function parseRecipientId(input: string): string {
  // Strip <@!123> or <@123> mention format
  const mentionMatch = input.match(/^<@!?(\d{17,20})>$/);
  if (mentionMatch) return mentionMatch[1];

  // Plain ID
  const idMatch = input.match(/^(\d{17,20})$/);
  if (idMatch) return idMatch[1];

  throw new Error('INVALID_RECIPIENT');
}

async function handleBankModal(interaction: ModalSubmitInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const action = parts[1];
  const userId = interaction.user.id;

  switch (action) {
    case 'deposit': {
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

      try {
        await depositChips(userId, amount);
        const data = await buildViewData(userId);
        const view = buildBankMainView(data, 'account');

        await interaction.reply({
          components: [view],
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === 'INSUFFICIENT_CHIPS') {
          const user = await findOrCreateUser(userId);
          await interaction.reply({
            content: `ウォレット残高が不足しています！ 残高: ${formatChips(user.chips)}`,
            flags: MessageFlags.Ephemeral,
          });
        } else {
          throw error;
        }
      }
      break;
    }

    case 'withdraw': {
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

      try {
        await withdrawChips(userId, amount);
        const data = await buildViewData(userId);
        const view = buildBankMainView(data, 'account');

        await interaction.reply({
          components: [view],
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === 'INSUFFICIENT_BANK_BALANCE') {
          const accountSummary = await getBankAccountSummary(userId);
          await interaction.reply({
            content: `口座残高が不足しています！ 口座残高: ${formatChips(accountSummary.bankBalance)}`,
            flags: MessageFlags.Ephemeral,
          });
        } else {
          throw error;
        }
      }
      break;
    }

    case 'transfer': {
      const recipientInput = interaction.fields.getTextInputValue('recipient').trim();
      const amountStr = interaction.fields.getTextInputValue('amount').trim();
      const parsed = parseInt(amountStr);

      if (isNaN(parsed) || parsed <= 0) {
        await interaction.reply({
          content: '有効な数値を入力してください。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      let recipientId: string;
      try {
        recipientId = parseRecipientId(recipientInput);
      } catch {
        await interaction.reply({
          content: '有効なユーザーIDを入力してください。（例: 123456789012345678）',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const amount = BigInt(parsed);

      try {
        const result = await transferChips(userId, recipientId, amount);
        await interaction.reply({
          content:
            `送金完了！\n` +
            `📤 送金額: ${formatChips(amount)}\n` +
            `👤 送金先: <@${recipientId}>\n` +
            `🏦 あなたの口座残高: ${formatChips(result.senderBankBalance)}`,
          flags: MessageFlags.Ephemeral,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === 'INSUFFICIENT_BANK_BALANCE') {
          const accountSummary = await getBankAccountSummary(userId);
          await interaction.reply({
            content: `口座残高が不足しています！ 口座残高: ${formatChips(accountSummary.bankBalance)}`,
            flags: MessageFlags.Ephemeral,
          });
        } else if (message === 'RECIPIENT_NOT_FOUND') {
          await interaction.reply({
            content: 'そのユーザーは登録されていません。',
            flags: MessageFlags.Ephemeral,
          });
        } else if (message === 'SELF_TRANSFER') {
          await interaction.reply({
            content: '自分自身には送金できません。',
            flags: MessageFlags.Ephemeral,
          });
        } else {
          throw error;
        }
      }
      break;
    }

    case 'borrow': {
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

      if (amount < configService.getBigInt(S.loanMinAmount) || amount > configService.getBigInt(S.loanMaxAmount)) {
        await interaction.reply({
          content: `借入額は${formatChips(configService.getBigInt(S.loanMinAmount))}〜${formatChips(configService.getBigInt(S.loanMaxAmount))}の範囲で指定してください。`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      try {
        await borrowChips(userId, amount);
        const data = await buildViewData(userId);
        const view = buildBankMainView(data, 'loan');

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

      try {
        await repayChips(userId, amount);
        const data = await buildViewData(userId);
        const view = buildBankMainView(data, 'loan');

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
