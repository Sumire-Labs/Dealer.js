// ── Barrel re-exports ──

export type {BankTab, BankTransaction, BankViewData} from './bank/types.js';
export {buildBankMainView} from './bank/main.builder.js';
export {buildBankruptcyConfirmView} from './bank/loan-tab.builder.js';
export {buildFixedDepositWithdrawView} from './bank/fixed-deposit-tab.builder.js';
