import { secureRandomInt } from '../../utils/random.js';
import {
  PRISON_JAILBREAK_COOLDOWN_MS,
} from '../../config/constants.js';
import { configService } from '../../config/config.service.js';
import { S } from '../../config/setting-defs.js';

export interface PrisonSession {
  userId: string;
  jailedAt: number;
  releaseAt: number;
  fineAmount: bigint;
  jailbreakCooldownUntil: number;
  heistTarget?: string;
}

const prisonSessions = new Map<string, PrisonSession>();

export function getJailSession(userId: string): PrisonSession | undefined {
  const session = prisonSessions.get(userId);
  if (!session) return undefined;

  // Auto-release if time is up
  if (Date.now() >= session.releaseAt) {
    prisonSessions.delete(userId);
    return undefined;
  }

  return session;
}

export function jailUser(userId: string, fineAmount: bigint, heistTarget?: string): void {
  prisonSessions.set(userId, {
    userId,
    jailedAt: Date.now(),
    releaseAt: Date.now() + configService.getNumber(S.prisonDuration),
    fineAmount,
    jailbreakCooldownUntil: 0,
    heistTarget,
  });
}

export function releaseUser(userId: string): void {
  prisonSessions.delete(userId);
}

export function isJailed(userId: string): boolean {
  return getJailSession(userId) !== undefined;
}

export function getRemainingJailTime(userId: string): number {
  const session = getJailSession(userId);
  if (!session) return 0;
  return Math.max(0, session.releaseAt - Date.now());
}

export function attemptJailbreak(userId: string): { success: boolean; newReleaseAt?: number } {
  const session = getJailSession(userId);
  if (!session) return { success: false };

  // Check cooldown
  if (Date.now() < session.jailbreakCooldownUntil) {
    return { success: false };
  }

  const roll = secureRandomInt(1, 100);
  if (roll <= configService.getNumber(S.prisonJailbreakRate)) {
    prisonSessions.delete(userId);
    return { success: true };
  }

  // Failed: extend sentence + set cooldown
  session.releaseAt += configService.getNumber(S.prisonJailbreakPenalty);
  session.jailbreakCooldownUntil = Date.now() + PRISON_JAILBREAK_COOLDOWN_MS;

  return { success: false, newReleaseAt: session.releaseAt };
}

export function getJailbreakCooldownRemaining(userId: string): number {
  const session = getJailSession(userId);
  if (!session) return 0;
  return Math.max(0, session.jailbreakCooldownUntil - Date.now());
}

export function usePrisonKey(userId: string): boolean {
  if (!isJailed(userId)) return false;
  releaseUser(userId);
  return true;
}
