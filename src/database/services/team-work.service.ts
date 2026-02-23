import { prisma } from '../client.js';
import { findOrCreateUser } from '../repositories/user.repository.js';
import {
  type ShiftType,
  JOB_MAP,
  SHIFT_MAP,
  LEVEL_THRESHOLDS,
  type JobDefinition,
} from '../../config/jobs.js';
import {
  WORK_STREAK_WINDOW_MS,
} from '../../config/constants.js';
import { configService } from '../../config/config.service.js';
import { S } from '../../config/setting-defs.js';
import {
  rollWorkEvent,
  rollBasePay,
  rollTipAmount,
  getStreakBonus,
  calculateWorkPayout,
  calculateXpGain,
  getLevelForXp,
  getEventFlavor,
  type WorkBonuses,
} from '../../games/work/work.engine.js';
import {
  isOnCooldown,
  getRemainingCooldown,
  setCooldown,
  buildCooldownKey,
} from '../../utils/cooldown.js';
import { hasActiveBuff } from './shop.service.js';
import { SHOP_EFFECTS } from '../../config/shop.js';
import { getMasteryTier, getMasteryLevelForShifts } from '../../config/work-mastery.js';
import { getMastery, incrementShifts, updateMasteryLevel } from '../repositories/work-mastery.repository.js';
import { PROMOTED_JOB_MAP, type PromotedJobDefinition } from '../../config/promoted-jobs.js';
import { type WorkResult, getToolBonuses, postWorkHooks } from './work.service.js';

function getCooldownMs(type: ShiftType): number {
  const map: Record<ShiftType, () => number> = {
    short: () => configService.getNumber(S.workShortCD),
    normal: () => configService.getNumber(S.workNormalCD),
    long: () => configService.getNumber(S.workLongCD),
  };
  return map[type]();
}

/**
 * Perform team work for a single player within a team shift.
 * Same pipeline as performWork but with team bonus applied and no multi-step events.
 */
export async function performTeamWork(
  userId: string,
  jobId: string,
  shiftType: ShiftType,
  teamSize: number,
): Promise<WorkResult> {
  const job: JobDefinition | PromotedJobDefinition | undefined =
    JOB_MAP.get(jobId) ?? PROMOTED_JOB_MAP.get(jobId);
  if (!job) return { success: false, error: '無効な職種です。' };

  const shift = SHIFT_MAP.get(shiftType);
  if (!shift) return { success: false, error: '無効なシフトです。' };

  // Cooldown check
  const cooldownKey = buildCooldownKey(userId, shift.cooldownKey);
  if (isOnCooldown(cooldownKey)) {
    return {
      success: false,
      remainingCooldown: getRemainingCooldown(cooldownKey),
    };
  }

  await findOrCreateUser(userId);

  const masteryData = await getMastery(userId, jobId);
  const masteryLevel = masteryData?.masteryLevel ?? 0;
  const masteryTier = getMasteryTier(masteryLevel);
  const toolBonuses = await getToolBonuses(userId, jobId);

  const bonuses: WorkBonuses = {
    mastery: masteryTier,
    toolPayBonus: toolBonuses.toolPayBonus,
    toolGreatSuccessBonus: toolBonuses.toolGreatSuccessBonus,
    toolRiskReduction: toolBonuses.toolRiskReduction,
    toolXpBonus: toolBonuses.toolXpBonus,
  };

  const event = rollWorkEvent(job, bonuses);
  const basePay = rollBasePay(job);
  const flavorText = getEventFlavor(jobId, event.type);
  const tipAmount = event.type === 'tip' ? rollTipAmount() : 0n;

  // Team bonus: +15% per additional member
  const teamBonusPercent = (teamSize - 1) * configService.getNumber(S.teamShiftBonus);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

    if (user.workLevel < job.requiredLevel) {
      return { success: false as const, error: `この職種にはレベル${job.requiredLevel}が必要です。` };
    }

    let newStreak: number;
    if (user.lastWorkAt && (Date.now() - user.lastWorkAt.getTime()) <= WORK_STREAK_WINDOW_MS) {
      newStreak = user.workStreak + 1;
    } else {
      newStreak = 1;
    }

    const streakBonus = getStreakBonus(newStreak);
    const { totalPay, shiftPay, bonusAmount, masteryBonus, toolBonus } =
      calculateWorkPayout(basePay, shift, event, streakBonus, bonuses);

    // Apply team bonus
    const teamBonus = (totalPay * BigInt(teamBonusPercent)) / 100n;
    let finalPay = totalPay + teamBonus + tipAmount;

    let xpGained = calculateXpGain(job, shift, bonuses);
    try {
      if (await hasActiveBuff(userId, 'XP_BOOSTER')) {
        xpGained = Math.round(xpGained * SHOP_EFFECTS.XP_BOOSTER_MULTIPLIER);
      }
    } catch { /* ignore */ }

    const oldXp = user.workXp;
    const newXp = oldXp + xpGained;
    const oldLevel = user.workLevel;
    const newLevel = getLevelForXp(newXp);

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
            teamSize,
            teamBonusPercent,
          },
        },
      });
    }

    const updatedMastery = await incrementShifts(userId, jobId, tx);
    const newMasteryLevel = getMasteryLevelForShifts(updatedMastery.shiftsCompleted);
    let masteryLeveledUp = false;
    let oldMasteryLevel = updatedMastery.masteryLevel;
    if (newMasteryLevel > updatedMastery.masteryLevel) {
      await updateMasteryLevel(userId, jobId, newMasteryLevel, tx);
      masteryLeveledUp = true;
      oldMasteryLevel = updatedMastery.masteryLevel;
    }

    const xpForNextLevel = newLevel < LEVEL_THRESHOLDS.length - 1
      ? LEVEL_THRESHOLDS[newLevel + 1]
      : null;

    return {
      success: true as const,
      jobId,
      jobName: job.name,
      jobEmoji: job.emoji,
      isPromoted: 'isPromoted' in job,
      shiftType,
      shiftLabel: shift.label,
      event,
      flavorText,
      basePay,
      shiftPay,
      tipAmount,
      streakBonus,
      bonusAmount: bonusAmount + teamBonus,
      masteryBonus,
      toolBonus,
      totalPay: finalPay,
      xpGained,
      oldLevel,
      newLevel,
      oldXp,
      newXp,
      xpForNextLevel,
      streak: newStreak,
      newBalance: updated.chips,
      masteryTier: getMasteryTier(newMasteryLevel),
      masteryShiftsCompleted: updatedMastery.shiftsCompleted,
      masteryLeveledUp,
      oldMasteryLevel,
      newMasteryLevel,
    };
  });

  if (!result.success) return result;

  setCooldown(cooldownKey, getCooldownMs(shiftType));

  const { newlyUnlocked, missionsCompleted } = await postWorkHooks(userId, result);

  return { ...result, newlyUnlocked, missionsCompleted };
}
