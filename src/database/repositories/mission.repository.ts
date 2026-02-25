import {prisma} from '../client.js';
import type {DailyMission} from '@prisma/client';

export async function getMissionsForDate(
    userId: string,
    date: string,
): Promise<DailyMission[]> {
    return prisma.dailyMission.findMany({
        where: {userId, date},
        orderBy: {createdAt: 'asc'},
    });
}

export async function createMission(data: {
    userId: string;
    missionKey: string;
    target: number;
    reward: bigint;
    date: string;
}): Promise<DailyMission> {
    return prisma.dailyMission.create({data});
}

export async function incrementProgress(
    userId: string,
    missionKey: string,
    date: string,
    amount: number,
): Promise<DailyMission> {
    return prisma.dailyMission.update({
        where: {
            userId_missionKey_date: {userId, missionKey, date},
        },
        data: {
            progress: {increment: amount},
        },
    });
}

export async function markCompleted(
    userId: string,
    missionKey: string,
    date: string,
): Promise<DailyMission> {
    return prisma.dailyMission.update({
        where: {
            userId_missionKey_date: {userId, missionKey, date},
        },
        data: {completed: true},
    });
}
