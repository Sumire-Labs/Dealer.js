// ── Setting definition registry ──────────────────────────────────────
// Each entry describes one configurable numeric constant.
// Priority at runtime: DB override > YAML override > defaultValue.

export interface SettingDef<T extends 'bigint' | 'number'> {
  readonly key: string;        // DB / YAML key  e.g. 'economy.initial_chips'
  readonly category: string;   // category id     e.g. 'economy'
  readonly type: T;
  readonly defaultValue: T extends 'bigint' ? bigint : number;
  readonly min: number;        // validation min (in display units)
  readonly max: number;        // validation max (in display units)
  readonly label: string;      // Japanese UI label
  readonly unit: string;       // display suffix  e.g. 'チップ', '%', '分'
  readonly uiDivisor: number;  // stored_value / uiDivisor = display_value
}

export type AnySettingDef = SettingDef<'bigint'> | SettingDef<'number'>;

export interface CategoryMeta {
  readonly id: string;
  readonly emoji: string;
  readonly label: string;
  readonly settings: readonly AnySettingDef[];
}

// ── Helper factories ─────────────────────────────────────────────────

function chips(
  key: string, category: string, defaultValue: bigint,
  min: number, max: number, label: string,
): SettingDef<'bigint'> {
  return { key, category, type: 'bigint', defaultValue, min, max, label, unit: 'チップ', uiDivisor: 1 };
}

function bigintPercent(
  key: string, category: string, defaultValue: bigint,
  min: number, max: number, label: string,
): SettingDef<'bigint'> {
  return { key, category, type: 'bigint', defaultValue, min, max, label, unit: '%', uiDivisor: 1 };
}

function percent(
  key: string, category: string, defaultValue: number,
  min: number, max: number, label: string,
): SettingDef<'number'> {
  return { key, category, type: 'number', defaultValue, min, max, label, unit: '%', uiDivisor: 1 };
}

function count(
  key: string, category: string, defaultValue: number,
  min: number, max: number, label: string,
): SettingDef<'number'> {
  return { key, category, type: 'number', defaultValue, min, max, label, unit: '', uiDivisor: 1 };
}

function hours(
  key: string, category: string, defaultMs: number,
  minH: number, maxH: number, label: string,
): SettingDef<'number'> {
  return { key, category, type: 'number', defaultValue: defaultMs, min: minH, max: maxH, label, unit: '時間', uiDivisor: 3_600_000 };
}

function minutes(
  key: string, category: string, defaultMs: number,
  minM: number, maxM: number, label: string,
): SettingDef<'number'> {
  return { key, category, type: 'number', defaultValue: defaultMs, min: minM, max: maxM, label, unit: '分', uiDivisor: 60_000 };
}

function seconds(
  key: string, category: string, defaultMs: number,
  minS: number, maxS: number, label: string,
): SettingDef<'number'> {
  return { key, category, type: 'number', defaultValue: defaultMs, min: minS, max: maxS, label, unit: '秒', uiDivisor: 1_000 };
}

// ── All 53 settings ──────────────────────────────────────────────────

