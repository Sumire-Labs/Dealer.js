import {secureRandomInt} from '../utils/random.js';

export interface ScenarioChoice {
  id: string;
  emoji: string;
  label: string;
  multiplierModifier: number; // Applied to event's payMultiplier (0.3~1.5)
  flavorText: string;
}

export interface WorkScenario {
  id: string;
  jobId: string;
  prompt: string;
  choices: ScenarioChoice[];
}

export const WORK_SCENARIOS: WorkScenario[] = [
  // ── Janitor ──
  {
    id: 'janitor_spill',
    jobId: 'janitor',
    prompt: 'VIPルームで大量の飲み物がこぼれている！ どう対処する？',
    choices: [
      { id: 'quick_mop', emoji: '🧹', label: '素早くモップで片付ける', multiplierModifier: 1.0, flavorText: '手際よく片付けた。普通の仕事だ。' },
      { id: 'deep_clean', emoji: '✨', label: '徹底的にクリーニング', multiplierModifier: 1.3, flavorText: 'VIP客が感動！ 「完璧だ」と称賛された！' },
      { id: 'call_help', emoji: '📞', label: '応援を呼ぶ', multiplierModifier: 0.7, flavorText: '応援を待つ間に客が不満を漏らした...' },
    ],
  },
  {
    id: 'janitor_lost',
    jobId: 'janitor',
    prompt: '清掃中に高額チップの入った財布を発見！',
    choices: [
      { id: 'return_owner', emoji: '🤝', label: 'オーナーに届ける', multiplierModifier: 1.5, flavorText: '持ち主のVIP客から感謝のチップを大量にもらった！' },
      { id: 'lost_found', emoji: '📦', label: '落とし物に預ける', multiplierModifier: 1.0, flavorText: '正直に処理した。マネージャーに褒められた。' },
      { id: 'ignore', emoji: '🚶', label: '見なかったことにする', multiplierModifier: 0.5, flavorText: '後で防犯カメラに映っていると注意された...' },
    ],
  },
  // ── Bartender ──
  {
    id: 'bartender_vip',
    jobId: 'bartender',
    prompt: 'VIP客「いつもの頼む」と言われた。心当たりがない...',
    choices: [
      { id: 'cocktail_guess', emoji: '🍹', label: '適当にカクテルを出す', multiplierModifier: 0.5, flavorText: '「これじゃない」と不機嫌に...ミスだった。' },
      { id: 'ask_staff', emoji: '🗣️', label: '他のスタッフに聞く', multiplierModifier: 1.2, flavorText: '先輩が教えてくれた！ 正しいドリンクを提供できた。' },
      { id: 'check_log', emoji: '📝', label: '注文履歴を確認', multiplierModifier: 1.4, flavorText: '完璧なドリンクを出して「さすがだ」と称賛！' },
    ],
  },
  {
    id: 'bartender_contest',
    jobId: 'bartender',
    prompt: '急遽カクテルコンテストに参加することに！',
    choices: [
      { id: 'classic', emoji: '🥃', label: 'クラシックカクテルで勝負', multiplierModifier: 1.0, flavorText: '安定した味で好評だった。' },
      { id: 'original', emoji: '🎨', label: 'オリジナルカクテルに挑戦', multiplierModifier: 1.5, flavorText: '斬新な味が審査員を魅了！ 優勝した！' },
      { id: 'decline', emoji: '🙅', label: '辞退する', multiplierModifier: 0.3, flavorText: '参加しなかった分、通常業務が忙しくなった...' },
    ],
  },
  // ── Dealer ──
  {
    id: 'dealer_cheat',
    jobId: 'dealer',
    prompt: 'テーブルのプレイヤーがイカサマをしている疑いが...',
    choices: [
      { id: 'confront', emoji: '🔍', label: '直接確認する', multiplierModifier: 1.3, flavorText: '証拠を見つけて適切に対処！ マネージャーから表彰！' },
      { id: 'report', emoji: '📋', label: 'セキュリティに報告', multiplierModifier: 1.0, flavorText: '正しい手順で処理した。' },
      { id: 'ignore_it', emoji: '🤷', label: '気のせいだと思う', multiplierModifier: 0.4, flavorText: '後でイカサマが発覚し、なぜ気づかなかったのかと叱られた...' },
    ],
  },
  {
    id: 'dealer_highroller',
    jobId: 'dealer',
    prompt: 'ハイローラーが「君のテーブルは運がいい」と巨額ベット！',
    choices: [
      { id: 'calm_deal', emoji: '🎴', label: '冷静にディーリング', multiplierModifier: 1.2, flavorText: 'プロフェッショナルな対応に満足してチップをもらった！' },
      { id: 'entertain', emoji: '🎭', label: 'ショーマンシップで盛り上げる', multiplierModifier: 1.5, flavorText: 'テーブル全体が盛り上がり、チップの嵐！' },
      { id: 'nervous', emoji: '😰', label: '緊張してしまう', multiplierModifier: 0.5, flavorText: 'ミスが多くなり、雰囲気が悪くなった...' },
    ],
  },
  // ── Security ──
  {
    id: 'security_fight',
    jobId: 'security',
    prompt: 'カジノフロアで客同士の口論がヒートアップ！',
    choices: [
      { id: 'mediate', emoji: '🤝', label: '間に入って仲裁', multiplierModifier: 1.3, flavorText: '双方を落ち着かせ、平和的に解決した！' },
      { id: 'escort_out', emoji: '🚪', label: '双方を退場させる', multiplierModifier: 1.0, flavorText: '迅速に対処した。ルール通りだ。' },
      { id: 'wait', emoji: '⏳', label: '様子を見る', multiplierModifier: 0.4, flavorText: '殴り合いに発展してしまい、上司に叱られた...' },
    ],
  },
  {
    id: 'security_suspicious',
    jobId: 'security',
    prompt: '不審なバッグを発見！ 中身が不明...',
    choices: [
      { id: 'check_camera', emoji: '📹', label: '監視カメラで持ち主を特定', multiplierModifier: 1.4, flavorText: '忘れ物だと判明。持ち主に返却して感謝された！' },
      { id: 'report_bomb', emoji: '🚨', label: '即座に上に報告', multiplierModifier: 1.0, flavorText: '手順通りに対応した。' },
      { id: 'open_bag', emoji: '👜', label: '中身を確認', multiplierModifier: 0.5, flavorText: '勝手に開けたことを注意された...' },
    ],
  },
  // ── Floor Manager ──
  {
    id: 'floor_double_booking',
    jobId: 'floor_manager',
    prompt: 'VIPルームがダブルブッキング！ 2組のVIP客が到着...',
    choices: [
      { id: 'negotiate', emoji: '💬', label: '片方に特別待遇を提案', multiplierModifier: 1.4, flavorText: '両方の客を満足させた！ マネジメント能力を評価された！' },
      { id: 'upgrade', emoji: '⬆️', label: 'スイートルームを手配', multiplierModifier: 1.2, flavorText: 'コストはかかったが問題を解決した。' },
      { id: 'apologize', emoji: '🙇', label: 'ひたすら謝る', multiplierModifier: 0.5, flavorText: '片方の客が不満を抱えたまま帰ってしまった...' },
    ],
  },
  {
    id: 'floor_system_down',
    jobId: 'floor_manager',
    prompt: 'カジノの決済システムが突然ダウン！',
    choices: [
      { id: 'manual', emoji: '📝', label: '手動で記録して継続', multiplierModifier: 1.3, flavorText: '見事なリーダーシップでフロアを維持した！' },
      { id: 'tech_call', emoji: '💻', label: 'IT部門を呼ぶ', multiplierModifier: 1.0, flavorText: '復旧を待って正常に再開した。' },
      { id: 'close_floor', emoji: '🚫', label: 'フロアを一時閉鎖', multiplierModifier: 0.4, flavorText: '売上損失が出てオーナーが不機嫌に...' },
    ],
  },
  // ── VIP Host ──
  {
    id: 'vip_celebrity',
    jobId: 'vip_host',
    prompt: '有名セレブがお忍びで来店！ 特別扱いを求めている...',
    choices: [
      { id: 'private_suite', emoji: '🏠', label: 'プライベートスイートを用意', multiplierModifier: 1.5, flavorText: 'セレブが感動！ SNSで「最高のカジノ」と投稿！' },
      { id: 'standard_vip', emoji: '🌟', label: 'VIPサービスで対応', multiplierModifier: 1.0, flavorText: '満足してもらえた。良い仕事だ。' },
      { id: 'reveal_identity', emoji: '📸', label: '他の客に紹介してしまう', multiplierModifier: 0.3, flavorText: 'プライバシーを侵害してしまい大問題に...' },
    ],
  },
  {
    id: 'vip_complaint',
    jobId: 'vip_host',
    prompt: '最上級VIP客が「サービスに不満がある」とクレーム！',
    choices: [
      { id: 'personal_care', emoji: '🎁', label: '特別ギフトと個別対応', multiplierModifier: 1.4, flavorText: '心のこもった対応に感動し、常連客になった！' },
      { id: 'comp_meal', emoji: '🍽️', label: '食事を無料提供', multiplierModifier: 1.1, flavorText: '少し機嫌が直った。まずまずの対応。' },
      { id: 'defend_service', emoji: '💪', label: 'サービスの正当性を主張', multiplierModifier: 0.4, flavorText: '客がさらに怒り、二度と来ないと言われた...' },
    ],
  },
];

/**
 * Get a random scenario for a given base job ID. Returns undefined if none available.
 */
export function getScenarioForJob(jobId: string): WorkScenario | undefined {
  const jobScenarios = WORK_SCENARIOS.filter(s => s.jobId === jobId);
  if (jobScenarios.length === 0) return undefined;
  const idx = secureRandomInt(0, jobScenarios.length - 1);
  return jobScenarios[idx];
}
