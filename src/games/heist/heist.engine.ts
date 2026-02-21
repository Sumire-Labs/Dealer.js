import { secureRandomInt } from '../../utils/random.js';
import {
  HEIST_BASE_SUCCESS_RATE,
  HEIST_PER_PLAYER_BONUS,
  HEIST_MAX_SUCCESS_RATE,
  HEIST_MIN_MULTIPLIER,
  HEIST_MAX_MULTIPLIER,
} from '../../config/constants.js';
import { HEIST_CONFIG } from '../../config/games.js';

export interface HeistOutcome {
  success: boolean;
  multiplier: number;
  successRate: number;
  phaseResults: PhaseResult[];
}

export interface PhaseResult {
  phase: string;
  emoji: string;
  name: string;
  success: boolean;
  description: string;
}

export function calculateSuccessRate(playerCount: number): number {
  const rate = HEIST_BASE_SUCCESS_RATE + (playerCount - 1) * HEIST_PER_PLAYER_BONUS;
  return Math.min(rate, HEIST_MAX_SUCCESS_RATE);
}

export function calculateHeistOutcome(playerCount: number): HeistOutcome {
  const successRate = calculateSuccessRate(playerCount);
  const roll = secureRandomInt(1, 100);
  const success = roll <= successRate;

  // Multiplier: random between min and max (1 decimal)
  const multiplierRaw = HEIST_MIN_MULTIPLIER +
    (secureRandomInt(0, 10) / 10) * (HEIST_MAX_MULTIPLIER - HEIST_MIN_MULTIPLIER);
  const multiplier = Math.round(multiplierRaw * 10) / 10;

  const phaseResults = generatePhaseResults(success);

  return { success, multiplier, successRate, phaseResults };
}

const SUCCESS_DESCRIPTIONS: Record<string, string[]> = {
  planning: ['完璧な計画を立てた！', 'チームの連携が光った！', '緻密な戦略が功を奏した！'],
  infiltration: ['警備を突破した！', 'セキュリティを無効化した！', '誰にも気づかれなかった！'],
  vault: ['大量のチップを発見！', '金庫を開錠した！', '宝の山を発見！'],
  escape: ['無事に逃走！', '完璧な脱出！', '追手を振り切った！'],
};

const FAILURE_DESCRIPTIONS: Record<string, string[]> = {
  planning: ['計画に欠陥があった...', '情報漏洩が起きた...', '内通者がいた...'],
  infiltration: ['警報が鳴った！', 'セキュリティに捕まった！', '監視カメラに映った！'],
  vault: ['金庫が開かない...', 'トラップに引っかかった！', '金庫が空だった...'],
  escape: ['逃走経路が封鎖された！', '追手に捕まった！', '車が故障した...'],
};

function generatePhaseResults(success: boolean): PhaseResult[] {
  const { phases, phaseEmoji, phaseNames } = HEIST_CONFIG;
  const results: PhaseResult[] = [];

  if (success) {
    // All phases succeed
    for (let i = 0; i < phases.length; i++) {
      const descs = SUCCESS_DESCRIPTIONS[phases[i]];
      results.push({
        phase: phases[i],
        emoji: phaseEmoji[i],
        name: phaseNames[i],
        success: true,
        description: descs[secureRandomInt(0, descs.length - 1)],
      });
    }
  } else {
    // Random failure point (at least 1 success before failure)
    const failPhase = secureRandomInt(0, phases.length - 1);

    for (let i = 0; i < phases.length; i++) {
      if (i < failPhase) {
        const descs = SUCCESS_DESCRIPTIONS[phases[i]];
        results.push({
          phase: phases[i],
          emoji: phaseEmoji[i],
          name: phaseNames[i],
          success: true,
          description: descs[secureRandomInt(0, descs.length - 1)],
        });
      } else if (i === failPhase) {
        const descs = FAILURE_DESCRIPTIONS[phases[i]];
        results.push({
          phase: phases[i],
          emoji: phaseEmoji[i],
          name: phaseNames[i],
          success: false,
          description: descs[secureRandomInt(0, descs.length - 1)],
        });
      }
      // Don't add phases after failure
    }
  }

  return results;
}
