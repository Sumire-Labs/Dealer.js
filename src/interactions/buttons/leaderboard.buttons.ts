import {type ButtonInteraction, MessageFlags} from 'discord.js';
import {registerButtonHandler} from '../handler.js';
import {findOrCreateUser} from '../../database/repositories/user.repository.js';
import {
    getTopPlayers,
    getTotalPlayerCount,
    getUserRank,
    type LeaderboardCategory,
    type LeaderboardEntry,
} from '../../database/repositories/leaderboard.repository.js';
import {
    buildLeaderboardView,
    LEADERBOARD_CATEGORIES,
    LEADERBOARD_PAGE_SIZE,
    type LeaderboardDisplayEntry,
} from '../../ui/builders/leaderboard.builder.js';
import {formatChips} from '../../utils/formatters.js';
import {prisma} from '../../database/client.js';

export function formatEntryValue(entry: LeaderboardEntry, category: LeaderboardCategory): LeaderboardDisplayEntry {
  switch (category) {
    case 'chips':
      return { userId: entry.id, value: `${formatChips(entry.chips)}（${entry.totalGames}回）` };
    case 'net_worth':
      return { userId: entry.id, value: formatChips(entry.chips + entry.bankBalance) };
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

export interface RequesterFields {
  chips: bigint;
  bankBalance: bigint;
  totalWon: bigint;
  workLevel: number;
  lifetimeShopSpend: bigint;
}

export function formatRequesterValue(user: RequesterFields, achievementCount: number, category: LeaderboardCategory): string {
  switch (category) {
    case 'chips': return formatChips(user.chips);
    case 'net_worth': return formatChips(user.chips + user.bankBalance);
    case 'total_won': return formatChips(user.totalWon);
    case 'work_level': return `Lv.${user.workLevel}`;
    case 'shop_spend': return formatChips(user.lifetimeShopSpend);
    case 'achievements': return `${achievementCount}個`;
  }
}

export function getCategoryLabel(category: LeaderboardCategory): string {
  const cat = LEADERBOARD_CATEGORIES.find(c => c.id === category);
  return cat ? `${cat.emoji} ${cat.label}ランキング` : '';
}

const VALID_CATEGORIES = new Set<string>(['chips', 'net_worth', 'total_won', 'work_level', 'shop_spend', 'achievements']);

async function handleLeaderboardButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const action = parts[1]; // prev or next
  const ownerId = parts[2];

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: 'これはあなたのランキングではありません！ `/leaderboard` で表示してください。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Only pagination: lb:prev:<userId>:<page>:<category> or lb:next:<userId>:<page>:<category>
  const currentPage = parseInt(parts[3], 10);
  const category: LeaderboardCategory = VALID_CATEGORIES.has(parts[4]) ? parts[4] as LeaderboardCategory : 'chips';
  const page = action === 'next' ? currentPage + 1 : currentPage - 1;

  const offset = page * LEADERBOARD_PAGE_SIZE;
  const userId = interaction.user.id;

  const [dbUser, topPlayers, rank, totalCount, userAchCount] = await Promise.all([
    findOrCreateUser(userId),
    getTopPlayers(category, LEADERBOARD_PAGE_SIZE, offset),
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

registerButtonHandler('lb', handleLeaderboardButton as never);
