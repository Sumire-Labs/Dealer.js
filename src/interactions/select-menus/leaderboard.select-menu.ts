import {
  type StringSelectMenuInteraction,
  MessageFlags,
} from 'discord.js';
import { registerSelectMenuHandler } from '../handler.js';
import { findOrCreateUser } from '../../database/repositories/user.repository.js';
import {
  getTopPlayers,
  getUserRank,
  getTotalPlayerCount,
  type LeaderboardCategory,
} from '../../database/repositories/leaderboard.repository.js';
import {
  buildLeaderboardView,
  LEADERBOARD_PAGE_SIZE,
} from '../../ui/builders/leaderboard.builder.js';
import {
  formatEntryValue,
  formatRequesterValue,
  getCategoryLabel,
} from '../buttons/leaderboard.buttons.js';
import { prisma } from '../../database/client.js';

const VALID_CATEGORIES = new Set<string>(['chips', 'net_worth', 'total_won', 'work_level', 'shop_spend', 'achievements']);

async function handleLeaderboardSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const ownerId = parts[2];

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: 'これはあなたのランキングではありません！ `/leaderboard` で表示してください。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const userId = interaction.user.id;
  const selected = interaction.values[0];
  const category: LeaderboardCategory = VALID_CATEGORIES.has(selected) ? selected as LeaderboardCategory : 'chips';
  const page = 0;

  const [dbUser, topPlayers, rank, totalCount, userAchCount] = await Promise.all([
    findOrCreateUser(userId),
    getTopPlayers(category, LEADERBOARD_PAGE_SIZE, 0),
    getUserRank(userId, category),
    getTotalPlayerCount(),
    category === 'achievements'
      ? prisma.userAchievement.count({ where: { userId } })
      : Promise.resolve(0),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / LEADERBOARD_PAGE_SIZE));
  const entries = topPlayers.map(p => formatEntryValue(p, category));

  const container = buildLeaderboardView({
    entries,
    category,
    categoryLabel: getCategoryLabel(category),
    requesterId: userId,
    requesterRank: rank,
    requesterValue: formatRequesterValue(dbUser, userAchCount, category),
    page,
    totalPages,
  });

  await interaction.update({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { users: [] },
  });
}

registerSelectMenuHandler('lb_select', handleLeaderboardSelectMenu as never);
