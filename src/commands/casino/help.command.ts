import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { registerCommand } from '../registry.js';
import { buildHelpTopView } from '../../ui/builders/help.builder.js';

const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('ヘルプ・ゲームガイドを表示する')
  .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const view = buildHelpTopView(interaction.user.id);
  await interaction.reply({
    components: [view],
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
  });
}

registerCommand({ data, execute: execute as never });
