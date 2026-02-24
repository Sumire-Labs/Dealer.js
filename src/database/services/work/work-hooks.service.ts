import { checkAchievements } from '../achievement.service.js';
import type { AchievementDefinition } from '../../../config/achievements.js';
import { updateMissionProgress, type CompletedMission } from '../mission.service.js';
import type { WorkResult } from './perform-work.service.js';

export async function postWorkHooks(
  userId: string,
  result: WorkResult,
): Promise<{ newlyUnlocked: AchievementDefinition[]; missionsCompleted: CompletedMission[] }> {
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
        masteryLeveledUp: result.masteryLeveledUp,
        newMasteryLevel: result.newMasteryLevel,
        jobId: result.jobId,
        isPromoted: result.isPromoted,
      },
    });
    const economyAchievements = await checkAchievements({
      userId,
      context: 'economy_change',
      newBalance: result.newBalance,
    });
    newlyUnlocked = [...workAchievements, ...economyAchievements];
  } catch { /* ignore */ }

  let missionsCompleted: CompletedMission[] = [];
  try {
    missionsCompleted = await updateMissionProgress(userId, { type: 'work' });
  } catch { /* ignore */ }

  // Weekly challenge progress
  try {
    const { updateWeeklyChallengeProgress } = await import('../weekly-challenge.service.js');
    await updateWeeklyChallengeProgress(userId, {
      jobId: result.jobId!,
      shiftType: result.shiftType!,
      eventType: result.event!.type,
      totalPay: result.totalPay!,
      isSpecialShift: !!result.specialShiftType,
      masteryLeveledUp: result.masteryLeveledUp,
    });
  } catch { /* ignore */ }

  return { newlyUnlocked, missionsCompleted };
}
