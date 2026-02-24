import { formatCard, formatHidden } from '../../../games/poker/poker.deck.js';
import type { PokerPhase } from '../../../games/poker/poker.engine.js';
import { evaluateBestHand } from '../../../games/poker/poker.hand.js';

export const PHASE_LABELS: Record<PokerPhase, string> = {
  preflop: 'PRE-FLOP',
  flop: 'FLOP',
  turn: 'TURN',
  river: 'RIVER',
  showdown: 'SHOWDOWN',
};

export const PHASE_PROGRESS: Record<PokerPhase, string> = {
  preflop: '▶ ━ ━ ━',
  flop: '✅ ▶ ━ ━',
  turn: '✅ ✅ ▶ ━',
  river: '✅ ✅ ✅ ▶',
  showdown: '✅ ✅ ✅ ✅',
};

export function positionTag(playerIndex: number, dealerIndex: number, playerCount: number): string {
  if (playerIndex === dealerIndex) return '`D `';
  const sbIndex = playerCount === 2 ? dealerIndex : (dealerIndex + 1) % playerCount;
  const bbIndex = playerCount === 2 ? (dealerIndex + 1) % playerCount : (dealerIndex + 2) % playerCount;
  if (playerIndex === sbIndex) return '`SB`';
  if (playerIndex === bbIndex) return '`BB`';
  return '`  `';
}

export function buildCommunityLine(communityCards: { suit: string; rank: string }[]): string {
  const cards: string[] = [];
  for (let i = 0; i < 5; i++) {
    if (i < communityCards.length) {
      cards.push(formatCard(communityCards[i] as never));
    } else {
      cards.push(formatHidden());
    }
  }
  return cards.join('  ');
}

export function getHandStrengthText(holeCards: { suit: string; rank: string }[], communityCards: { suit: string; rank: string }[]): string {
  const allCards = [...holeCards, ...communityCards];
  if (allCards.length < 5) return '';
  const result = evaluateBestHand(allCards as never);
  return `🃏 ベストハンド: **${result.name}**`;
}

export function getPotOddsText(callAmount: bigint, totalPot: bigint): string {
  if (callAmount <= 0n) return '';
  const potAfterCall = totalPot + callAmount;
  // pot odds = potAfterCall : callAmount
  const ratioX10 = potAfterCall * 10n / callAmount;
  const ratio = (Number(ratioX10) / 10).toFixed(1);
  return `📊 ポットオッズ: ${ratio} : 1`;
}
