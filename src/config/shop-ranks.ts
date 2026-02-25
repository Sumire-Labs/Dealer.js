export type ShopRank = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface ShopRankDef {
    rank: ShopRank;
    label: string;
    emoji: string;
    threshold: bigint;
    discountPercent: number;
}

export const SHOP_RANKS: ShopRankDef[] = [
    {rank: 'bronze', label: 'ブロンズ', emoji: '🥉', threshold: 0n, discountPercent: 0},
    {rank: 'silver', label: 'シルバー', emoji: '🥈', threshold: 50_000n, discountPercent: 3},
    {rank: 'gold', label: 'ゴールド', emoji: '🥇', threshold: 200_000n, discountPercent: 5},
    {rank: 'platinum', label: 'プラチナ', emoji: '💠', threshold: 500_000n, discountPercent: 8},
    {rank: 'diamond', label: 'ダイヤモンド', emoji: '💎', threshold: 1_000_000n, discountPercent: 10},
];

export function getShopRank(lifetimeSpend: bigint): ShopRankDef {
    let current = SHOP_RANKS[0];
    for (const rank of SHOP_RANKS) {
        if (lifetimeSpend >= rank.threshold) {
            current = rank;
        }
    }
    return current;
}

export function getNextRank(current: ShopRankDef): ShopRankDef | null {
    const idx = SHOP_RANKS.findIndex(r => r.rank === current.rank);
    if (idx < 0 || idx >= SHOP_RANKS.length - 1) return null;
    return SHOP_RANKS[idx + 1];
}

export function getRankDiscount(lifetimeSpend: bigint): number {
    return getShopRank(lifetimeSpend).discountPercent;
}
