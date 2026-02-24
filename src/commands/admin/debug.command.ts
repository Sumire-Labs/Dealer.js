import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags,
} from 'discord.js';
import { registerCommand } from '../registry.js';
import { buildDebugUserSelectView } from '../../ui/builders/debug.builder.js';

const data = new SlashCommandBuilder()
  .setName('debug')
  .setDescription('[管理者] ユーザーデータのデバッグパネル')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const view = buildDebugUserSelectView(interaction.user.id);

  await interaction.reply({
    components: [view],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

registerCommand({ data, execute: execute as never });
