import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { registerCommand } from '../registry.js';
import { getBusinessDashboard } from '../../database/services/business.service.js';
import { buildBusinessDashboardView } from '../../ui/builders/business.builder.js';

const data = new SlashCommandBuilder()
  .setName('business')
  .setDescription('ビジネスを経営してパッシブ収入を得る')
  .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  const dashboard = await getBusinessDashboard(userId);
  const view = buildBusinessDashboardView(dashboard, userId);

  await interaction.reply({
    components: [view],
    flags: MessageFlags.IsComponentsV2,
  });
}

registerCommand({ data, execute: execute as never });
