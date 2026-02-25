import {prisma} from '../client.js';
import type {LotteryRound, LotteryTicket} from '@prisma/client';

export async function getCurrentRound(): Promise<LotteryRound | null> {
    return prisma.lotteryRound.findFirst({
        where: {status: 'OPEN'},
        orderBy: {createdAt: 'desc'},
    });
}

export async function createRound(drawAt: Date, initialJackpot: bigint = 0n): Promise<LotteryRound> {
    return prisma.lotteryRound.create({
        data: {
            drawAt,
            jackpot: initialJackpot,
        },
    });
}

export async function addTicket(
    roundId: string,
    userId: string,
    numbers: number[],
): Promise<LotteryTicket> {
    return prisma.lotteryTicket.create({
        data: {
            roundId,
            userId,
            numbers,
        },
    });
}

export async function getUserTickets(
    roundId: string,
    userId: string,
): Promise<LotteryTicket[]> {
    return prisma.lotteryTicket.findMany({
        where: {roundId, userId},
        orderBy: {createdAt: 'asc'},
    });
}

export async function getUserTicketCount(
    roundId: string,
    userId: string,
): Promise<number> {
    return prisma.lotteryTicket.count({
        where: {roundId, userId},
    });
}

export async function getRoundTickets(
    roundId: string,
): Promise<LotteryTicket[]> {
    return prisma.lotteryTicket.findMany({
        where: {roundId},
    });
}

export async function getRoundTicketCount(
    roundId: string,
): Promise<number> {
    return prisma.lotteryTicket.count({
        where: {roundId},
    });
}

export async function getRecentCompletedRounds(
    limit: number = 5,
): Promise<(LotteryRound & { _count: { tickets: number } })[]> {
    return prisma.lotteryRound.findMany({
        where: {status: 'COMPLETED'},
        orderBy: {drawnAt: 'desc'},
        take: limit,
        include: {
            _count: {select: {tickets: true}},
        },
    });
}

export async function updateRoundStatus(
    roundId: string,
    status: 'OPEN' | 'DRAWING' | 'COMPLETED',
    winningNumbers?: number[],
): Promise<LotteryRound> {
    return prisma.lotteryRound.update({
        where: {id: roundId},
        data: {
            status,
            ...(winningNumbers ? {winningNumbers} : {}),
            ...(status === 'COMPLETED' ? {drawnAt: new Date()} : {}),
        },
    });
}

export async function incrementJackpot(
    roundId: string,
    amount: bigint,
): Promise<LotteryRound> {
    return prisma.lotteryRound.update({
        where: {id: roundId},
        data: {jackpot: {increment: amount}},
    });
}

export async function getDrawReadyRounds(): Promise<LotteryRound[]> {
    return prisma.lotteryRound.findMany({
        where: {
            status: 'OPEN',
            drawAt: {lte: new Date()},
        },
    });
}
