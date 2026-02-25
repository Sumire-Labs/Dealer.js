import {prisma} from '../client.js';
import {findOrCreateUser} from '../repositories/user.repository.js';
import {JOB_MAP, type JobDefinition, LEVEL_THRESHOLDS, SHIFT_MAP, type ShiftType,} from '../../config/jobs.js';
import {WORK_STREAK_WINDOW_MS,} from '../../config/constants.js';
import {configService} from '../../config/config.service.js';
import {S} from '../../config/setting-defs.js';
import {
  calculateWorkPayout,
  calculateXpGain,
  getEventFlavor,
  getLevelForXp,
  getStreakBonus,
  rollBasePay,
  rollTipAmount,
  rollWorkEvent,
  type WorkBonuses,
} from '../../games/work/work.engine.js';
import {buildCooldownKey, getRemainingCooldown, isOnCooldown, setCooldown,} from '../../utils/cooldown.js';
import {hasActiveBuff, hasInventoryItem} from './shop.service.js';
import {SHOP_EFFECTS} from '../../config/shop.js';
import {getMasteryLevelForShifts, getMasteryTier} from '../../config/work-mastery.js';
import {getMastery, incrementShifts, updateMasteryLevel} from '../repositories/work-mastery.repository.js';
import {PROMOTED_JOB_MAP, type PromotedJobDefinition} from '../../config/promoted-jobs.js';
import {getToolBonuses, postWorkHooks, type WorkResult} from './work.service.js';

function getTeamCooldownMs(type: ShiftType): number {
    const map: Record<ShiftType, () => number> = {
        short: () => configService.getNumber(S.teamShortCD),
        normal: () => configService.getNumber(S.teamNormalCD),
        long: () => configService.getNumber(S.teamLongCD),
    };
    return map[type]();
}

function buildTeamCooldownKey(userId: string, shiftType: ShiftType): string {
    return buildCooldownKey(userId, `team_work_${shiftType}`);
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
    if (!job) return {success: false, error: '無効な職種です。'};

    const shift = SHIFT_MAP.get(shiftType);
    if (!shift) return {success: false, error: '無効なシフトです。'};

    // Cooldown check (team shifts have separate cooldowns from solo)
    const cooldownKey = buildTeamCooldownKey(userId, shiftType);
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
        const user = await tx.user.findUniqueOrThrow({where: {id: userId}});

        if (user.workLevel < job.requiredLevel) {
            return {success: false as const, error: `この職種にはレベル${job.requiredLevel}が必要です。`};
        }

        let newStreak: number;
        if (user.lastWorkAt && (Date.now() - user.lastWorkAt.getTime()) <= WORK_STREAK_WINDOW_MS) {
            newStreak = user.workStreak + 1;
        } else {
            newStreak = 1;
        }

        const streakBonus = getStreakBonus(newStreak);
        const {totalPay, shiftPay, bonusAmount, masteryBonus, toolBonus} =
            calculateWorkPayout(basePay, shift, event, streakBonus, bonuses);

        // Apply team bonus
        const teamBonus = (totalPay * BigInt(teamBonusPercent)) / 100n;
        let finalPay = totalPay + teamBonus + tipAmount;

        // WORK_PAY_BOOST buff: +25% work pay
        try {
            if (await hasActiveBuff(userId, 'WORK_PAY_BOOST')) {
                finalPay = BigInt(Math.round(Number(finalPay) * (1 + SHOP_EFFECTS.WORK_PAY_BOOST_PERCENT / 100)));
            }
        } catch { /* ignore */
        }

        // Worker Collection bonus: +5% work pay
        try {
            if (await hasInventoryItem(userId, 'COLLECTION_REWARD_WORKER')) {
                finalPay = BigInt(Math.round(Number(finalPay) * (1 + SHOP_EFFECTS.COLLECTION_WORKER_PERCENT / 100)));
            }
        } catch { /* ignore */
        }

        // MASTER_TOOL: +10% all job pay
        try {
            if (await hasInventoryItem(userId, 'MASTER_TOOL')) {
                finalPay = BigInt(Math.round(Number(finalPay) * (1 + SHOP_EFFECTS.MASTER_TOOL_PERCENT / 100)));
            }
        } catch { /* ignore */
        }

        let xpGained = calculateXpGain(job, shift, bonuses);
        // Mega XP Booster buff: +100% XP (priority over XP Booster)
        try {
            if (await hasActiveBuff(userId, 'MEGA_XP_BOOSTER')) {
                xpGained = Math.round(xpGained * SHOP_EFFECTS.MEGA_XP_BOOSTER_MULTIPLIER);
            } else if (await hasActiveBuff(userId, 'XP_BOOSTER')) {
                xpGained = Math.round(xpGained * SHOP_EFFECTS.XP_BOOSTER_MULTIPLIER);
            }
        } catch { /* ignore */
        }

        const oldXp = user.workXp;
        const newXp = oldXp + xpGained;
        const oldLevel = user.workLevel;
        const newLevel = getLevelForXp(newXp);

        const updated = await tx.user.update({
            where: {id: userId},
            data: {
                chips: {increment: finalPay},
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

    setCooldown(cooldownKey, getTeamCooldownMs(shiftType));

    const {newlyUnlocked, missionsCompleted} = await postWorkHooks(userId, result);

    return {...result, newlyUnlocked, missionsCompleted};
}
