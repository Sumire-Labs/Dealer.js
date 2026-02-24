import { DAILY_ELIGIBLE_ITEMS } from '../../../config/shop.js';
import { getSetting, upsertSetting } from '../../repositories/setting.repository.js';
import { shuffleArray } from '../../../utils/random.js';

export interface FlashSale {
  itemId: string;
  originalPrice: bigint;
  salePrice: bigint;
  expiresAt: number; // unix ms
}

export async function getFlashSale(): Promise<FlashSale | null> {
  const stored = await getSetting('flash_sale') as {
    itemId: string;
    originalPrice: string;
    salePrice: string;
    expiresAt: number;
  } | null;

  if (!stored) return null;
  if (Date.now() > stored.expiresAt) return null;

  return {
    itemId: stored.itemId,
    originalPrice: BigInt(stored.originalPrice),
    salePrice: BigInt(stored.salePrice),
    expiresAt: stored.expiresAt,
  };
}

export async function generateFlashSale(): Promise<FlashSale | null> {
  const eligible = DAILY_ELIGIBLE_ITEMS.filter(i => i.price > 0n);
  if (eligible.length === 0) return null;

  const shuffled = shuffleArray(eligible);
  const pick = shuffled[0];
  const salePrice = pick.price - (pick.price * 40n) / 100n; // 40% off
  const expiresAt = Date.now() + 2 * 60 * 60 * 1000; // 2 hours

  const sale: FlashSale = {
    itemId: pick.id,
    originalPrice: pick.price,
    salePrice,
    expiresAt,
  };

  await upsertSetting('flash_sale', {
    itemId: sale.itemId,
    originalPrice: sale.originalPrice.toString(),
    salePrice: sale.salePrice.toString(),
    expiresAt: sale.expiresAt,
  });

  return sale;
}

export async function checkAndRefreshFlashSale(): Promise<boolean> {
  const current = await getFlashSale();
  if (!current) {
    await generateFlashSale();
    return true;
  }
  return false;
}
