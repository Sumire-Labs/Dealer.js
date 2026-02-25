export interface BusinessLevelDefinition {
    level: number;
    upgradeCost: bigint;
    incomePerHour: bigint;
    description: string;
}

export interface BusinessTypeDefinition {
    id: string;
    name: string;
    emoji: string;
    purchaseCost: bigint;
    maxLevel: number;
    levels: BusinessLevelDefinition[];
}

export const BUSINESS_TYPES: BusinessTypeDefinition[] = [
    {
        id: 'stall',
        name: '屋台',
        emoji: '🏕️',
        purchaseCost: 10_000n,
        maxLevel: 5,
        levels: [
            {level: 1, upgradeCost: 0n, incomePerHour: 50n, description: '小さな屋台'},
            {level: 2, upgradeCost: 5_000n, incomePerHour: 100n, description: '看板設置'},
            {level: 3, upgradeCost: 15_000n, incomePerHour: 180n, description: 'メニュー拡張'},
            {level: 4, upgradeCost: 40_000n, incomePerHour: 300n, description: '常連客獲得'},
            {level: 5, upgradeCost: 80_000n, incomePerHour: 500n, description: '名物屋台'},
        ],
    },
    {
        id: 'convenience',
        name: 'コンビニ',
        emoji: '🏪',
        purchaseCost: 50_000n,
        maxLevel: 5,
        levels: [
            {level: 1, upgradeCost: 0n, incomePerHour: 200n, description: '小さなコンビニ'},
            {level: 2, upgradeCost: 20_000n, incomePerHour: 400n, description: '品揃え拡充'},
            {level: 3, upgradeCost: 60_000n, incomePerHour: 700n, description: 'ATM設置'},
            {level: 4, upgradeCost: 120_000n, incomePerHour: 1_100n, description: '24時間営業'},
            {level: 5, upgradeCost: 200_000n, incomePerHour: 1_500n, description: 'チェーン展開'},
        ],
    },
    {
        id: 'restaurant',
        name: 'レストラン',
        emoji: '🍽️',
        purchaseCost: 200_000n,
        maxLevel: 5,
        levels: [
            {level: 1, upgradeCost: 0n, incomePerHour: 500n, description: '小さなレストラン'},
            {level: 2, upgradeCost: 80_000n, incomePerHour: 1_000n, description: 'メニュー刷新'},
            {level: 3, upgradeCost: 200_000n, incomePerHour: 1_800n, description: '有名シェフ雇用'},
            {level: 4, upgradeCost: 400_000n, incomePerHour: 2_800n, description: 'ミシュラン獲得'},
            {level: 5, upgradeCost: 700_000n, incomePerHour: 4_000n, description: '超高級レストラン'},
        ],
    },
    {
        id: 'bar',
        name: 'バー',
        emoji: '🍸',
        purchaseCost: 500_000n,
        maxLevel: 5,
        levels: [
            {level: 1, upgradeCost: 0n, incomePerHour: 1_000n, description: '隠れ家バー'},
            {level: 2, upgradeCost: 150_000n, incomePerHour: 2_000n, description: 'カクテルメニュー充実'},
            {level: 3, upgradeCost: 350_000n, incomePerHour: 3_500n, description: 'VIPルーム設置'},
            {level: 4, upgradeCost: 600_000n, incomePerHour: 5_500n, description: 'ライブステージ設置'},
            {level: 5, upgradeCost: 1_000_000n, incomePerHour: 8_000n, description: '伝説のバー'},
        ],
    },
    {
        id: 'casino_biz',
        name: 'カジノ',
        emoji: '🎰',
        purchaseCost: 1_000_000n,
        maxLevel: 5,
        levels: [
            {level: 1, upgradeCost: 0n, incomePerHour: 2_500n, description: '小さなカジノ'},
            {level: 2, upgradeCost: 400_000n, incomePerHour: 5_000n, description: 'スロットマシン増設'},
            {level: 3, upgradeCost: 1_000_000n, incomePerHour: 9_000n, description: 'VIPテーブル設置'},
            {level: 4, upgradeCost: 2_000_000n, incomePerHour: 14_000n, description: 'ホテル併設'},
            {level: 5, upgradeCost: 4_000_000n, incomePerHour: 20_000n, description: '世界的カジノリゾート'},
        ],
    },
];

export const BUSINESS_TYPE_MAP = new Map(BUSINESS_TYPES.map(b => [b.id, b]));

export function getBusinessLevel(typeId: string, level: number): BusinessLevelDefinition | undefined {
    const type = BUSINESS_TYPE_MAP.get(typeId);
    if (!type) return undefined;
    return type.levels.find(l => l.level === level);
}

// Business events
export interface BusinessEvent {
    id: string;
    name: string;
    emoji: string;
    multiplier: number;
    chance: number;
}

export const BUSINESS_EVENTS: BusinessEvent[] = [
    {id: 'boom', name: '大繁盛', emoji: '🎉', multiplier: 2.0, chance: 10},
    {id: 'normal', name: '通常営業', emoji: '📊', multiplier: 1.0, chance: 55},
    {id: 'slow', name: '客足減少', emoji: '📉', multiplier: 0.5, chance: 20},
    {id: 'inspection', name: '抜き打ち検査', emoji: '🔍', multiplier: 0.0, chance: 5},
    {id: 'viral', name: 'SNSバズり', emoji: '📱', multiplier: 3.0, chance: 5},
    {id: 'accident_biz', name: '設備故障', emoji: '🔧', multiplier: 0.0, chance: 5},
];
