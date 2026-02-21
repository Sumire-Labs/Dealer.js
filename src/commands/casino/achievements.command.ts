import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { registerCommand } from '../registry.js';
import { findOrCreateUser } from '../../database/repositories/user.repository.js';
import { getUnlockedIds } from '../../database/repositories/achievement.repository.js';
import { buildAchievementsView } from '../../ui/builders/achievements.builder.js';

const data = new SlashCommandBuilder()
  .setName('achievements')
  .setDescription('実績一覧を表示する')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('表示するユーザー')
      .setRequired(false),
  )
  .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const targetUser = interaction.options.getUser('user') ?? interaction.user;
  const userId = interaction.user.id;
  const targetId = targetUser.id;
  const isSelf = userId === targetId;

  await findOrCreateUser(targetId);
  const unlockedIds = await getUnlockedIds(targetId);

  const username = isSelf ? interaction.user.displayName : targetUser.displayName;
  const view = buildAchievementsView(userId, targetId, username, unlockedIds);

  await interaction.reply({
    components: [view],
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
  });
}

registerCommand({ data, execute: execute as never });
