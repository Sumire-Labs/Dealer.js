import { getLifetimeShopSpend } from '../../../database/repositories/shop.repository.js';
import { getShopRank, getNextRank } from '../../../config/shop-ranks.js';

// Session state per user
export const shopState = new Map<string, { category: number; page: number; craftPage: number; collectionPage: number }>();

export function getState(userId: string) {
  if (!shopState.has(userId)) {
    if (shopState.size > 10_000) shopState.clear();
    shopState.set(userId, { category: 0, page: 0, craftPage: 0, collectionPage: 0 });
  }
  return shopState.get(userId)!;
}

export async function getRankInfo(userId: string) {
  const spend = await getLifetimeShopSpend(userId);
  const rank = getShopRank(spend);
  const nextRank = getNextRank(rank);
  return { rank, nextRank, lifetimeSpend: spend };
}
