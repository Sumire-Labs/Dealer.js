import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  UserSelectMenuBuilder,
} from 'discord.js';
import { CasinoTheme } from '../themes/casino.theme.js';
import { formatChips, formatTimeDelta } from '../../utils/formatters.js';
import type { LoanSummary, IndividualLoanDetail } from '../../database/services/loan.service.js';
import type { FixedDepositInfo } from '../../database/services/fixed-deposit.service.js';
import type { TransactionType } from '@prisma/client';

// ── Types ────────────────────────────────────────────────────────────

export type BankTab = 'account' | 'loan' | 'history' | 'fixed_deposit' | 'transfer_select';

export interface BankTransaction {
  id: string;
  type: TransactionType;
  amount: bigint;
  balanceAfter: bigint;
  createdAt: Date;
  metadata: unknown;
}

export interface BankViewData {
  userId: string;
  walletBalance: bigint;
  bankBalance: bigint;
  loanSummary: LoanSummary;
  penaltyRemainingMs: number;
  lastInterestAt: Date | null;
  estimatedInterest: bigint;
  baseInterestRate: bigint;
  effectiveInterestRate: bigint;
  hasInterestBooster: boolean;
  recentTransactions?: BankTransaction[];
  transactionPage?: number;
  transactionTotalPages?: number;
  individualLoans?: IndividualLoanDetail[];
  loanPage?: number;
  fixedDeposits?: FixedDepositInfo[];
}

// ── Transaction display maps ─────────────────────────────────────────

const TRANSACTION_TYPE_EMOJI: Partial<Record<TransactionType, string>> = {
  BANK_DEPOSIT: '⬇️',
  BANK_WITHDRAW: '⬆️',
  BANK_TRANSFER_SEND: '📤',
  BANK_TRANSFER_RECV: '📥',
  BANK_INTEREST: '📈',
  LOAN_BORROW: '💵',
  LOAN_REPAY: '💳',
  BANKRUPTCY: '💀',
  FIXED_DEPOSIT_CREATE: '📌',
  FIXED_DEPOSIT_MATURE: '✅',
  FIXED_DEPOSIT_EARLY_WITHDRAW: '⚠️',
};

const TRANSACTION_TYPE_LABEL: Partial<Record<TransactionType, string>> = {
  BANK_DEPOSIT: '入金',
  BANK_WITHDRAW: '出金',
  BANK_TRANSFER_SEND: '送金',
  BANK_TRANSFER_RECV: '受取',
  BANK_INTEREST: '利息',
  LOAN_BORROW: '借入',
  LOAN_REPAY: '返済',
  BANKRUPTCY: '破産',
  FIXED_DEPOSIT_CREATE: '定期預入',
  FIXED_DEPOSIT_MATURE: '定期満期',
  FIXED_DEPOSIT_EARLY_WITHDRAW: '定期解約',
};

function formatTransactionDate(date: Date): string {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const h = date.getHours().toString().padStart(2, '0');
  const min = date.getMinutes().toString().padStart(2, '0');
  return `${m}/${d} ${h}:${min}`;
}

// ── Tab bar builder ──────────────────────────────────────────────────

function buildTabRow(userId: string, currentTab: BankTab): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`bank:tab_account:${userId}`)
      .setLabel('🏦 口座')
      .setStyle(currentTab === 'account' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(currentTab === 'account'),
    new ButtonBuilder()
      .setCustomId(`bank:tab_loan:${userId}`)
      .setLabel('📋 ローン')
      .setStyle(currentTab === 'loan' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(currentTab === 'loan'),
    new ButtonBuilder()
      .setCustomId(`bank:tab_history:${userId}`)
      .setLabel('📜 履歴')
      .setStyle(currentTab === 'history' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(currentTab === 'history'),
  );
}

// ── Main view builder ────────────────────────────────────────────────

export function buildBankMainView(data: BankViewData, tab: BankTab = 'account'): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.bank),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  switch (tab) {
    case 'account':
      buildAccountTab(container, data);
      break;
    case 'loan':
      buildLoanTab(container, data);
      break;
    case 'history':
      buildHistoryTab(container, data);
      break;
    case 'fixed_deposit':
      buildFixedDepositTab(container, data);
      break;
    case 'transfer_select':
      buildTransferSelectTab(container, data);
      break;
  }

  // Tab bar (not for transfer_select or fixed_deposit — they have own back buttons)
  if (tab !== 'transfer_select' && tab !== 'fixed_deposit') {
    container.addActionRowComponents(buildTabRow(data.userId, tab));
  }

  return container;
}

