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
} from '../../database/services/loan.service.js';
import {
  depositChips,
  withdrawChips,
} from '../../database/services/bank-account.service.js';
import { buildBankViewData } from '../../database/services/bank-view.service.js';
import {
  buildBankMainView,
  buildBankruptcyConfirmView,
  buildFixedDepositWithdrawView,
} from '../../ui/builders/bank.builder.js';
import { getFixedDepositsForDisplay, earlyWithdrawFixedDeposit } from '../../database/services/fixed-deposit.service.js';
import { formatChips } from '../../utils/formatters.js';
import { configService } from '../../config/config.service.js';
import { S } from '../../config/setting-defs.js';

// ── Page tracking ────────────────────────────────────────────────────

const bankHistoryPage = new Map<string, number>();
const bankLoanPage = new Map<string, number>();

function setPageGuarded(map: Map<string, number>, key: string, value: number): void {
  if (map.size > 10_000) map.clear();
  map.set(key, value);
}

// ── Handler ──────────────────────────────────────────────────────────

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
    // ── Tab switching ──────────────────────────────────────────────────
    case 'tab_account': {
      const data = await buildBankViewData(userId);
      const view = buildBankMainView(data, 'account');
      await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }

    case 'tab_loan': {
      const page = bankLoanPage.get(userId) ?? 1;
      const data = await buildBankViewData(userId);
      data.loanPage = page;
      const view = buildBankMainView(data, 'loan');
      await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }

    case 'tab_history': {
      const page = bankHistoryPage.get(userId) ?? 1;
      const data = await buildBankViewData(userId, { historyPage: page });
      const view = buildBankMainView(data, 'history');
      await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }

    case 'tab_fixed': {
      const data = await buildBankViewData(userId);
      const view = buildBankMainView(data, 'fixed_deposit');
      await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }

    // ── Account actions (modal) ────────────────────────────────────────
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
      // Show user select menu tab instead of modal
      const data = await buildBankViewData(userId);
      const view = buildBankMainView(data, 'transfer_select');
      await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }

    // ── Quick actions ──────────────────────────────────────────────────
    case 'quick_deposit_all': {
      const user = await findOrCreateUser(userId);
      if (user.chips <= 0n) {
        await interaction.reply({
          content: 'ウォレットにチップがありません。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      try {
        await depositChips(userId, user.chips);
      } catch (error) {
        await interaction.reply({
          content: `入金に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const data = await buildBankViewData(userId);
      const view = buildBankMainView(data, 'account');
      await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }

    case 'quick_withdraw_all': {
      const user = await findOrCreateUser(userId);
      if (user.bankBalance <= 0n) {
        await interaction.reply({
          content: '口座にチップがありません。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      try {
        await withdrawChips(userId, user.bankBalance);
      } catch (error) {
        await interaction.reply({
          content: `出金に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const data = await buildBankViewData(userId);
      const view = buildBankMainView(data, 'account');
      await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }

    case 'quick_deposit_half': {
      const user = await findOrCreateUser(userId);
      const half = user.chips / 2n;
      if (half <= 0n) {
        await interaction.reply({
          content: 'ウォレットにチップが不足しています。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      try {
        await depositChips(userId, half);
      } catch (error) {
        await interaction.reply({
          content: `入金に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const data = await buildBankViewData(userId);
      const view = buildBankMainView(data, 'account');
      await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }

    // ── Loan actions ───────────────────────────────────────────────────
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
        const data = await buildBankViewData(userId);
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
      const data = await buildBankViewData(userId);
      const view = buildBankMainView(data, 'loan');

      await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }

    // ── Loan pagination ────────────────────────────────────────────────
    case 'loan_prev': {
      const current = bankLoanPage.get(userId) ?? 1;
      const newPage = Math.max(1, current - 1);
      setPageGuarded(bankLoanPage, userId, newPage);
      const data = await buildBankViewData(userId);
      data.loanPage = newPage;
      const view = buildBankMainView(data, 'loan');
      await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }

    case 'loan_next': {
      const current = bankLoanPage.get(userId) ?? 1;
      const newPage = current + 1;
      setPageGuarded(bankLoanPage, userId, newPage);
      const data = await buildBankViewData(userId);
      data.loanPage = newPage;
      const view = buildBankMainView(data, 'loan');
      await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }

    // ── History pagination ─────────────────────────────────────────────
    case 'history_prev': {
      const current = bankHistoryPage.get(userId) ?? 1;
      const newPage = Math.max(1, current - 1);
      setPageGuarded(bankHistoryPage, userId, newPage);
      const data = await buildBankViewData(userId, { historyPage: newPage });
      const view = buildBankMainView(data, 'history');
      await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }

    case 'history_next': {
      const current = bankHistoryPage.get(userId) ?? 1;
      const newPage = current + 1;
      setPageGuarded(bankHistoryPage, userId, newPage);
      const data = await buildBankViewData(userId, { historyPage: newPage });
      const view = buildBankMainView(data, 'history');
      await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }

    // ── Fixed deposit actions ──────────────────────────────────────────
    case 'fixed_create_7':
    case 'fixed_create_30': {
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
              .setPlaceholder('例: 50000')
              .setRequired(true),
          ),
        );
      await interaction.showModal(modal);
      break;
    }

    case 'fixed_early_withdraw': {
      const deposits = await getFixedDepositsForDisplay(userId);
      if (deposits.length === 0) {
        await interaction.reply({
          content: 'アクティブな定期預金がありません。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const view = buildFixedDepositWithdrawView(userId, deposits);
      await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }

    case 'fixed_withdraw_confirm': {
      const depositId = parts[3];
      try {
        const result = await earlyWithdrawFixedDeposit(userId, depositId);
        await interaction.reply({
          content: `早期解約完了。元金 ${formatChips(result.returnedAmount)} を口座に返却しました。`,
          flags: MessageFlags.Ephemeral,
        });
        // Update the view behind
        const data = await buildBankViewData(userId);
        const view = buildBankMainView(data, 'fixed_deposit');
        await interaction.message.edit({
          components: [view],
          flags: MessageFlags.IsComponentsV2,
        });
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
      break;
    }

    // Ignore disabled info buttons
    case 'loan_page_info':
    case 'history_page_info':
      break;
  }
}

registerButtonHandler('bank', handleBankButton as never);
