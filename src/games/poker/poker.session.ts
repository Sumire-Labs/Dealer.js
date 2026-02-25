import type {Card} from './poker.deck.js';
import type {PokerPhase, PokerPlayer} from './poker.engine.js';

export type SessionStatus = 'waiting' | 'playing' | 'finished' | 'cancelled';

export interface PokerSessionState {
  id: string;
  channelId: string;
  messageId?: string;
  ownerId: string;
  status: SessionStatus;

  // Lobby
  lobbyDeadline: number;
  lobbyTimer?: ReturnType<typeof setInterval>;

  // Game state
  players: PokerPlayer[];
  deck: Card[];
  communityCards: Card[];
  dealerIndex: number;
  phase: PokerPhase;

  // Betting state
  currentBet: bigint;
  minRaise: bigint;
  currentPlayerIndex: number;
  lastRaiserIndex: number;

  // Turn timer
  turnTimer?: ReturnType<typeof setTimeout>;
  turnDeadline: number;
}

// In-memory active sessions: channelId -> session
const activeSessions = new Map<string, PokerSessionState>();

export function getActiveSession(channelId: string): PokerSessionState | undefined {
  return activeSessions.get(channelId);
}

export function setActiveSession(channelId: string, session: PokerSessionState): void {
  activeSessions.set(channelId, session);
}

export function removeActiveSession(channelId: string): void {
  const session = activeSessions.get(channelId);
  if (session) {
    if (session.lobbyTimer) clearInterval(session.lobbyTimer);
    if (session.turnTimer) clearTimeout(session.turnTimer);
  }
  activeSessions.delete(channelId);
}

export function addPlayer(
  channelId: string,
  userId: string,
  displayName: string,
  buyIn: bigint,
): boolean {
  const session = activeSessions.get(channelId);
  if (!session || session.status !== 'waiting') return false;
  if (session.players.some(p => p.userId === userId)) return false;

  session.players.push({
    userId,
    displayName,
    holeCards: [],
    stack: buyIn,
    currentBet: 0n,
    totalBet: 0n,
    folded: false,
    allIn: false,
    acted: false,
  });
  return true;
}

export function hasPlayer(channelId: string, userId: string): boolean {
  const session = activeSessions.get(channelId);
  if (!session) return false;
  return session.players.some(p => p.userId === userId);
}
