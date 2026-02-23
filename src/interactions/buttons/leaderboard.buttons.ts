import { type ButtonInteraction, MessageFlags } from 'discord.js';
import { registerButtonHandler } from '../handler.js';
import { findOrCreateUser } from '../../database/repositories/user.repository.js';
import {
  getTopPlayers,
  getUserRank,
  getTotalPlayerCount,
  type LeaderboardCategory,
  type LeaderboardEntry,
} from '../../database/repositories/leaderboard.repository.js';
import {
  buildLeaderboardView,
  LEADERBOARD_PAGE_SIZE,
  LEADERBOARD_CATEGORIES,
  type LeaderboardDisplayEntry,
} from '../../ui/builders/leaderboard.builder.js';
import { formatChips } from '../../utils/formatters.js';

function formatEntryValue(entry: LeaderboardEntry, category: LeaderboardCategory): LeaderboardDisplayEntry {
  switch (category) {
    case 'chips':
      return { userId: entry.id, value: `${formatChips(entry.chips)}（${entry.totalGames}回）` };
    case 'net_worth':
      return {
        userId: entry.id,
        value: formatChips(entry.chips + entry.bankBalance),
        subValue: `手持ち+銀行`,
      };
    case 'total_won':
      return { userId: entry.id, value: formatChips(entry.totalWon) };
    case 'work_level':
      return { userId: entry.id, value: `Lv.${entry.workLevel}（XP: ${entry.workXp}）` };
    case 'shop_spend':
      return { userId: entry.id, value: formatChips(entry.lifetimeShopSpend) };
    case 'achievements':
      return { userId: entry.id, value: `${entry.achievementCount}個` };
  }
}

function formatRequesterValue(user: { chips: bigint; bankBalance: bigint; totalWon: bigint; workLevel: number; workXp: number; lifetimeShopSpend: bigint }, achievementCount: number, category: LeaderboardCategory): string {
  switch (category) {
    case 'chips': return formatChips(user.chips);
    case 'net_worth': return formatChips(user.chips + user.bankBalance);
    case 'total_won': return formatChips(user.totalWon);
    case 'work_level': return `Lv.${user.workLevel}`;
    case 'shop_spend': return formatChips(user.lifetimeShopSpend);
    case 'achievements': return `${achievementCount}個`;
  }
}

function getCategoryLabel(category: LeaderboardCategory): string {
  const cat = LEADERBOARD_CATEGORIES.find(c => c.id === category);
  return cat ? `${cat.emoji} ${cat.label}ランキング` : '';
}

const VALID_CATEGORIES = new Set<string>(['chips', 'net_worth', 'total_won', 'work_level', 'shop_spend', 'achievements']);

async function handleLeaderboardButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const action = parts[1]; // prev, next, or cat
  const ownerId = parts[2];

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: 'これはあなたのランキングではありません！ `/leaderboard` で表示してください。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  let page: number;
  let category: LeaderboardCategory;

  if (action === 'cat') {
    // lb:cat:<userId>:<category>
    category = VALID_CATEGORIES.has(parts[3]) ? parts[3] as LeaderboardCategory : 'chips';
    page = 0;
  } else {
    // lb:prev:<userId>:<page>:<category> or lb:next:<userId>:<page>:<category>
    const currentPage = parseInt(parts[3], 10);
    category = VALID_CATEGORIES.has(parts[4]) ? parts[4] as LeaderboardCategory : 'chips';
    page = action === 'next' ? currentPage + 1 : currentPage - 1;
  }

  const offset = page * LEADERBOARD_PAGE_SIZE;
  const userId = interaction.user.id;

  const [dbUser, topPlayers, rank, totalCount, userAchCount] = await Promise.all([
    findOrCreateUser(userId),
    getTopPlayers(category, LEADERBOARD_PAGE_SIZE, offset),
    getUserRank(userId, category),
    getTotalPlayerCount(),
    category === 'achievements'
      ? (await import('../../database/client.js')).prisma.userAchievement.count({ where: { userId } })
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
    requesterValue: formatRequesterValue(
      dbUser as { chips: bigint; bankBalance: bigint; totalWon: bigint; workLevel: number; workXp: number; lifetimeShopSpend: bigint },
      userAchCount,
      category,
    ),
    page,
    totalPages,
  });

  await interaction.update({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { users: [] },
  });
}

registerButtonHandler('lb', handleLeaderboardButton as never);
