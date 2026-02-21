// European Roulette — number & color definitions

export const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18,
  19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export const BLACK_NUMBERS = new Set([
  2, 4, 6, 8, 10, 11, 13, 15, 17,
  20, 22, 24, 26, 28, 29, 31, 33, 35,
]);

export type RouletteColor = 'red' | 'black' | 'green';

export function getNumberColor(n: number): RouletteColor {
  if (n === 0) return 'green';
  return RED_NUMBERS.has(n) ? 'red' : 'black';
}

export function getNumberEmoji(n: number): string {
  const color = getNumberColor(n);
  const emoji = color === 'red' ? '🔴' : color === 'black' ? '⚫' : '🟢';
  return `${emoji}${n}`;
}

// European wheel order (for animation)
export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36,
  11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9,
  22, 18, 29, 7, 28, 12, 35, 3, 26,
];

// Bet types
export type OutsideBetType =
  | 'red' | 'black'
  | 'even' | 'odd'
  | 'low' | 'high'
  | '1st12' | '2nd12' | '3rd12';

export type InsideBetType =
  | 'straight' | 'split' | 'street' | 'corner' | 'sixline';

export type RouletteBetType = OutsideBetType | InsideBetType;

export interface RouletteBet {
  type: RouletteBetType;
  numbers: number[]; // covered numbers
}

export const OUTSIDE_BET_MULTIPLIER: Record<OutsideBetType, number> = {
  red: 2,
  black: 2,
  even: 2,
  odd: 2,
  low: 2,
  high: 2,
  '1st12': 3,
  '2nd12': 3,
  '3rd12': 3,
};

export const INSIDE_BET_MULTIPLIER: Record<InsideBetType, number> = {
  straight: 36,
  split: 18,
  street: 12,
  corner: 9,
  sixline: 6,
};

// Outside bet number coverage
export function getOutsideBetNumbers(type: OutsideBetType): number[] {
  switch (type) {
    case 'red': return [...RED_NUMBERS];
    case 'black': return [...BLACK_NUMBERS];
    case 'even': return Array.from({ length: 18 }, (_, i) => (i + 1) * 2);
    case 'odd': return Array.from({ length: 18 }, (_, i) => i * 2 + 1);
    case 'low': return Array.from({ length: 18 }, (_, i) => i + 1);
    case 'high': return Array.from({ length: 18 }, (_, i) => i + 19);
    case '1st12': return Array.from({ length: 12 }, (_, i) => i + 1);
    case '2nd12': return Array.from({ length: 12 }, (_, i) => i + 13);
    case '3rd12': return Array.from({ length: 12 }, (_, i) => i + 25);
  }
}

// Inside bet validation

export function validateSplit(a: number, b: number): boolean {
  if (a < 0 || a > 36 || b < 0 || b > 36 || a === b) return false;
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);

  // 0 adjacency
  if (lo === 0) return hi >= 1 && hi <= 3;

  // Vertical: differ by 3
  if (hi - lo === 3) return true;

  // Horizontal: differ by 1, same row
  if (hi - lo === 1) {
    return Math.ceil(lo / 3) === Math.ceil(hi / 3);
  }

  return false;
}

export function validateStreet(n: number): number[] | null {
  if (n < 1 || n > 34 || (n - 1) % 3 !== 0) return null;
  return [n, n + 1, n + 2];
}

export function validateCorner(n: number): number[] | null {
  if (n < 1 || n > 32) return null;
  // Must be in column 1 or 2 (not column 3)
  if (n % 3 === 0) return null;
  return [n, n + 1, n + 3, n + 4];
}

export function validateSixLine(n: number): number[] | null {
  if (n < 1 || n > 31 || (n - 1) % 3 !== 0) return null;
  return [n, n + 1, n + 2, n + 3, n + 4, n + 5];
}
