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
import { findOrCreateUser, resetUser } from '../../database/repositories/user.repository.js';
import { createTransaction } from '../../database/repositories/transaction.repository.js';
import { CasinoTheme } from '../../ui/themes/casino.theme.js';
import { INITIAL_CHIPS } from '../../config/constants.js';
import { formatChips } from '../../utils/formatters.js';

const data = new SlashCommandBuilder()
  .setName('reset')
  .setDescription('[管理者] ユーザーのデータをリセット')
  .addUserOption(option =>
    option.setName('user').setDescription('対象ユーザー').setRequired(true),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const targetUser = interaction.options.getUser('user', true);

  await findOrCreateUser(targetUser.id);
  await resetUser(targetUser.id);

  await createTransaction({
    userId: targetUser.id,
    type: 'ADMIN_RESET',
    amount: 0n,
    balanceAfter: INITIAL_CHIPS,
  });

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.red)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('🔧 **管理者 — ユーザーリセット**'),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `<@${targetUser.id}> のアカウントをリセットしました。\nチップを **${formatChips(INITIAL_CHIPS)}** に設定し、統計をクリアしました。`,
      ),
    );

  await interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

registerCommand({ data, execute: execute as never });
