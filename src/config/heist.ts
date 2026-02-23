export type HeistTarget = 'convenience_store' | 'bank' | 'casino';
export type HeistRiskLevel = 'low' | 'mid' | 'high';
export type HeistApproach = 'stealth' | 'aggressive';

export interface HeistPhaseDefinition {
  id: string;
  emoji: string;
  name: string;
}

export interface HeistTargetDefinition {
  id: HeistTarget;
  name: string;
  emoji: string;
  description: string;
  successRateModifier: number;
  multiplierMin: number;
  multiplierMax: number;
  maxEntryFee: bigint;
  phases: HeistPhaseDefinition[];
  successTexts: Record<string, string[]>;
  failureTexts: Record<string, string[]>;
}

export interface HeistRiskDefinition {
  id: HeistRiskLevel;
  name: string;
  emoji: string;
  description: string;
  successRateModifier: number;
  multiplierScale: number;
  entryFeeScale: number;
}

export interface HeistApproachDefinition {
  id: HeistApproach;
  name: string;
  emoji: string;
  description: string;
  successRateModifier: number;
  multiplierScale: number;
}

export const HEIST_TARGETS: HeistTargetDefinition[] = [
  {
    id: 'convenience_store',
    name: 'コンビニ',
    emoji: '🏪',
    description: '低リスク・低リターン',
    successRateModifier: 15,
    multiplierMin: 1.5,
    multiplierMax: 2.5,
    maxEntryFee: 25_000n,
    phases: [
      { id: 'planning', emoji: '📋', name: '計画' },
      { id: 'entry', emoji: '🚪', name: '侵入' },
      { id: 'robbery', emoji: '💰', name: 'レジ強奪' },
      { id: 'escape', emoji: '🏃', name: '逃走' },
    ],
    successTexts: {
      planning: ['簡単な計画で十分だった！', '店員の動きを完璧に把握した！', '監視カメラの死角を見つけた！'],
      entry: ['自然に店内に入った！', '客を装って侵入成功！', '裏口から忍び込んだ！'],
      robbery: ['レジの金を全て奪った！', '金庫も見つけて一網打尽！', '素早くレジを開錠した！'],
      escape: ['車で颯爽と逃走！', '路地裏に消えた！', '追手を振り切った！'],
    },
    failureTexts: {
      planning: ['計画がずさんだった...', '店の情報が間違っていた...', '仲間割れが起きた...'],
      entry: ['防犯ブザーが鳴った！', '店員に怪しまれた！', '入口で警備員と鉢合わせ！'],
      robbery: ['レジが開かない...', '通報ボタンを押された！', '客に取り押さえられた！'],
      escape: ['パトカーに囲まれた！', '逃走車がエンストした...', '道を間違えた！'],
    },
  },
  {
    id: 'bank',
    name: '銀行',
    emoji: '🏦',
    description: '中リスク・中リターン',
    successRateModifier: 0,
    multiplierMin: 2.0,
    multiplierMax: 4.0,
    maxEntryFee: 100_000n,
    phases: [
      { id: 'planning', emoji: '📋', name: '計画立案' },
      { id: 'infiltration', emoji: '🔓', name: '侵入' },
      { id: 'vault', emoji: '🏦', name: '金庫突破' },
      { id: 'escape', emoji: '🚗', name: '逃走' },
    ],
    successTexts: {
      planning: ['完璧な計画を立てた！', 'チームの連携が光った！', '緻密な戦略が功を奏した！'],
      infiltration: ['警備を突破した！', 'セキュリティを無効化した！', '誰にも気づかれなかった！'],
      vault: ['大量のチップを発見！', '金庫を開錠した！', '宝の山を発見！'],
      escape: ['無事に逃走！', '完璧な脱出！', '追手を振り切った！'],
    },
    failureTexts: {
      planning: ['計画に欠陥があった...', '情報漏洩が起きた...', '内通者がいた...'],
      infiltration: ['警報が鳴った！', 'セキュリティに捕まった！', '監視カメラに映った！'],
      vault: ['金庫が開かない...', 'トラップに引っかかった！', '金庫が空だった...'],
      escape: ['逃走経路が封鎖された！', '追手に捕まった！', '車が故障した...'],
    },
  },
  {
    id: 'casino',
    name: 'カジノ',
    emoji: '🎰',
    description: '高リスク・高リターン',
    successRateModifier: -10,
    multiplierMin: 3.0,
    multiplierMax: 6.0,
    maxEntryFee: 200_000n,
    phases: [
      { id: 'planning', emoji: '📋', name: '計画立案' },
      { id: 'disguise', emoji: '🎭', name: '変装' },
      { id: 'floor', emoji: '🎰', name: 'フロア潜入' },
      { id: 'vault', emoji: '🏦', name: '金庫突破' },
      { id: 'extraction', emoji: '🚁', name: '脱出' },
    ],
    successTexts: {
      planning: ['完璧な作戦を練り上げた！', 'カジノの設計図を入手した！', 'インサイダーからの情報を得た！'],
      disguise: ['VIP客に完璧になりすました！', '従業員に化けた！', '誰にも怪しまれなかった！'],
      floor: ['セキュリティを避けて通過！', 'カメラの死角を縫って移動！', '警備のシフト交代を狙った！'],
      vault: ['最新鋭の金庫を突破！', '大量のチップを確保！', '金庫室を制圧した！'],
      extraction: ['ヘリで華麗に脱出！', '地下トンネルから逃走！', '追手を完全に撒いた！'],
    },
    failureTexts: {
      planning: ['計画が甘すぎた...', 'カジノ側に筒抜けだった...', '裏切り者がいた...'],
      disguise: ['変装が見破られた！', '指紋認証で引っかかった！', 'VIPリストに名前がなかった！'],
      floor: ['フロアのセンサーに反応！', '監視室に気づかれた！', '警備ロボットに検知された！'],
      vault: ['三重ロックが解除できない...', '時間制限に間に合わなかった...', 'サイレントアラームが作動！'],
      extraction: ['全ての出口が封鎖された！', '武装警備隊に包囲された！', '脱出用の車両が奪われた！'],
    },
  },
];

