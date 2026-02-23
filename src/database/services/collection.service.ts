import { COLLECTION_SETS, type CollectionSet } from '../../config/collections.js';
import { getEverOwnedItems } from '../repositories/shop.repository.js';
import { getUserCollections, hasCollection, completeCollection } from '../repositories/collection.repository.js';
import { upsertInventoryItem } from '../repositories/shop.repository.js';
import { checkAchievements } from './achievement.service.js';
import type { AchievementDefinition } from '../../config/achievements.js';
import { logger } from '../../utils/logger.js';

export interface CollectionProgress {
  collection: CollectionSet;
  ownedItems: string[];
  total: number;
  completed: boolean;
}

export async function getCollectionProgress(userId: string): Promise<CollectionProgress[]> {
  const [everOwned, completedCollections] = await Promise.all([
    getEverOwnedItems(userId),
    getUserCollections(userId),
  ]);
  const ownedSet = new Set(everOwned);
  const completedKeys = new Set(completedCollections.map(c => c.collectionKey));

  return COLLECTION_SETS.map(collection => {
    const owned = collection.requiredItems.filter(id => ownedSet.has(id));
    return {
      collection,
      ownedItems: owned,
      total: collection.requiredItems.length,
      completed: completedKeys.has(collection.key),
    };
  });
}

export async function checkAndCompleteCollections(
  userId: string,
): Promise<{ completed: CollectionSet[]; newlyUnlocked: AchievementDefinition[] }> {
  const everOwned = await getEverOwnedItems(userId);
  const ownedSet = new Set(everOwned);
  const newlyCompleted: CollectionSet[] = [];

  for (const collection of COLLECTION_SETS) {
    const allOwned = collection.requiredItems.every(id => ownedSet.has(id));
    if (!allOwned) continue;

    const alreadyCompleted = await hasCollection(userId, collection.key);
    if (alreadyCompleted) continue;

    try {
      await completeCollection(userId, collection.key);
      // Grant reward item as a permanent flag
      await upsertInventoryItem(userId, collection.rewardItemId, 1);
      newlyCompleted.push(collection);
    } catch (err) {
      logger.error('Failed to complete collection', { userId, key: collection.key, error: String(err) });
    }
  }

  // Check achievements
  let newlyUnlocked: AchievementDefinition[] = [];
  if (newlyCompleted.length > 0) {
    try {
      const allCompleted = await getUserCollections(userId);
      newlyUnlocked = await checkAchievements({
        userId,
        context: 'shop',
        metadata: {
          action: 'collection_complete',
          completedCount: allCompleted.length,
          totalCollections: COLLECTION_SETS.length,
        },
      });
    } catch {
      // Never block
    }
  }

  return { completed: newlyCompleted, newlyUnlocked };
}

export async function getCompletedCollectionRewards(userId: string): Promise<string[]> {
  const collections = await getUserCollections(userId);
  return collections.map(c => {
    const def = COLLECTION_SETS.find(s => s.key === c.collectionKey);
    return def?.rewardItemId ?? '';
  }).filter(Boolean);
}
