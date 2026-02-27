import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
} from 'discord.js';
import {CasinoTheme} from '../themes/casino.theme.js';
import {formatChips} from '../../utils/formatters.js';
import {ITEM_MAP, type ItemRarity, RARITY_EMOJI, RARITY_LABELS,} from '../../config/shop.js';
import {buildTabRow} from './shop.builder.js';

export interface DailyRotationViewItem {
    itemId: string;
    originalPrice: bigint;
    discountedPrice: bigint;
}

export function buildDailyRotationView(
    userId: string,
    items: DailyRotationViewItem[],
    balance: bigint,
    nextResetTimestamp: number,
    selectedIndex: number = 0,
): ContainerBuilder {
    const container = new ContainerBuilder()
        .setAccentColor(CasinoTheme.colors.diamondBlue);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(CasinoTheme.prefixes.dailyShop),
    );
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    const validItems = items.filter(e => ITEM_MAP.has(e.itemId));
    const safeSelected = validItems.length > 0 ? Math.min(selectedIndex, validItems.length - 1) : 0;

    const lines: string[] = [
        `🔥 **20% OFF!**  次の更新: <t:${nextResetTimestamp}:R>`,
        '',
    ];

    for (let i = 0; i < validItems.length; i++) {
        const entry = validItems[i];
        const item = ITEM_MAP.get(entry.itemId)!;
        const cursor = i === safeSelected ? '▶' : '　';
        lines.push(
            `${cursor} ${item.emoji} **${item.name}** — ~~${formatChips(entry.originalPrice)}~~ → ${formatChips(entry.discountedPrice)}`,
        );
        lines.push(`  ${item.description}`);
    }

    lines.push('');
    lines.push(`💰 残高: ${formatChips(balance)}`);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(lines.join('\n')),
    );
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    // Cursor navigation + buy button for selected item
    if (validItems.length > 0) {
        const selectedEntry = validItems[safeSelected];
        const selectedItem = ITEM_MAP.get(selectedEntry.itemId)!;
        // Find the original index in items array for daily_buy
        const originalIndex = items.indexOf(selectedEntry);

        const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`shop:daily_sel_up:${userId}`)
                .setLabel('▲')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`shop:daily_sel_down:${userId}`)
                .setLabel('▼')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`shop:daily_buy:${userId}:${originalIndex}`)
                .setLabel(`${selectedItem.emoji} ${formatChips(selectedEntry.discountedPrice)} 購入`)
                .setStyle(ButtonStyle.Success),
        );
        container.addActionRowComponents(navRow);
    }

    // Tab row
    container.addActionRowComponents(buildTabRow(userId, 'daily'));

    return container;
}

export function buildMysteryBoxResultView(
    userId: string,
    _boxEmoji: string,
    _resultEmoji: string,
    resultName: string,
    rarity: ItemRarity,
    chipsAwarded: bigint | undefined,
    newBalance: bigint | undefined,
): ContainerBuilder {
    const container = new ContainerBuilder()
        .setAccentColor(CasinoTheme.colors.purple);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(CasinoTheme.prefixes.mystery),
    );
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    const lines: string[] = [
        '✨ **開封結果！**',
        `${RARITY_EMOJI[rarity]} **${resultName}** (${RARITY_LABELS[rarity]})`,
    ];

    if (chipsAwarded && chipsAwarded > 0n) {
        lines.push(`💰 +${formatChips(chipsAwarded)}`);
    }
    if (newBalance !== undefined) {
        lines.push(`💰 残高: ${formatChips(newBalance)}`);
    }

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(lines.join('\n')),
    );
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`inv:back:${userId}`)
                .setLabel('🎒 インベントリに戻る')
                .setStyle(ButtonStyle.Primary),
        ),
    );

    return container;
}

export interface BulkOpenLootEntry {
    name: string;
    emoji: string;
    rarity: ItemRarity;
    count: number;
}

export function buildBulkMysteryBoxResultView(
    userId: string,
    boxName: string,
    boxesOpened: number,
    lootSummary: BulkOpenLootEntry[],
    totalChipsAwarded: bigint,
    finalBalance: bigint,
): ContainerBuilder {
    const container = new ContainerBuilder()
        .setAccentColor(CasinoTheme.colors.purple);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(CasinoTheme.prefixes.mystery),
    );
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    const lines: string[] = [
        `✨ **${boxName} x${boxesOpened} 開封結果！**`,
        '',
    ];

    for (const entry of lootSummary) {
        lines.push(`${RARITY_EMOJI[entry.rarity]} ${entry.emoji} **${entry.name}** x${entry.count} (${RARITY_LABELS[entry.rarity]})`);
    }

    if (totalChipsAwarded > 0n) {
        lines.push('');
        lines.push(`💰 チップ合計: +${formatChips(totalChipsAwarded)}`);
    }

    lines.push('');
    lines.push(`💰 残高: ${formatChips(finalBalance)}`);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(lines.join('\n')),
    );
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`inv:back:${userId}`)
                .setLabel('🎒 インベントリに戻る')
                .setStyle(ButtonStyle.Primary),
        ),
    );

    return container;
}
