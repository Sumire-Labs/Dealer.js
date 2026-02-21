import {
  type JobDefinition,
  type ShiftDefinition,
  type WorkEventType,
  type WorkEvent,
  EVENT_MAP,
  EVENT_FLAVORS,
  LEVEL_THRESHOLDS,
  JOBS,
} from '../../config/jobs.js';
import { WORK_TIP_MIN, WORK_TIP_MAX, WORK_STREAK_MAX_BONUS } from '../../config/constants.js';
import { secureRandomInt } from '../../utils/random.js';
import { weightedRandom } from '../../utils/random.js';

/**
 * Roll a random work event based on the job's risk rate.
 * Risk rate adjusts trouble+accident combined probability.
 */
export function rollWorkEvent(job: JobDefinition): WorkEvent {
  const riskRate = job.riskRate;

  // Distribute risk: ~75% trouble, ~25% accident
  const accidentRate = Math.round(riskRate * 0.3);
  const troubleRate = riskRate - accidentRate;

  // Remaining pool (100 - risk) split among great_success, success, tip
  const remaining = 100 - riskRate;
  // great_success scales slightly with risk (higher risk = higher reward potential)
  const greatSuccessRate = Math.round(10 + riskRate * 0.25);
  const tipRate = 15;
  const successRate = remaining - greatSuccessRate - tipRate;

  const items: { value: WorkEventType; weight: number }[] = [
    { value: 'great_success', weight: greatSuccessRate },
    { value: 'success', weight: Math.max(successRate, 1) },
    { value: 'tip', weight: tipRate },
    { value: 'trouble', weight: troubleRate },
    { value: 'accident', weight: accidentRate },
  ];

  const eventType = weightedRandom(items);
  return EVENT_MAP.get(eventType)!;
}

/**
 * Get a random flavor text for a job+event combo.
 */
export function getEventFlavor(jobId: string, eventType: WorkEventType): string {
  const jobFlavors = EVENT_FLAVORS[jobId];
  if (!jobFlavors) return '';
  const texts = jobFlavors[eventType];
  if (!texts || texts.length === 0) return '';
  return texts[secureRandomInt(0, texts.length - 1)];
}

/**
 * Calculate the base pay for a job (random within range).
 */
export function rollBasePay(job: JobDefinition): bigint {
  const min = Number(job.basePay.min);
  const max = Number(job.basePay.max);
  return BigInt(secureRandomInt(min, max));
}

/**
 * Calculate tip amount for 'tip' events.
 */
export function rollTipAmount(): bigint {
  const min = Number(WORK_TIP_MIN);
  const max = Number(WORK_TIP_MAX);
  return BigInt(secureRandomInt(min, max));
}

/**
 * Calculate streak bonus percentage (0-20).
 */
export function getStreakBonus(streak: number): number {
  if (streak <= 1) return 0;
  const bonus = (streak - 1) * 5;
  return Math.min(bonus, WORK_STREAK_MAX_BONUS);
}

/**
 * Full payout calculation.
 */
export function calculateWorkPayout(
  basePay: bigint,
  shift: ShiftDefinition,
  event: WorkEvent,
  streakBonus: number,
): { totalPay: bigint; shiftPay: bigint; bonusAmount: bigint } {
  // base × shift multiplier
  const shiftPayNum = Math.round(Number(basePay) * shift.payMultiplier);
  const shiftPay = BigInt(shiftPayNum);

  // apply event multiplier
  const afterEvent = BigInt(Math.round(Number(shiftPay) * event.payMultiplier));

  // apply streak bonus
  const bonusAmount = (afterEvent * BigInt(streakBonus)) / 100n;
  const totalPay = afterEvent + bonusAmount;

  return { totalPay, shiftPay: afterEvent, bonusAmount };
}

/**
 * Calculate XP gain for a shift.
 */
export function calculateXpGain(job: JobDefinition, shift: ShiftDefinition): number {
  return Math.round(job.xpPerShift * shift.xpMultiplier);
}

/**
 * Determine the level for a given XP total.
 */
export function getLevelForXp(xp: number): number {
  let level = 0;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      level = i;
      break;
    }
  }
  return level;
}

/**
 * Get XP needed for next level. Returns null at max level.
 */
export function getXpForNextLevel(currentLevel: number): number | null {
  if (currentLevel >= LEVEL_THRESHOLDS.length - 1) return null;
  return LEVEL_THRESHOLDS[currentLevel + 1];
}

/**
 * Get all jobs available at a given level.
 */
export function getAvailableJobs(level: number): JobDefinition[] {
  return JOBS.filter(j => j.requiredLevel <= level);
}
