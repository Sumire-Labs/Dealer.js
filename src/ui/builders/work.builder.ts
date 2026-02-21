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

export interface WorkPanelViewData {
  userId: string;
  workLevel: number;
  workXp: number;
  workStreak: number;
  lastWorkAt: Date | null;
  xpForNextLevel: number | null;
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
  const { userId, workLevel, workXp, workStreak, xpForNextLevel } = data;

  const availableJobs = getAvailableJobs(workLevel);

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

  // Job list
  const jobLines = JOBS.map(job => {
    if (job.requiredLevel <= workLevel) {
      return `${job.emoji} ${job.name}　${formatChips(job.basePay.min)}〜${formatChips(job.basePay.max)}`;
    }
    return `🔒 ${job.name} (Lv.${job.requiredLevel})`;
  });

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

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Job selection buttons (only available jobs)
  const buttons = availableJobs.map(job =>
    new ButtonBuilder()
      .setCustomId(`work:job:${userId}:${job.id}`)
      .setLabel(job.emoji + ' ' + job.name)
      .setStyle(ButtonStyle.Secondary),
  );

  // Discord allows max 5 buttons per row
  if (buttons.length <= 5) {
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons),
    );
  } else {
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons.slice(0, 5)),
    );
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons.slice(5)),
    );
  }

  return container;
}

export interface ShiftSelectViewData {
  userId: string;
  jobId: string;
  jobName: string;
  jobEmoji: string;
}

export function buildShiftSelectView(data: ShiftSelectViewData): ContainerBuilder {
  const { userId, jobId, jobName, jobEmoji } = data;

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.work),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`${jobEmoji} **${jobName}** で働く`),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  // Shift buttons with cooldown check
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

  return container;
}

export function buildWorkResultView(result: WorkResult): ContainerBuilder {
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
        `${result.jobEmoji} **${result.jobName}** — ${result.shiftLabel}シフト`,
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

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `📊 報酬: **${formatChips(result.totalPay!)}** | XP: +${result.xpGained}\n📈 Lv.${result.newLevel} → XP: ${xpText}\n💰 残高: **${formatChips(result.newBalance!)}**${levelUpLine}`,
    ),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Work again button
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`work:panel:${result.jobId}`)
        .setLabel('💼 もう一度働く')
        .setStyle(ButtonStyle.Primary),
    ),
  );

  return container;
}
