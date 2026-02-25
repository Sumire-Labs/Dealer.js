export interface CraftRecipe {
    id: string;
    name: string;
    emoji: string;
    description: string;
    materials: { itemId: string; quantity: number }[];
    resultItemId: string;
    resultQuantity: number;
}

export const CRAFT_RECIPES: CraftRecipe[] = [
    {
        id: 'RECIPE_MEGA_XP',
        name: 'メガXPブースター',
        emoji: '🧬',
        description: 'XPブースター3個を合成してXP+100%の強力ブースターに',
        materials: [{itemId: 'XP_BOOSTER', quantity: 3}],
        resultItemId: 'MEGA_XP_BOOSTER',
        resultQuantity: 1,
    },
    {
        id: 'RECIPE_GOLDEN_BOX',
        name: 'ゴールデンボックス',
        emoji: '📦',
        description: '3種のボックスを合成して伝説確定ボックスに',
        materials: [
            {itemId: 'BOX_BRONZE', quantity: 1},
            {itemId: 'BOX_SILVER', quantity: 1},
            {itemId: 'BOX_GOLD', quantity: 1},
        ],
        resultItemId: 'GOLDEN_BOX',
        resultQuantity: 1,
    },
    {
        id: 'RECIPE_SUPER_SAFETY',
        name: 'スーパーセーフティ',
        emoji: '🛡️',
        description: 'セーフティネット2個+ラッキーチャームで超保険に',
        materials: [
            {itemId: 'SAFETY_NET', quantity: 2},
            {itemId: 'LUCKY_CHARM', quantity: 1},
        ],
        resultItemId: 'SUPER_SAFETY_NET',
        resultQuantity: 1,
    },
    {
        id: 'RECIPE_MASTER_TOOL',
        name: 'マスターツール',
        emoji: '🔧',
        description: '任意のツール3個で全ジョブ対応の万能ツールに',
        materials: [{itemId: 'TOOL_UNIVERSAL', quantity: 3}],
        resultItemId: 'MASTER_TOOL',
        resultQuantity: 1,
    },
];

export const RECIPE_MAP = new Map<string, CraftRecipe>(
    CRAFT_RECIPES.map(r => [r.id, r]),
);
