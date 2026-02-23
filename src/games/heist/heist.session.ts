import type { HeistTarget, HeistRiskLevel, HeistApproach } from '../../config/heist.js';

export interface HeistPlayer {
  userId: string;
  isHost: boolean;
}

export type HeistStatus = 'waiting' | 'running' | 'finished' | 'cancelled';

export interface HeistSessionState {
  channelId: string;
  hostId: string;
  players: HeistPlayer[];
  status: HeistStatus;
  lobbyDeadline: number;
  entryFee: bigint;
  messageId?: string;
  lobbyTimer?: ReturnType<typeof setInterval>;
  target: HeistTarget;
  riskLevel: HeistRiskLevel;
  approach: HeistApproach;
  isSolo: boolean;
}

const activeSessions = new Map<string, HeistSessionState>();

export function getActiveHeistSession(channelId: string): HeistSessionState | undefined {
  return activeSessions.get(channelId);
}

export function setActiveHeistSession(channelId: string, session: HeistSessionState): void {
  activeSessions.set(channelId, session);
}

export function removeActiveHeistSession(channelId: string): void {
  const session = activeSessions.get(channelId);
  if (session?.lobbyTimer) {
    clearInterval(session.lobbyTimer);
  }
  activeSessions.delete(channelId);
}

export function addPlayerToHeist(channelId: string, userId: string): boolean {
  const session = activeSessions.get(channelId);
  if (!session) return false;
  if (session.players.some(p => p.userId === userId)) return false;

  session.players.push({ userId, isHost: false });
  return true;
}

export function isPlayerInHeist(channelId: string, userId: string): boolean {
  const session = activeSessions.get(channelId);
  if (!session) return false;
  return session.players.some(p => p.userId === userId);
}
