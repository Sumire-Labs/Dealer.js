import type {UserCollection} from '@prisma/client';
import {prisma} from '../client.js';

export async function getUserCollections(userId: string): Promise<UserCollection[]> {
    return prisma.userCollection.findMany({
        where: {userId},
        orderBy: {completedAt: 'asc'},
    });
}

export async function hasCollection(userId: string, key: string): Promise<boolean> {
    const record = await prisma.userCollection.findUnique({
        where: {userId_collectionKey: {userId, collectionKey: key}},
    });
    return record !== null;
}

export async function completeCollection(
    userId: string,
    key: string,
    tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
): Promise<UserCollection> {
    const db = tx ?? prisma;
    return db.userCollection.create({
        data: {userId, collectionKey: key},
    });
}
