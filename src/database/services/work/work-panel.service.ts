import { findOrCreateUser } from '../../repositories/user.repository.js';
import { LEVEL_THRESHOLDS } from '../../../config/jobs.js';
import { getAllMasteries } from '../../repositories/work-mastery.repository.js';

export interface WorkPanelData {
  workLevel: number;
  workXp: number;
  workStreak: number;
  lastWorkAt: Date | null;
  xpForNextLevel: number | null;
  chips: bigint;
  masteries: Map<string, { level: number; shiftsCompleted: number }>;
}

export async function getWorkPanelData(userId: string): Promise<WorkPanelData> {
  const user = await findOrCreateUser(userId);
  const xpForNextLevel = user.workLevel < LEVEL_THRESHOLDS.length - 1
    ? LEVEL_THRESHOLDS[user.workLevel + 1]
    : null;

  const masteryRows = await getAllMasteries(userId);
  const masteries = new Map<string, { level: number; shiftsCompleted: number }>();
  for (const m of masteryRows) {
    masteries.set(m.jobId, { level: m.masteryLevel, shiftsCompleted: m.shiftsCompleted });
  }

  return {
    workLevel: user.workLevel,
    workXp: user.workXp,
    workStreak: user.workStreak,
    lastWorkAt: user.lastWorkAt,
    xpForNextLevel,
    chips: user.chips,
    masteries,
  };
}
