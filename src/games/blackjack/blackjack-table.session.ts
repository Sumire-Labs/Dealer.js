import type {BlackjackHand, GameOutcome} from './blackjack.engine.js';
import type {Card, Shoe} from './blackjack.deck.js';

export interface TablePlayer {
    userId: string;
    displayName: string;
    bet: bigint;
    isHost: boolean;
    hands: BlackjackHand[];
    activeHandIndex: number;
    outcomes: GameOutcome[];
    multipliers: number[];
    insuranceBet: bigint;
    insurancePaid: boolean;
    done: boolean;
}

export type TablePhase = 'waiting' | 'playing' | 'dealer_turn' | 'resolved' | 'cancelled';

export interface BlackjackTableSession {
    channelId: string;
    hostId: string;
    messageId?: string;
    bet: bigint;
    phase: TablePhase;
    lobbyDeadline: number;
    lobbyTimer?: ReturnType<typeof setInterval>;
    shoe: Shoe;
    players: TablePlayer[];
    currentPlayerIndex: number;
    dealerCards: Card[];
    turnTimer?: ReturnType<typeof setTimeout>;
    turnDeadline: number;
}

const activeSessions = new Map<string, BlackjackTableSession>();

export function getActiveTableSession(channelId: string): BlackjackTableSession | undefined {
    return activeSessions.get(channelId);
}

export function setActiveTableSession(channelId: string, session: BlackjackTableSession): void {
    activeSessions.set(channelId, session);
}

export function removeActiveTableSession(channelId: string): void {
    const session = activeSessions.get(channelId);
    if (session) {
        if (session.lobbyTimer) clearInterval(session.lobbyTimer);
        if (session.turnTimer) clearTimeout(session.turnTimer);
    }
    activeSessions.delete(channelId);
}

export function addPlayerToTable(channelId: string, userId: string, displayName: string, bet: bigint): boolean {
    const session = activeSessions.get(channelId);
    if (!session || session.phase !== 'waiting') return false;
    if (session.players.some(p => p.userId === userId)) return false;

    session.players.push({
        userId,
        displayName,
        bet,
        isHost: false,
        hands: [],
        activeHandIndex: 0,
        outcomes: [],
        multipliers: [],
        insuranceBet: 0n,
        insurancePaid: false,
        done: false,
    });
    return true;
}

export function hasPlayerInTable(channelId: string, userId: string): boolean {
    const session = activeSessions.get(channelId);
    if (!session) return false;
    return session.players.some(p => p.userId === userId);
}
