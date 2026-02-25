import {
  EVENT_FLAVORS,
  EVENT_MAP,
  type JobDefinition,
  JOBS,
  LEVEL_THRESHOLDS,
  type ShiftDefinition,
  type WorkEvent,
  type WorkEventType,
} from '../../config/jobs.js';
import {OVERTIME_MULTIPLIERS,} from '../../config/constants.js';
import {configService} from '../../config/config.service.js';
import {S} from '../../config/setting-defs.js';
import {secureRandomInt, weightedRandom} from '../../utils/random.js';
import type {MasteryTier} from '../../config/work-mastery.js';
import type {PromotedJobDefinition} from '../../config/promoted-jobs.js';

export interface WorkBonuses {
    mastery?: MasteryTier;
    toolPayBonus?: number;        // +% to payout
    toolGreatSuccessBonus?: number; // +% to great success rate
    toolRiskReduction?: number;    // -% from risk
    toolXpBonus?: number;          // +% to XP
}

/**
 * Roll a random work event based on the job's risk rate.
 * Mastery and tool bonuses adjust great_success and trouble/accident rates.
 */
export function rollWorkEvent(job: JobDefinition, bonuses?: WorkBonuses): WorkEvent {
    const masteryGreatBonus = bonuses?.mastery?.greatSuccessBonus ?? 0;
    const masteryRiskReduction = bonuses?.mastery?.accidentReduction ?? 0;
    const toolGreatBonus = bonuses?.toolGreatSuccessBonus ?? 0;
    const toolRiskReduction = bonuses?.toolRiskReduction ?? 0;

    const totalGreatBonus = masteryGreatBonus + toolGreatBonus;
    const totalRiskReduction = masteryRiskReduction + toolRiskReduction;

    const riskRate = Math.max(job.riskRate - totalRiskReduction, 0);

    // Distribute risk: ~75% trouble, ~25% accident
    const accidentRate = Math.round(riskRate * 0.3);
    const troubleRate = riskRate - accidentRate;

    // Remaining pool (100 - risk) split among great_success, success, tip
    const remaining = 100 - riskRate;
    // great_success scales slightly with risk (higher risk = higher reward potential)
    const greatSuccessRate = Math.round(10 + job.riskRate * 0.25) + totalGreatBonus;
    const tipRate = 15;
    const successRate = remaining - greatSuccessRate - tipRate;

    const items: { value: WorkEventType; weight: number }[] = [
        {value: 'great_success', weight: Math.max(greatSuccessRate, 1)},
        {value: 'success', weight: Math.max(successRate, 1)},
        {value: 'tip', weight: tipRate},
        {value: 'trouble', weight: Math.max(troubleRate, 0)},
        {value: 'accident', weight: Math.max(accidentRate, 0)},
    ];

    // Filter out zero-weight items
    const filtered = items.filter(i => i.weight > 0);

    const eventType = weightedRandom(filtered);
    return EVENT_MAP.get(eventType)!;
}

/**
 * Get a random flavor text for a job+event combo.
 */
export function getEventFlavor(jobId: string, eventType: WorkEventType): string {
    // For promoted jobs, use the base job's flavor text
    const baseJobId = jobId.replace(/_pro$/, '');
    const jobFlavors = EVENT_FLAVORS[baseJobId];
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
    const min = Number(configService.getBigInt(S.tipMin));
    const max = Number(configService.getBigInt(S.tipMax));
    return BigInt(secureRandomInt(min, max));
}

/**
 * Calculate streak bonus percentage (0-20).
 */
export function getStreakBonus(streak: number): number {
    if (streak <= 1) return 0;
    const bonus = (streak - 1) * 5;
    return Math.min(bonus, configService.getNumber(S.streakMaxBonus));
}

/**
 * Full payout calculation with mastery and tool bonuses.
 */
export function calculateWorkPayout(
    basePay: bigint,
    shift: ShiftDefinition,
    event: WorkEvent,
    streakBonus: number,
    bonuses?: WorkBonuses,
): { totalPay: bigint; shiftPay: bigint; bonusAmount: bigint; masteryBonus: bigint; toolBonus: bigint } {
    // base × shift multiplier
    const shiftPayNum = Math.round(Number(basePay) * shift.payMultiplier);
    const shiftPay = BigInt(shiftPayNum);

    // apply event multiplier
    const afterEvent = BigInt(Math.round(Number(shiftPay) * event.payMultiplier));

    // apply mastery pay bonus
    const masteryPayPercent = bonuses?.mastery?.payBonus ?? 0;
    const masteryBonus = (afterEvent * BigInt(masteryPayPercent)) / 100n;

    // apply tool pay bonus
    const toolPayPercent = bonuses?.toolPayBonus ?? 0;
    const toolBonus = (afterEvent * BigInt(toolPayPercent)) / 100n;

    const afterBonuses = afterEvent + masteryBonus + toolBonus;

    // apply streak bonus
    const bonusAmount = (afterBonuses * BigInt(streakBonus)) / 100n;
    const totalPay = afterBonuses + bonusAmount;

    return {totalPay, shiftPay: afterEvent, bonusAmount, masteryBonus, toolBonus};
}

/**
 * Calculate XP gain for a shift with optional tool bonus.
 */
export function calculateXpGain(job: JobDefinition, shift: ShiftDefinition, bonuses?: WorkBonuses): number {
    let xp = Math.round(job.xpPerShift * shift.xpMultiplier);
    const toolXpPercent = bonuses?.toolXpBonus ?? 0;
    if (toolXpPercent > 0) {
        xp = Math.round(xp * (1 + toolXpPercent / 100));
    }
    return xp;
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
 * Get all jobs available at a given level, including promoted jobs.
 */
export function getAvailableJobs(
    level: number,
    promotedJobs?: PromotedJobDefinition[],
): (JobDefinition | PromotedJobDefinition)[] {
    const baseJobs = JOBS.filter(j => j.requiredLevel <= level);

    if (!promotedJobs || level < 5) return baseJobs;

    return [...baseJobs, ...promotedJobs];
}

/**
 * Roll an overtime event. Risk increases each round.
 * Returns a WorkEvent — accident means overtime failure.
 */
export function rollOvertimeEvent(baseRiskRate: number, round: number, bonuses?: WorkBonuses): WorkEvent {
    const totalRiskReduction = (bonuses?.mastery?.accidentReduction ?? 0) + (bonuses?.toolRiskReduction ?? 0);
    const adjustedBase = Math.max(baseRiskRate - totalRiskReduction, 0);
    const riskRate = Math.min(adjustedBase + (round + 1) * configService.getNumber(S.overtimeRisk), 95);

    const roll = secureRandomInt(1, 100);
    if (roll <= riskRate) {
        return EVENT_MAP.get('accident')!;
    }
    return EVENT_MAP.get('success')!;
}

/**
 * Calculate overtime bonus for a given round.
 * Returns the bonus amount (multiplier difference × baseShiftPay).
 */
export function calculateOvertimePay(baseShiftPay: bigint, round: number): bigint {
    const multiplier = OVERTIME_MULTIPLIERS[round] ?? 1;
    const bonus = BigInt(Math.round(Number(baseShiftPay) * (multiplier - 1)));
    return bonus > 0n ? bonus : 0n;
}
