export type ShiftType = 'short' | 'normal' | 'long';

export type WorkEventType = 'great_success' | 'success' | 'tip' | 'trouble' | 'accident';

export interface JobDefinition {
  id: string;
  name: string;
  emoji: string;
  requiredLevel: number;
  basePay: { min: bigint; max: bigint };
  riskRate: number; // total % for trouble + accident
  xpPerShift: number;
}

export interface ShiftDefinition {
  type: ShiftType;
  label: string;
  emoji: string;
  cooldownKey: string;
  payMultiplier: number;
  xpMultiplier: number;
}

export interface WorkEvent {
  type: WorkEventType;
  emoji: string;
  payMultiplier: number;
  label: string;
}

export const JOBS: JobDefinition[] = [
  {
    id: 'janitor',
    name: '清掃員',
    emoji: '🧹',
    requiredLevel: 0,
    basePay: { min: 500n, max: 800n },
    riskRate: 5,
    xpPerShift: 5,
  },
  {
    id: 'bartender',
    name: 'バーテンダー',
    emoji: '🍸',
    requiredLevel: 1,
    basePay: { min: 800n, max: 1_200n },
    riskRate: 8,
    xpPerShift: 8,
  },
  {
    id: 'dealer',
    name: 'ディーラー',
    emoji: '🃏',
    requiredLevel: 2,
    basePay: { min: 1_200n, max: 1_800n },
    riskRate: 12,
    xpPerShift: 12,
  },
  {
    id: 'security',
    name: '警備員',
    emoji: '🛡️',
    requiredLevel: 3,
    basePay: { min: 1_800n, max: 2_500n },
    riskRate: 18,
    xpPerShift: 16,
  },
  {
    id: 'floor_manager',
    name: 'フロアマネージャー',
    emoji: '📋',
    requiredLevel: 4,
    basePay: { min: 2_500n, max: 3_500n },
    riskRate: 15,
    xpPerShift: 20,
  },
  {
    id: 'vip_host',
    name: 'VIPホスト',
    emoji: '🌟',
    requiredLevel: 5,
    basePay: { min: 3_500n, max: 5_000n },
    riskRate: 20,
    xpPerShift: 25,
  },
];

export const JOB_MAP = new Map(JOBS.map(j => [j.id, j]));

export const SHIFTS: ShiftDefinition[] = [
  {
    type: 'short',
    label: '短時間',
    emoji: '⚡',
    cooldownKey: 'work_short',
    payMultiplier: 0.6,
    xpMultiplier: 1,
  },
  {
    type: 'normal',
    label: '通常',
    emoji: '📋',
    cooldownKey: 'work_normal',
    payMultiplier: 1.0,
    xpMultiplier: 2,
  },
  {
    type: 'long',
    label: '長時間',
    emoji: '💪',
    cooldownKey: 'work_long',
    payMultiplier: 1.8,
    xpMultiplier: 4,
  },
];

export const SHIFT_MAP = new Map(SHIFTS.map(s => [s.type, s]));

export const LEVEL_THRESHOLDS = [0, 50, 150, 350, 600, 1000];

export const WORK_EVENTS: WorkEvent[] = [
  { type: 'great_success', emoji: '✨', payMultiplier: 1.5, label: '大成功' },
  { type: 'success', emoji: '✅', payMultiplier: 1.0, label: '成功' },
  { type: 'tip', emoji: '💵', payMultiplier: 1.0, label: 'チップ' },
  { type: 'trouble', emoji: '⚠️', payMultiplier: 0.5, label: 'トラブル' },
  { type: 'accident', emoji: '💥', payMultiplier: 0, label: '事故' },
];

export const EVENT_MAP = new Map(WORK_EVENTS.map(e => [e.type, e]));

