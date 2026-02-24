import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { CasinoTheme } from '../../themes/casino.theme.js';
import { formatChips } from '../../../utils/formatters.js';
import {
  JOBS,
  LEVEL_THRESHOLDS,
} from '../../../config/jobs.js';
import { getAvailableJobs } from '../../../games/work/work.engine.js';
import { getRemainingCooldown, buildCooldownKey } from '../../../utils/cooldown.js';
import { formatTimeDelta } from '../../../utils/formatters.js';
import { getMasteryTier } from '../../../config/work-mastery.js';
import { PROMOTED_JOBS, type PromotedJobDefinition } from '../../../config/promoted-jobs.js';
import { SHIFTS } from '../../../config/jobs.js';

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
  const remaining = needed - progress;
  return `${bar} ${percent}% (あと${remaining}XP)`;
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

  // Job list with mastery tiers + estimated pay with mastery bonus
  const jobLines: string[] = [];

  // Base jobs
  for (const job of JOBS) {
    if (job.requiredLevel <= workLevel) {
      const masteryInfo = masteries?.get(job.id);
      const tier = getMasteryTier(masteryInfo?.level ?? 0);
      const masteryLabel = `${tier.emoji}`;
      const bonusPct = tier.payBonus;
      const estMin = job.basePay.min + (job.basePay.min * BigInt(bonusPct)) / 100n;
      const estMax = job.basePay.max + (job.basePay.max * BigInt(bonusPct)) / 100n;
      const payRange = bonusPct > 0
        ? `${formatChips(estMin)}〜${formatChips(estMax)} (+${bonusPct}%)`
        : `${formatChips(job.basePay.min)}〜${formatChips(job.basePay.max)}`;
      jobLines.push(`${job.emoji} ${job.name} ${masteryLabel}　${payRange}`);
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

  // Job selection StringSelectMenu
  const jobOptions = availableJobs.map(job => {
    const masteryInfo = masteries?.get(job.id);
    const tier = getMasteryTier(masteryInfo?.level ?? 0);
    const bonusPct = tier.payBonus;
    const estMin = job.basePay.min + (job.basePay.min * BigInt(bonusPct)) / 100n;
    const estMax = job.basePay.max + (job.basePay.max * BigInt(bonusPct)) / 100n;
    const isPromoted = 'isPromoted' in job;
    const reqLevel = 'requiredLevel' in job ? (job as import('../../../config/jobs.js').JobDefinition).requiredLevel : 5;
    const desc = isPromoted
      ? `⭐ 昇進ジョブ | ${formatChips(job.basePay.min)}〜${formatChips(job.basePay.max)}`
      : `Lv.${reqLevel}〜 | ${formatChips(estMin)}〜${formatChips(estMax)} ${tier.emoji}`;
    return new StringSelectMenuOptionBuilder()
      .setLabel(`${job.emoji} ${job.name}`)
      .setDescription(desc)
      .setValue(job.id);
  });

  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`work_select:job:${userId}`)
        .setPlaceholder('💼 ジョブを選択...')
        .addOptions(jobOptions),
    ),
  );

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
