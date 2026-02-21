import type { GameType } from '@prisma/client';

export type MissionType =
  | 'play_game'
  | 'win_game'
  | 'earn_chips'
  | 'bet_chips'
  | 'work'
  | 'daily';

export type MissionDifficulty = 'easy' | 'medium' | 'hard';

export interface MissionDefinition {
  key: string;
  name: string;
  type: MissionType;
  gameType?: GameType | 'any';
  target: number;
  reward: bigint;
  difficulty: MissionDifficulty;
}

export interface MissionEvent {
  type: 'game_play' | 'game_win' | 'chips_earned' | 'chips_bet' | 'work' | 'daily';
  gameType?: GameType;
  amount?: number;
}

export interface CompletedMission {
  missionKey: string;
  name: string;
  reward: bigint;
}

// Easy missions ($500-$1,000)
const EASY_MISSIONS: MissionDefinition[] = [
  {
    key: 'daily_1',
    name: 'ログインボーナス',
    type: 'daily',
    target: 1,
    reward: 500n,
    difficulty: 'easy',
  },
  {
    key: 'play_any_3',
    name: 'カジノ巡り',
    type: 'play_game',
    gameType: 'any',
    target: 3,
    reward: 800n,
    difficulty: 'easy',
  },
  {
    key: 'play_slots_3',
    name: 'スロット回し',
    type: 'play_game',
    gameType: 'SLOTS',
    target: 3,
    reward: 700n,
    difficulty: 'easy',
  },
  {
    key: 'play_coinflip_3',
    name: 'コイントス',
    type: 'play_game',
    gameType: 'COINFLIP',
    target: 3,
    reward: 700n,
    difficulty: 'easy',
  },
  {
    key: 'play_roulette_3',
    name: 'ルーレット入門',
    type: 'play_game',
    gameType: 'ROULETTE',
    target: 3,
    reward: 700n,
    difficulty: 'easy',
  },
  {
    key: 'work_1',
    name: 'お仕事',
    type: 'work',
    target: 1,
    reward: 600n,
    difficulty: 'easy',
  },
  {
    key: 'bet_5000',
    name: '小さな勇気',
    type: 'bet_chips',
    target: 5_000,
    reward: 1_000n,
    difficulty: 'easy',
  },
];

// Medium missions ($1,500-$2,500)
const MEDIUM_MISSIONS: MissionDefinition[] = [
  {
    key: 'win_any_3',
    name: '3連勝',
    type: 'win_game',
    gameType: 'any',
    target: 3,
    reward: 2_000n,
    difficulty: 'medium',
  },
  {
    key: 'play_bj_3',
    name: 'ブラックジャック勝負',
    type: 'play_game',
    gameType: 'BLACKJACK',
    target: 3,
    reward: 1_500n,
    difficulty: 'medium',
  },
  {
    key: 'play_any_7',
    name: 'カジノ常連',
    type: 'play_game',
    gameType: 'any',
    target: 7,
    reward: 1_800n,
    difficulty: 'medium',
  },
  {
    key: 'bet_15000',
    name: '度胸試し',
    type: 'bet_chips',
    target: 15_000,
    reward: 2_500n,
    difficulty: 'medium',
  },
  {
    key: 'work_2',
    name: 'ダブルシフト',
    type: 'work',
    target: 2,
    reward: 1_500n,
    difficulty: 'medium',
  },
  {
    key: 'win_slots_2',
    name: 'スロットマスター',
    type: 'win_game',
    gameType: 'SLOTS',
    target: 2,
    reward: 2_000n,
    difficulty: 'medium',
  },
];

// Hard missions ($3,000-$5,000)
const HARD_MISSIONS: MissionDefinition[] = [
  {
    key: 'win_any_5',
    name: '勝利の道',
    type: 'win_game',
    gameType: 'any',
    target: 5,
    reward: 4_000n,
    difficulty: 'hard',
  },
  {
    key: 'earn_10000',
    name: '荒稼ぎ',
    type: 'earn_chips',
    target: 10_000,
    reward: 3_500n,
    difficulty: 'hard',
  },
  {
    key: 'bet_30000',
    name: 'ハイローラー',
    type: 'bet_chips',
    target: 30_000,
    reward: 5_000n,
    difficulty: 'hard',
  },
  {
    key: 'play_any_12',
    name: 'マラソンプレイ',
    type: 'play_game',
    gameType: 'any',
    target: 12,
    reward: 3_500n,
    difficulty: 'hard',
  },
  {
    key: 'win_roulette_3',
    name: 'ルーレットの達人',
    type: 'win_game',
    gameType: 'ROULETTE',
    target: 3,
    reward: 4_000n,
    difficulty: 'hard',
  },
];

export const MISSION_POOLS: Record<MissionDifficulty, MissionDefinition[]> = {
  easy: EASY_MISSIONS,
  medium: MEDIUM_MISSIONS,
  hard: HARD_MISSIONS,
};

export const MISSION_MAP = new Map<string, MissionDefinition>(
  [...EASY_MISSIONS, ...MEDIUM_MISSIONS, ...HARD_MISSIONS].map(m => [m.key, m]),
);
