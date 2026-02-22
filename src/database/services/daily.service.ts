import { Prisma } from '@prisma/client';
import { DAILY_BONUS, DAILY_BONUS_BROKE, DAILY_COOLDOWN_MS } from '../../config/constants.js';
import { prisma } from '../client.js';
import { findOrCreateUser } from '../repositories/user.repository.js';
import { checkAchievements } from './achievement.service.js';
import type { AchievementDefinition } from '../../config/achievements.js';
import { updateMissionProgress, type CompletedMission } from './mission.service.js';
import { hasActiveBuff, hasInventoryItem, consumeInventoryItem } from './shop.service.js';
import { SHOP_EFFECTS } from '../../config/shop.js';

export interface DailyResult {
  success: boolean;
  amount?: bigint;
  newBalance?: bigint;
  remainingCooldown?: number;
  streak?: number;
  nextClaimAt?: number;
  newlyUnlocked?: AchievementDefinition[];
  missionsCompleted?: CompletedMission[];
}

export async function claimDaily(userId: string): Promise<DailyResult> {
  await findOrCreateUser(userId);

  // Atomic check-and-claim inside a transaction
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

    if (user.lastDaily) {
      const elapsed = Date.now() - user.lastDaily.getTime();
      if (elapsed < DAILY_COOLDOWN_MS) {
        const nextClaimAt = user.lastDaily.getTime() + DAILY_COOLDOWN_MS;
        return {
          success: false,
          remainingCooldown: DAILY_COOLDOWN_MS - elapsed,
          nextClaimAt,
        };
      }
    }

    const isBroke = user.chips <= 0n;
    let amount = isBroke ? DAILY_BONUS_BROKE : DAILY_BONUS;

    // CHIP_FOUNTAIN permanent upgrade: +$500
    try {
      if (await hasInventoryItem(userId, 'CHIP_FOUNTAIN')) {
        amount += SHOP_EFFECTS.CHIP_FOUNTAIN_BONUS;
      }
    } catch {
      // Never block daily
    }

    // DAILY_BOOST consumable: double amount
    try {
      if (await hasInventoryItem(userId, 'DAILY_BOOST')) {
        amount *= 2n;
        await consumeInventoryItem(userId, 'DAILY_BOOST');
      }
    } catch {
      // Never block daily
    }

    // Streak calculation: within 48h of lastDaily → increment, otherwise reset to 1
    const STREAK_WINDOW_MS = 48 * 60 * 60 * 1000;
    let newStreak: number;
    const withinWindow = user.lastDaily && (Date.now() - user.lastDaily.getTime()) <= STREAK_WINDOW_MS;
    if (withinWindow) {
      newStreak = user.dailyStreak + 1;
    } else {
      // STREAK_SHIELD: prevent streak reset
      let shielded = false;
      try {
        if (user.dailyStreak > 0 && await hasActiveBuff(userId, 'STREAK_SHIELD')) {
          shielded = true;
        }
      } catch {
        // Never block daily
      }
      newStreak = shielded ? user.dailyStreak + 1 : 1;
    }

    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        chips: { increment: amount },
        lastDaily: new Date(),
        dailyStreak: newStreak,
      },
    });

    await tx.transaction.create({
      data: {
        userId,
        type: 'DAILY',
        amount,
        balanceAfter: updated.chips,
        metadata: Prisma.JsonNull,
      },
    });

    // Achievement check
    let newlyUnlocked: AchievementDefinition[] = [];
    try {
      const dailyAchievements = await checkAchievements({
        userId,
        context: 'daily_claim',
        dailyStreak: newStreak,
        newBalance: updated.chips,
      });
      const economyAchievements = await checkAchievements({
        userId,
        context: 'economy_change',
        newBalance: updated.chips,
      });
      newlyUnlocked = [...dailyAchievements, ...economyAchievements];
    } catch {
      // Achievement check should never block daily claim
    }

    // Mission progress hooks
    let missionsCompleted: CompletedMission[] = [];
    try {
      missionsCompleted = await updateMissionProgress(userId, { type: 'daily' });
    } catch {
      // Mission check should never block daily claim
    }

    return {
      success: true,
      amount,
      newBalance: updated.chips,
      streak: newStreak,
      newlyUnlocked,
      missionsCompleted,
    };
  });
}
