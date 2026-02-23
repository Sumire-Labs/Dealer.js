import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { CasinoTheme } from '../themes/casino.theme.js';
import { formatChips, formatTimeDelta } from '../../utils/formatters.js';
import {
  JOBS,
  SHIFTS,
  LEVEL_THRESHOLDS,
  type ShiftType,
} from '../../config/jobs.js';
import {
  WORK_SHORT_COOLDOWN_MS,
  WORK_NORMAL_COOLDOWN_MS,
  WORK_LONG_COOLDOWN_MS,
} from '../../config/constants.js';
import { getAvailableJobs } from '../../games/work/work.engine.js';
import { getRemainingCooldown, buildCooldownKey } from '../../utils/cooldown.js';
import type { WorkResult } from '../../database/services/work.service.js';
import { getMasteryTier } from '../../config/work-mastery.js';
import { PROMOTED_JOBS, type PromotedJobDefinition } from '../../config/promoted-jobs.js';
import type { SpecialShiftDefinition } from '../../config/special-shifts.js';
import type { ScenarioChoice } from '../../config/work-events.js';

export interface WorkPanelViewData {
  userId: string;
  workLevel: number;
  workXp: number;
  workStreak: number;
  lastWorkAt: Date | null;
  xpForNextLevel: number | null;
  masteries?: Map<string, { level: number; shiftsCompleted: number }>;
  weeklyChallenges?: { name: string; progress: number; target: number; completed: boolean }[];
}

const SHIFT_COOLDOWNS: Record<ShiftType, number> = {
  short: WORK_SHORT_COOLDOWN_MS,
  normal: WORK_NORMAL_COOLDOWN_MS,
  long: WORK_LONG_COOLDOWN_MS,
};

function buildXpBar(currentXp: number, nextLevelXp: number | null, currentLevel: number): string {
  if (nextLevelXp === null) return '██████████ MAX';
  const currentThreshold = LEVEL_THRESHOLDS[currentLevel];
  const progress = currentXp - currentThreshold;
  const needed = nextLevelXp - currentThreshold;
  const ratio = Math.min(progress / needed, 1);
  const filled = Math.round(ratio * 10);
  const empty = 10 - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const percent = Math.round(ratio * 100);
  return `${bar} ${percent}%`;
}

