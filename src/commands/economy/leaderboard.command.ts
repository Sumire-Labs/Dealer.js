import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { registerCommand } from '../registry.js';
import { findOrCreateUser } from '../../database/repositories/user.repository.js';
import { getTopPlayers, getUserRank, getTotalPlayerCount } from '../../database/repositories/leaderboard.repository.js';
import { buildLeaderboardView, LEADERBOARD_PAGE_SIZE } from '../../ui/builders/leaderboard.builder.js';

const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('チップ保有量ランキングを表示')
  .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;

  const [dbUser, topPlayers, rank, totalCount] = await Promise.all([
    findOrCreateUser(userId),
    getTopPlayers(LEADERBOARD_PAGE_SIZE, 0),
    getUserRank(userId),
    getTotalPlayerCount(),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / LEADERBOARD_PAGE_SIZE));

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
    page: 0,
    totalPages,
  });

  await interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    allowedMentions: { users: [] },
  });
}

registerCommand({ data, execute: execute as never });
