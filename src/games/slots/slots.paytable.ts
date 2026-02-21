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
    return { multiplier: SLOTS_CONFIG.payouts.specialTwo, label: '💎 ダブルダイヤモンド！' };
  }

  // 1x special
  if (specialCount === 1) {
    return { multiplier: SLOTS_CONFIG.payouts.specialOne, label: '💎 ダイヤモンド！' };
  }

  // All three match (no specials)
  if (reels[0].id === reels[1].id && reels[1].id === reels[2].id) {
    const rank = reels[0].rank;
    switch (rank) {
      case 'high':
        return { multiplier: SLOTS_CONFIG.payouts.threeHighRank, label: `${reels[0].emoji} トリプル・ハイ！` };
      case 'medium':
        return { multiplier: SLOTS_CONFIG.payouts.threeMediumRank, label: `${reels[0].emoji} トリプル！` };
      case 'low':
        return { multiplier: SLOTS_CONFIG.payouts.threeLowRank, label: `${reels[0].emoji} トリプル！` };
      default:
        return { multiplier: SLOTS_CONFIG.payouts.threeLowRank, label: `${reels[0].emoji} トリプル！` };
    }
  }

  // Two match
  if (reels[0].id === reels[1].id || reels[1].id === reels[2].id || reels[0].id === reels[2].id) {
    return { multiplier: SLOTS_CONFIG.payouts.twoMatch, label: 'ペア！' };
  }

  // No match
  return { multiplier: SLOTS_CONFIG.payouts.loss, label: 'ハズレ...' };
}
