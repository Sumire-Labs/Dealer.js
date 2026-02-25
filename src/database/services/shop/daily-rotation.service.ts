import {DAILY_DISCOUNT_RATE, DAILY_ELIGIBLE_ITEMS, DAILY_ROTATION_COUNT,} from '../../../config/shop.js';
import {getSetting, upsertSetting} from '../../repositories/setting.repository.js';
import {shuffleArray} from '../../../utils/random.js';

export interface DailyRotation {
  date: string;
  items: { itemId: string; originalPrice: bigint; discountedPrice: bigint }[];
}

export async function getDailyRotation(): Promise<DailyRotation> {
  const today = new Date().toISOString().slice(0, 10);

  // Check if already generated for today
  const stored = await getSetting('shop_rotation') as { date: string; items: { itemId: string; originalPrice: string; discountedPrice: string }[] } | null;
  if (stored && stored.date === today) {
    return {
      date: stored.date,
      items: stored.items.map(i => ({
        itemId: i.itemId,
        originalPrice: BigInt(i.originalPrice),
        discountedPrice: BigInt(i.discountedPrice),
      })),
    };
  }

  // Generate new rotation
  return generateDailyRotation(today);
}

export async function generateDailyRotation(date: string): Promise<DailyRotation> {
  const shuffled = shuffleArray(DAILY_ELIGIBLE_ITEMS);
  const picks = shuffled.slice(0, DAILY_ROTATION_COUNT);

  const items = picks.map(item => ({
    itemId: item.id,
    originalPrice: item.price,
    discountedPrice: item.price - (item.price * BigInt(DAILY_DISCOUNT_RATE)) / 100n,
  }));

  // Persist
  await upsertSetting('shop_rotation', {
    date,
    items: items.map(i => ({
      itemId: i.itemId,
      originalPrice: i.originalPrice.toString(),
      discountedPrice: i.discountedPrice.toString(),
    })),
  });

  return { date, items };
}

export async function checkAndRefreshRotation(): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const stored = await getSetting('shop_rotation') as { date: string } | null;

  if (!stored || stored.date !== today) {
    await generateDailyRotation(today);
    return true;
  }
  return false;
}
