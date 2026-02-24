import { prisma } from '../../client.js';
import { findOrCreateUser } from '../../repositories/user.repository.js';
import {
  type ShiftType,
  type WorkEvent,
  JOB_MAP,
  SHIFT_MAP,
  LEVEL_THRESHOLDS,
  type JobDefinition,
} from '../../../config/jobs.js';
import {
  WORK_STREAK_WINDOW_MS,
} from '../../../config/constants.js';
import { configService } from '../../../config/config.service.js';
import { S } from '../../../config/setting-defs.js';
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
} from '../../../games/work/work.engine.js';
import type { AchievementDefinition } from '../../../config/achievements.js';
import type { CompletedMission } from '../mission.service.js';
import {
  isOnCooldown,
  getRemainingCooldown,
  setCooldown,
  buildCooldownKey,
} from '../../../utils/cooldown.js';
import { hasActiveBuff, hasInventoryItem } from '../shop.service.js';
import { SHOP_EFFECTS } from '../../../config/shop.js';
import { getMasteryTier, getMasteryLevelForShifts, type MasteryTier } from '../../../config/work-mastery.js';
import { getMastery, incrementShifts, updateMasteryLevel } from '../../repositories/work-mastery.repository.js';
import { PROMOTED_JOB_MAP, type PromotedJobDefinition } from '../../../config/promoted-jobs.js';
import { SPECIAL_SHIFTS, type SpecialShiftDefinition, isVipEventUsedToday, markVipEventUsed } from '../../../config/special-shifts.js';
import { getWorkSession, setWorkSession, removeWorkSession, type PendingWorkSession } from '../../../games/work/work.session.js';
import { getScenarioForJob, type WorkScenario } from '../../../config/work-events.js';
import { secureRandomInt } from '../../../utils/random.js';
import { WORK_TOOL_IDS, getToolBonusesForJob } from '../../../config/work-tools.js';
import { postWorkHooks } from './work-hooks.service.js';

function getCooldownMs(type: ShiftType): number {
  const map: Record<ShiftType, () => number> = {
    short: () => configService.getNumber(S.workShortCD),
    normal: () => configService.getNumber(S.workNormalCD),
    long: () => configService.getNumber(S.workLongCD),
  };
  return map[type]();
}

const SPECIAL_SHIFT_CD_MAP: Record<string, () => number> = {
  work_emergency: () => configService.getNumber(S.workEmergencyCD),
};

function getEffectiveCooldownMs(shiftType: ShiftType, specialShift?: SpecialShiftDefinition): number {
  if (specialShift?.cooldownKey) {
    const resolver = SPECIAL_SHIFT_CD_MAP[specialShift.cooldownKey];
    if (resolver) return resolver();
    if (specialShift.cooldownMs) return specialShift.cooldownMs;
  }
  return getCooldownMs(shiftType);
}

export interface WorkResult {
  success: boolean;
  error?: string;
  remainingCooldown?: number;
  // Multi-step pending
  multiStepPending?: boolean;
  scenario?: WorkScenario;
  // Success data
  jobId?: string;
  jobName?: string;
  jobEmoji?: string;
  isPromoted?: boolean;
  shiftType?: ShiftType;
  shiftLabel?: string;
  specialShiftType?: string;
  specialShiftName?: string;
  event?: WorkEvent;
  flavorText?: string;
  basePay?: bigint;
  shiftPay?: bigint;
  tipAmount?: bigint;
  streakBonus?: number;
  bonusAmount?: bigint;
  masteryBonus?: bigint;
  toolBonus?: bigint;
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
  // Mastery info
  masteryTier?: MasteryTier;
  masteryShiftsCompleted?: number;
  masteryLeveledUp?: boolean;
  oldMasteryLevel?: number;
  newMasteryLevel?: number;
  // Overtime
  overtimeAvailable?: boolean;
}

