import { prisma } from '../client.js';
import { findOrCreateUser } from '../repositories/user.repository.js';
import {
  getCurrentRound,
  createRound,
  getUserTicketCount,
  getRoundTickets,
  updateRoundStatus,
  getDrawReadyRounds,
} from '../repositories/lottery.repository.js';
import {
  drawWinningNumbers,
  calculateLotteryPayouts,
} from '../../games/lottery/lottery.engine.js';
import {
  LOTTERY_DRAW_INTERVAL_MS,
} from '../../config/constants.js';
import { configService } from '../../config/config.service.js';
import { S } from '../../config/setting-defs.js';
import { logger } from '../../utils/logger.js';

export async function getOrCreateCurrentRound() {
  const current = await getCurrentRound();
  if (current) return current;

  const drawAt = new Date(Date.now() + LOTTERY_DRAW_INTERVAL_MS);
  return createRound(drawAt);
}

export async function buyTicket(
  userId: string,
  numbers: number[],
): Promise<{ success: boolean; error?: string }> {
  await findOrCreateUser(userId);

  return prisma.$transaction(async (tx) => {
    const round = await tx.lotteryRound.findFirst({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
    });

    if (!round) {
      return { success: false, error: '現在開催中のラウンドがありません。' };
    }

    // Check ticket limit
    const ticketCount = await tx.lotteryTicket.count({
      where: { roundId: round.id, userId },
    });
    if (ticketCount >= configService.getNumber(S.lotteryMaxTickets)) {
      return { success: false, error: `1ラウンドの購入上限（${configService.getNumber(S.lotteryMaxTickets)}枚）に達しています。` };
    }

    // Check balance
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.chips < configService.getBigInt(S.lotteryTicketPrice)) {
      return { success: false, error: 'チップが不足しています。' };
    }

    // Deduct chips
    await tx.user.update({
      where: { id: userId },
      data: { chips: { decrement: configService.getBigInt(S.lotteryTicketPrice) } },
    });

    // Record transaction
    const updatedUser = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    await tx.transaction.create({
      data: {
        userId,
        type: 'LOTTERY_BUY',
        game: 'LOTTERY',
        amount: -configService.getBigInt(S.lotteryTicketPrice),
        balanceAfter: updatedUser.chips,
      },
    });

    // Create ticket
    await tx.lotteryTicket.create({
      data: { roundId: round.id, userId, numbers },
    });

    // Increment jackpot
    await tx.lotteryRound.update({
      where: { id: round.id },
      data: { jackpot: { increment: configService.getBigInt(S.lotteryTicketPrice) } },
    });

    return { success: true };
  });
}

export async function executeDraw(roundId: string): Promise<void> {
  // Mark as drawing
  await updateRoundStatus(roundId, 'DRAWING');

  const round = await prisma.lotteryRound.findUniqueOrThrow({
    where: { id: roundId },
  });

  const winningNumbers = drawWinningNumbers();
  const tickets = await getRoundTickets(roundId);

  const payoutResult = calculateLotteryPayouts(
    tickets.map(t => ({ userId: t.userId, numbers: t.numbers })),
    winningNumbers,
    round.jackpot,
    configService.getBigInt(S.lotteryJackpotRate),
    configService.getBigInt(S.lotterySecondRate),
    configService.getBigInt(S.lotteryTicketPrice),
  );

  // Distribute payouts
  const allPayouts = new Map<string, bigint>();

  for (const [userId, amount] of payoutResult.threeMatchUsers) {
    allPayouts.set(userId, (allPayouts.get(userId) ?? 0n) + amount);
  }
  for (const [userId, amount] of payoutResult.twoMatchUsers) {
    allPayouts.set(userId, (allPayouts.get(userId) ?? 0n) + amount);
  }
  for (const [userId, amount] of payoutResult.oneMatchUsers) {
    allPayouts.set(userId, (allPayouts.get(userId) ?? 0n) + amount);
  }

  await prisma.$transaction(async (tx) => {
    for (const [userId, amount] of allPayouts) {
      if (amount <= 0n) continue;

      await findOrCreateUser(userId);
      const user = await tx.user.update({
        where: { id: userId },
        data: { chips: { increment: amount } },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: 'LOTTERY_WIN',
          game: 'LOTTERY',
          amount,
          balanceAfter: user.chips,
          metadata: {
            roundId,
            winningNumbers,
          },
        },
      });
    }
  });

  // Complete round
  await updateRoundStatus(roundId, 'COMPLETED', winningNumbers);

  // Create next round with carryover
  const drawAt = new Date(Date.now() + LOTTERY_DRAW_INTERVAL_MS);
  await createRound(drawAt, payoutResult.nextRoundCarryover);

  logger.info(`Lottery draw completed for round ${roundId}`, {
    winningNumbers,
    totalTickets: tickets.length,
    jackpot: round.jackpot.toString(),
    carryover: payoutResult.nextRoundCarryover.toString(),
  });
}

export async function checkAndExecuteDraws(): Promise<number> {
  const readyRounds = await getDrawReadyRounds();
  let drawn = 0;

  for (const round of readyRounds) {
    try {
      await executeDraw(round.id);
      drawn++;
    } catch (err) {
      logger.error(`Failed to execute lottery draw for round ${round.id}`, {
        error: String(err),
      });
    }
  }

  return drawn;
}

export { getUserTicketCount };
