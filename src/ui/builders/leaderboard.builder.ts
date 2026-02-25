import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import {CasinoTheme} from '../themes/casino.theme.js';
import type {LeaderboardCategory} from '../../database/repositories/leaderboard.repository.js';

export const LEADERBOARD_PAGE_SIZE = 10;

export const LEADERBOARD_CATEGORIES: {
    id: LeaderboardCategory;
    label: string;
    emoji: string;
    description: string
}[] = [
    {id: 'chips', label: 'チップ', emoji: '💰', description: '手持ちチップ額でランキング'},
    {id: 'net_worth', label: '総資産', emoji: '🏦', description: 'チップ＋銀行残高の合計'},
    {id: 'total_won', label: '累計勝利', emoji: '🏆', description: '累計獲得チップ額でランキング'},
    {id: 'work_level', label: '仕事Lv', emoji: '💼', description: '仕事レベルでランキング'},
    {id: 'shop_spend', label: 'ショップ', emoji: '🛒', description: 'ショップ累計支出額でランキング'},
    {id: 'achievements', label: '実績', emoji: '🏅', description: '解除した実績数でランキング'},
];

export interface LeaderboardDisplayEntry {
    userId: string;
    value: string;
}

export interface LeaderboardDisplayData {
    entries: LeaderboardDisplayEntry[];
    category: LeaderboardCategory;
    categoryLabel: string;
    requesterId: string;
    requesterRank: number;
    requesterValue: string;
    page: number;
    totalPages: number;
}

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

function buildCategorySelectMenu(
    requesterId: string,
    currentCategory: LeaderboardCategory,
): ActionRowBuilder<StringSelectMenuBuilder> {
    const options = LEADERBOARD_CATEGORIES.map(cat =>
        new StringSelectMenuOptionBuilder()
            .setLabel(`${cat.emoji} ${cat.label}`)
            .setValue(cat.id)
            .setDescription(cat.description)
            .setDefault(cat.id === currentCategory),
    );

    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`lb_select:category:${requesterId}`)
            .setPlaceholder('カテゴリーを選択...')
            .addOptions(options),
    );
}

export function buildLeaderboardView(data: LeaderboardDisplayData): ContainerBuilder {
    const {
        entries, category, categoryLabel,
        requesterId, requesterRank, requesterValue,
        page, totalPages,
    } = data;

    const offset = page * LEADERBOARD_PAGE_SIZE;
    const lines = entries.map((entry, i) => {
        const absoluteRank = offset + i;
        const medal = RANK_MEDALS[absoluteRank] ?? `**${absoluteRank + 1}.**`;
        const isRequester = entry.userId === requesterId;
        const name = isRequester ? '**あなた**' : `<@${entry.userId}>`;
        const highlight = isRequester ? ' ◀' : '';
        return `${medal} ${name} — ${entry.value}${highlight}`;
    });

    const boardText = lines.length > 0
        ? lines.join('\n')
        : '*まだプレイヤーがいません。*';

    const container = new ContainerBuilder()
        .setAccentColor(CasinoTheme.colors.gold)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(CasinoTheme.prefixes.leaderboard),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`${categoryLabel}\n${boardText}`),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `あなたの順位: **#${requesterRank}** | ${requesterValue}\nページ: ${page + 1} / ${totalPages}`,
            ),
        );

    // Category select menu
    container.addActionRowComponents(buildCategorySelectMenu(requesterId, category));

    // Pagination buttons
    if (totalPages > 1) {
        container.addActionRowComponents(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`lb:prev:${requesterId}:${page}:${category}`)
                    .setLabel('◀ 前へ')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page <= 0),
                new ButtonBuilder()
                    .setCustomId(`lb:next:${requesterId}:${page}:${category}`)
                    .setLabel('▶ 次へ')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page >= totalPages - 1),
            ),
        );
    }

    return container;
}
