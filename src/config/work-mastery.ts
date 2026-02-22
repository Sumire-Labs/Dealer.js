export interface MasteryTier {
  level: number;
  name: string;
  emoji: string;
  greatSuccessBonus: number;  // +% to great_success rate
  accidentReduction: number;  // -% from accident/trouble rate
  payBonus: number;           // +% to payout
  shiftsRequired: number;     // cumulative shifts to reach this tier
}

export const MASTERY_TIERS: MasteryTier[] = [
  { level: 0, name: 'ブロンズ', emoji: '🥉', greatSuccessBonus: 0, accidentReduction: 0, payBonus: 0, shiftsRequired: 0 },
  { level: 1, name: 'シルバー', emoji: '🥈', greatSuccessBonus: 2, accidentReduction: 1, payBonus: 5, shiftsRequired: 20 },
  { level: 2, name: 'ゴールド', emoji: '🥇', greatSuccessBonus: 4, accidentReduction: 2, payBonus: 10, shiftsRequired: 50 },
  { level: 3, name: 'プラチナ', emoji: '💠', greatSuccessBonus: 6, accidentReduction: 3, payBonus: 15, shiftsRequired: 100 },
  { level: 4, name: 'ダイヤモンド', emoji: '💎', greatSuccessBonus: 8, accidentReduction: 4, payBonus: 20, shiftsRequired: 200 },
  { level: 5, name: 'マスター', emoji: '👑', greatSuccessBonus: 10, accidentReduction: 5, payBonus: 25, shiftsRequired: 350 },
];

export const MAX_MASTERY_LEVEL = 5;

export function getMasteryTier(level: number): MasteryTier {
  return MASTERY_TIERS[Math.min(level, MAX_MASTERY_LEVEL)];
}

export function getMasteryLevelForShifts(shiftsCompleted: number): number {
  let level = 0;
  for (let i = MASTERY_TIERS.length - 1; i >= 0; i--) {
    if (shiftsCompleted >= MASTERY_TIERS[i].shiftsRequired) {
      level = i;
      break;
    }
  }
  return level;
}

// Master title per job — auto-granted when mastery level 5 reached
export const MASTER_TITLES: Record<string, string> = {
  janitor: 'マスター清掃員',
  bartender: 'マスターバーテンダー',
  dealer: 'マスターディーラー',
  security: 'マスター警備員',
  floor_manager: 'マスターマネージャー',
  vip_host: 'マスターVIPホスト',
};
