import type { ShopItem, ShopCategory } from './shop.js';
import type { WorkBonuses } from '../games/work/work.engine.js';

export interface WorkToolDefinition extends ShopItem {
  targetJobId: string | 'all';
  toolPayBonus?: number;
  toolGreatSuccessBonus?: number;
  toolRiskReduction?: number;
  toolXpBonus?: number;
}

export const WORK_TOOLS: WorkToolDefinition[] = [
  {
    id: 'TOOL_JANITOR',
    name: '高級手袋',
    emoji: '🧤',
    description: '清掃員の報酬+10%',
    price: 20_000n,
    category: 'tool' as ShopCategory,
    maxStack: 1,
    targetJobId: 'janitor',
    toolPayBonus: 10,
  },
  {
    id: 'TOOL_BARTENDER',
    name: 'プレミアム酒セット',
    emoji: '🍶',
    description: 'バーテンダーの大成功率+5%',
    price: 25_000n,
    category: 'tool' as ShopCategory,
    maxStack: 1,
    targetJobId: 'bartender',
    toolGreatSuccessBonus: 5,
  },
  {
    id: 'TOOL_SECURITY',
    name: '高性能ライト',
    emoji: '🔦',
    description: '警備員のリスク-3%',
    price: 20_000n,
    category: 'tool' as ShopCategory,
    maxStack: 1,
    targetJobId: 'security',
    toolRiskReduction: 3,
  },
  {
    id: 'TOOL_DEALER',
    name: 'カスタムカード',
    emoji: '🃏',
    description: 'ディーラーの報酬+10%',
    price: 30_000n,
    category: 'tool' as ShopCategory,
    maxStack: 1,
    targetJobId: 'dealer',
    toolPayBonus: 10,
  },
  {
    id: 'TOOL_FLOOR_MANAGER',
    name: '管理アプリ',
    emoji: '📱',
    description: 'フロアマネージャーのXP+25%',
    price: 35_000n,
    category: 'tool' as ShopCategory,
    maxStack: 1,
    targetJobId: 'floor_manager',
    toolXpBonus: 25,
  },
  {
    id: 'TOOL_VIP_HOST',
    name: '高級スーツ',
    emoji: '🎩',
    description: 'VIPホストの報酬+15%',
    price: 50_000n,
    category: 'tool' as ShopCategory,
    maxStack: 1,
    targetJobId: 'vip_host',
    toolPayBonus: 15,
  },
  {
    id: 'TOOL_UNIVERSAL',
    name: '万能ツールキット',
    emoji: '🔧',
    description: '全ジョブの報酬+5%',
    price: 100_000n,
    category: 'tool' as ShopCategory,
    maxStack: 3,
    targetJobId: 'all',
    toolPayBonus: 5,
    sourceHint: '/shop 仕事道具で購入',
  },
];

export const WORK_TOOL_MAP = new Map(WORK_TOOLS.map(t => [t.id, t]));
export const WORK_TOOL_IDS = WORK_TOOLS.map(t => t.id);

/**
 * Compute aggregate tool bonuses for a specific job given owned tool IDs.
 */
export function getToolBonusesForJob(
  jobId: string,
  ownedToolIds: Set<string>,
): Partial<Pick<WorkBonuses, 'toolPayBonus' | 'toolGreatSuccessBonus' | 'toolRiskReduction' | 'toolXpBonus'>> {
  let payBonus = 0;
  let greatSuccessBonus = 0;
  let riskReduction = 0;
  let xpBonus = 0;

  // For promoted jobs, also check the base job's tools
  const baseJobId = jobId.replace(/_pro$/, '');

  for (const tool of WORK_TOOLS) {
    if (!ownedToolIds.has(tool.id)) continue;
    if (tool.targetJobId !== 'all' && tool.targetJobId !== baseJobId && tool.targetJobId !== jobId) continue;

    payBonus += tool.toolPayBonus ?? 0;
    greatSuccessBonus += tool.toolGreatSuccessBonus ?? 0;
    riskReduction += tool.toolRiskReduction ?? 0;
    xpBonus += tool.toolXpBonus ?? 0;
  }

  return {
    toolPayBonus: payBonus || undefined,
    toolGreatSuccessBonus: greatSuccessBonus || undefined,
    toolRiskReduction: riskReduction || undefined,
    toolXpBonus: xpBonus || undefined,
  };
}
