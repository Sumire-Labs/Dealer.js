export const DAILY_RESET_HOUR_JST = 5; // 毎朝 JST 05:00 リセット

export const RACE_BETTING_DURATION_MS = 60_000; // 60 seconds
export const RACE_MIN_PLAYERS = 2;
export const RACE_HORSE_COUNT = 5;

export const POKER_MIN_PLAYERS = 2;
export const POKER_MAX_PLAYERS = 6;
export const POKER_LOBBY_DURATION_MS = 60_000;

// Loan & Bank
export const LOAN_INTEREST_PERIOD_MS = 10 * 60 * 60 * 1000; // 10 hours
export const BANK_INTEREST_PERIOD_MS = 24 * 60 * 60 * 1000; // 24h
export const BANK_MIN_BALANCE_FOR_INTEREST = 100n;           // 利息最低残高

// Lottery
export const LOTTERY_NUMBER_MIN = 1;
export const LOTTERY_NUMBER_MAX = 9;
export const LOTTERY_NUMBERS_COUNT = 3;
export const LOTTERY_DRAW_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Heist
export const HEIST_MIN_PLAYERS = 1;
export const HEIST_GROUP_MIN_PLAYERS = 2;
export const HEIST_MAX_PLAYERS = 8;
export const HEIST_LOBBY_DURATION_MS = 60_000;
export const HEIST_SOLO_MULTIPLIER_SCALE = 0.7;
export const HEIST_SOLO_MIN_MULTIPLIER = 1.2;

// Prison
export const PRISON_JAILBREAK_COOLDOWN_MS = 60 * 1000;        // 脱獄再挑戦CD 1分

// Work
export const WORK_STREAK_WINDOW_MS = 24 * 60 * 60 * 1000;     // 24 hours

// Special Shifts
export const SPECIAL_SHIFT_CACHE_TTL_MS = 60_000;             // 60s anti-fishing
export const SPECIAL_SHIFT_TRAINING_CD_MS = 2 * 60 * 60 * 1000; // 2 hours

// Weekly Challenges
export const WEEKLY_CHALLENGE_COUNT = 3;

// Multi-step events
export const MULTI_STEP_SESSION_TTL_MS = 10 * 60 * 1000;     // 10 minutes

// Overtime
export const OVERTIME_MULTIPLIERS = [1.5, 2.0, 3.0];
export const OVERTIME_SESSION_TTL_MS = 5 * 60 * 1000;         // 5 minutes

// Team Shift
export const TEAM_SHIFT_MIN_PLAYERS = 2;
export const TEAM_SHIFT_MAX_PLAYERS = 4;
export const TEAM_SHIFT_LOBBY_DURATION_MS = 60_000;

// Business
export const BUSINESS_MAX_ACCUMULATION_MS = 24 * 60 * 60 * 1000; // 24h

// Blackjack Table (Multiplayer)
export const BJ_TABLE_MIN_PLAYERS = 2;
export const BJ_TABLE_MAX_PLAYERS = 6;
export const BJ_TABLE_LOBBY_DURATION_MS = 60_000;
export const BJ_TABLE_TURN_TIMEOUT_MS = 30_000;

export const COMMAND_COOLDOWN_MS = 3_000; // 3 seconds default cooldown
