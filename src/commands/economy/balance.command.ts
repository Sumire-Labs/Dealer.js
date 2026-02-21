import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { registerCommand } from '../registry.js';
import { findOrCreateUser } from '../../database/repositories/user.repository.js';
import { getUserRank } from '../../database/repositories/leaderboard.repository.js';
import { buildBalanceView } from '../../ui/builders/balance.builder.js';

const data = new SlashCommandBuilder()
  .setName('balance')
  .setDescription('チップ残高と統計を確認')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('他のユーザーの残高を確認')
      .setRequired(false),
  )
  .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const targetUser = interaction.options.getUser('user') ?? interaction.user;
  const isSelf = targetUser.id === interaction.user.id;

  const dbUser = await findOrCreateUser(targetUser.id);
  const rank = await getUserRank(targetUser.id);

  const container = buildBalanceView({
    userId: targetUser.id,
    username: targetUser.displayName,
    chips: dbUser.chips,
    totalWon: dbUser.totalWon,
    totalLost: dbUser.totalLost,
    totalGames: dbUser.totalGames,
    rank,
    isSelf,
  });

  await interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });
}

registerCommand({ data, execute: execute as never });
