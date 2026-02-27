import {prisma} from '../../client.js';
import {
  createActiveBuff,
  decrementInventoryItem,
  getInventoryItem,
  markEverOwned,
  upsertInventoryItem,
} from '../../repositories/shop.repository.js';
import {checkAchievements} from '../achievement.service.js';
import type {AchievementDefinition} from '../../../config/achievements.js';
import {ITEM_MAP, type ShopItem} from '../../../config/shop.js';
import {RECIPE_MAP, type CraftRecipe} from '../../../config/crafting.js';
import {checkAndCompleteCollections} from '../collection.service.js';

export interface CraftResult {
    success: boolean;
    error?: string;
    resultItem?: ShopItem;
    newlyUnlocked?: AchievementDefinition[];
}

export async function craftItem(
    userId: string,
    recipeId: string,
): Promise<CraftResult> {
    const recipe = RECIPE_MAP.get(recipeId);
    if (!recipe) return {success: false, error: 'レシピが見つかりません。'};

    const resultItem = ITEM_MAP.get(recipe.resultItemId);
    if (!resultItem) return {success: false, error: '成果物が見つかりません。'};

    return prisma.$transaction(async (tx) => {
        // Check all materials
        for (const mat of recipe.materials) {
            const inv = await getInventoryItem(userId, mat.itemId);
            if (!inv || inv.quantity < mat.quantity) {
                const matItem = ITEM_MAP.get(mat.itemId);
                return {
                    success: false,
                    error: `素材「${matItem?.name ?? mat.itemId}」が不足しています（${inv?.quantity ?? 0}/${mat.quantity}）。`,
                };
            }
        }

        // Consume materials
        for (const mat of recipe.materials) {
            await decrementInventoryItem(userId, mat.itemId, mat.quantity, tx);
        }

        // Grant result
        if (resultItem.buffDurationMs) {
            await createActiveBuff(userId, recipe.resultItemId, resultItem.buffDurationMs, tx);
        } else {
            await upsertInventoryItem(userId, recipe.resultItemId, recipe.resultQuantity, tx);
        }
        await markEverOwned(userId, recipe.resultItemId, tx);

        // Record transaction
        const user = await tx.user.findUniqueOrThrow({where: {id: userId}});
        await tx.transaction.create({
            data: {
                userId,
                type: 'SHOP_CRAFT',
                amount: 0n,
                balanceAfter: user.chips,
                metadata: {
                    recipeId,
                    recipeName: recipe.name,
                    resultItemId: recipe.resultItemId,
                },
            },
        });

        // Achievement checks
        let newlyUnlocked: AchievementDefinition[] = [];
        try {
            newlyUnlocked = await checkAchievements({
                userId,
                context: 'shop',
                metadata: {action: 'craft', recipeId},
            });
        } catch {
            // Never block
        }

        // Check collections
        try {
            const collResult = await checkAndCompleteCollections(userId);
            if (collResult.newlyUnlocked.length > 0) {
                newlyUnlocked.push(...collResult.newlyUnlocked);
            }
        } catch {
            // Never block
        }

        return {success: true, resultItem, newlyUnlocked};
    });
}

export interface BulkCraftResult {
    success: boolean;
    crafted: number;
    results: { resultItem: ShopItem; recipe: CraftRecipe }[];
    failedAtIndex?: number;
    error?: string;
    newlyUnlocked: AchievementDefinition[];
}

export async function craftItemBulk(
    userId: string,
    recipeId: string,
    count: number,
): Promise<BulkCraftResult> {
    const recipe = RECIPE_MAP.get(recipeId);
    if (!recipe) return {success: false, crafted: 0, results: [], error: 'レシピが見つかりません。', newlyUnlocked: []};

    const resultItem = ITEM_MAP.get(recipe.resultItemId);
    if (!resultItem) return {success: false, crafted: 0, results: [], error: '成果物が見つかりません。', newlyUnlocked: []};

    const results: { resultItem: ShopItem; recipe: CraftRecipe }[] = [];
    const allUnlocked: AchievementDefinition[] = [];

    for (let i = 0; i < count; i++) {
        const result = await craftItem(userId, recipeId);
        if (!result.success) {
            return {
                success: results.length > 0,
                crafted: results.length,
                results,
                failedAtIndex: i,
                error: result.error,
                newlyUnlocked: allUnlocked,
            };
        }
        results.push({resultItem: result.resultItem!, recipe});
        if (result.newlyUnlocked) {
            allUnlocked.push(...result.newlyUnlocked);
        }
    }

    return {
        success: true,
        crafted: results.length,
        results,
        newlyUnlocked: allUnlocked,
    };
}
