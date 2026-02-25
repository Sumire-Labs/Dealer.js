import type {ShiftType} from '../../config/jobs.js';
import {OVERTIME_SESSION_TTL_MS} from '../../config/constants.js';

export interface OvertimeSession {
    userId: string;
    jobId: string;
    shiftType: ShiftType;
    baseShiftPay: bigint;
    currentRound: number; // 0-indexed, next round to play
    accumulatedBonus: bigint;
    baseRiskRate: number;
    createdAt: number;
}

const overtimeSessions = new Map<string, OvertimeSession>();

export function getOvertimeSession(userId: string): OvertimeSession | undefined {
    const session = overtimeSessions.get(userId);
    if (!session) return undefined;

    if (Date.now() - session.createdAt > OVERTIME_SESSION_TTL_MS) {
        overtimeSessions.delete(userId);
        return undefined;
    }

    return session;
}

export function setOvertimeSession(userId: string, session: OvertimeSession): void {
    overtimeSessions.set(userId, session);
}

export function removeOvertimeSession(userId: string): void {
    overtimeSessions.delete(userId);
}
