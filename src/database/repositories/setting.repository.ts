import type {BotSetting, Prisma} from '@prisma/client';
import {prisma} from '../client.js';

export async function getSetting(key: string): Promise<Prisma.JsonValue | null> {
    const setting = await prisma.botSetting.findUnique({where: {key}});
    return setting?.value ?? null;
}

export async function upsertSetting(key: string, value: Prisma.InputJsonValue): Promise<void> {
    await prisma.botSetting.upsert({
        where: {key},
        update: {value},
        create: {key, value},
    });
}

export async function deleteSetting(key: string): Promise<void> {
    await prisma.botSetting.deleteMany({where: {key}});
}

export async function getAllSettings(): Promise<BotSetting[]> {
    return prisma.botSetting.findMany();
}
