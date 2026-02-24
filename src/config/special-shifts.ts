import { secureRandomInt } from '../utils/random.js';
import { SPECIAL_SHIFT_CACHE_TTL_MS, SPECIAL_SHIFT_TRAINING_CD_MS } from './constants.js';
import { isOnCooldown, buildCooldownKey } from '../utils/cooldown.js';

export interface SpecialShiftDefinition {
  type: string;
  name: string;
  emoji: string;
  payMultiplier: number;
  xpMultiplier: number;
  riskModifier: number;  // +/- to risk rate
  chance: number;        // % chance to appear
  cooldownKey?: string;
  cooldownMs?: number;
}

export const SPECIAL_SHIFTS: SpecialShiftDefinition[] = [
  {
    type: 'emergency',
    name: '緊急',
    emoji: '🚨',
    payMultiplier: 2.0,
    xpMultiplier: 1,
    riskModifier: 10,
    chance: 10,
    cooldownKey: 'work_emergency',
  },
  {
    type: 'vip_event',
    name: 'VIPイベント',
    emoji: '🌟',
    payMultiplier: 3.0,
    xpMultiplier: 2,
    riskModifier: 0,
    chance: 5,
  },
  {
    type: 'training',
    name: 'トレーニング',
    emoji: '📚',
    payMultiplier: 0.3,
    xpMultiplier: 3,
    riskModifier: -5,
    chance: 15,
    cooldownKey: 'work_training',
    cooldownMs: SPECIAL_SHIFT_TRAINING_CD_MS,
  },
];

// Cache for rolled special shifts per user (anti-fishing)
const shiftCache = new Map<string, { shifts: SpecialShiftDefinition[]; expiresAt: number }>();

// VIP event daily limit per user
const vipEventUsed = new Map<string, string>(); // userId -> dateString

export function isVipEventUsedToday(userId: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return vipEventUsed.get(userId) === today;
}

export function markVipEventUsed(userId: string): void {
  const today = new Date().toISOString().slice(0, 10);
  vipEventUsed.set(userId, today);
}

/**
 * Roll which special shifts appear for this user.
 * Results are cached for 60s to prevent reroll-fishing.
 */
export function rollSpecialShifts(userId: string): SpecialShiftDefinition[] {
  const cached = shiftCache.get(userId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.shifts;
  }

  const available: SpecialShiftDefinition[] = [];

  for (const shift of SPECIAL_SHIFTS) {
    // Check cooldown
    if (shift.cooldownKey) {
      const key = buildCooldownKey(userId, shift.cooldownKey);
      if (isOnCooldown(key)) continue;
    }

    // VIP daily limit
    if (shift.type === 'vip_event' && isVipEventUsedToday(userId)) continue;

    // Roll chance
    if (secureRandomInt(1, 100) <= shift.chance) {
      available.push(shift);
    }
  }

  shiftCache.set(userId, {
    shifts: available,
    expiresAt: Date.now() + SPECIAL_SHIFT_CACHE_TTL_MS,
  });

  return available;
}