export function buildWorkPanelView(data: WorkPanelViewData): ContainerBuilder {
  const { userId, workLevel, workXp, workStreak, xpForNextLevel, masteries } = data;

  const masteryMap = masteries ? new Map(
    Array.from(masteries.entries()).map(([k, v]) => [k, v.level]),
  ) : undefined;

  const availableJobs = getAvailableJobs(workLevel, masteryMap, PROMOTED_JOBS);

  // Current job title (highest unlocked)
  const currentJob = availableJobs[availableJobs.length - 1];
  const xpBar = buildXpBar(workXp, xpForNextLevel, workLevel);
  const xpText = xpForNextLevel !== null ? `${workXp}/${xpForNextLevel}` : `${workXp} (MAX)`;

  const streakBonus = workStreak <= 1 ? 0 : Math.min((workStreak - 1) * 5, 20);
  const streakLine = workStreak > 0
    ? `🔥 連勤: ${workStreak}日${streakBonus > 0 ? ` (+${streakBonus}%)` : ''}`
    : '';

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.work),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `📊 Lv.${workLevel} ${currentJob.emoji} ${currentJob.name} | XP: ${xpText}\n${xpBar}${streakLine ? '\n' + streakLine : ''}`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  // Job list with mastery tiers
  const jobLines: string[] = [];

  // Base jobs
  for (const job of JOBS) {
    if (job.requiredLevel <= workLevel) {
      const masteryInfo = masteries?.get(job.id);
      const tier = getMasteryTier(masteryInfo?.level ?? 0);
      const masteryLabel = `${tier.emoji}`;
      jobLines.push(`${job.emoji} ${job.name} ${masteryLabel}　${formatChips(job.basePay.min)}〜${formatChips(job.basePay.max)}`);
    } else {
      jobLines.push(`🔒 ${job.name} (Lv.${job.requiredLevel})`);
    }
  }

  // Promoted jobs
  const promotedAvailable = availableJobs.filter(
    (j): j is PromotedJobDefinition => 'isPromoted' in j,
  );
  if (promotedAvailable.length > 0) {
    jobLines.push('');
    jobLines.push('**⭐ 昇進ジョブ:**');
    for (const pj of promotedAvailable) {
      jobLines.push(`${pj.emoji} ${pj.name}　${formatChips(pj.basePay.min)}〜${formatChips(pj.basePay.max)}`);
    }
  }

  // Cooldown info
  const cooldownLines: string[] = [];
  for (const shift of SHIFTS) {
    const remaining = getRemainingCooldown(buildCooldownKey(userId, shift.cooldownKey));
    if (remaining > 0) {
      cooldownLines.push(`⏰ ${shift.label}: ${formatTimeDelta(remaining)}`);
    }
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `**利用可能な職種:**\n${jobLines.join('\n')}${cooldownLines.length > 0 ? '\n\n' + cooldownLines.join('\n') : ''}`,
    ),
  );

  // Weekly challenge summary
  if (data.weeklyChallenges && data.weeklyChallenges.length > 0) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );
    const challengeLines = data.weeklyChallenges.map(c => {
      const icon = c.completed ? '✅' : '⬜';
      return `${icon} ${c.name}: ${c.progress}/${c.target}`;
    });
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**📋 週間チャレンジ:**\n${challengeLines.join('\n')}`),
    );
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Job selection buttons (only available jobs)
  const buttons = availableJobs.map(job =>
    new ButtonBuilder()
      .setCustomId(`work:job:${userId}:${job.id}`)
      .setLabel(job.emoji + ' ' + job.name)
      .setStyle('isPromoted' in job ? ButtonStyle.Success : ButtonStyle.Secondary),
  );

  // Discord allows max 5 buttons per row
  for (let i = 0; i < buttons.length; i += 5) {
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons.slice(i, i + 5)),
    );
  }

  // Extra buttons row: team shift + weekly challenges
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`work:team_select:${userId}`)
        .setLabel('👥 チームシフト')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`work:weekly:${userId}`)
        .setLabel('📋 週間チャレンジ')
        .setStyle(ButtonStyle.Secondary),
    ),
  );

  return container;
}

export interface ShiftSelectViewData {
  userId: string;
  jobId: string;
  jobName: string;
  jobEmoji: string;
  isPromoted?: boolean;
  specialShifts?: SpecialShiftDefinition[];
}

export function buildShiftSelectView(data: ShiftSelectViewData): ContainerBuilder {
  const { userId, jobId, jobName, jobEmoji, specialShifts } = data;

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.work),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${jobEmoji} **${jobName}** で働く${data.isPromoted ? ' ⭐' : ''}`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  // Normal shift buttons with cooldown check
  const shiftButtons = SHIFTS.map(shift => {
    const remaining = getRemainingCooldown(buildCooldownKey(userId, shift.cooldownKey));
    const isDisabled = remaining > 0;
    const cooldownMs = SHIFT_COOLDOWNS[shift.type];
    const hours = cooldownMs / (60 * 60 * 1000);
    const label = isDisabled
      ? `${shift.emoji} ${shift.label} (${formatTimeDelta(remaining)})`
      : `${shift.emoji} ${shift.label} (${hours}h)`;

    return new ButtonBuilder()
      .setCustomId(`work:shift:${userId}:${jobId}:${shift.type}`)
      .setLabel(label)
      .setStyle(isDisabled ? ButtonStyle.Secondary : ButtonStyle.Primary)
      .setDisabled(isDisabled);
  });

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(...shiftButtons),
  );

  // Special shift buttons
  if (specialShifts && specialShifts.length > 0) {
    const specialButtons = specialShifts.map(ss =>
      new ButtonBuilder()
        .setCustomId(`work:special:${userId}:${jobId}:${ss.type}`)
        .setLabel(`${ss.emoji} ${ss.name} (${ss.payMultiplier}x報酬)`)
        .setStyle(ButtonStyle.Danger),
    );

    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(...specialButtons),
    );
  }

  return container;
}

