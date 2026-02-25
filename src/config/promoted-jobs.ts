import type {JobDefinition} from './jobs.js';

export interface PromotedJobDefinition extends JobDefinition {
  baseJobId: string;
  isPromoted: true;
}

export const PROMOTED_JOBS: PromotedJobDefinition[] = [
  {
    id: 'janitor_pro',
    baseJobId: 'janitor',
    isPromoted: true,
    name: '施設管理長',
    emoji: '🏢',
    requiredLevel: 5,
    basePay: { min: 1_200n, max: 1_800n },
    riskRate: 3,
    xpPerShift: 10,
  },
  {
    id: 'bartender_pro',
    baseJobId: 'bartender',
    isPromoted: true,
    name: 'チーフバーテンダー',
    emoji: '🍷',
    requiredLevel: 5,
    basePay: { min: 1_800n, max: 2_800n },
    riskRate: 6,
    xpPerShift: 16,
  },
  {
    id: 'dealer_pro',
    baseJobId: 'dealer',
    isPromoted: true,
    name: 'シニアディーラー',
    emoji: '🎴',
    requiredLevel: 5,
    basePay: { min: 2_800n, max: 4_000n },
    riskRate: 10,
    xpPerShift: 24,
  },
  {
    id: 'security_pro',
    baseJobId: 'security',
    isPromoted: true,
    name: '警備隊長',
    emoji: '⚔️',
    requiredLevel: 5,
    basePay: { min: 4_000n, max: 5_500n },
    riskRate: 15,
    xpPerShift: 32,
  },
  {
    id: 'floor_manager_pro',
    baseJobId: 'floor_manager',
    isPromoted: true,
    name: '統括マネージャー',
    emoji: '📊',
    requiredLevel: 5,
    basePay: { min: 5_500n, max: 7_500n },
    riskRate: 12,
    xpPerShift: 40,
  },
  {
    id: 'vip_host_pro',
    baseJobId: 'vip_host',
    isPromoted: true,
    name: 'カジノ支配人',
    emoji: '🎩',
    requiredLevel: 5,
    basePay: { min: 7_500n, max: 10_000n },
    riskRate: 18,
    xpPerShift: 50,
  },
];

export const PROMOTED_JOB_MAP = new Map(PROMOTED_JOBS.map(j => [j.id, j]));
