import {
  type ButtonInteraction,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js';
import { registerButtonHandler } from '../handler.js';
import { findOrCreateUser } from '../../database/repositories/user.repository.js';
import {
  getLoanSummary,
  declareBankruptcy,
  getBankruptcyPenaltyRemaining,
} from '../../database/services/loan.service.js';
import { buildBankMainView, buildBankruptcyConfirmView } from '../../ui/builders/bank.builder.js';
import { formatChips } from '../../utils/formatters.js';
import { LOAN_MIN_AMOUNT, LOAN_MAX_AMOUNT } from '../../config/constants.js';

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
    case 'borrow': {
      const modal = new ModalBuilder()
        .setCustomId(`bank_modal:borrow`)
        .setTitle('借入')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('amount')
              .setLabel(`金額（${Number(LOAN_MIN_AMOUNT).toLocaleString()}〜${Number(LOAN_MAX_AMOUNT).toLocaleString()}）`)
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('例: 10000')
              .setRequired(true),
          ),
        );
      await interaction.showModal(modal);
      break;
    }

    case 'repay': {
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
              .setPlaceholder('例: 5000')
              .setRequired(true),
          ),
        );
      await interaction.showModal(modal);
      break;
    }

    case 'bankrupt': {
      const user = await findOrCreateUser(userId);
      const summary = await getLoanSummary(userId);

      if (summary.loanCount === 0) {
        await interaction.reply({
          content: '借金がないため、破産できません。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const confirmView = buildBankruptcyConfirmView(userId, summary.totalOwed, user.chips);
      await interaction.update({
        components: [confirmView],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }

    case 'confirm_bankrupt': {
      try {
        const newBalance = await declareBankruptcy(userId);
        const summary = await getLoanSummary(userId);
        const user = await findOrCreateUser(userId);
        const penaltyRemaining = getBankruptcyPenaltyRemaining(user.bankruptAt);
        const view = buildBankMainView(userId, newBalance, summary, penaltyRemaining);

        await interaction.update({
          components: [view],
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === 'NO_LOANS') {
          await interaction.reply({
            content: '借金がないため、破産できません。',
            flags: MessageFlags.Ephemeral,
          });
        } else {
          throw error;
        }
      }
      break;
    }

    case 'cancel': {
      const user = await findOrCreateUser(userId);
      const summary = await getLoanSummary(userId);
      const penaltyRemaining = getBankruptcyPenaltyRemaining(user.bankruptAt);
      const view = buildBankMainView(userId, user.chips, summary, penaltyRemaining);

      await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }
  }
}

registerButtonHandler('bank', handleBankButton as never);
