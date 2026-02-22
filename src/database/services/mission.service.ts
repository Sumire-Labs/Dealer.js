import type { DailyMission } from '@prisma/client';
import {
  getMissionsForDate,
  createMission,
  incrementProgress,
  markCompleted,
} from '../repositories/mission.repository.js';
import {
  MISSION_POOLS,
  MISSION_MAP,
  type MissionEvent,
  type CompletedMission,
  type MissionDefinition,
} from '../../config/missions.js';
export type { CompletedMission } from '../../config/missions.js';
import { MISSION_COMPLETE_BONUS } from '../../config/constants.js';
import { addChips } from './economy.service.js';
import { checkAchievements } from './achievement.service.js';
import type { AchievementDefinition } from '../../config/achievements.js';
import { shuffleArray } from '../../utils/random.js';
import { logger } from '../../utils/logger.js';
import { getInventoryQuantity, hasInventoryItem } from './shop.service.js';
import { SHOP_EFFECTS } from '../../config/shop.js';

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function assignDailyMissions(userId: string): Promise<DailyMission[]> {
  const date = getTodayDateString();
  const existing = await getMissionsForDate(userId, date);
  if (existing.length > 0) return existing;

  // Determine mission slots: base 3 + MISSION_SLOT_PLUS upgrades (max 5)
  let extraSlots = 0;
  try {
    extraSlots = await getInventoryQuantity(userId, 'MISSION_SLOT_PLUS');
  } catch {
    // Never block mission assignment
  }
  const totalSlots = Math.min(3 + extraSlots, 5);

  // Pick 1 easy + 1 medium + 1 hard + extras from random pools
  const picks: MissionDefinition[] = [];
  const difficultyOrder: ('easy' | 'medium' | 'hard')[] = ['easy', 'medium', 'hard'];
  for (const difficulty of difficultyOrder) {
    const pool = MISSION_POOLS[difficulty];
    const shuffled = shuffleArray(pool);
    picks.push(shuffled[0]);
  }

  // Extra slots pick from random difficulties
  for (let i = 3; i < totalSlots; i++) {
    const diff = difficultyOrder[i % difficultyOrder.length];
    const pool = MISSION_POOLS[diff];
    const shuffled = shuffleArray(pool);
    const picked = shuffled.find(m => !picks.some(p => p.key === m.key));
    if (picked) picks.push(picked);
  }

  const missions: DailyMission[] = [];
  for (const def of picks) {
    const mission = await createMission({
      userId,
      missionKey: def.key,
      target: def.target,
      reward: def.reward,
      date,
    });
    missions.push(mission);
  }

  return missions;
}

export async function getDailyMissions(userId: string): Promise<DailyMission[]> {
  return assignDailyMissions(userId);
}

export async function updateMissionProgress(
  userId: string,
  event: MissionEvent,
): Promise<CompletedMission[]> {
  const date = getTodayDateString();
  const missions = await getMissionsForDate(userId, date);
  if (missions.length === 0) return [];

  const completed: CompletedMission[] = [];

  for (const mission of missions) {
    if (mission.completed) continue;

    const def = MISSION_MAP.get(mission.missionKey);
    if (!def) continue;

    const increment = getProgressIncrement(def, event);
    if (increment <= 0) continue;

    try {
      const updated = await incrementProgress(userId, mission.missionKey, date, increment);

      if (updated.progress >= updated.target && !updated.completed) {
        await markCompleted(userId, mission.missionKey, date);

        // Grant reward (with GOLDEN_DICE bonus)
        let reward = def.reward;
        try {
          if (await hasInventoryItem(userId, 'GOLDEN_DICE')) {
            reward += (reward * SHOP_EFFECTS.GOLDEN_DICE_PERCENT) / 100n;
          }
        } catch {
          // Never block reward
        }
        await addChips(userId, reward, 'MISSION_REWARD');

        completed.push({
          missionKey: def.key,
          name: def.name,
          reward,
        });
      }
    } catch (err) {
      logger.error('Failed to update mission progress', {
        userId,
        missionKey: mission.missionKey,
        error: String(err),
      });
    }
  }

  // Check if all missions completed → bonus
  if (completed.length > 0) {
    const allMissions = await getMissionsForDate(userId, date);
    const allCompleted = allMissions.every(m => m.completed);

    if (allCompleted) {
      await addChips(userId, MISSION_COMPLETE_BONUS, 'MISSION_REWARD');
      completed.push({
        missionKey: '_complete_bonus',
        name: 'コンプリートボーナス',
        reward: MISSION_COMPLETE_BONUS,
      });
    }

    // Achievement checks
    try {
      const achievementResults = await checkAchievements({
        userId,
        context: 'mission',
        metadata: { allCompleted },
      });
      // Store for caller to handle (returned via completed missions notification)
      if (achievementResults.length > 0) {
        (completed as CompletedMission[] & { _achievements?: AchievementDefinition[] })._achievements = achievementResults;
      }
    } catch {
      // Never block mission completion
    }
  }

  return completed;
}

function getProgressIncrement(def: MissionDefinition, event: MissionEvent): number {
  switch (def.type) {
    case 'play_game':
      if (event.type !== 'game_play') return 0;
      if (def.gameType === 'any' || def.gameType === event.gameType) return 1;
      return 0;

    case 'win_game':
      if (event.type !== 'game_win') return 0;
      if (def.gameType === 'any' || def.gameType === event.gameType) return 1;
      return 0;

    case 'earn_chips':
      if (event.type !== 'chips_earned') return 0;
      return event.amount ?? 0;

    case 'bet_chips':
      if (event.type !== 'chips_bet') return 0;
      return event.amount ?? 0;

    case 'work':
      if (event.type !== 'work') return 0;
      return 1;

    case 'daily':
      if (event.type !== 'daily') return 0;
      return 1;

    default:
      return 0;
  }
}

export function buildMissionNotification(completed: CompletedMission[]): string {
  const lines = completed.map(m => `✅ ${m.name} — 報酬: $${Number(m.reward).toLocaleString()}`);
  return `🎯 **ミッション達成！**\n${lines.join('\n')}`;
}
