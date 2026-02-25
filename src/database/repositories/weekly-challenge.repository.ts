import {prisma} from '../client.js';
import type {Prisma, WorkWeeklyChallenge} from '@prisma/client';

export async function getChallengesForWeek(
    userId: string,
    weekStart: string,
): Promise<WorkWeeklyChallenge[]> {
    return prisma.workWeeklyChallenge.findMany({
        where: {userId, weekStart},
    });
}

export async function createChallenge(
    data: {
        userId: string;
        weekStart: string;
        challengeKey: string;
        target: number;
        reward: bigint;
    },
): Promise<WorkWeeklyChallenge> {
    return prisma.workWeeklyChallenge.create({data});
}

export async function updateProgress(
    id: string,
    progress: number,
    completed: boolean,
    tx?: Prisma.TransactionClient,
): Promise<WorkWeeklyChallenge> {
    const client = tx ?? prisma;
    return client.workWeeklyChallenge.update({
        where: {id},
        data: {progress, completed},
    });
}
