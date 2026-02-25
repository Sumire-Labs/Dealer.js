import type {IndividualLoanDetail, LoanSummary} from '../../../database/services/loan.service.js';
import type {FixedDepositInfo} from '../../../database/services/fixed-deposit.service.js';
import type {TransactionType} from '@prisma/client';

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

export const TRANSACTION_TYPE_EMOJI: Partial<Record<TransactionType, string>> = {
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

export const TRANSACTION_TYPE_LABEL: Partial<Record<TransactionType, string>> = {
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

export function formatTransactionDate(date: Date): string {
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const h = date.getHours().toString().padStart(2, '0');
    const min = date.getMinutes().toString().padStart(2, '0');
    return `${m}/${d} ${h}:${min}`;
}
