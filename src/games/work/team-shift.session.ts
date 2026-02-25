import type {ShiftType} from '../../config/jobs.js';

export interface TeamShiftPlayer {
  userId: string;
  isHost: boolean;
  jobId?: string;
}

export type TeamShiftStatus = 'lobby' | 'job_select' | 'running' | 'finished';

export interface TeamShiftSession {
  channelId: string;
  hostId: string;
  shiftType: ShiftType;
  players: TeamShiftPlayer[];
  status: TeamShiftStatus;
  lobbyDeadline: number;
  messageId?: string;
  lobbyTimer?: ReturnType<typeof setInterval>;
}

const teamSessions = new Map<string, TeamShiftSession>();

export function getTeamSession(channelId: string): TeamShiftSession | undefined {
  return teamSessions.get(channelId);
}

export function setTeamSession(channelId: string, session: TeamShiftSession): void {
  teamSessions.set(channelId, session);
}

export function removeTeamSession(channelId: string): void {
  const session = teamSessions.get(channelId);
  if (session?.lobbyTimer) {
    clearInterval(session.lobbyTimer);
  }
  teamSessions.delete(channelId);
}

export function addPlayerToTeam(channelId: string, userId: string): boolean {
  const session = teamSessions.get(channelId);
  if (!session) return false;
  if (session.players.some(p => p.userId === userId)) return false;
  session.players.push({ userId, isHost: false });
  return true;
}

export function isPlayerInTeam(channelId: string, userId: string): boolean {
  const session = teamSessions.get(channelId);
  if (!session) return false;
  return session.players.some(p => p.userId === userId);
}

export function setPlayerJob(channelId: string, userId: string, jobId: string): boolean {
  const session = teamSessions.get(channelId);
  if (!session) return false;
  const player = session.players.find(p => p.userId === userId);
  if (!player) return false;
  player.jobId = jobId;
  return true;
}

export function allPlayersReady(channelId: string): boolean {
  const session = teamSessions.get(channelId);
  if (!session) return false;
  return session.players.every(p => p.jobId != null);
}
