import { prisma } from '../client.js';
import { findOrCreateUser } from '../repositories/user.repository.js';
import {
  type ShiftType,
  type WorkEvent,
  JOB_MAP,
  SHIFT_MAP,
  LEVEL_THRESHOLDS,
} from '../../config/jobs.js';
import {
  WORK_SHORT_COOLDOWN_MS,
  WORK_NORMAL_COOLDOWN_MS,
  WORK_LONG_COOLDOWN_MS,
  WORK_STREAK_WINDOW_MS,
} from '../../config/constants.js';
import {
  rollWorkEvent,
  rollBasePay,
  rollTipAmount,
  getStreakBonus,
  calculateWorkPayout,
  calculateXpGain,
  getLevelForXp,
  getEventFlavor,
} from '../../games/work/work.engine.js';
import { checkAchievements } from './achievement.service.js';
import type { AchievementDefinition } from '../../config/achievements.js';
import { updateMissionProgress, type CompletedMission } from './mission.service.js';
import {
  isOnCooldown,
  getRemainingCooldown,
  setCooldown,
  buildCooldownKey,
} from '../../utils/cooldown.js';
import { hasActiveBuff } from './shop.service.js';
import { SHOP_EFFECTS } from '../../config/shop.js';

const COOLDOWN_MAP: Record<ShiftType, number> = {
  short: WORK_SHORT_COOLDOWN_MS,
  normal: WORK_NORMAL_COOLDOWN_MS,
  long: WORK_LONG_COOLDOWN_MS,
};

export interface WorkResult {
  success: boolean;
  error?: string;
  remainingCooldown?: number;
  // Success data
  jobId?: string;
  jobName?: string;
  jobEmoji?: string;
  shiftType?: ShiftType;
  shiftLabel?: string;
  event?: WorkEvent;
  flavorText?: string;
  basePay?: bigint;
  shiftPay?: bigint;
  tipAmount?: bigint;
  streakBonus?: number;
  bonusAmount?: bigint;
  totalPay?: bigint;
  xpGained?: number;
  oldLevel?: number;
  newLevel?: number;
  oldXp?: number;
  newXp?: number;
  xpForNextLevel?: number | null;
  streak?: number;
  newBalance?: bigint;
  newlyUnlocked?: AchievementDefinition[];
  missionsCompleted?: CompletedMission[];
}

export async function performWork(
  userId: string,
  jobId: string,
  shiftType: ShiftType,
): Promise<WorkResult> {
  const job = JOB_MAP.get(jobId);
  if (!job) return { success: false, error: '無効な職種です。' };

  const shift = SHIFT_MAP.get(shiftType);
  if (!shift) return { success: false, error: '無効なシフトです。' };

  // Check cooldown for this shift type
  const cooldownKey = buildCooldownKey(userId, shift.cooldownKey);
  if (isOnCooldown(cooldownKey)) {
    return {
      success: false,
      remainingCooldown: getRemainingCooldown(cooldownKey),
    };
  }

  await findOrCreateUser(userId);

  // Roll event and calculate payout
  const event = rollWorkEvent(job);
  const basePay = rollBasePay(job);
  const flavorText = getEventFlavor(jobId, event.type);
  const tipAmount = event.type === 'tip' ? rollTipAmount() : 0n;

  // Perform atomic transaction
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

    // Check level requirement
    if (user.workLevel < job.requiredLevel) {
      return { success: false as const, error: `この職種にはレベル${job.requiredLevel}が必要です。` };
    }

    // Streak calculation
    let newStreak: number;
    if (user.lastWorkAt && (Date.now() - user.lastWorkAt.getTime()) <= WORK_STREAK_WINDOW_MS) {
      newStreak = user.workStreak + 1;
    } else {
      newStreak = 1;
    }

    const streakBonus = getStreakBonus(newStreak);
    const { totalPay, shiftPay, bonusAmount } = calculateWorkPayout(basePay, shift, event, streakBonus);
    const finalPay = totalPay + tipAmount;

    // XP always granted (even on accident)
    let xpGained = calculateXpGain(job, shift);

    // XP Booster buff: +50% XP
    try {
      if (await hasActiveBuff(userId, 'XP_BOOSTER')) {
        xpGained = Math.round(xpGained * SHOP_EFFECTS.XP_BOOSTER_MULTIPLIER);
      }
    } catch {
      // Buff check should never block work
    }
    const oldXp = user.workXp;
    const newXp = oldXp + xpGained;
    const oldLevel = user.workLevel;
    const newLevel = getLevelForXp(newXp);

    // Update user
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        chips: { increment: finalPay },
        workXp: newXp,
        workLevel: newLevel,
        lastWorkAt: new Date(),
        workStreak: newStreak,
      },
    });

    // Record transaction (only if pay > 0)
    if (finalPay > 0n) {
      await tx.transaction.create({
        data: {
          userId,
          type: 'WORK_EARN',
          amount: finalPay,
          balanceAfter: updated.chips,
          metadata: {
            jobId,
            shiftType,
            event: event.type,
            basePay: basePay.toString(),
            tipAmount: tipAmount.toString(),
          },
        },
      });
    }

    // Next level XP threshold
    const xpForNextLevel = newLevel < LEVEL_THRESHOLDS.length - 1
      ? LEVEL_THRESHOLDS[newLevel + 1]
      : null;

    return {
      success: true as const,
      jobId,
      jobName: job.name,
      jobEmoji: job.emoji,
      shiftType,
      shiftLabel: shift.label,
      event,
      flavorText,
      basePay,
      shiftPay,
      tipAmount,
      streakBonus,
      bonusAmount,
      totalPay: finalPay,
      xpGained,
      oldLevel,
      newLevel,
      oldXp,
      newXp,
      xpForNextLevel,
      streak: newStreak,
      newBalance: updated.chips,
    };
  });

  if (!result.success) return result;

  // Set cooldown after successful work
  setCooldown(cooldownKey, COOLDOWN_MAP[shiftType]);

  // Achievement checks
  let newlyUnlocked: AchievementDefinition[] = [];
  try {
    const workAchievements = await checkAchievements({
      userId,
      context: 'work',
      newBalance: result.newBalance,
      metadata: {
        workLevel: result.newLevel,
        workStreak: result.streak,
        isFirstWork: true,
      },
    });
    const economyAchievements = await checkAchievements({
      userId,
      context: 'economy_change',
      newBalance: result.newBalance,
    });
    newlyUnlocked = [...workAchievements, ...economyAchievements];
  } catch {
    // Achievement check should never block work result
  }

  // Mission progress hooks
  let missionsCompleted: CompletedMission[] = [];
  try {
    missionsCompleted = await updateMissionProgress(userId, { type: 'work' });
  } catch {
    // Mission check should never block work result
  }

  return { ...result, newlyUnlocked, missionsCompleted };
}

export interface WorkPanelData {
  workLevel: number;
  workXp: number;
  workStreak: number;
  lastWorkAt: Date | null;
  xpForNextLevel: number | null;
  chips: bigint;
}

export async function getWorkPanelData(userId: string): Promise<WorkPanelData> {
  const user = await findOrCreateUser(userId);
  const xpForNextLevel = user.workLevel < LEVEL_THRESHOLDS.length - 1
    ? LEVEL_THRESHOLDS[user.workLevel + 1]
    : null;

  return {
    workLevel: user.workLevel,
    workXp: user.workXp,
    workStreak: user.workStreak,
    lastWorkAt: user.lastWorkAt,
    xpForNextLevel,
    chips: user.chips,
  };
}
