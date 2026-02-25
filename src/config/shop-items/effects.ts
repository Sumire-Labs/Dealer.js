import type {ItemRarity} from './types.js';

// ── Buff effect constants ──

export const SHOP_EFFECTS = {
    VIP_BONUS_PERCENT: 5n,       // VIP_CARD & VIP_PASS: +5%
    LUCKY_CHARM_REFUND: 50n,     // 50% of bet refunded
    SAFETY_NET_AMOUNT: 5_000n,
    SUPER_SAFETY_NET_AMOUNT: 10_000n,
    XP_BOOSTER_MULTIPLIER: 1.5,
    MEGA_XP_BOOSTER_MULTIPLIER: 2.0,
    CHIP_FOUNTAIN_BONUS: 1_000n,
    BANK_EXPANSION_RATE: 1n,     // +1% per stack
    GOLDEN_DICE_PERCENT: 20n,    // +20% mission reward
    BANKRUPTCY_INSURANCE_BONUS: 10_000n,
    HEIST_INTEL_BONUS: 15,       // +15% success rate
    HEIST_VAULT_PERCENT: 10n,    // +10% heist reward
    POKER_FACE_PERCENT: 10n,     // +10% poker reward
    LUCKY_TICKET_MULTIPLIER: 2.0,
    WORK_PAY_BOOST_PERCENT: 25,  // +25% work pay
    LOAN_DISCOUNT_RATE: 0.5,     // 50% interest reduction
    COLLECTION_GAMBLER_PERCENT: 3n,
    COLLECTION_WORKER_PERCENT: 5,
    COLLECTION_INSURANCE_BONUS: 300n,
    COLLECTION_ROYAL_RATE: 1n,
    RECYCLE_REFUND_RATE: 30,     // 30% refund
    GIFT_FEE_RATE: 5,            // 5% fee on chip gifts
    MASTER_TOOL_PERCENT: 10,     // +10% all job pay
} as const;

// ── Rarity display ──

export const RARITY_LABELS: Record<ItemRarity, string> = {
    common: 'コモン',
    uncommon: 'アンコモン',
    rare: 'レア',
    epic: 'エピック',
    legendary: '伝説',
};

export const RARITY_EMOJI: Record<ItemRarity, string> = {
    common: '⬜',
    uncommon: '🟩',
    rare: '🟦',
    epic: '🟪',
    legendary: '🟨',
};
