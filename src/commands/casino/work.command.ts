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

  const view = buildWorkPanelView({
    userId,
    workLevel: panelData.workLevel,
    workXp: panelData.workXp,
    workStreak: panelData.workStreak,
    lastWorkAt: panelData.lastWorkAt,
    xpForNextLevel: panelData.xpForNextLevel,
  });

  await interaction.reply({
    components: [view],
    flags: MessageFlags.IsComponentsV2,
  });
}

registerCommand({ data, execute: execute as never });
