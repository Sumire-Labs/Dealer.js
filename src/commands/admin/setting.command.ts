import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags,
} from 'discord.js';
import { registerCommand } from '../registry.js';
import { buildSettingMenuView } from '../../ui/builders/setting.builder.js';

const data = new SlashCommandBuilder()
  .setName('setting')
  .setDescription('ボットの設定を管理する')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const container = buildSettingMenuView(interaction.user.id);

  await interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

registerCommand({ data, execute: execute as never });
