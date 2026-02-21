import { Prisma } from '@prisma/client';
import { DAILY_BONUS, DAILY_BONUS_BROKE, DAILY_COOLDOWN_MS } from '../../config/constants.js';
import { prisma } from '../client.js';
import { findOrCreateUser } from '../repositories/user.repository.js';

export interface DailyResult {
  success: boolean;
  amount?: bigint;
  newBalance?: bigint;
  remainingCooldown?: number;
  streak?: number;
  nextClaimAt?: number;
}

export async function claimDaily(userId: string): Promise<DailyResult> {
  await findOrCreateUser(userId);

  // Atomic check-and-claim inside a transaction
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

    if (user.lastDaily) {
      const elapsed = Date.now() - user.lastDaily.getTime();
      if (elapsed < DAILY_COOLDOWN_MS) {
        const nextClaimAt = user.lastDaily.getTime() + DAILY_COOLDOWN_MS;
        return {
          success: false,
          remainingCooldown: DAILY_COOLDOWN_MS - elapsed,
          nextClaimAt,
        };
      }
    }

    const isBroke = user.chips <= 0n;
    const amount = isBroke ? DAILY_BONUS_BROKE : DAILY_BONUS;

    // Streak calculation: within 48h of lastDaily → increment, otherwise reset to 1
    const STREAK_WINDOW_MS = 48 * 60 * 60 * 1000;
    let newStreak: number;
    if (user.lastDaily && (Date.now() - user.lastDaily.getTime()) <= STREAK_WINDOW_MS) {
      newStreak = user.dailyStreak + 1;
    } else {
      newStreak = 1;
    }

    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        chips: { increment: amount },
        lastDaily: new Date(),
        dailyStreak: newStreak,
      },
    });

    await tx.transaction.create({
      data: {
        userId,
        type: 'DAILY',
        amount,
        balanceAfter: updated.chips,
        metadata: Prisma.JsonNull,
      },
    });

    return {
      success: true,
      amount,
      newBalance: updated.chips,
      streak: newStreak,
    };
  });
}
