export interface CollectionSet {
    key: string;
    name: string;
    emoji: string;
    description: string;
    requiredItems: string[];
    rewardDescription: string;
    rewardItemId: string;
}

export const COLLECTION_SETS: CollectionSet[] = [
    {
        key: 'gambler',
        name: 'ギャンブラーセット',
        emoji: '🎰',
        description: '幸運のアイテムを集めたギャンブラーセット',
        requiredItems: ['LUCKY_CHARM', 'VIP_PASS', 'GOLDEN_DICE'],
        rewardDescription: '全ゲーム報酬+3%永続',
        rewardItemId: 'COLLECTION_REWARD_GAMBLER',
    },
    {
        key: 'worker',
        name: 'ワーカーセット',
        emoji: '💼',
        description: '働き者のためのワーカーセット',
        requiredItems: ['XP_BOOSTER', 'WORK_PAY_BOOST', 'TOOL_UNIVERSAL'],
        rewardDescription: '労働報酬+5%永続',
        rewardItemId: 'COLLECTION_REWARD_WORKER',
    },
    {
        key: 'insurance',
        name: '保険セット',
        emoji: '🛡️',
        description: '万全の備えの保険セット',
        requiredItems: ['STREAK_SHIELD', 'BANKRUPTCY_INSURANCE', 'SAFETY_NET'],
        rewardDescription: 'デイリーボーナス+$300永続',
        rewardItemId: 'COLLECTION_REWARD_INSURANCE',
    },
    {
        key: 'royal',
        name: 'ロイヤルセット',
        emoji: '👑',
        description: '王者の風格のロイヤルセット',
        requiredItems: ['TITLE_CASINO_KING', 'BADGE_CROWN', 'VIP_CARD'],
        rewardDescription: '銀行利率+1%永続',
        rewardItemId: 'COLLECTION_REWARD_ROYAL',
    },
    {
        key: 'mystery',
        name: 'ミステリーセット',
        emoji: '📦',
        description: '全ボックスを揃えるミステリーセット',
        requiredItems: ['BOX_BRONZE', 'BOX_SILVER', 'BOX_GOLD'],
        rewardDescription: 'ミステリーボックスのレア率UP永続',
        rewardItemId: 'COLLECTION_REWARD_MYSTERY',
    },
];

export const COLLECTION_MAP = new Map<string, CollectionSet>(
    COLLECTION_SETS.map(c => [c.key, c]),
);