// Flavor text per job × event
export const EVENT_FLAVORS: Record<string, Record<WorkEventType, string[]>> = {
  janitor: {
    great_success: [
      'VIPルームを完璧に清掃！ オーナーが感激！',
      'カジノ全体をピカピカに！ マネージャーから特別賞！',
      '落ちていた高額チップを届けて感謝された！',
    ],
    success: [
      'フロアを綺麗に清掃完了。',
      '問題なくシフトを終えた。',
      'いつも通りの仕事をこなした。',
    ],
    tip: [
      'お客様がドリンクをこぼした対応で感謝された！',
      'VIP客の部屋を丁寧に片付けてチップをもらった！',
      '迅速な対応に感心したお客様からの心付け。',
    ],
    trouble: [
      'モップで滑って備品を壊してしまった...',
      '清掃中にお客様の邪魔をしてクレーム...',
      '洗剤を間違えてカーペットにシミが...',
    ],
    accident: [
      'VIPルームの高級花瓶を割ってしまった！',
      '清掃用具でスロットマシンを傷つけた！',
      'バケツの水をお客様にかけてしまった！',
    ],
  },
  bartender: {
    great_success: [
      'オリジナルカクテルが大好評！ 常連客が絶賛！',
      'VIP客のお気に入りドリンクを完璧に再現！',
      'カクテルコンテストで優勝！ ボーナスゲット！',
    ],
    success: [
      'スムーズにドリンクを提供し続けた。',
      'カウンターを切り盛りして無事終了。',
      'オーダーをテキパキとこなした。',
    ],
    tip: [
      '大勝ちしたお客様が気前よくチップを！',
      '常連客からの気持ちのいいチップ。',
      '特別なカクテルに感動したお客様から！',
    ],
    trouble: [
      'グラスを割ってしまい片付けに時間が...',
      'オーダーを間違えてお客様が不機嫌に...',
      '在庫切れのドリンクを注文されて困った...',
    ],
    accident: [
      'シェイカーが手から飛んでお客様に直撃！',
      '高級ワインのボトルを落として粉々に！',
      'カクテルに間違った材料を入れてしまった！',
    ],
  },
  dealer: {
    great_success: [
      '完璧なディーリングでテーブルが盛り上がった！',
      'VIPテーブルを担当してオーナーに褒められた！',
      'ミスゼロのシフトでマネージャーから表彰！',
    ],
    success: [
      'いつも通りカードを配り続けた。',
      'テーブルを問題なく回した。',
      'お客様も満足のシフト完了。',
    ],
    tip: [
      '大勝ちしたお客様から気前のいいチップ！',
      'ブラックジャックで勝ったプレイヤーからの心付け。',
      '楽しい時間を過ごしたお客様から感謝の印。',
    ],
    trouble: [
      'カードの配り間違えでゲームをやり直し...',
      'チップの計算ミスでクレームを受けた...',
      'お客様同士のトラブルに巻き込まれた...',
    ],
    accident: [
      'デッキを落としてカードが散乱！ ゲーム中断！',
      'イカサマ疑惑のお客様に詰め寄られた！',
      '大きな精算ミスで上司に怒られた！',
    ],
  },
  security: {
    great_success: [
      '不審者を見事に取り押さえてオーナーから感謝！',
      'VIP客の安全を完璧に確保！ 特別ボーナス！',
      'トラブルを未然に防ぎ表彰された！',
    ],
    success: [
      '巡回を問題なく完了した。',
      '平穏なシフトだった。',
      'フロアの安全を確保した。',
    ],
    tip: [
      'VIP客のエスコートでチップをもらった！',
      '迷子の子供を親に届けて感謝された！',
      'トラブルから助けたお客様からの御礼。',
    ],
    trouble: [
      '酔客の対応に手間取った...',
      '警報の誤作動で走り回った...',
      'お客様同士の喧嘩の仲裁で疲弊...',
    ],
    accident: [
      '酔客に殴られてしまった！',
      '追跡中に他のお客様にぶつかってしまった！',
      '不審者を取り逃がしてしまった！',
    ],
  },
  floor_manager: {
    great_success: [
      'フロア全体を完璧に統括！ 売上記録更新！',
      'VIPイベントの運営が大成功！',
      '効率的なシフト管理でオーナーから絶賛！',
    ],
    success: [
      'フロアを円滑に管理した。',
      'スタッフの配置を適切に行った。',
      '問題なくシフトを終えた。',
    ],
    tip: [
      '素晴らしいサービスに感動したVIP客から！',
      'イベント成功のお礼としてオーナーから！',
      'スタッフからの信頼も厚く、チーム一丸で成果。',
    ],
    trouble: [
      'スタッフの遅刻でフロアが混乱...',
      'VIP客からのクレーム対応に追われた...',
      '予約ミスでダブルブッキング...',
    ],
    accident: [
      '大規模なシステム障害でフロアが大混乱！',
      '重要書類を紛失してしまった！',
      'VIPイベントの準備不足で大失態！',
    ],
  },
  vip_host: {
    great_success: [
      '超VIP客を完璧にもてなし、特別ボーナス！',
      'セレブリティの来店を大成功に導いた！',
      'VIPルームの売上が過去最高に！',
    ],
    success: [
      'VIP客を丁寧にもてなした。',
      'リピーターのお客様に満足いただけた。',
      '予約管理を問題なくこなした。',
    ],
    tip: [
      'ハイローラーから豪華なチップ！',
      '特別な記念日を演出して感動のチップ！',
      'セレブ客からの気前のいい御礼。',
    ],
    trouble: [
      'VIP客の予約変更に振り回された...',
      '高い期待に応えられずクレーム...',
      '他のVIP客と鉢合わせでトラブル...',
    ],
    accident: [
      'VIP客のドリンクをこぼしてしまった！',
      '重要なゲストの名前を間違えた！',
      'セレブ客のプライバシーを漏らしてしまった！',
    ],
  },
};
