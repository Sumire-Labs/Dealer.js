import type {Card} from './poker.deck.js';
import {evaluateBestHand, type HandResult} from './poker.hand.js';

export type PokerPhase = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export interface PokerPlayer {
  userId: string;
  displayName: string;
  holeCards: Card[];
  stack: bigint;
  currentBet: bigint;
  totalBet: bigint;
  folded: boolean;
  allIn: boolean;
  acted: boolean;
}

export interface PotInfo {
  amount: bigint;
  eligible: string[];
}

export interface WinnerInfo {
  userId: string;
  amount: bigint;
  hand?: HandResult;
  potIndex: number;
}

/**
 * Post small and big blinds.
 * Heads-up (2 players): dealer = SB, other = BB.
 * 3+ players: left of dealer = SB, next = BB.
 */
export function postBlinds(
  players: PokerPlayer[],
  dealerIndex: number,
  sb: bigint,
  bb: bigint,
): void {
  const n = players.length;
  const sbIndex = n === 2 ? dealerIndex : (dealerIndex + 1) % n;
  const bbIndex = n === 2 ? (dealerIndex + 1) % n : (dealerIndex + 2) % n;

  const sbPlayer = players[sbIndex];
  const sbAmount = sbPlayer.stack < sb ? sbPlayer.stack : sb;
  sbPlayer.stack -= sbAmount;
  sbPlayer.currentBet = sbAmount;
  sbPlayer.totalBet = sbAmount;
  if (sbPlayer.stack === 0n) sbPlayer.allIn = true;

  const bbPlayer = players[bbIndex];
  const bbAmount = bbPlayer.stack < bb ? bbPlayer.stack : bb;
  bbPlayer.stack -= bbAmount;
  bbPlayer.currentBet = bbAmount;
  bbPlayer.totalBet = bbAmount;
  if (bbPlayer.stack === 0n) bbPlayer.allIn = true;
}

/**
 * Get first player to act in a phase.
 * Preflop: UTG (left of BB). Post-flop: first active left of dealer.
 */
export function getFirstToAct(
  players: PokerPlayer[],
  dealerIndex: number,
  phase: PokerPhase,
): number {
  const n = players.length;

  if (phase === 'preflop') {
    // UTG = left of BB
    const bbIndex = n === 2 ? (dealerIndex + 1) % n : (dealerIndex + 2) % n;
    let idx = (bbIndex + 1) % n;
    for (let i = 0; i < n; i++) {
      if (!players[idx].folded && !players[idx].allIn) return idx;
      idx = (idx + 1) % n;
    }
    return -1;
  }

  // Post-flop: first active after dealer
  let idx = (dealerIndex + 1) % n;
  for (let i = 0; i < n; i++) {
    if (!players[idx].folded && !players[idx].allIn) return idx;
    idx = (idx + 1) % n;
  }
  return -1;
}

/** Get next active (non-folded, non-allIn) player after currentIndex */
export function getNextActivePlayer(
  players: PokerPlayer[],
  currentIndex: number,
): number {
  const n = players.length;
  let idx = (currentIndex + 1) % n;
  for (let i = 0; i < n; i++) {
    if (!players[idx].folded && !players[idx].allIn) return idx;
    idx = (idx + 1) % n;
  }
  return -1;
}

/** Can this player check? (their bet matches the current bet) */
export function canCheck(player: PokerPlayer, currentBet: bigint): boolean {
  return player.currentBet >= currentBet;
}

/** Process a player action */
export function processAction(
  action: 'fold' | 'check' | 'call' | 'raise',
  player: PokerPlayer,
  currentBet: bigint,
  raiseAmount?: bigint,
): { newCurrentBet: bigint } {
  player.acted = true;

  if (action === 'fold') {
    player.folded = true;
    return { newCurrentBet: currentBet };
  }

  if (action === 'check') {
    return { newCurrentBet: currentBet };
  }

  if (action === 'call') {
    const callAmount = currentBet - player.currentBet;
    const actualCall = player.stack < callAmount ? player.stack : callAmount;
    player.stack -= actualCall;
    player.currentBet += actualCall;
    player.totalBet += actualCall;
    if (player.stack === 0n) player.allIn = true;
    return { newCurrentBet: currentBet };
  }

  if (action === 'raise' && raiseAmount !== undefined) {
    // raiseAmount is the TOTAL bet the player wants to have (not the increment)
    const totalToAdd = raiseAmount - player.currentBet;
    const actualAdd = player.stack < totalToAdd ? player.stack : totalToAdd;
    player.stack -= actualAdd;
    player.currentBet += actualAdd;
    player.totalBet += actualAdd;
    const newBet = player.currentBet;
    if (player.stack === 0n) player.allIn = true;
    return { newCurrentBet: newBet };
  }

  return { newCurrentBet: currentBet };
}

