import {
  type StringSelectMenuInteraction,
  MessageFlags,
} from 'discord.js';
import { registerSelectMenuHandler } from '../handler.js';
import { JOB_MAP } from '../../config/jobs.js';
import { PROMOTED_JOB_MAP } from '../../config/promoted-jobs.js';
import { buildShiftSelectView } from '../../ui/builders/work.builder.js';
import { rollSpecialShifts } from '../../config/special-shifts.js';

async function handleWorkSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const action = parts[1];
  const ownerId = parts[2];

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: '`/work` で自分のワークパネルを開いてください。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  switch (action) {
    case 'job': {
      const jobId = interaction.values[0];
      const job = JOB_MAP.get(jobId) ?? PROMOTED_JOB_MAP.get(jobId);
      if (!job) {
        await interaction.reply({
          content: '無効な職種です。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

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
  }
}

registerSelectMenuHandler('work_select', handleWorkSelectMenu as never);
