import type {ShiftType, WorkEvent} from '../../config/jobs.js';
import type {WorkBonuses} from './work.engine.js';
import type {WorkScenario} from '../../config/work-events.js';
import {MULTI_STEP_SESSION_TTL_MS} from '../../config/constants.js';

export interface PendingWorkSession {
  userId: string;
  jobId: string;
  shiftType: ShiftType;
  basePay: bigint;
  event: WorkEvent;
  bonuses: WorkBonuses;
  scenario: WorkScenario;
  specialShiftType?: string;
  createdAt: number;
}

const activeSessions = new Map<string, PendingWorkSession>();

export function getWorkSession(userId: string): PendingWorkSession | undefined {
  const session = activeSessions.get(userId);
  if (!session) return undefined;

  // Check TTL
  if (Date.now() - session.createdAt > MULTI_STEP_SESSION_TTL_MS) {
    activeSessions.delete(userId);
    return undefined;
  }

  return session;
}

export function setWorkSession(userId: string, session: PendingWorkSession): void {
  activeSessions.set(userId, session);
}

export function removeWorkSession(userId: string): void {
  activeSessions.delete(userId);
}
