import {secureRandomInt} from '../../utils/random.js';
import {HEIST_SOLO_MIN_MULTIPLIER, HEIST_SOLO_MULTIPLIER_SCALE,} from '../../config/constants.js';
import {configService} from '../../config/config.service.js';
import {S} from '../../config/setting-defs.js';
import {
  HEIST_APPROACH_MAP,
  HEIST_RISK_MAP,
  HEIST_TARGET_MAP,
  type HeistApproach,
  type HeistRiskLevel,
  type HeistTarget,
} from '../../config/heist.js';

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

export interface HeistCalcParams {
    playerCount: number;
    target: HeistTarget;
    riskLevel: HeistRiskLevel;
    approach: HeistApproach;
    isSolo: boolean;
    hasHeistIntel?: boolean;
    hasHeistVault?: boolean;
}

export function calculateSuccessRate(params: HeistCalcParams): number {
    const targetDef = HEIST_TARGET_MAP.get(params.target)!;
    const riskDef = HEIST_RISK_MAP.get(params.riskLevel)!;
    const approachDef = HEIST_APPROACH_MAP.get(params.approach)!;

    let rate = configService.getNumber(S.heistBaseRate)
        + (params.playerCount - 1) * configService.getNumber(S.heistPerPlayerBonus)
        + targetDef.successRateModifier
        + riskDef.successRateModifier
        + approachDef.successRateModifier;

    if (params.isSolo) {
        rate -= configService.getNumber(S.heistSoloPenalty);
    }

    if (params.hasHeistIntel) {
        rate += 15;
    }

    return Math.max(configService.getNumber(S.heistMinRate), Math.min(rate, configService.getNumber(S.heistMaxRate)));
}

export function calculateMultiplierRange(params: HeistCalcParams): { min: number; max: number } {
    const targetDef = HEIST_TARGET_MAP.get(params.target)!;
    const riskDef = HEIST_RISK_MAP.get(params.riskLevel)!;
    const approachDef = HEIST_APPROACH_MAP.get(params.approach)!;

    let minMult = targetDef.multiplierMin * riskDef.multiplierScale * approachDef.multiplierScale;
    let maxMult = targetDef.multiplierMax * riskDef.multiplierScale * approachDef.multiplierScale;

    if (params.isSolo) {
        minMult *= HEIST_SOLO_MULTIPLIER_SCALE;
        maxMult *= HEIST_SOLO_MULTIPLIER_SCALE;
    }

    if (params.hasHeistVault) {
        minMult *= 1.1;
        maxMult *= 1.1;
    }

    // Enforce minimum
    minMult = Math.max(minMult, HEIST_SOLO_MIN_MULTIPLIER);
    maxMult = Math.max(maxMult, minMult);

    return {
        min: Math.round(minMult * 10) / 10,
        max: Math.round(maxMult * 10) / 10,
    };
}

export function calculateMaxEntryFee(target: HeistTarget, riskLevel: HeistRiskLevel): bigint {
    const targetDef = HEIST_TARGET_MAP.get(target)!;
    const riskDef = HEIST_RISK_MAP.get(riskLevel)!;
    return BigInt(Math.round(Number(targetDef.maxEntryFee) * riskDef.entryFeeScale));
}

export function calculateHeistOutcome(params: HeistCalcParams): HeistOutcome {
    const successRate = calculateSuccessRate(params);
    const roll = secureRandomInt(1, 100);
    const success = roll <= successRate;

    const {min, max} = calculateMultiplierRange(params);
    const multiplierRaw = min + (secureRandomInt(0, 10) / 10) * (max - min);
    const multiplier = Math.round(multiplierRaw * 10) / 10;

    const phaseResults = generatePhaseResults(success, params.target);

    return {success, multiplier, successRate, phaseResults};
}

function generatePhaseResults(success: boolean, target: HeistTarget): PhaseResult[] {
    const targetDef = HEIST_TARGET_MAP.get(target)!;
    const {phases, successTexts, failureTexts} = targetDef;
    const results: PhaseResult[] = [];

    if (success) {
        for (const phase of phases) {
            const descs = successTexts[phase.id];
            results.push({
                phase: phase.id,
                emoji: phase.emoji,
                name: phase.name,
                success: true,
                description: descs[secureRandomInt(0, descs.length - 1)],
            });
        }
    } else {
        const failPhase = secureRandomInt(0, phases.length - 1);

        for (let i = 0; i < phases.length; i++) {
            const phase = phases[i];
            if (i < failPhase) {
                const descs = successTexts[phase.id];
                results.push({
                    phase: phase.id,
                    emoji: phase.emoji,
                    name: phase.name,
                    success: true,
                    description: descs[secureRandomInt(0, descs.length - 1)],
                });
            } else if (i === failPhase) {
                const descs = failureTexts[phase.id];
                results.push({
                    phase: phase.id,
                    emoji: phase.emoji,
                    name: phase.name,
                    success: false,
                    description: descs[secureRandomInt(0, descs.length - 1)],
                });
            }
            // Don't add phases after failure
        }
    }

    return results;
}
