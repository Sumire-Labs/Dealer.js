import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { registerCommand } from '../registry.js';
import { getWorkPanelData } from '../../database/services/work.service.js';
import { buildWorkPanelView } from '../../ui/builders/work.builder.js';

const data = new SlashCommandBuilder()
  .setName('work')
  .setDescription('カジノ従業員として働いてチップを稼ぐ')
  .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  const panelData = await getWorkPanelData(userId);

  let weeklyChallenges: { name: string; progress: number; target: number; completed: boolean }[] = [];
  try {
    const { getWeeklyChallenges } = await import('../../database/services/weekly-challenge.service.js');
    const { WEEKLY_CHALLENGE_POOL } = await import('../../config/weekly-challenges.js');
    const challenges = await getWeeklyChallenges(userId);
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

  await interaction.reply({
    components: [view],
    flags: MessageFlags.IsComponentsV2,
  });
}

registerCommand({ data, execute: execute as never });
