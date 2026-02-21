export const INITIAL_CHIPS = 10_000n;
export const DAILY_BONUS = 2_500n;
export const DAILY_BONUS_BROKE = 5_000n;
export const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

export const MIN_BET = 100n;
export const MAX_BET_SLOTS = 50_000n;
export const MAX_BET_BLACKJACK = 100_000n;
export const MAX_BET_HORSE_RACE = 100_000n;
export const MAX_BET_COINFLIP = 500_000n;

export const RACE_BETTING_DURATION_MS = 60_000; // 60 seconds
export const RACE_MIN_PLAYERS = 2;
export const RACE_HORSE_COUNT = 5;

export const POKER_MIN_BUYIN = 2_000n;
export const POKER_MAX_BUYIN = 100_000n;
export const POKER_MIN_PLAYERS = 2;
export const POKER_MAX_PLAYERS = 6;
export const POKER_LOBBY_DURATION_MS = 60_000;
export const POKER_ACTION_TIMEOUT_MS = 45_000;

// Loan & Bankruptcy
export const LOAN_MAX_TOTAL = 100_000n;
export const LOAN_MIN_AMOUNT = 1_000n;
export const LOAN_MAX_AMOUNT = 50_000n;
export const LOAN_INTEREST_RATE = 10n; // 10%
export const LOAN_INTEREST_PERIOD_MS = 10 * 60 * 60 * 1000; // 10 hours
export const BANKRUPTCY_CHIPS = 2_500n;
export const BANKRUPTCY_PENALTY_DURATION_MS = 60 * 60 * 1000; // 1 hour
export const BANKRUPTCY_PENALTY_RATE = 10; // 10% reduction

// Bank Account & Interest
export const BANK_INTEREST_RATE = 1n;               // 日利 1%
export const BANK_INTEREST_PERIOD_MS = 24 * 60 * 60 * 1000; // 24h
export const BANK_MIN_BALANCE_FOR_INTEREST = 100n;   // 利息最低残高

// Lottery
export const LOTTERY_TICKET_PRICE = 1_000n;
export const LOTTERY_MAX_TICKETS_PER_ROUND = 10;
export const LOTTERY_NUMBER_MIN = 1;
export const LOTTERY_NUMBER_MAX = 9;
export const LOTTERY_NUMBERS_COUNT = 3;
export const LOTTERY_DRAW_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const LOTTERY_JACKPOT_PAYOUT_RATE = 70n;  // 3 match: pot × 70%
export const LOTTERY_SECOND_PAYOUT_RATE = 20n;   // 2 match: pot × 20%
export const LOTTERY_HOUSE_RATE = 10n;            // 10% chip sink

// Heist
export const HEIST_MIN_ENTRY = 1_000n;
export const HEIST_MAX_ENTRY = 100_000n;
export const HEIST_MIN_PLAYERS = 2;
export const HEIST_MAX_PLAYERS = 6;
export const HEIST_LOBBY_DURATION_MS = 60_000;
export const HEIST_BASE_SUCCESS_RATE = 30;
export const HEIST_PER_PLAYER_BONUS = 10;
export const HEIST_MAX_SUCCESS_RATE = 80;
export const HEIST_MIN_MULTIPLIER = 2.0;
export const HEIST_MAX_MULTIPLIER = 4.0;
export const HEIST_CHANNEL_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

// Work
export const WORK_SHORT_COOLDOWN_MS = 1 * 60 * 60 * 1000;   // 1 hour
export const WORK_NORMAL_COOLDOWN_MS = 4 * 60 * 60 * 1000;  // 4 hours
export const WORK_LONG_COOLDOWN_MS = 8 * 60 * 60 * 1000;    // 8 hours
export const WORK_STREAK_WINDOW_MS = 24 * 60 * 60 * 1000;   // 24 hours
export const WORK_STREAK_MAX_BONUS = 20;                     // max +20%
export const WORK_TIP_MIN = 200n;
export const WORK_TIP_MAX = 500n;

// Roulette
export const MAX_BET_ROULETTE = 100_000n;

// Missions
export const MISSION_COMPLETE_BONUS = 3_000n;

export const COMMAND_COOLDOWN_MS = 3_000; // 3 seconds default cooldown
