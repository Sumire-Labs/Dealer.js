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
import {ITEM_MAP} from '../../config/shop.js';
import type {ActiveBuff} from '@prisma/client';

export function buildProfileView(
    userId: string,
    targetId: string,
    username: string,
    activeTitle: string | null,
    activeBadge: string | null,
    activeBuffs: ActiveBuff[],
    inventoryCount: number,
    isSelf: boolean,
): ContainerBuilder {
    const container = new ContainerBuilder()
        .setAccentColor(CasinoTheme.colors.gold);

    const title = isSelf
        ? CasinoTheme.prefixes.balance
        : `${CasinoTheme.prefixes.balance}\n**${username}**`;

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(title),
    );
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    const lines: string[] = [];

    // Title
    const titleItem = activeTitle ? ITEM_MAP.get(activeTitle) : null;
    lines.push(`称号: ${titleItem ? `${titleItem.emoji} ${titleItem.name}` : 'なし'}`);

    // Badge
    const badgeItem = activeBadge ? ITEM_MAP.get(activeBadge) : null;
    lines.push(`バッジ: ${badgeItem ? `${badgeItem.emoji} ${badgeItem.name}` : 'なし'}`);

    // Active buffs
    if (activeBuffs.length > 0) {
        const buffLines = activeBuffs.map(b => {
            const item = ITEM_MAP.get(b.buffId);
            if (!item) return null;
            const remaining = b.expiresAt.getTime() - Date.now();
            const hours = Math.ceil(remaining / (60 * 60 * 1000));
            return `${item.emoji} ${item.name} (残り${hours}h)`;
        }).filter(Boolean);
        lines.push(`アクティブバフ: ${buffLines.length > 0 ? buffLines.join(', ') : 'なし'}`);
    } else {
        lines.push('アクティブバフ: なし');
    }

    lines.push(`インベントリ: ${inventoryCount}個`);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(lines.join('\n')),
    );
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    // Tab row
    container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`bal:balance:${userId}:${targetId}`)
                .setLabel('💰 残高')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`bal:stats:${userId}:${targetId}`)
                .setLabel('📊 統計')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`bal:profile:${userId}:${targetId}`)
                .setLabel('👤 プロフィール')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true),
        ),
    );

    return container;
}
