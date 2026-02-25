import {prisma} from '../client.js';
import type {WorkWeeklyChallenge} from '@prisma/client';
import {createChallenge, getChallengesForWeek, updateProgress,} from '../repositories/weekly-challenge.repository.js';
import {WEEKLY_CHALLENGE_MAP, WEEKLY_CHALLENGE_POOL,} from '../../config/weekly-challenges.js';
import {WEEKLY_CHALLENGE_COUNT} from '../../config/constants.js';
import {configService} from '../../config/config.service.js';
import {S} from '../../config/setting-defs.js';
import {shuffleArray} from '../../utils/random.js';
import type {ShiftType, WorkEventType} from '../../config/jobs.js';
import {logger} from '../../utils/logger.js';

export interface WorkEventInfo {
  jobId: string;
  shiftType: ShiftType;
  eventType: WorkEventType;
  totalPay: bigint;
  isSpecialShift: boolean;
  masteryLeveledUp?: boolean;
}

/**
 * Get the ISO week string for a given date (e.g. "2026-W08").
 */
export function getISOWeekString(date?: Date): string {
  const d = date ?? new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((d.getTime() - jan1.getTime()) / 86_400_000) + 1;
  const weekNumber = Math.ceil((dayOfYear + jan1.getDay()) / 7);
  return `${d.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

/**
 * Assign weekly challenges for a user if not already assigned this week.
 */
export async function assignWeeklyChallenges(userId: string): Promise<WorkWeeklyChallenge[]> {
  const weekStart = getISOWeekString();
  const existing = await getChallengesForWeek(userId, weekStart);
  if (existing.length > 0) return existing;

  // Pick random challenges
  const shuffled = shuffleArray([...WEEKLY_CHALLENGE_POOL]);
  const selected = shuffled.slice(0, WEEKLY_CHALLENGE_COUNT);

  const created: WorkWeeklyChallenge[] = [];
  for (const def of selected) {
    const challenge = await createChallenge({
      userId,
      weekStart,
      challengeKey: def.key,
      target: def.target,
      reward: def.reward,
    });
    created.push(challenge);
  }

  return created;
}

/**
 * Get weekly challenges for a user (auto-assigns if needed).
 */
export async function getWeeklyChallenges(userId: string): Promise<WorkWeeklyChallenge[]> {
  const weekStart = getISOWeekString();
  const existing = await getChallengesForWeek(userId, weekStart);
  if (existing.length > 0) return existing;
  return assignWeeklyChallenges(userId);
}

/**
 * Update weekly challenge progress after a work shift.
 * Tracks: jobs worked, long shifts, trouble streaks, great successes, earnings, total shifts, mastery.
 */
export async function updateWeeklyChallengeProgress(
  userId: string,
  event: WorkEventInfo,
): Promise<void> {
  try {
    const challenges = await getWeeklyChallenges(userId);
    const incomplete = challenges.filter(c => !c.completed);
    if (incomplete.length === 0) return;

    for (const challenge of incomplete) {
      const def = WEEKLY_CHALLENGE_MAP.get(challenge.challengeKey);
      if (!def) continue;

      let newProgress = challenge.progress;

      switch (def.type) {
        case 'work_count':
          newProgress = challenge.progress + 1;
          break;

        case 'long_shifts':
          if (event.shiftType === 'long') {
            newProgress = challenge.progress + 1;
          }
          break;

        case 'great_success_count':
          if (event.eventType === 'great_success') {
            newProgress = challenge.progress + 1;
          }
          break;

        case 'earn_total':
          newProgress = challenge.progress + Number(event.totalPay);
          break;

        case 'no_trouble_streak':
          if (event.eventType === 'trouble' || event.eventType === 'accident') {
            // Reset streak
            newProgress = 0;
          } else {
            newProgress = challenge.progress + 1;
          }
          break;

        case 'work_all_jobs': {
          // Track unique jobs — store as bitmask in progress wouldn't work well,
          // so we query recent work transactions this week for distinct jobs
          const weekStart = getISOWeekString();
          const startOfWeek = getWeekStartDate(weekStart);
          const distinctJobs = await prisma.transaction.findMany({
            where: {
              userId,
              type: 'WORK_EARN',
              createdAt: { gte: startOfWeek },
            },
            select: { metadata: true },
            distinct: ['metadata'],
          });
          const jobIds = new Set<string>();
          for (const t of distinctJobs) {
            const meta = t.metadata as { jobId?: string } | null;
            if (meta?.jobId) {
              // Strip _pro suffix for promoted jobs
              jobIds.add(meta.jobId.replace(/_pro$/, ''));
            }
          }
          newProgress = jobIds.size;
          break;
        }

        case 'mastery_progress':
          if (event.masteryLeveledUp) {
            newProgress = challenge.progress + 1;
          }
          break;
      }

      if (newProgress !== challenge.progress) {
        const completed = newProgress >= challenge.target;
        await updateProgress(challenge.id, Math.min(newProgress, challenge.target), completed);

        // If completed, grant reward
        if (completed && !challenge.completed) {
          await prisma.user.update({
            where: { id: userId },
            data: { chips: { increment: challenge.reward } },
          });
          await prisma.transaction.create({
            data: {
              userId,
              type: 'WEEKLY_CHALLENGE_REWARD',
              amount: challenge.reward,
              balanceAfter: (await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { chips: true } })).chips,
              metadata: { challengeKey: challenge.challengeKey },
            },
          });

          // Check if all completed for bonus
          const allChallenges = await getWeeklyChallenges(userId);
          if (allChallenges.every(c => c.completed || c.id === challenge.id)) {
            const weeklyAllBonus = configService.getBigInt(S.weeklyAllBonus);
            await prisma.user.update({
              where: { id: userId },
              data: { chips: { increment: weeklyAllBonus } },
            });
            await prisma.transaction.create({
              data: {
                userId,
                type: 'WEEKLY_CHALLENGE_REWARD',
                amount: weeklyAllBonus,
                balanceAfter: (await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { chips: true } })).chips,
                metadata: { allCompleted: true },
              },
            });
          }
        }
      }
    }
  } catch (err) {
    logger.error('Weekly challenge progress update failed', { error: String(err), userId });
  }
}

function getWeekStartDate(weekString: string): Date {
  // Parse "2026-W08" → Monday of that week
  const [yearStr, weekStr] = weekString.split('-W');
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekStr, 10);

  // Jan 1 of the year
  const jan1 = new Date(year, 0, 1);
  // Day of week (0=Sun, 1=Mon, ...)
  const dow = jan1.getDay();
  // Offset to first Monday
  const mondayOffset = dow <= 1 ? 1 - dow : 8 - dow;
  const firstMonday = new Date(year, 0, 1 + mondayOffset);

  // Add weeks
  const targetDate = new Date(firstMonday.getTime() + (week - 1) * 7 * 86_400_000);
  targetDate.setHours(0, 0, 0, 0);
  return targetDate;
}