export const S = {
  // ── Economy (5) ────────────────────────────────────────────────────
  initialChips:         chips('economy.initial_chips', 'economy', 10_000n, 1_000, 100_000_000, '初期チップ'),
  bankInterestRate:     bigintPercent('economy.bank_interest_rate', 'economy', 1n, 0, 100, '銀行日利'),
  dailyBonus:           chips('economy.daily_bonus', 'economy', 2_500n, 100, 10_000_000, 'デイリーボーナス'),
  dailyBonusBroke:      chips('economy.daily_bonus_broke', 'economy', 5_000n, 100, 10_000_000, 'デイリー(破産時)'),
  missionCompleteBonus: chips('economy.mission_complete_bonus', 'economy', 3_000n, 100, 10_000_000, 'ミッション完了報酬'),

  // ── Bets (6) ───────────────────────────────────────────────────────
  minBet:       chips('bet.min_bet', 'bet', 100n, 1, 1_000_000, '最低ベット'),
  maxSlots:     chips('bet.max_slots', 'bet', 50_000n, 1_000, 1_000_000_000, 'スロット上限'),
  maxBlackjack: chips('bet.max_blackjack', 'bet', 100_000n, 1_000, 1_000_000_000, 'BJ上限'),
  maxHorseRace: chips('bet.max_horse_race', 'bet', 100_000n, 1_000, 1_000_000_000, '競馬上限'),
  maxCoinflip:  chips('bet.max_coinflip', 'bet', 500_000n, 1_000, 1_000_000_000, 'コイン上限'),
  maxRoulette:  chips('bet.max_roulette', 'bet', 100_000n, 1_000, 1_000_000_000, 'ルーレット上限'),

  // ── Loans (4) ──────────────────────────────────────────────────────
  loanMaxTotal:     chips('loan.max_total', 'loan', 100_000n, 1_000, 1_000_000_000, '借入上限(合計)'),
  loanMinAmount:    chips('loan.min_amount', 'loan', 1_000n, 100, 100_000_000, '最小借入額'),
  loanMaxAmount:    chips('loan.max_amount', 'loan', 50_000n, 100, 1_000_000_000, '最大借入額'),
  loanInterestRate: bigintPercent('loan.interest_rate', 'loan', 10n, 0, 100, 'ローン利率'),

  // ── Bankruptcy (3) ─────────────────────────────────────────────────
  bankruptcyChips:           chips('bankruptcy.chips', 'bankruptcy', 2_500n, 100, 10_000_000, '破産救済金'),
  bankruptcyPenaltyRate:     percent('bankruptcy.penalty_rate', 'bankruptcy', 10, 0, 100, '破産ペナルティ率'),
  bankruptcyPenaltyDuration: minutes('bankruptcy.penalty_duration_ms', 'bankruptcy', 60 * 60 * 1000, 1, 1440, '破産ペナルティ時間'),

  // ── Work (7) ───────────────────────────────────────────────────────
  workShortCD:     hours('work.short_cd_ms', 'work', 1 * 60 * 60 * 1000, 1, 72, '短期CD'),
  workNormalCD:    hours('work.normal_cd_ms', 'work', 4 * 60 * 60 * 1000, 1, 72, '通常CD'),
  workLongCD:      hours('work.long_cd_ms', 'work', 8 * 60 * 60 * 1000, 1, 168, '長期CD'),
  tipMin:          chips('work.tip_min', 'work', 200n, 1, 1_000_000, 'チップ最小'),
  tipMax:          chips('work.tip_max', 'work', 500n, 1, 10_000_000, 'チップ最大'),
  streakMaxBonus:  percent('work.streak_max_bonus', 'work', 20, 0, 100, '連勤ボーナス上限'),
  multiStepChance: percent('work.multi_step_chance', 'work', 25, 0, 100, 'マルチステップ確率'),

  // ── Heist (7) ──────────────────────────────────────────────────────
  heistMinEntry:       chips('heist.min_entry', 'heist', 1_000n, 100, 10_000_000, '最低参加費'),
  heistBaseRate:       percent('heist.base_rate', 'heist', 30, 0, 100, '基本成功率'),
  heistPerPlayerBonus: percent('heist.per_player_bonus', 'heist', 10, 0, 50, '人数ボーナス'),
  heistMaxRate:        percent('heist.max_rate', 'heist', 80, 1, 100, '最大成功率'),
  heistMinRate:        percent('heist.min_rate', 'heist', 5, 0, 100, '最小成功率'),
  heistSoloPenalty:    percent('heist.solo_penalty', 'heist', 15, 0, 100, 'ソロペナルティ'),
  heistChannelCD:      minutes('heist.channel_cd_ms', 'heist', 60 * 60 * 1000, 1, 1440, 'チャンネルCD'),

  // ── Prison (4) ─────────────────────────────────────────────────────
  prisonDuration:         minutes('prison.duration_ms', 'prison', 5 * 60 * 1000, 1, 60, '収監時間'),
  prisonFine:             chips('prison.fine', 'prison', 5_000n, 100, 10_000_000, '罰金'),
  prisonJailbreakRate:    percent('prison.jailbreak_rate', 'prison', 30, 0, 100, '脱獄成功率'),
  prisonJailbreakPenalty: minutes('prison.jailbreak_penalty_ms', 'prison', 3 * 60 * 1000, 1, 60, '脱獄失敗追加時間'),

  // ── Lottery (5) ────────────────────────────────────────────────────
  lotteryTicketPrice: chips('lottery.ticket_price', 'lottery', 1_000n, 100, 10_000_000, 'チケット価格'),
  lotteryMaxTickets:  count('lottery.max_tickets', 'lottery', 10, 1, 100, '最大購入枚数'),
  lotteryJackpotRate: bigintPercent('lottery.jackpot_rate', 'lottery', 70n, 0, 100, 'JP配当率'),
  lotterySecondRate:  bigintPercent('lottery.second_rate', 'lottery', 20n, 0, 100, '2等配当率'),
  lotteryHouseRate:   bigintPercent('lottery.house_rate', 'lottery', 10n, 0, 100, 'ハウス率'),

  // ── Poker (3) ──────────────────────────────────────────────────────
  pokerMinBuyin:      chips('poker.min_buyin', 'poker', 2_000n, 100, 10_000_000, '最低バイイン'),
  pokerMaxBuyin:      chips('poker.max_buyin', 'poker', 100_000n, 1_000, 1_000_000_000, '最大バイイン'),
  pokerActionTimeout: seconds('poker.action_timeout_ms', 'poker', 45_000, 10, 300, 'アクション制限時間'),

  // ── Business (5) ───────────────────────────────────────────────────
  businessUnlockLevel: count('business.unlock_level', 'business', 3, 1, 100, '開放レベル'),
  businessEmployeeMax: count('business.employee_max', 'business', 3, 1, 20, '最大従業員数'),
  businessOwnerBonus:  percent('business.owner_bonus', 'business', 10, 0, 100, 'オーナーボーナス'),
  businessSalaryRate:  percent('business.salary_rate', 'business', 5, 0, 100, '給料率'),
  businessEventChance: percent('business.event_chance', 'business', 25, 0, 100, 'イベント確率'),

  // ── Team (4) ───────────────────────────────────────────────────────
  teamShiftBonus:    percent('team.shift_bonus', 'team', 15, 0, 100, 'シフトボーナス/人'),
  overtimeMaxRounds: count('team.overtime_max_rounds', 'team', 3, 1, 10, '残業最大ラウンド'),
  overtimeRisk:      percent('team.overtime_risk', 'team', 15, 0, 100, '残業リスク/ラウンド'),
  weeklyAllBonus:    chips('team.weekly_all_bonus', 'team', 25_000n, 1_000, 100_000_000, 'ウィークリー全達成報酬'),
};

