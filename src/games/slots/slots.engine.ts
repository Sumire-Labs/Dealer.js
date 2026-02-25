import {weightedRandom} from '../../utils/random.js';
import {SLOT_SYMBOLS, type SlotSymbol} from './slots.symbols.js';
import {evaluatePaytable, type PaytableResult} from './slots.paytable.js';

export interface SlotsResult {
  reels: SlotSymbol[];
  paytable: PaytableResult;
}

const weightedItems = SLOT_SYMBOLS.map(s => ({ value: s, weight: s.weight }));

export function spinReel(): SlotSymbol {
  return weightedRandom(weightedItems);
}

export function spin(): SlotsResult {
  const reels = [spinReel(), spinReel(), spinReel()];
  const paytable = evaluatePaytable(reels);
  return { reels, paytable };
}

export function generateRandomReelDisplay(): SlotSymbol[] {
  return [spinReel(), spinReel(), spinReel()];
}
