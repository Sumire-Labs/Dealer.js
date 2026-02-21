import {
  type ButtonInteraction,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
} from 'discord.js';
import { registerButtonHandler } from '../handler.js';
import { performWork, getWorkPanelData } from '../../database/services/work.service.js';
import {
  buildWorkPanelView,
  buildShiftSelectView,
  buildWorkResultView,
} from '../../ui/builders/work.builder.js';
import { JOB_MAP, type ShiftType } from '../../config/jobs.js';
import { CasinoTheme } from '../../ui/themes/casino.theme.js';
import { formatTimeDelta } from '../../utils/formatters.js';
import { buildAchievementNotification } from '../../database/services/achievement.service.js';

async function handleWorkButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const action = parts[1];

  switch (action) {
    case 'panel': {
      // "Work again" button — anyone can open their own panel
      const userId = interaction.user.id;
      const panelData = await getWorkPanelData(userId);
      const view = buildWorkPanelView({
        userId,
        workLevel: panelData.workLevel,
        workXp: panelData.workXp,
        workStreak: panelData.workStreak,
        lastWorkAt: panelData.lastWorkAt,
        xpForNextLevel: panelData.xpForNextLevel,
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

      const job = JOB_MAP.get(jobId);
      if (!job) {
        await interaction.reply({
          content: '無効な職種です。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const view = buildShiftSelectView({
        userId: ownerId,
        jobId: job.id,
        jobName: job.name,
        jobEmoji: job.emoji,
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

      const view = buildWorkResultView(result);

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
      break;
    }
  }
}

registerButtonHandler('work', handleWorkButton as never);
