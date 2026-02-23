import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { CasinoTheme } from '../themes/casino.theme.js';
import { formatChips, formatTimeDelta } from '../../utils/formatters.js';
import type { LoanSummary } from '../../database/services/loan.service.js';

export type BankTab = 'account' | 'loan';

export interface BankViewData {
  userId: string;
  walletBalance: bigint;
  bankBalance: bigint;
  loanSummary: LoanSummary;
  penaltyRemainingMs: number;
  lastInterestAt: Date | null;
  estimatedInterest: bigint;
  baseInterestRate: bigint;
}

export function buildBankMainView(data: BankViewData, tab: BankTab = 'account'): ContainerBuilder {
  const {
    userId,
    walletBalance,
    bankBalance,
    loanSummary,
    penaltyRemainingMs,
    lastInterestAt,
    estimatedInterest,
  } = data;

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.bank),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  if (tab === 'account') {
    // Balances
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `💰 ウォレット: ${formatChips(walletBalance)}\n` +
        `🏦 口座残高: ${formatChips(bankBalance)}`,
      ),
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    // Interest info
    let interestInfo = `📈 利息情報\n　日利: ${data.baseInterestRate}%\n`;
    if (estimatedInterest > 0n) {
      interestInfo += `　次回利息: ${formatChips(estimatedInterest)}（24時間ごと）`;
    } else {
      interestInfo += `　最低残高 $100 以上で利息が発生します`;
    }
    if (lastInterestAt) {
      const elapsed = Date.now() - lastInterestAt.getTime();
      const remaining = 24 * 60 * 60 * 1000 - elapsed;
      if (remaining > 0) {
        interestInfo += `\n　次回まで: ${formatTimeDelta(remaining)}`;
      } else {
        interestInfo += `\n　次回: まもなく付与`;
      }
    }

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(interestInfo),
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    // Action buttons
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`bank:deposit:${userId}`)
          .setLabel('💰 入金')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`bank:withdraw:${userId}`)
          .setLabel('💵 出金')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`bank:transfer:${userId}`)
          .setLabel('📤 送金')
          .setStyle(ButtonStyle.Secondary),
      ),
    );
  } else {
    // Loan tab — wallet balance
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`💰 ウォレット: ${formatChips(walletBalance)}`),
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    // Loan status section
    if (loanSummary.loanCount > 0) {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `📋 ローン状況\n` +
          `　借入件数: ${loanSummary.loanCount}件\n` +
          `　元金合計: ${formatChips(loanSummary.totalPrincipal)}\n` +
          `　利息合計: ${formatChips(loanSummary.totalInterest)}\n` +
          `　総返済額: ${formatChips(loanSummary.totalOwed)}\n` +
          `　追加借入可能額: ${formatChips(loanSummary.remainingCapacity)}`,
        ),
      );
    } else {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `📋 ローン状況\n` +
          `　借入なし\n` +
          `　借入可能額: ${formatChips(loanSummary.remainingCapacity)}`,
        ),
      );
    }

    // Penalty warning
    if (penaltyRemainingMs > 0) {
      container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
      );
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `⚠️ 破産ペナルティ中 — 報酬 -10%（残り ${formatTimeDelta(penaltyRemainingMs)}）`,
        ),
      );
    }

    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    // Loan action buttons
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`bank:borrow:${userId}`)
          .setLabel('💵 借入')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`bank:repay:${userId}`)
          .setLabel('💳 返済')
          .setStyle(ButtonStyle.Success)
          .setDisabled(loanSummary.loanCount === 0),
        new ButtonBuilder()
          .setCustomId(`bank:bankrupt:${userId}`)
          .setLabel('💀 破産')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(loanSummary.loanCount === 0),
      ),
    );
  }

  // Tab switching row
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`bank:tab_account:${userId}`)
        .setLabel('🏦 口座')
        .setStyle(tab === 'account' ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(tab === 'account'),
      new ButtonBuilder()
        .setCustomId(`bank:tab_loan:${userId}`)
        .setLabel('📋 ローン')
        .setStyle(tab === 'loan' ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(tab === 'loan'),
    ),
  );

  return container;
}

export function buildBankruptcyConfirmView(
  userId: string,
  totalOwed: bigint,
  currentBalance: bigint,
  currentBankBalance: bigint,
): ContainerBuilder {
  return new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.red)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('⚠️ 破産申告の確認'),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `・全ローン（${formatChips(totalOwed)}）を帳消し\n` +
        `・全チップ（${formatChips(currentBalance)}）を没収\n` +
        `・口座残高（${formatChips(currentBankBalance)}）を没収\n` +
        `・${formatChips(2_500n)} を支給\n` +
        `・1時間のギャンブル報酬 -10% ペナルティ`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`bank:confirm_bankrupt:${userId}`)
          .setLabel('✅ 実行')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`bank:cancel:${userId}`)
          .setLabel('❌ キャンセル')
          .setStyle(ButtonStyle.Secondary),
      ),
    );
}
