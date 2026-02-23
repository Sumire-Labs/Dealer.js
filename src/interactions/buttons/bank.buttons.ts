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
import { getBankAccountSummary } from '../../database/services/bank-account.service.js';
import {
  buildBankMainView,
  buildBankruptcyConfirmView,
  type BankViewData,
} from '../../ui/builders/bank.builder.js';
import { formatChips } from '../../utils/formatters.js';
import { configService } from '../../config/config.service.js';
import { S } from '../../config/setting-defs.js';

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
    case 'tab_account': {
      const data = await buildViewData(userId);
      const view = buildBankMainView(data, 'account');
      await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }

    case 'tab_loan': {
      const data = await buildViewData(userId);
      const view = buildBankMainView(data, 'loan');
      await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }

    case 'deposit': {
      const modal = new ModalBuilder()
        .setCustomId(`bank_modal:deposit`)
        .setTitle('入金')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('amount')
              .setLabel('入金額（ウォレットから口座へ）')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('例: 10000')
              .setRequired(true),
          ),
        );
      await interaction.showModal(modal);
      break;
    }

    case 'withdraw': {
      const modal = new ModalBuilder()
        .setCustomId(`bank_modal:withdraw`)
        .setTitle('出金')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('amount')
              .setLabel('出金額（口座からウォレットへ）')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('例: 10000')
              .setRequired(true),
          ),
        );
      await interaction.showModal(modal);
      break;
    }

    case 'transfer': {
      const modal = new ModalBuilder()
        .setCustomId(`bank_modal:transfer`)
        .setTitle('送金')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('recipient')
              .setLabel('送金先ユーザーID')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('例: 123456789012345678')
              .setRequired(true),
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('amount')
              .setLabel('送金額')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('例: 10000')
              .setRequired(true),
          ),
        );
      await interaction.showModal(modal);
      break;
    }

    case 'borrow': {
      const modal = new ModalBuilder()
        .setCustomId(`bank_modal:borrow`)
        .setTitle('借入')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('amount')
              .setLabel(`金額（${Number(configService.getBigInt(S.loanMinAmount)).toLocaleString()}〜${Number(configService.getBigInt(S.loanMaxAmount)).toLocaleString()}）`)
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

      const confirmView = buildBankruptcyConfirmView(userId, summary.totalOwed, user.chips, user.bankBalance);
      await interaction.update({
        components: [confirmView],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }

    case 'confirm_bankrupt': {
      try {
        await declareBankruptcy(userId);
        const data = await buildViewData(userId);
        const view = buildBankMainView(data, 'loan');

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
      const data = await buildViewData(userId);
      const view = buildBankMainView(data, 'loan');

      await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }
  }
}

registerButtonHandler('bank', handleBankButton as never);