export function buildMultiStepEventView(
  userId: string,
  result: WorkResult,
): ContainerBuilder {
  const scenario = result.scenario!;

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.purple)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.work),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${result.jobEmoji} **${result.jobName}** — ${result.shiftLabel}シフト`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`🎭 **イベント発生！**\n\n${scenario.prompt}`),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  const choiceButtons = scenario.choices.map((choice: ScenarioChoice) =>
    new ButtonBuilder()
      .setCustomId(`work:choice:${userId}:${choice.id}`)
      .setLabel(`${choice.emoji} ${choice.label}`)
      .setStyle(ButtonStyle.Primary),
  );

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(...choiceButtons),
  );

  return container;
}

export function buildWorkResultView(result: WorkResult, userId: string): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(
      result.event!.type === 'accident'
        ? CasinoTheme.colors.red
        : result.event!.type === 'great_success'
          ? CasinoTheme.colors.gold
          : CasinoTheme.colors.darkGreen,
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.work),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${result.jobEmoji} **${result.jobName}** — ${result.shiftLabel}シフト${result.specialShiftName ? ` (${result.specialShiftName})` : ''}${result.isPromoted ? ' ⭐' : ''}`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  // Event result
  const eventLine = `${result.event!.emoji} **${result.event!.label}**`;
  const flavorLine = result.flavorText ? `\n「${result.flavorText}」` : '';
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(eventLine + flavorLine),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Pay breakdown
  const payLines: string[] = [];
  if (result.event!.type === 'accident') {
    payLines.push('💰 基本給: $0 (事故による減給)');
  } else {
    payLines.push(`💰 基本給: ${formatChips(result.shiftPay!)}`);
  }
  if (result.tipAmount && result.tipAmount > 0n) {
    payLines.push(`💵 チップ: ${formatChips(result.tipAmount)}`);
  }
  if (result.masteryBonus && result.masteryBonus > 0n) {
    payLines.push(`${result.masteryTier?.emoji ?? '🥉'} 熟練度ボーナス: +${formatChips(result.masteryBonus)}`);
  }
  if (result.toolBonus && result.toolBonus > 0n) {
    payLines.push(`🔧 ツールボーナス: +${formatChips(result.toolBonus)}`);
  }
  if (result.streakBonus && result.streakBonus > 0) {
    payLines.push(`🔥 連勤ボーナス (${result.streak}日): +${result.streakBonus}%`);
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(payLines.join('\n')),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Summary
  const levelUpLine = result.newLevel! > result.oldLevel!
    ? `\n🎉 **レベルアップ！** Lv.${result.oldLevel} → Lv.${result.newLevel}`
    : '';
  const xpText = result.xpForNextLevel !== null
    ? `${result.newXp}/${result.xpForNextLevel}`
    : `${result.newXp} (MAX)`;

  // Mastery progress
  let masteryLine = '';
  if (result.masteryTier) {
    masteryLine = `\n${result.masteryTier.emoji} 熟練度: ${result.masteryTier.name} (${result.masteryShiftsCompleted}回)`;
    if (result.masteryLeveledUp) {
      masteryLine += `\n🎊 **熟練度UP！** ${getMasteryTier(result.oldMasteryLevel!).name} → ${result.masteryTier.name}`;
    }
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `📊 報酬: **${formatChips(result.totalPay!)}** | XP: +${result.xpGained}\n📈 Lv.${result.newLevel} → XP: ${xpText}\n💰 残高: **${formatChips(result.newBalance!)}**${levelUpLine}${masteryLine}`,
    ),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Work again + overtime buttons
  const actionButtons: ButtonBuilder[] = [
    new ButtonBuilder()
      .setCustomId(`work:panel:${userId}:${result.jobId}`)
      .setLabel('💼 もう一度働く')
      .setStyle(ButtonStyle.Primary),
  ];

  if (result.overtimeAvailable) {
    actionButtons.push(
      new ButtonBuilder()
        .setCustomId(`work:overtime:${userId}`)
        .setLabel('⏰ 残業する')
        .setStyle(ButtonStyle.Danger),
    );
  }

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(...actionButtons),
  );

  return container;
}

export interface WeeklyChallengeViewData {
  userId: string;
  challenges: { name: string; emoji: string; progress: number; target: number; completed: boolean; reward: bigint }[];
  allCompleted: boolean;
  allCompletedBonus: bigint;
}

export function buildWeeklyChallengeView(data: WeeklyChallengeViewData): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.weeklyChallenges),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  if (data.challenges.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('今週のチャレンジはまだ割り当てられていません。'),
    );
  } else {
    const lines = data.challenges.map(c => {
      const icon = c.completed ? '✅' : '⬜';
      const bar = buildProgressBar(c.progress, c.target);
      return `${icon} **${c.name}**\n${bar} ${c.progress}/${c.target}　報酬: ${formatChips(c.reward)}`;
    });

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(lines.join('\n\n')),
    );

    if (data.allCompleted) {
      container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
      );
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `🎉 **全チャレンジ達成！** ボーナス: ${formatChips(data.allCompletedBonus)}`,
        ),
      );
    }
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`work:panel:${data.userId}`)
        .setLabel('💼 戻る')
        .setStyle(ButtonStyle.Secondary),
    ),
  );

  return container;
}

function buildProgressBar(current: number, target: number): string {
  const ratio = Math.min(current / target, 1);
  const filled = Math.round(ratio * 8);
  const empty = 8 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}
