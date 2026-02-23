import { findOrCreateUser } from '../repositories/user.repository.js';
import {
  getLoanSummary,
  getLoanDetails,
  getBankruptcyPenaltyRemaining,
} from './loan.service.js';
import { getBankAccountSummary, getBankTransactionHistory } from './bank-account.service.js';
import { getFixedDepositsForDisplay } from './fixed-deposit.service.js';
import { configService } from '../../config/config.service.js';
import { S } from '../../config/setting-defs.js';
import type { BankViewData } from '../../ui/builders/bank.builder.js';

export async function buildBankViewData(
  userId: string,
  options?: { historyPage?: number; loanPage?: number },
): Promise<BankViewData> {
  // Resolve user first to avoid race condition (duplicate upsert with getBankAccountSummary)
  const user = await findOrCreateUser(userId);

  const [loanSummary, accountSummary, individualLoans, fixedDeposits] = await Promise.all([
    getLoanSummary(userId),
    getBankAccountSummary(userId, user),
    getLoanDetails(userId),
    getFixedDepositsForDisplay(userId),
  ]);

  const penaltyRemainingMs = getBankruptcyPenaltyRemaining(user.bankruptAt);

  const result: BankViewData = {
    userId,
    walletBalance: user.chips,
    bankBalance: accountSummary.bankBalance,
    loanSummary,
    penaltyRemainingMs,
    lastInterestAt: accountSummary.lastInterestAt,
    estimatedInterest: accountSummary.estimatedInterest,
    baseInterestRate: configService.getBigInt(S.bankInterestRate),
    effectiveInterestRate: accountSummary.effectiveInterestRate,
    hasInterestBooster: accountSummary.hasInterestBooster,
    individualLoans,
    fixedDeposits,
  };

  if (options?.historyPage) {
    const history = await getBankTransactionHistory(userId, options.historyPage);
    result.recentTransactions = history.transactions;
    result.transactionPage = history.page;
    result.transactionTotalPages = history.totalPages;
  }

  return result;
}
