import type { GameType } from '@prisma/client';
import {
  type AchievementDefinition,
  type AchievementContext,
  ACHIEVEMENTS_BY_CONTEXT,
  ALL_GAME_TYPES,
} from '../../config/achievements.js';
import { getUnlockedIds, unlockAchievement } from '../repositories/achievement.repository.js';
import { prisma } from '../client.js';
import { logger } from '../../utils/logger.js';

export interface AchievementCheckInput {
  userId: string;
  context: AchievementContext;
  gameType?: GameType;
  gameResult?: 'win' | 'loss';
  netAmount?: bigint;
  newBalance?: bigint;
  dailyStreak?: number;
  metadata?: Record<string, unknown>;
}

export async function checkAchievements(
  input: AchievementCheckInput,
): Promise<AchievementDefinition[]> {
  try {
    const candidates = ACHIEVEMENTS_BY_CONTEXT.get(input.context) ?? [];
    if (candidates.length === 0) return [];

    const unlockedIds = await getUnlockedIds(input.userId);
    const toCheck = candidates.filter(a => !unlockedIds.has(a.id));
    if (toCheck.length === 0) return [];

    const newlyUnlocked: AchievementDefinition[] = [];

    for (const achievement of toCheck) {
      const met = await isConditionMet(achievement.id, input);
      if (met) {
        const unlocked = await unlockAchievement(input.userId, achievement.id);
        if (unlocked) {
          newlyUnlocked.push(achievement);
        }
      }
    }

    return newlyUnlocked;
  } catch (err) {
    logger.error('Achievement check failed', { error: String(err), userId: input.userId });
    return [];
  }
}

async function isConditionMet(
  achievementId: string,
  input: AchievementCheckInput,
): Promise<boolean> {
  switch (achievementId) {
    case 'FIRST_WIN':
      return input.gameResult === 'win';

    case 'WIN_STREAK_5': {
      if (input.gameResult !== 'win') return false;
      const recent = await prisma.transaction.findMany({
        where: {
          userId: input.userId,
          type: { in: ['WIN', 'LOSS'] },
          game: { not: null },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { type: true },
      });
      return recent.length === 5 && recent.every(t => t.type === 'WIN');
    }

    case 'GAMES_10': {
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { totalGames: true },
      });
      return (user?.totalGames ?? 0) >= 10;
    }

    case 'GAMES_100': {
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { totalGames: true },
      });
      return (user?.totalGames ?? 0) >= 100;
    }

    case 'GAMES_1000': {
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { totalGames: true },
      });
      return (user?.totalGames ?? 0) >= 1000;
    }

    case 'SLOTS_JACKPOT':
      return (
        input.gameType === 'SLOTS' &&
        input.metadata?.['multiplier'] === 500
      );

    case 'BLACKJACK_NATURAL':
      return (
        input.gameType === 'BLACKJACK' &&
        input.metadata?.['isNatural'] === true
      );

    case 'ALL_GAMES_PLAYED': {
      const played = await prisma.transaction.findMany({
        where: {
          userId: input.userId,
          game: { not: null },
        },
        select: { game: true },
        distinct: ['game'],
      });
      const playedTypes = new Set(played.map(t => t.game).filter(Boolean));
      return ALL_GAME_TYPES.every(g => playedTypes.has(g));
    }

    case 'RICH_10K':
      return (input.newBalance ?? 0n) >= 10_000n;

    case 'RICH_100K':
      return (input.newBalance ?? 0n) >= 100_000n;

    case 'RICH_1M':
      return (input.newBalance ?? 0n) >= 1_000_000n;

    case 'FIRST_LOAN':
      return input.context === 'loan' && input.metadata?.['action'] === 'borrow';

    case 'DEBT_FREE': {
      if (input.context !== 'loan' || input.metadata?.['action'] !== 'repay') return false;
      const activeLoans = await prisma.loan.count({
        where: { userId: input.userId, paidAt: null },
      });
      return activeLoans === 0;
    }

    case 'BANKRUPTCY':
      return input.context === 'bankruptcy';

    case 'DAILY_STREAK_7':
      return (input.dailyStreak ?? 0) >= 7;

    case 'DAILY_STREAK_30':
      return (input.dailyStreak ?? 0) >= 30;

    case 'MULTIPLAYER_FIRST':
      return input.context === 'multiplayer';

    case 'BIG_WIN':
      return (input.netAmount ?? 0n) >= 50_000n;

    case 'ROCK_BOTTOM':
      return input.newBalance === 0n;

    case 'LOTTERY_JACKPOT':
      return input.context === 'lottery' && input.metadata?.['fullMatch'] === true;

    case 'FIRST_WORK':
      return input.context === 'work';

    case 'WORK_LEVEL_3':
      return input.context === 'work' && (input.metadata?.['workLevel'] as number) >= 3;

    case 'WORK_LEVEL_5':
      return input.context === 'work' && (input.metadata?.['workLevel'] as number) >= 5;

    case 'WORK_STREAK_5':
      return input.context === 'work' && (input.metadata?.['workStreak'] as number) >= 5;

    case 'ROULETTE_STRAIGHT':
      return (
        input.gameType === 'ROULETTE' &&
        input.metadata?.['isRouletteStraightWin'] === true
      );

    case 'MISSION_FIRST':
      return input.context === 'mission';

    case 'MISSION_COMPLETE_ALL':
      return input.context === 'mission' && input.metadata?.['allCompleted'] === true;

    default:
      return false;
  }
}

export function buildAchievementNotification(achievements: AchievementDefinition[]): string {
  const lines = achievements.map(a => `${a.emoji} **${a.name}** — ${a.description}`);
  return `🏅 **実績解除！**\n${lines.join('\n')}`;
}
