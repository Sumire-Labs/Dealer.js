import { secureRandomInt } from '../../utils/random.js';
import {
  getNumberColor,
  type RouletteColor,
  type RouletteBet,
  type OutsideBetType,
  type InsideBetType,
  OUTSIDE_BET_MULTIPLIER,
  INSIDE_BET_MULTIPLIER,
  WHEEL_ORDER,
} from '../../config/roulette.js';

export interface RouletteResult {
  number: number;
  color: RouletteColor;
}

export function spinRoulette(): RouletteResult {
  const number = secureRandomInt(0, 36);
  return { number, color: getNumberColor(number) };
}

export function evaluateBet(result: RouletteResult, bet: RouletteBet): number {
  const hit = bet.numbers.includes(result.number);
  if (!hit) return 0;

  if (bet.type in OUTSIDE_BET_MULTIPLIER) {
    return OUTSIDE_BET_MULTIPLIER[bet.type as OutsideBetType];
  }
  return INSIDE_BET_MULTIPLIER[bet.type as InsideBetType];
}

// Generate animation frames: pick random positions on the wheel
export function getAnimationNumbers(count: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    const idx = secureRandomInt(0, WHEEL_ORDER.length - 1);
    result.push(WHEEL_ORDER[idx]);
  }
  return result;
}
