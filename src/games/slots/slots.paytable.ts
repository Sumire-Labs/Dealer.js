import { SLOTS_CONFIG } from '../../config/games.js';
import type { SlotSymbol } from './slots.symbols.js';

export interface PaytableResult {
  multiplier: number;
  label: string;
}

export function evaluatePaytable(reels: SlotSymbol[]): PaytableResult {
  const specialCount = reels.filter(s => s.rank === 'special').length;

  // 3x special = jackpot
  if (specialCount === 3) {
    return { multiplier: SLOTS_CONFIG.payouts.jackpot, label: '💥 JACKPOT!! 💥' };
  }

  // 2x special
  if (specialCount === 2) {
    return { multiplier: SLOTS_CONFIG.payouts.specialTwo, label: '💎 Double Diamond!' };
  }

  // 1x special
  if (specialCount === 1) {
    return { multiplier: SLOTS_CONFIG.payouts.specialOne, label: '💎 Diamond!' };
  }

  // All three match (no specials)
  if (reels[0].id === reels[1].id && reels[1].id === reels[2].id) {
    const rank = reels[0].rank;
    switch (rank) {
      case 'high':
        return { multiplier: SLOTS_CONFIG.payouts.threeHighRank, label: `${reels[0].emoji} Triple High!` };
      case 'medium':
        return { multiplier: SLOTS_CONFIG.payouts.threeMediumRank, label: `${reels[0].emoji} Triple!` };
      case 'low':
        return { multiplier: SLOTS_CONFIG.payouts.threeLowRank, label: `${reels[0].emoji} Triple!` };
      default:
        return { multiplier: SLOTS_CONFIG.payouts.threeLowRank, label: `${reels[0].emoji} Triple!` };
    }
  }

  // Two match
  if (reels[0].id === reels[1].id || reels[1].id === reels[2].id || reels[0].id === reels[2].id) {
    return { multiplier: SLOTS_CONFIG.payouts.twoMatch, label: 'Pair!' };
  }

  // No match
  return { multiplier: SLOTS_CONFIG.payouts.loss, label: 'No luck...' };
}
