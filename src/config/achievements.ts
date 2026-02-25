import type {GameType} from '@prisma/client';
import type {AchievementCategory, AchievementContext, AchievementDefinition} from './achievements/types.js';
import {ACHIEVEMENTS} from './achievements/definitions.js';

// ── Re-exports from sub-modules ──

export type {AchievementCategory, AchievementContext, AchievementDefinition} from './achievements/types.js';
export {ACHIEVEMENTS} from './achievements/definitions.js';

// ── Imports for aggregation ──

// ── Lookup maps ──

export const ACHIEVEMENT_MAP = new Map(
    ACHIEVEMENTS.map(a => [a.id, a]),
);

export const ACHIEVEMENTS_BY_CATEGORY = new Map<AchievementCategory, AchievementDefinition[]>();
for (const a of ACHIEVEMENTS) {
    const list = ACHIEVEMENTS_BY_CATEGORY.get(a.category) ?? [];
    list.push(a);
    ACHIEVEMENTS_BY_CATEGORY.set(a.category, list);
}

export const ACHIEVEMENTS_BY_CONTEXT = new Map<AchievementContext, AchievementDefinition[]>();
for (const a of ACHIEVEMENTS) {
    for (const ctx of a.contexts) {
        const list = ACHIEVEMENTS_BY_CONTEXT.get(ctx) ?? [];
        list.push(a);
        ACHIEVEMENTS_BY_CONTEXT.set(ctx, list);
    }
}

// All game types for ALL_GAMES_PLAYED check
export const ALL_GAME_TYPES: GameType[] = [
    'SLOTS', 'BLACKJACK', 'HORSE_RACE', 'COINFLIP', 'POKER', 'ROULETTE',
];
