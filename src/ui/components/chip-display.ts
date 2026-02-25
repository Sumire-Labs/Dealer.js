import {formatChips} from '../../utils/formatters.js';

export function chipDisplay(amount: bigint): string {
  return formatChips(amount);
}

export function betAndBalanceDisplay(bet: bigint, balance: bigint): string {
  return `BET: ${formatChips(bet)} | 残高: ${formatChips(balance)}`;
}

export function winDisplay(bet: bigint, payout: bigint): string {
  return `BET: ${formatChips(bet)} → 獲得: ${formatChips(payout)}!`;
}

export function lossDisplay(bet: bigint): string {
  return `BET: ${formatChips(bet)} → ハズレ`;
}
