import {prisma} from '../client.js';

export async function getUserAchievements(userId: string) {
    return prisma.userAchievement.findMany({
        where: {userId},
        orderBy: {unlockedAt: 'asc'},
    });
}

export async function getUnlockedIds(userId: string): Promise<Set<string>> {
    const achievements = await prisma.userAchievement.findMany({
        where: {userId},
        select: {achievementId: true},
    });
    return new Set(achievements.map(a => a.achievementId));
}

export async function unlockAchievement(
    userId: string,
    achievementId: string,
): Promise<boolean> {
    try {
        await prisma.userAchievement.create({
            data: {userId, achievementId},
        });
        return true;
    } catch {
        // Already unlocked (unique constraint)
        return false;
    }
}

export async function getAchievementCount(userId: string): Promise<number> {
    return prisma.userAchievement.count({
        where: {userId},
    });
}