export const HEIST_RISKS: HeistRiskDefinition[] = [
  {
    id: 'low',
    name: '低リスク',
    emoji: '🟢',
    description: '安全重視: 成功率UP・倍率DOWN',
    successRateModifier: 10,
    multiplierScale: 0.7,
    entryFeeScale: 0.5,
  },
  {
    id: 'mid',
    name: '中リスク',
    emoji: '🟡',
    description: 'バランス型: 標準',
    successRateModifier: 0,
    multiplierScale: 1.0,
    entryFeeScale: 1.0,
  },
  {
    id: 'high',
    name: '高リスク',
    emoji: '🔴',
    description: '一攫千金: 成功率DOWN・倍率UP',
    successRateModifier: -15,
    multiplierScale: 1.5,
    entryFeeScale: 1.5,
  },
];

export const HEIST_APPROACHES: HeistApproachDefinition[] = [
  {
    id: 'stealth',
    name: 'ステルス',
    emoji: '🤫',
    description: '慎重に行動: 成功率UP・倍率DOWN',
    successRateModifier: 10,
    multiplierScale: 0.8,
  },
  {
    id: 'aggressive',
    name: '強行突入',
    emoji: '💥',
    description: '力押し: 成功率DOWN・倍率UP',
    successRateModifier: -10,
    multiplierScale: 1.3,
  },
];

export const HEIST_TARGET_MAP = new Map(HEIST_TARGETS.map(t => [t.id, t]));
export const HEIST_RISK_MAP = new Map(HEIST_RISKS.map(r => [r.id, r]));
export const HEIST_APPROACH_MAP = new Map(HEIST_APPROACHES.map(a => [a.id, a]));
