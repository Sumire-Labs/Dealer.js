import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { registerCommand } from '../registry.js';
import { findOrCreateUser } from '../../database/repositories/user.repository.js';
import { getTopPlayers, getUserRank } from '../../database/repositories/leaderboard.repository.js';
import { buildLeaderboardView } from '../../ui/builders/leaderboard.builder.js';

const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('チップ保有量ランキングを表示')
  .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;

  const dbUser = await findOrCreateUser(userId);
  const topPlayers = await getTopPlayers(10);
  const rank = await getUserRank(userId);

  const entries = topPlayers.map(p => ({
    userId: p.id,
    chips: p.chips,
    totalGames: p.totalGames,
  }));

  const container = buildLeaderboardView({
    entries,
    requesterId: userId,
    requesterRank: rank,
    requesterChips: dbUser.chips,
  });

  await interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { users: [] },
  });
}

registerCommand({ data, execute: execute as never });
