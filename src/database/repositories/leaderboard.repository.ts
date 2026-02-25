import {prisma} from '../client.js';

export type LeaderboardCategory = 'chips' | 'net_worth' | 'total_won' | 'work_level' | 'shop_spend' | 'achievements';

export interface LeaderboardEntry {
    id: string;
    chips: bigint;
    bankBalance: bigint;
    totalWon: bigint;
    totalGames: number;
    workLevel: number;
    workXp: number;
    lifetimeShopSpend: bigint;
    achievementCount: number;
}

const CATEGORY_SELECTS: Record<LeaderboardCategory, Record<string, boolean | object>> = {
    chips: {id: true, chips: true, totalGames: true},
    net_worth: {}, // handled by raw SQL
    total_won: {id: true, totalWon: true},
    work_level: {id: true, workLevel: true, workXp: true},
    shop_spend: {id: true, lifetimeShopSpend: true},
    achievements: {id: true, _count: {select: {achievements: true}}},
};

const ENTRY_DEFAULTS: Omit<LeaderboardEntry, 'id'> = {
    chips: 0n,
    bankBalance: 0n,
    totalWon: 0n,
    totalGames: 0,
    workLevel: 0,
    workXp: 0,
    lifetimeShopSpend: 0n,
    achievementCount: 0,
};

function toEntry(row: Record<string, unknown>): LeaderboardEntry {
    return {
        ...ENTRY_DEFAULTS,
        id: row.id as string,
        ...(row.chips != null && {chips: row.chips as bigint}),
        ...(row.bankBalance != null && {bankBalance: row.bankBalance as bigint}),
        ...(row.totalWon != null && {totalWon: row.totalWon as bigint}),
        ...(row.totalGames != null && {totalGames: row.totalGames as number}),
        ...(row.workLevel != null && {workLevel: row.workLevel as number}),
        ...(row.workXp != null && {workXp: row.workXp as number}),
        ...(row.lifetimeShopSpend != null && {lifetimeShopSpend: row.lifetimeShopSpend as bigint}),
        ...(row._count != null && {achievementCount: (row._count as { achievements: number }).achievements}),
    };
}

export async function getTopPlayers(
    category: LeaderboardCategory,
    limit = 10,
    offset = 0,
): Promise<LeaderboardEntry[]> {
    if (category === 'net_worth') {
        const rows = await prisma.$queryRaw<{ id: string; chips: bigint; bankBalance: bigint }[]>`
      SELECT "id", "chips", "bankBalance"
      FROM "User"
      ORDER BY ("chips" + "bankBalance") DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
        return rows.map(r => ({
            ...ENTRY_DEFAULTS,
            id: r.id,
            chips: r.chips,
            bankBalance: r.bankBalance,
        }));
    }

    const orderByMap = {
        chips: {chips: 'desc' as const},
        total_won: {totalWon: 'desc' as const},
        work_level: [{workLevel: 'desc' as const}, {workXp: 'desc' as const}],
        shop_spend: {lifetimeShopSpend: 'desc' as const},
        achievements: {achievements: {_count: 'desc' as const}},
    };

    const users = await prisma.user.findMany({
        select: CATEGORY_SELECTS[category] as never,
        orderBy: orderByMap[category] as never,
        take: limit,
        skip: offset,
    });

    return (users as Record<string, unknown>[]).map(toEntry);
}

export async function getTotalPlayerCount(): Promise<number> {
    return prisma.user.count();
}

export async function getUserRank(userId: string, category: LeaderboardCategory): Promise<number> {
    if (category === 'achievements') {
        const userAchCount = await prisma.userAchievement.count({
            where: {userId},
        });
        const result = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM (
        SELECT "userId" FROM "UserAchievement"
        GROUP BY "userId"
        HAVING COUNT(*) > ${userAchCount}
      ) t
    `;
        return Number(result[0].count) + 1;
    }

    if (category === 'net_worth') {
        const user = await prisma.user.findUnique({
            where: {id: userId},
            select: {chips: true, bankBalance: true},
        });
        if (!user) return -1;
        const userNetWorth = user.chips + user.bankBalance;

        const count = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM "User"
      WHERE ("chips" + "bankBalance") > ${userNetWorth}
    `;
        return Number(count[0].count) + 1;
    }

    if (category === 'work_level') {
        const user = await prisma.user.findUnique({
            where: {id: userId},
            select: {workLevel: true, workXp: true},
        });
        if (!user) return -1;

        const count = await prisma.user.count({
            where: {
                OR: [
                    {workLevel: {gt: user.workLevel}},
                    {workLevel: user.workLevel, workXp: {gt: user.workXp}},
                ],
            },
        });
        return count + 1;
    }

    // chips, total_won, shop_spend
    const user = await prisma.user.findUnique({
        where: {id: userId},
        select: {chips: true, totalWon: true, lifetimeShopSpend: true},
    });
    if (!user) return -1;

    const rankField = category === 'total_won' ? 'totalWon'
        : category === 'shop_spend' ? 'lifetimeShopSpend'
            : 'chips';

    const count = await prisma.user.count({
        where: {[rankField]: {gt: user[rankField]}},
    });
    return count + 1;
}
