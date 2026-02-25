export type WeeklyChallengeType =
    | 'work_all_jobs'
    | 'long_shifts'
    | 'no_trouble_streak'
    | 'great_success_count'
    | 'earn_total'
    | 'work_count'
    | 'mastery_progress';

export interface WeeklyChallengeDefinition {
    key: string;
    name: string;
    type: WeeklyChallengeType;
    target: number;
    reward: bigint;
}

export const WEEKLY_CHALLENGE_POOL: WeeklyChallengeDefinition[] = [
    {
        key: 'all_jobs_once',
        name: '全ジョブで1回ずつ',
        type: 'work_all_jobs',
        target: 6,
        reward: 15_000n,
    },
    {
        key: 'long_shift_5',
        name: 'ロングシフト5回',
        type: 'long_shifts',
        target: 5,
        reward: 12_000n,
    },
    {
        key: 'no_trouble_7',
        name: 'トラブルなし7連勤',
        type: 'no_trouble_streak',
        target: 7,
        reward: 20_000n,
    },
    {
        key: 'great_success_3',
        name: '大成功3回',
        type: 'great_success_count',
        target: 3,
        reward: 15_000n,
    },
    {
        key: 'earn_20000',
        name: '合計$20,000稼ぐ',
        type: 'earn_total',
        target: 20_000,
        reward: 10_000n,
    },
    {
        key: 'work_10',
        name: '10回シフト',
        type: 'work_count',
        target: 10,
        reward: 12_000n,
    },
    {
        key: 'mastery_up',
        name: '熟練度レベルアップ',
        type: 'mastery_progress',
        target: 1,
        reward: 15_000n,
    },
];

export const WEEKLY_CHALLENGE_MAP = new Map(
    WEEKLY_CHALLENGE_POOL.map(c => [c.key, c]),
);
