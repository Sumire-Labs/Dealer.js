import {
  type ButtonInteraction,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
} from 'discord.js';
import { registerButtonHandler } from '../handler.js';
import { performWork, resolveMultiStepWork, getWorkPanelData } from '../../database/services/work.service.js';
import {
  buildWorkPanelView,
  buildShiftSelectView,
  buildWorkResultView,
  buildMultiStepEventView,
  buildWeeklyChallengeView,
} from '../../ui/builders/work.builder.js';
import { JOB_MAP, type ShiftType } from '../../config/jobs.js';
import { PROMOTED_JOB_MAP } from '../../config/promoted-jobs.js';
import { CasinoTheme } from '../../ui/themes/casino.theme.js';
import { formatTimeDelta } from '../../utils/formatters.js';
import { buildAchievementNotification } from '../../database/services/achievement.service.js';
import { buildMissionNotification } from '../../database/services/mission.service.js';
import { rollSpecialShifts } from '../../config/special-shifts.js';
import { WEEKLY_CHALLENGE_ALL_BONUS } from '../../config/constants.js';
import { setCooldown, buildCooldownKey } from '../../utils/cooldown.js';
import { SPECIAL_SHIFTS } from '../../config/special-shifts.js';

async function handleWorkButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const action = parts[1];

  switch (action) {
    case 'panel': {
      const ownerId = parts[2];
      if (interaction.user.id !== ownerId) {
        await interaction.reply({
          content: '`/work` で自分のワークパネルを開いてください。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const userId = ownerId;
      const panelData = await getWorkPanelData(userId);

      // Get weekly challenge summary
      let weeklyChallenges: { name: string; progress: number; target: number; completed: boolean }[] = [];
      try {
        const { getWeeklyChallenges } = await import('../../database/services/weekly-challenge.service.js');
        const challenges = await getWeeklyChallenges(userId);
        const { WEEKLY_CHALLENGE_POOL } = await import('../../config/weekly-challenges.js');
        weeklyChallenges = challenges.map(c => {
          const def = WEEKLY_CHALLENGE_POOL.find(p => p.key === c.challengeKey);
          return {
            name: def?.name ?? c.challengeKey,
            progress: c.progress,
            target: c.target,
            completed: c.completed,
          };
        });
      } catch { /* ignore */ }

      const view = buildWorkPanelView({
        userId,
        workLevel: panelData.workLevel,
        workXp: panelData.workXp,
        workStreak: panelData.workStreak,
        lastWorkAt: panelData.lastWorkAt,
        xpForNextLevel: panelData.xpForNextLevel,
        masteries: panelData.masteries,
        weeklyChallenges,
      });

      await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }

    case 'job': {
      const ownerId = parts[2];
      const jobId = parts[3];

      if (interaction.user.id !== ownerId) {
        await interaction.reply({
          content: '`/work` で自分のワークパネルを開いてください。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const job = JOB_MAP.get(jobId) ?? PROMOTED_JOB_MAP.get(jobId);
      if (!job) {
        await interaction.reply({
          content: '無効な職種です。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Roll special shifts
      const specialShifts = rollSpecialShifts(ownerId);

      const view = buildShiftSelectView({
        userId: ownerId,
        jobId: job.id,
        jobName: job.name,
        jobEmoji: job.emoji,
        isPromoted: 'isPromoted' in job,
        specialShifts,
      });

      await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }

    case 'shift': {
      const ownerId = parts[2];
      const jobId = parts[3];
      const shiftType = parts[4] as ShiftType;

      if (interaction.user.id !== ownerId) {
        await interaction.reply({
          content: '`/work` で自分のワークパネルを開いてください。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const result = await performWork(ownerId, jobId, shiftType);
      await handleWorkResult(interaction, result);
      break;
    }

    case 'special': {
      const ownerId = parts[2];
      const jobId = parts[3];
      const specialType = parts[4];

      if (interaction.user.id !== ownerId) {
        await interaction.reply({
          content: '`/work` で自分のワークパネルを開いてください。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Special shifts use 'normal' shift type as base
      const specialShift = SPECIAL_SHIFTS.find(s => s.type === specialType);
      if (!specialShift) {
        await interaction.reply({ content: '無効な特別シフトです。', flags: MessageFlags.Ephemeral });
        return;
      }

      // Set training cooldown if applicable
      if (specialShift.cooldownKey && specialShift.cooldownMs) {
        setCooldown(buildCooldownKey(ownerId, specialShift.cooldownKey), specialShift.cooldownMs);
      }

      const result = await performWork(ownerId, jobId, 'normal', specialType);
      await handleWorkResult(interaction, result);
      break;
    }

    case 'choice': {
      const ownerId = parts[2];
      const choiceId = parts[3];

      if (interaction.user.id !== ownerId) {
        await interaction.reply({
          content: '`/work` で自分のワークパネルを開いてください。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const result = await resolveMultiStepWork(ownerId, choiceId);
      await handleWorkResult(interaction, result);
      break;
    }

    case 'weekly': {
      const ownerId = parts[2];

      if (interaction.user.id !== ownerId) {
        await interaction.reply({
          content: '`/work` で自分のワークパネルを開いてください。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      try {
        const { getWeeklyChallenges } = await import('../../database/services/weekly-challenge.service.js');
        const { WEEKLY_CHALLENGE_POOL } = await import('../../config/weekly-challenges.js');
        const challenges = await getWeeklyChallenges(ownerId);

        const mapped = challenges.map(c => {
          const def = WEEKLY_CHALLENGE_POOL.find(p => p.key === c.challengeKey);
          return {
            name: def?.name ?? c.challengeKey,
            emoji: '📋',
            progress: c.progress,
            target: c.target,
            completed: c.completed,
            reward: c.reward,
          };
        });

        const allCompleted = mapped.length > 0 && mapped.every(c => c.completed);

        const view = buildWeeklyChallengeView({
          userId: ownerId,
          challenges: mapped,
          allCompleted,
          allCompletedBonus: WEEKLY_CHALLENGE_ALL_BONUS,
        });

        await interaction.update({
          components: [view],
          flags: MessageFlags.IsComponentsV2,
        });
      } catch {
        await interaction.reply({ content: 'チャレンジの読み込みに失敗しました。', flags: MessageFlags.Ephemeral });
      }
      break;
    }
  }
}

async function handleWorkResult(
  interaction: ButtonInteraction,
  result: Awaited<ReturnType<typeof performWork>>,
): Promise<void> {
  if (!result.success) {
    if (result.remainingCooldown) {
      const container = new ContainerBuilder()
        .setAccentColor(CasinoTheme.colors.red)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(CasinoTheme.prefixes.work),
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `⏰ まだ休憩中です！\n次のシフトまで: **${formatTimeDelta(result.remainingCooldown)}**`,
          ),
        );

      await interaction.update({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });
    } else {
      await interaction.reply({
        content: result.error ?? 'エラーが発生しました。',
        flags: MessageFlags.Ephemeral,
      });
    }
    return;
  }

  // Multi-step event pending — show choices
  if (result.multiStepPending) {
    const view = buildMultiStepEventView(interaction.user.id, result);
    await interaction.update({
      components: [view],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  const view = buildWorkResultView(result, interaction.user.id);

  await interaction.update({
    components: [view],
    flags: MessageFlags.IsComponentsV2,
  });

  // Achievement notification
  if (result.newlyUnlocked && result.newlyUnlocked.length > 0) {
    await interaction.followUp({
      content: buildAchievementNotification(result.newlyUnlocked),
      flags: MessageFlags.Ephemeral,
    });
  }

  // Mission notification
  if (result.missionsCompleted && result.missionsCompleted.length > 0) {
    await interaction.followUp({
      content: buildMissionNotification(result.missionsCompleted),
      flags: MessageFlags.Ephemeral,
    });
  }
}

registerButtonHandler('work', handleWorkButton as never);
