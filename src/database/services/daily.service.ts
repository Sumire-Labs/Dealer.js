import {Prisma} from '@prisma/client';
import {DAILY_RESET_HOUR_JST} from '../../config/constants.js';
import {configService} from '../../config/config.service.js';
import {S} from '../../config/setting-defs.js';
import {prisma} from '../client.js';
import {findOrCreateUser} from '../repositories/user.repository.js';
import {checkAchievements} from './achievement.service.js';
import type {AchievementDefinition} from '../../config/achievements.js';
import {type CompletedMission, updateMissionProgress} from './mission.service.js';
import {consumeInventoryItem} from './shop.service.js';
import {loadUserItemsSnapshot, snapshotHasBuff, snapshotHasItem} from './shop/batch-inventory.service.js';
import {SHOP_EFFECTS} from '../../config/shop.js';

/** JST 05:00 を日付境界として、dateが属する「リセット日」を "YYYY-MM-DD" で返す */
function getJstResetDate(date: Date): string {
  const jstMs = date.getTime() + 9 * 60 * 60 * 1000;
  const jst = new Date(jstMs);
  const resetToday = new Date(jst);
  resetToday.setUTCHours(DAILY_RESET_HOUR_JST, 0, 0, 0);
  if (jst < resetToday) {
    resetToday.setUTCDate(resetToday.getUTCDate() - 1);
  }
  return resetToday.toISOString().slice(0, 10);
}

/** 次の JST 05:00 の UTC タイムスタンプを返す */
function getNextResetTimestamp(): number {
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const resetToday = new Date(jstNow);
  resetToday.setUTCHours(DAILY_RESET_HOUR_JST, 0, 0, 0);
  let resetUtc = resetToday.getTime() - 9 * 60 * 60 * 1000;
  if (now.getTime() >= resetUtc) {
    resetUtc += 24 * 60 * 60 * 1000;
  }
  return resetUtc;
}

export { getJstResetDate, getNextResetTimestamp };

export interface DailyResult {
  success: boolean;
  amount?: bigint;
  newBalance?: bigint;
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

    const todayKey = getJstResetDate(new Date());
    const lastKey = user.lastDaily ? getJstResetDate(user.lastDaily) : null;

    if (lastKey === todayKey) {
      return {
        success: false,
        nextClaimAt: getNextResetTimestamp(),
      };
    }

    const isBroke = user.chips <= 0n;
    let amount = isBroke ? configService.getBigInt(S.dailyBonusBroke) : configService.getBigInt(S.dailyBonus);

    // Load inventory + buffs in 2 queries (batch) instead of ~6 individual queries
    let snapshot;
    try {
      snapshot = await loadUserItemsSnapshot(userId);
    } catch {
      snapshot = null;
    }

    // CHIP_FOUNTAIN permanent upgrade: +$500
    try {
      if (snapshot && snapshotHasItem(snapshot, 'CHIP_FOUNTAIN')) {
        amount += SHOP_EFFECTS.CHIP_FOUNTAIN_BONUS;
      }
    } catch {
      // Never block daily
    }

    // Insurance Collection bonus: +$300
    try {
      if (snapshot && snapshotHasItem(snapshot, 'COLLECTION_REWARD_INSURANCE')) {
        amount += SHOP_EFFECTS.COLLECTION_INSURANCE_BONUS;
      }
    } catch {
      // Never block daily
    }

    // DAILY_BOOST consumable: double amount
    try {
      if (snapshot && snapshotHasItem(snapshot, 'DAILY_BOOST')) {
        amount *= 2n;
        await consumeInventoryItem(userId, 'DAILY_BOOST');
      }
    } catch {
      // Never block daily
    }

    // Streak: 昨日(JST)取得していれば継続、そうでなければリセット
    const yesterdayKey = getJstResetDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const streakContinues = lastKey === yesterdayKey;
    let newStreak: number;
    if (streakContinues) {
      newStreak = user.dailyStreak + 1;
    } else {
      // STREAK_SHIELD: prevent streak reset
      let shielded = false;
      try {
        if (user.dailyStreak > 0 && snapshot && snapshotHasBuff(snapshot, 'STREAK_SHIELD')) {
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
