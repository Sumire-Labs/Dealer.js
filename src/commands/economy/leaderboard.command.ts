import {type ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder,} from 'discord.js';
import {registerCommand} from '../registry.js';
import {findOrCreateUser} from '../../database/repositories/user.repository.js';
import {getTopPlayers, getTotalPlayerCount, getUserRank} from '../../database/repositories/leaderboard.repository.js';
import {
    buildLeaderboardView,
    LEADERBOARD_CATEGORIES,
    LEADERBOARD_PAGE_SIZE
} from '../../ui/builders/leaderboard.builder.js';
import {formatChips} from '../../utils/formatters.js';

const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('ランキングを表示（カテゴリ切替可能）')
  .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  const category = 'chips' as const;

  const [dbUser, topPlayers, rank, totalCount] = await Promise.all([
    findOrCreateUser(userId),
    getTopPlayers(category, LEADERBOARD_PAGE_SIZE, 0),
    getUserRank(userId, category),
    getTotalPlayerCount(),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / LEADERBOARD_PAGE_SIZE));

  const entries = topPlayers.map(p => ({
    userId: p.id,
    value: `${formatChips(p.chips)}（${p.totalGames}回）`,
  }));

  const catInfo = LEADERBOARD_CATEGORIES.find(c => c.id === category)!;

  const container = buildLeaderboardView({
    entries,
    category,
    categoryLabel: `${catInfo.emoji} ${catInfo.label}ランキング`,
    requesterId: userId,
    requesterRank: rank,
    requesterValue: formatChips(dbUser.chips),
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
