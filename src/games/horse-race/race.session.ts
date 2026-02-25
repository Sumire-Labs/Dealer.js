import type {Horse} from './race.horses.js';
import type {RaceBetEntry} from './race.betting.js';

export type RaceSessionStatus = 'betting' | 'running' | 'finished' | 'cancelled';

export interface RaceSessionState {
    id: string;
    channelId: string;
    messageId?: string;
    ownerId: string;
    horses: Horse[];
    bets: RaceBetEntry[];
    status: RaceSessionStatus;
    startsAt: number; // timestamp when betting closes
}

// In-memory active race sessions: channelId -> session
const activeSessions = new Map<string, RaceSessionState>();

export function getActiveSession(channelId: string): RaceSessionState | undefined {
    return activeSessions.get(channelId);
}

export function setActiveSession(channelId: string, session: RaceSessionState): void {
    activeSessions.set(channelId, session);
}

export function removeActiveSession(channelId: string): void {
    activeSessions.delete(channelId);
}

export function addBetToSession(
    channelId: string,
    bet: RaceBetEntry,
): boolean {
    const session = activeSessions.get(channelId);
    if (!session || session.status !== 'betting') return false;

    // Check if user already bet
    const existing = session.bets.find(b => b.userId === bet.userId);
    if (existing) return false;

    session.bets.push(bet);
    return true;
}

export function hasUserBet(channelId: string, userId: string): boolean {
    const session = activeSessions.get(channelId);
    if (!session) return false;
    return session.bets.some(b => b.userId === userId);
}