export async function getToolBonuses(userId: string, jobId: string): Promise<Partial<WorkBonuses>> {
  try {
    const tools = await prisma.userInventory.findMany({
      where: { userId, itemId: { in: WORK_TOOL_IDS }, quantity: { gt: 0 } },
    });
    const ownedIds = new Set(tools.map(t => t.itemId));
    return getToolBonusesForJob(jobId, ownedIds);
  } catch {
    return {};
  }
}

export async function performWork(
  userId: string,
  jobId: string,
  shiftType: ShiftType,
  specialShiftType?: string,
): Promise<WorkResult> {
  // Resolve job (base or promoted)
  const job: JobDefinition | PromotedJobDefinition | undefined =
    JOB_MAP.get(jobId) ?? PROMOTED_JOB_MAP.get(jobId);
  if (!job) return { success: false, error: '無効な職種です。' };

  const shift = SHIFT_MAP.get(shiftType);
  if (!shift) return { success: false, error: '無効なシフトです。' };

  // Special shift validation
  let specialShift: SpecialShiftDefinition | undefined;
  if (specialShiftType) {
    specialShift = SPECIAL_SHIFTS.find(s => s.type === specialShiftType);
    if (!specialShift) return { success: false, error: '無効な特別シフトです。' };
    if (specialShift.type === 'vip_event' && isVipEventUsedToday(userId)) {
      return { success: false, error: 'VIPイベントは1日1回のみです。' };
    }
  }

  // Determine effective cooldown key — special shifts with own cooldownKey are independent
  const cooldownKey = specialShift?.cooldownKey
    ? buildCooldownKey(userId, specialShift.cooldownKey)
    : buildCooldownKey(userId, shift.cooldownKey);
  if (isOnCooldown(cooldownKey)) {
    return {
      success: false,
      remainingCooldown: getRemainingCooldown(cooldownKey),
    };
  }

  await findOrCreateUser(userId);

  // Get mastery data
  const masteryData = await getMastery(userId, jobId);
  const masteryLevel = masteryData?.masteryLevel ?? 0;
  const masteryTier = getMasteryTier(masteryLevel);

  // Get tool bonuses
  const toolBonuses = await getToolBonuses(userId, jobId);

  const bonuses: WorkBonuses = {
    mastery: masteryTier,
    toolPayBonus: toolBonuses.toolPayBonus,
    toolGreatSuccessBonus: toolBonuses.toolGreatSuccessBonus,
    toolRiskReduction: toolBonuses.toolRiskReduction,
    toolXpBonus: toolBonuses.toolXpBonus,
  };

  // Roll event and calculate payout
  const event = rollWorkEvent(job, bonuses);
  const basePay = rollBasePay(job);
  const flavorText = getEventFlavor(jobId, event.type);
  const tipAmount = event.type === 'tip' ? rollTipAmount() : 0n;

  // Check for multi-step event (25% chance, only on non-accident/trouble)
  if (
    event.type !== 'accident' && event.type !== 'trouble' &&
    secureRandomInt(1, 100) <= configService.getNumber(S.multiStepChance)
  ) {
    const baseJobId = 'baseJobId' in job ? (job as PromotedJobDefinition).baseJobId : jobId;
    const scenario = getScenarioForJob(baseJobId);
    if (scenario) {
      // Store session for later resolution
      const session: PendingWorkSession = {
        userId,
        jobId,
        shiftType,
        basePay,
        event,
        bonuses,
        scenario,
        specialShiftType,
        createdAt: Date.now(),
      };
      setWorkSession(userId, session);
      setCooldown(cooldownKey, getEffectiveCooldownMs(shiftType, specialShift));

      return {
        success: true,
        multiStepPending: true,
        scenario,
        jobId,
        jobName: job.name,
        jobEmoji: job.emoji,
        isPromoted: 'isPromoted' in job,
        shiftType,
        shiftLabel: shift.label,
        specialShiftType,
      };
    }
  }

  // Apply special shift multipliers
  let payMultiplier = 1.0;
  let xpMultiplier = 1.0;
  if (specialShift) {
    payMultiplier = specialShift.payMultiplier;
    xpMultiplier = specialShift.xpMultiplier;
  }

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
    const { totalPay, shiftPay, bonusAmount, masteryBonus, toolBonus } = calculateWorkPayout(basePay, shift, event, streakBonus, bonuses);

    // Apply special shift pay multiplier
    let finalPay = BigInt(Math.round(Number(totalPay) * payMultiplier)) + tipAmount;

    // WORK_PAY_BOOST buff: +25% work pay
    try {
      if (await hasActiveBuff(userId, 'WORK_PAY_BOOST')) {
        finalPay = BigInt(Math.round(Number(finalPay) * (1 + SHOP_EFFECTS.WORK_PAY_BOOST_PERCENT / 100)));
      }
    } catch {
      // Buff check should never block work
    }

    // Worker Collection bonus: +5% work pay
    try {
      if (await hasInventoryItem(userId, 'COLLECTION_REWARD_WORKER')) {
        finalPay = BigInt(Math.round(Number(finalPay) * (1 + SHOP_EFFECTS.COLLECTION_WORKER_PERCENT / 100)));
      }
    } catch {
      // Collection check should never block work
    }

    // MASTER_TOOL: +10% all job pay
    try {
      if (await hasInventoryItem(userId, 'MASTER_TOOL')) {
        finalPay = BigInt(Math.round(Number(finalPay) * (1 + SHOP_EFFECTS.MASTER_TOOL_PERCENT / 100)));
      }
    } catch {
      // Tool check should never block work
    }

    // XP always granted (even on accident)
    let xpGained = calculateXpGain(job, shift, bonuses);
    xpGained = Math.round(xpGained * xpMultiplier);

    // Mega XP Booster buff: +100% XP (takes priority over XP Booster)
    // XP Booster buff: +50% XP
    try {
      if (await hasActiveBuff(userId, 'MEGA_XP_BOOSTER')) {
        xpGained = Math.round(xpGained * SHOP_EFFECTS.MEGA_XP_BOOSTER_MULTIPLIER);
      } else if (await hasActiveBuff(userId, 'XP_BOOSTER')) {
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
            specialShiftType: specialShiftType ?? null,
          },
        },
      });
    }

    // Increment mastery shifts
    const updatedMastery = await incrementShifts(userId, jobId, tx);
    const newMasteryLevel = getMasteryLevelForShifts(updatedMastery.shiftsCompleted);
    let masteryLeveledUp = false;
    let oldMasteryLevel = updatedMastery.masteryLevel;
    if (newMasteryLevel > updatedMastery.masteryLevel) {
      await updateMasteryLevel(userId, jobId, newMasteryLevel, tx);
      masteryLeveledUp = true;
      oldMasteryLevel = updatedMastery.masteryLevel;
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
      isPromoted: 'isPromoted' in job,
      shiftType,
      shiftLabel: shift.label,
      specialShiftType,
      specialShiftName: specialShift?.name,
      event,
      flavorText,
      basePay,
      shiftPay,
      tipAmount,
      streakBonus,
      bonusAmount,
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

  // Set cooldown after successful work
  setCooldown(cooldownKey, getEffectiveCooldownMs(shiftType, specialShift));

  // Mark VIP event used
  if (specialShift?.type === 'vip_event') {
    markVipEventUsed(userId);
  }

  // Achievement checks + mission progress
  const { newlyUnlocked, missionsCompleted } = await postWorkHooks(userId, result);

  // Overtime availability: only if the shift wasn't an accident or trouble
  const overtimeAvailable = result.event?.type !== 'accident' && result.event?.type !== 'trouble';

  return { ...result, newlyUnlocked, missionsCompleted, overtimeAvailable };
}