// ── Aggregate helpers ────────────────────────────────────────────────

export const ALL_SETTINGS: readonly AnySettingDef[] = Object.values(S);

export const SETTING_BY_KEY = new Map<string, AnySettingDef>(
  ALL_SETTINGS.map(def => [def.key, def]),
);

export const SETTING_CATEGORIES: readonly CategoryMeta[] = [
  { id: 'economy',    emoji: '\u{1F4B0}', label: '経済',       settings: [S.initialChips, S.bankInterestRate, S.dailyBonus, S.dailyBonusBroke, S.missionCompleteBonus] },
  { id: 'bet',        emoji: '\u{1F3B2}', label: 'ベット',     settings: [S.minBet, S.maxSlots, S.maxBlackjack, S.maxHorseRace, S.maxCoinflip, S.maxRoulette] },
  { id: 'loan',       emoji: '\u{1F3E6}', label: 'ローン',     settings: [S.loanMaxTotal, S.loanMinAmount, S.loanMaxAmount, S.loanInterestRate] },
  { id: 'bankruptcy', emoji: '\u{1F480}', label: '破産',       settings: [S.bankruptcyChips, S.bankruptcyPenaltyRate, S.bankruptcyPenaltyDuration] },
  { id: 'work',       emoji: '\u{1F4BC}', label: '労働',       settings: [S.workShortCD, S.workNormalCD, S.workLongCD, S.tipMin, S.tipMax, S.streakMaxBonus, S.multiStepChance] },
  { id: 'heist',      emoji: '\u{1F52B}', label: '強盗',       settings: [S.heistMinEntry, S.heistBaseRate, S.heistPerPlayerBonus, S.heistMaxRate, S.heistMinRate, S.heistSoloPenalty, S.heistChannelCD] },
  { id: 'prison',     emoji: '\u{1F46E}', label: '刑務所',     settings: [S.prisonDuration, S.prisonFine, S.prisonJailbreakRate, S.prisonJailbreakPenalty] },
  { id: 'lottery',    emoji: '\u{1F3AB}', label: '宝くじ',     settings: [S.lotteryTicketPrice, S.lotteryMaxTickets, S.lotteryJackpotRate, S.lotterySecondRate, S.lotteryHouseRate] },
  { id: 'poker',      emoji: '\u{1F0CF}', label: 'ポーカー',   settings: [S.pokerMinBuyin, S.pokerMaxBuyin, S.pokerActionTimeout] },
  { id: 'business',   emoji: '\u{1F3E2}', label: 'ビジネス',   settings: [S.businessUnlockLevel, S.businessEmployeeMax, S.businessOwnerBonus, S.businessSalaryRate, S.businessEventChance] },
  { id: 'team',       emoji: '\u{1F465}', label: 'チーム',     settings: [S.teamShiftBonus, S.overtimeMaxRounds, S.overtimeRisk, S.weeklyAllBonus] },
];
