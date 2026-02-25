import type {ChinchiroHand} from './chinchiro.engine.js';

// ─── Types ──────────────────────────────────────────────

export interface ChinchiroTablePlayer {
    userId: string;
    displayName: string;
    bet: bigint;
    isHost: boolean;
    currentHand: ChinchiroHand | null;
    rollHistory: ChinchiroHand[];
    rollsRemaining: number;       // starts at 3, decrements on menashi reroll
    done: boolean;
    netResult: bigint;            // cumulative across all rounds
}

export type ChinchiroTablePhase =
    | 'waiting'
    | 'banker_roll'
    | 'player_roll'
    | 'round_result'
    | 'resolved'
    | 'cancelled';

export interface ChinchiroTableSession {
    channelId: string;
    hostId: string;
    messageId?: string;
    bet: bigint;
    phase: ChinchiroTablePhase;
    lobbyDeadline: number;
    lobbyTimer?: ReturnType<typeof setInterval>;
    players: ChinchiroTablePlayer[];
    bankerIndex: number;
    currentPlayerIndex: number;
    turnTimer?: ReturnType<typeof setTimeout>;
    turnDeadline: number;
    completedRotations: number;
}

// ─── Session store ──────────────────────────────────────

const activeSessions = new Map<string, ChinchiroTableSession>();

export function getActiveChinchiroSession(channelId: string): ChinchiroTableSession | undefined {
    return activeSessions.get(channelId);
}

export function setActiveChinchiroSession(channelId: string, session: ChinchiroTableSession): void {
    activeSessions.set(channelId, session);
}

export function removeActiveChinchiroSession(channelId: string): void {
    const session = activeSessions.get(channelId);
    if (session) {
        if (session.lobbyTimer) clearInterval(session.lobbyTimer);
        if (session.turnTimer) clearTimeout(session.turnTimer);
        activeSessions.delete(channelId);
    }
}

export function addPlayerToChinchiro(
    channelId: string,
    userId: string,
    displayName: string,
    bet: bigint,
): boolean {
    const session = activeSessions.get(channelId);
    if (!session || session.phase !== 'waiting') return false;
    if (session.players.some(p => p.userId === userId)) return false;

    session.players.push({
        userId,
        displayName,
        bet,
        isHost: false,
        currentHand: null,
        rollHistory: [],
        rollsRemaining: 3,
        done: false,
        netResult: 0n,
    });
    return true;
}

export function hasPlayerInChinchiro(channelId: string, userId: string): boolean {
    const session = activeSessions.get(channelId);
    if (!session) return false;
    return session.players.some(p => p.userId === userId);
}