export async function resolveMultiStepWork(
  userId: string,
  choiceId: string,
): Promise<WorkResult> {
  const session = getWorkSession(userId);
  if (!session) return { success: false, error: 'セッションが見つかりません。' };

  const choice = session.scenario.choices.find(c => c.id === choiceId);
  if (!choice) return { success: false, error: '無効な選択肢です。' };

  removeWorkSession(userId);

  const { jobId, shiftType, basePay, event, bonuses, specialShiftType } = session;

  const job: JobDefinition | PromotedJobDefinition | undefined =
    JOB_MAP.get(jobId) ?? PROMOTED_JOB_MAP.get(jobId);
  if (!job) return { success: false, error: '無効な職種です。' };

  const shift = SHIFT_MAP.get(shiftType);
  if (!shift) return { success: false, error: '無効なシフトです。' };

  // Special shift
  let specialShift: SpecialShiftDefinition | undefined;
  if (specialShiftType) {
    specialShift = SPECIAL_SHIFTS.find(s => s.type === specialShiftType);
  }
  const payMultiplier = specialShift?.payMultiplier ?? 1.0;
  const xpMultiplier = specialShift?.xpMultiplier ?? 1.0;

  // Apply choice modifier to event
  const modifiedEvent: WorkEvent = {
    ...event,
    payMultiplier: event.payMultiplier * choice.multiplierModifier,
  };

  const tipAmount = event.type === 'tip' ? rollTipAmount() : 0n;

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

    // Streak
    let newStreak: number;
    if (user.lastWorkAt && (Date.now() - user.lastWorkAt.getTime()) <= WORK_STREAK_WINDOW_MS) {
      newStreak = user.workStreak + 1;
    } else {
      newStreak = 1;
    }

    const streakBonus = getStreakBonus(newStreak);
    const { totalPay, shiftPay, bonusAmount, masteryBonus, toolBonus } = calculateWorkPayout(basePay, shift, modifiedEvent, streakBonus, bonuses);

    let finalPay = BigInt(Math.round(Number(totalPay) * payMultiplier)) + tipAmount;

    // WORK_PAY_BOOST buff: +25% work pay
    try {
      if (await hasActiveBuff(userId, 'WORK_PAY_BOOST')) {
        finalPay = BigInt(Math.round(Number(finalPay) * (1 + SHOP_EFFECTS.WORK_PAY_BOOST_PERCENT / 100)));
      }
    } catch { /* ignore */ }

    // Worker Collection bonus: +5% work pay
    try {
      if (await hasInventoryItem(userId, 'COLLECTION_REWARD_WORKER')) {
        finalPay = BigInt(Math.round(Number(finalPay) * (1 + SHOP_EFFECTS.COLLECTION_WORKER_PERCENT / 100)));
      }
    } catch { /* ignore */ }

    // MASTER_TOOL: +10% all job pay
    try {
      if (await hasInventoryItem(userId, 'MASTER_TOOL')) {
        finalPay = BigInt(Math.round(Number(finalPay) * (1 + SHOP_EFFECTS.MASTER_TOOL_PERCENT / 100)));
      }
    } catch { /* ignore */ }

    let xpGained = calculateXpGain(job, shift, bonuses);
    xpGained = Math.round(xpGained * xpMultiplier);

    // Mega XP Booster buff: +100% XP (takes priority over XP Booster)
    // XP Booster buff: +50% XP
    try {
      if (await hasActiveBuff(userId, 'MEGA_XP_BOOSTER')) {
        xpGained = Math.round(xpGained * SHOP_EFFECTS.MEGA_XP_BOOSTER_MULTIPLIER);
      } else if (await hasActiveBuff(userId, 'XP_BOOSTER')) {
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
            basePay: basePay.toString(),
            tipAmount: tipAmount.toString(),
            choiceId,
            scenarioId: session.scenario.id,
            specialShiftType: specialShiftType ?? null,
          },
        },
      });
    }

    // Mastery
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
      specialShiftType,
      specialShiftName: specialShift?.name,
      event: modifiedEvent,
      flavorText: choice.flavorText,
      basePay,
      shiftPay,
      tipAmount,
      streakBonus,
      bonusAmount,
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

  const { newlyUnlocked, missionsCompleted } = await postWorkHooks(userId, result);

  const overtimeAvailable = result.event?.type !== 'accident' && result.event?.type !== 'trouble';

  return { ...result, newlyUnlocked, missionsCompleted, overtimeAvailable };
}