// ── Account tab ──────────────────────────────────────────────────────

function buildAccountTab(container: ContainerBuilder, data: BankViewData): void {
  const { userId, walletBalance, bankBalance, estimatedInterest } = data;

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
  const rateDisplay = data.baseInterestRate === data.effectiveInterestRate
    ? `${data.baseInterestRate}%`
    : `${data.effectiveInterestRate}% (基本${data.baseInterestRate}%+ボーナス)`;
  let interestInfo = `📈 利息情報\n　日利: ${rateDisplay}`;
  if (data.hasInterestBooster) {
    interestInfo += `\n　📈 利息ブースター適用中 (x2)`;
  }
  interestInfo += '\n';
  if (estimatedInterest > 0n) {
    interestInfo += `　次回利息: ${formatChips(estimatedInterest)}（24時間ごと）`;
  } else {
    interestInfo += `　最低残高 $100 以上で利息が発生します`;
  }
  if (data.lastInterestAt) {
    const elapsed = Date.now() - data.lastInterestAt.getTime();
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

  // Row 1: main actions
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

  // Row 2: quick actions + fixed deposit
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`bank:quick_deposit_all:${userId}`)
        .setLabel('⏬ 全額入金')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`bank:quick_withdraw_all:${userId}`)
        .setLabel('⏫ 全額出金')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`bank:quick_deposit_half:${userId}`)
        .setLabel('↕ 半額入金')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`bank:tab_fixed:${userId}`)
        .setLabel('📌 定期預金')
        .setStyle(ButtonStyle.Secondary),
    ),
  );
}

// ── Loan tab ─────────────────────────────────────────────────────────

function buildLoanTab(container: ContainerBuilder, data: BankViewData): void {
  const { userId, walletBalance, loanSummary, penaltyRemainingMs } = data;
  const loans = data.individualLoans ?? [];
  const page = data.loanPage ?? 1;
  const loansPerPage = 5;
  const totalPages = Math.max(1, Math.ceil(loans.length / loansPerPage));
  const startIdx = (page - 1) * loansPerPage;
  const pageLoans = loans.slice(startIdx, startIdx + loansPerPage);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`💰 ウォレット: ${formatChips(walletBalance)}`),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  if (loans.length > 0) {
    let loanText = `📋 ローン詳細 (${loans.length}件)\n`;
    pageLoans.forEach((loan, i) => {
      const num = startIdx + i + 1;
      const elapsed = formatTimeDelta(loan.elapsedMs);
      loanText += `\n**#${num}**　元金: ${formatChips(loan.principal)}　利息: ${formatChips(loan.interest)}　経過: ${elapsed}`;
    });
    loanText += `\n\n　合計返済額: ${formatChips(loanSummary.totalOwed)}`;
    loanText += `\n　追加借入可能額: ${formatChips(loanSummary.remainingCapacity)}`;

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(loanText),
    );
  } else {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `📋 ローン状況\n　借入なし\n　借入可能額: ${formatChips(loanSummary.remainingCapacity)}`,
      ),
    );
  }

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

  // Pagination row (only if more than 1 page)
  if (totalPages > 1) {
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`bank:loan_prev:${userId}`)
          .setLabel('◀')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page <= 1),
        new ButtonBuilder()
          .setCustomId(`bank:loan_page_info:${userId}`)
          .setLabel(`${page}/${totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`bank:loan_next:${userId}`)
          .setLabel('▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= totalPages),
      ),
    );
  }

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

// ── History tab ──────────────────────────────────────────────────────

function buildHistoryTab(container: ContainerBuilder, data: BankViewData): void {
  const { userId } = data;
  const transactions = data.recentTransactions ?? [];
  const page = data.transactionPage ?? 1;
  const totalPages = data.transactionTotalPages ?? 1;

  if (transactions.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('📜 取引履歴\n\n　取引履歴がありません。'),
    );
  } else {
    let historyText = '📜 取引履歴\n';
    for (const tx of transactions) {
      const emoji = TRANSACTION_TYPE_EMOJI[tx.type] ?? '❓';
      const label = TRANSACTION_TYPE_LABEL[tx.type] ?? tx.type;
      const date = formatTransactionDate(tx.createdAt);
      const amountStr = tx.amount >= 0n ? `+${formatChips(tx.amount)}` : formatChips(tx.amount);
      historyText += `\n${date}　${emoji} ${label}　${amountStr}`;
    }

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(historyText),
    );
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Pagination
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`bank:history_prev:${userId}`)
        .setLabel('◀')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 1),
      new ButtonBuilder()
        .setCustomId(`bank:history_page_info:${userId}`)
        .setLabel(`${page}/${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`bank:history_next:${userId}`)
        .setLabel('▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages),
    ),
  );
}