/** Check if betting round is complete */
export function isBettingRoundComplete(
  players: PokerPlayer[],
  currentBet: bigint,
): boolean {
  const active = players.filter(p => !p.folded && !p.allIn);
  // If no active players can act, round is done
  if (active.length === 0) return true;
  // All active players must have acted and matched the current bet
  return active.every(p => p.acted && p.currentBet >= currentBet);
}

/** Reset per-round bet tracking for a new betting round */
export function resetBettingRound(players: PokerPlayer[]): void {
  for (const p of players) {
    p.currentBet = 0n;
    p.acted = false;
  }
}

/** Get players that haven't folded */
export function getActivePlayers(players: PokerPlayer[]): PokerPlayer[] {
  return players.filter(p => !p.folded);
}

/** Count of players that can still act (not folded, not all-in) */
export function getActionablePlayers(players: PokerPlayer[]): PokerPlayer[] {
  return players.filter(p => !p.folded && !p.allIn);
}

/**
 * Calculate side pots.
 * Groups by totalBet levels of non-folded players.
 */
export function calculatePots(players: PokerPlayer[]): PotInfo[] {
  // All non-folded players sorted by totalBet ascending
  const contenders = players
    .filter(p => !p.folded)
    .sort((a, b) => (a.totalBet < b.totalBet ? -1 : a.totalBet > b.totalBet ? 1 : 0));

  // Also include folded players' contributions
  const allBets = players.map(p => ({ userId: p.userId, totalBet: p.totalBet, folded: p.folded }));

  const pots: PotInfo[] = [];
  let processedLevel = 0n;

  for (const contender of contenders) {
    const level = contender.totalBet;
    if (level <= processedLevel) continue;

    const increment = level - processedLevel;
    let potAmount = 0n;
    const eligible: string[] = [];

    for (const p of allBets) {
      const contribution = p.totalBet - processedLevel;
      if (contribution > 0n) {
        potAmount += contribution < increment ? contribution : increment;
      }
      // Eligible if not folded and bet at least this level
      if (!p.folded && p.totalBet >= level) {
        eligible.push(p.userId);
      }
    }

    if (potAmount > 0n) {
      pots.push({ amount: potAmount, eligible });
    }
    processedLevel = level;
  }

  return pots;
}

/**
 * Determine winners for each pot.
 */
export function determineWinners(
  pots: PotInfo[],
  players: PokerPlayer[],
  communityCards: Card[],
): WinnerInfo[] {
  const winners: WinnerInfo[] = [];

  // Evaluate hands for all non-folded players
  const hands = new Map<string, HandResult>();
  for (const p of players) {
    if (!p.folded) {
      const allCards = [...p.holeCards, ...communityCards];
      hands.set(p.userId, evaluateBestHand(allCards));
    }
  }

  for (let i = 0; i < pots.length; i++) {
    const pot = pots[i];
    const eligibleHands = pot.eligible
      .map(uid => ({ userId: uid, hand: hands.get(uid)! }))
      .filter(h => h.hand);

    if (eligibleHands.length === 0) continue;

    // Find best score
    const bestScore = Math.max(...eligibleHands.map(h => h.hand.score));
    const potWinners = eligibleHands.filter(h => h.hand.score === bestScore);

    // Split pot evenly among winners
    const share = pot.amount / BigInt(potWinners.length);
    const remainder = pot.amount % BigInt(potWinners.length);

    for (let j = 0; j < potWinners.length; j++) {
      const w = potWinners[j];
      winners.push({
        userId: w.userId,
        amount: share + (j === 0 ? remainder : 0n),
        hand: w.hand,
        potIndex: i,
      });
    }
  }

  return winners;
}
