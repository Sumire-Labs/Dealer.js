import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  PermissionFlagsBits,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} from 'discord.js';
import { registerCommand } from '../registry.js';
import { findOrCreateUser } from '../../database/repositories/user.repository.js';
import { addChips } from '../../database/services/economy.service.js';
import { CasinoTheme } from '../../ui/themes/casino.theme.js';
import { formatChips } from '../../utils/formatters.js';

const data = new SlashCommandBuilder()
  .setName('give')
  .setDescription('[管理者] ユーザーにチップを付与')
  .addUserOption(option =>
    option.setName('user').setDescription('対象ユーザー').setRequired(true),
  )
  .addIntegerOption(option =>
    option
      .setName('amount')
      .setDescription('付与するチップ量')
      .setRequired(true)
      .setMinValue(1),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const targetUser = interaction.options.getUser('user', true);
  const amount = BigInt(interaction.options.getInteger('amount', true));

  await findOrCreateUser(targetUser.id);
  const newBalance = await addChips(targetUser.id, amount, 'ADMIN_GIVE');

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.diamondBlue)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('🔧 **管理者 — チップ付与**'),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `<@${targetUser.id}> に **${formatChips(amount)}** を付与しました\n新しい残高: **${formatChips(newBalance)}**`,
      ),
    );

  await interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

registerCommand({ data, execute: execute as never });