// ── Fixed deposit tab ────────────────────────────────────────────────

function buildFixedDepositTab(container: ContainerBuilder, data: BankViewData): void {
  const { userId, bankBalance } = data;
  const deposits = data.fixedDeposits ?? [];

  // Plan description
  let info = `📌 定期預金\n\n`;
  info += `口座残高から預入し、満期時に倍率分を受取ります。\n`;
  info += `早期解約の場合、元金のみ返却されます。\n\n`;
  info += `📋 プラン一覧\n`;

  // Import getTermOptions dynamically would be circular, so inline
  // We show static info here; actual multipliers are from config
  info += `　7日プラン: 元金 × 倍率\n`;
  info += `　30日プラン: 元金 × 倍率\n\n`;
  info += `🏦 口座残高: ${formatChips(bankBalance)}`;

  if (deposits.length > 0) {
    info += `\n\n📌 アクティブ預金 (${deposits.length}件)`;
    deposits.forEach((d, i) => {
      const remaining = d.remainingMs > 0 ? formatTimeDelta(d.remainingMs) : '満期！';
      info += `\n**#${i + 1}**　${formatChips(d.amount)} × ${d.interestRate} (${d.termDays}日)　残り: ${remaining}`;
    });
  } else {
    info += `\n\n　アクティブな定期預金はありません。`;
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(info),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Actions
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`bank:fixed_create_7:${userId}`)
        .setLabel('📌 7日プラン')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`bank:fixed_create_30:${userId}`)
        .setLabel('📌 30日プラン')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`bank:fixed_early_withdraw:${userId}`)
        .setLabel('⚠️ 早期解約')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(deposits.length === 0),
      new ButtonBuilder()
        .setCustomId(`bank:tab_account:${userId}`)
        .setLabel('🔙 戻る')
        .setStyle(ButtonStyle.Secondary),
    ),
  );
}

// ── Transfer select tab ──────────────────────────────────────────────

function buildTransferSelectTab(container: ContainerBuilder, data: BankViewData): void {
  const { userId } = data;

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `📤 送金先を選択\n\n` +
      `下のメニューから送金先のメンバーを選んでください。\n` +
      `選択後、金額入力のモーダルが表示されます。`,
    ),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // UserSelectMenu
  container.addActionRowComponents(
    new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId(`bank_select:transfer_user:${userId}`)
        .setPlaceholder('送金先メンバーを選択...')
        .setMinValues(1)
        .setMaxValues(1),
    ),
  );

  // Back button
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`bank:tab_account:${userId}`)
        .setLabel('🔙 口座に戻る')
        .setStyle(ButtonStyle.Secondary),
    ),
  );
}

// ── Bankruptcy confirm view ──────────────────────────────────────────

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

// ── Fixed deposit early withdraw confirm ─────────────────────────────

export function buildFixedDepositWithdrawView(
  userId: string,
  deposits: FixedDepositInfo[],
): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.red)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('⚠️ 早期解約 — 元金のみ返却されます'),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  let text = '';
  deposits.forEach((d, i) => {
    const remaining = d.remainingMs > 0 ? formatTimeDelta(d.remainingMs) : '満期！';
    text += `**#${i + 1}**　${formatChips(d.amount)} (${d.termDays}日)　残り: ${remaining}\n`;
  });

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(text),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Buttons for each deposit (max 5 per row)
  const buttons = deposits.slice(0, 5).map((d, i) =>
    new ButtonBuilder()
      .setCustomId(`bank:fixed_withdraw_confirm:${userId}:${d.id}`)
      .setLabel(`#${i + 1} 解約`)
      .setStyle(ButtonStyle.Danger),
  );

  buttons.push(
    new ButtonBuilder()
      .setCustomId(`bank:tab_fixed:${userId}`)
      .setLabel('🔙 戻る')
      .setStyle(ButtonStyle.Secondary),
  );

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons),
  );

  return container;
}
