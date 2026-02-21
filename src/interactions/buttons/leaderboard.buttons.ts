import { type ButtonInteraction, MessageFlags } from 'discord.js';
import { registerButtonHandler } from '../handler.js';
import { findOrCreateUser } from '../../database/repositories/user.repository.js';
import { getTopPlayers, getUserRank, getTotalPlayerCount } from '../../database/repositories/leaderboard.repository.js';
import { buildLeaderboardView, LEADERBOARD_PAGE_SIZE } from '../../ui/builders/leaderboard.builder.js';

async function handleLeaderboardButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  // lb:prev:<userId>:<page> or lb:next:<userId>:<page>
  const direction = parts[1]; // prev or next
  const ownerId = parts[2];
  const currentPage = parseInt(parts[3], 10);

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: 'これはあなたのランキングではありません！ `/leaderboard` で表示してください。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const newPage = direction === 'next' ? currentPage + 1 : currentPage - 1;
  const offset = newPage * LEADERBOARD_PAGE_SIZE;

  const userId = interaction.user.id;
  const [dbUser, topPlayers, rank, totalCount] = await Promise.all([
    findOrCreateUser(userId),
    getTopPlayers(LEADERBOARD_PAGE_SIZE, offset),
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
    page: newPage,
    totalPages,
  });

  await interaction.update({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { users: [] },
  });
}

registerButtonHandler('lb', handleLeaderboardButton as never);
