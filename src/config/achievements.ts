import type { GameType } from '@prisma/client';

export type AchievementCategory = 'gaming' | 'economy' | 'social' | 'special';
export type AchievementContext =
  | 'game_result'
  | 'daily_claim'
  | 'economy_change'
  | 'bankruptcy'
  | 'loan'
  | 'lottery'
  | 'heist'
  | 'multiplayer';

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  emoji: string;
  category: AchievementCategory;
  contexts: AchievementContext[];
  hidden: boolean;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  // Gaming
  {
    id: 'FIRST_WIN',
    name: '初勝利',
    description: '初めてゲームに勝利する',
    emoji: '🌟',
    category: 'gaming',
    contexts: ['game_result'],
    hidden: false,
  },
  {
    id: 'WIN_STREAK_5',
    name: '5連勝',
    description: '直近5ゲーム全勝する',
    emoji: '🔥',
    category: 'gaming',
    contexts: ['game_result'],
    hidden: false,
  },
  {
    id: 'GAMES_10',
    name: 'カジノ常連',
    description: '10回プレイする',
    emoji: '🎮',
    category: 'gaming',
    contexts: ['game_result'],
    hidden: false,
  },
  {
    id: 'GAMES_100',
    name: 'ハイローラー',
    description: '100回プレイする',
    emoji: '🎲',
    category: 'gaming',
    contexts: ['game_result'],
    hidden: false,
  },
  {
    id: 'GAMES_1000',
    name: 'カジノの王',
    description: '1000回プレイする',
    emoji: '👑',
    category: 'gaming',
    contexts: ['game_result'],
    hidden: false,
  },
  {
    id: 'SLOTS_JACKPOT',
    name: 'ジャックポット！',
    description: 'スロットで500xを出す',
    emoji: '💎',
    category: 'gaming',
    contexts: ['game_result'],
    hidden: true,
  },
  {
    id: 'BLACKJACK_NATURAL',
    name: 'ナチュラル21',
    description: 'ブラックジャックでナチュラルを出す',
    emoji: '🃏',
    category: 'gaming',
    contexts: ['game_result'],
    hidden: false,
  },
  {
    id: 'ALL_GAMES_PLAYED',
    name: 'オールラウンダー',
    description: '全ゲーム種をプレイする',
    emoji: '🎯',
    category: 'gaming',
    contexts: ['game_result'],
    hidden: false,
  },
  // Economy
  {
    id: 'RICH_10K',
    name: '小金持ち',
    description: '残高 $10,000 以上',
    emoji: '💵',
    category: 'economy',
    contexts: ['economy_change'],
    hidden: false,
  },
  {
    id: 'RICH_100K',
    name: '富豪',
    description: '残高 $100,000 以上',
    emoji: '💰',
    category: 'economy',
    contexts: ['economy_change'],
    hidden: false,
  },
  {
    id: 'RICH_1M',
    name: 'ミリオネア',
    description: '残高 $1,000,000 以上',
    emoji: '🏆',
    category: 'economy',
    contexts: ['economy_change'],
    hidden: false,
  },
  {
    id: 'FIRST_LOAN',
    name: '借金デビュー',
    description: '初めてローンを借りる',
    emoji: '📝',
    category: 'economy',
    contexts: ['loan'],
    hidden: false,
  },
  {
    id: 'DEBT_FREE',
    name: '完済',
    description: 'ローンを全て返済する',
    emoji: '✨',
    category: 'economy',
    contexts: ['loan'],
    hidden: false,
  },
  {
    id: 'BANKRUPTCY',
    name: '破産宣告',
    description: '破産を宣告する',
    emoji: '💸',
    category: 'economy',
    contexts: ['bankruptcy'],
    hidden: false,
  },
  // Social
  {
    id: 'DAILY_STREAK_7',
    name: '皆勤賞',
    description: '7日連続でデイリーボーナスを受け取る',
    emoji: '📅',
    category: 'social',
    contexts: ['daily_claim'],
    hidden: false,
  },
  {
    id: 'DAILY_STREAK_30',
    name: '常連さん',
    description: '30日連続でデイリーボーナスを受け取る',
    emoji: '🗓️',
    category: 'social',
    contexts: ['daily_claim'],
    hidden: false,
  },
  {
    id: 'MULTIPLAYER_FIRST',
    name: '初参加',
    description: 'マルチプレイヤーゲームに初参加する',
    emoji: '🤝',
    category: 'social',
    contexts: ['multiplayer'],
    hidden: false,
  },
  // Special
  {
    id: 'BIG_WIN',
    name: '大当たり',
    description: '1回で $50,000 以上獲得する',
    emoji: '🎉',
    category: 'special',
    contexts: ['game_result'],
    hidden: true,
  },
  {
    id: 'ROCK_BOTTOM',
    name: 'どん底',
    description: '残高が $0 になる',
    emoji: '😱',
    category: 'special',
    contexts: ['economy_change'],
    hidden: true,
  },
  {
    id: 'LOTTERY_JACKPOT',
    name: '宝くじ大当たり',
    description: '宝くじで3つ全て一致させる',
    emoji: '🎟️',
    category: 'special',
    contexts: ['lottery'],
    hidden: true,
  },
];

// Lookup maps
export const ACHIEVEMENT_MAP = new Map(
  ACHIEVEMENTS.map(a => [a.id, a]),
);

export const ACHIEVEMENTS_BY_CATEGORY = new Map<AchievementCategory, AchievementDefinition[]>();
for (const a of ACHIEVEMENTS) {
  const list = ACHIEVEMENTS_BY_CATEGORY.get(a.category) ?? [];
  list.push(a);
  ACHIEVEMENTS_BY_CATEGORY.set(a.category, list);
}

export const ACHIEVEMENTS_BY_CONTEXT = new Map<AchievementContext, AchievementDefinition[]>();
for (const a of ACHIEVEMENTS) {
  for (const ctx of a.contexts) {
    const list = ACHIEVEMENTS_BY_CONTEXT.get(ctx) ?? [];
    list.push(a);
    ACHIEVEMENTS_BY_CONTEXT.set(ctx, list);
  }
}

// All game types for ALL_GAMES_PLAYED check
export const ALL_GAME_TYPES: GameType[] = [
  'SLOTS', 'BLACKJACK', 'HORSE_RACE', 'COINFLIP', 'POKER',
];
