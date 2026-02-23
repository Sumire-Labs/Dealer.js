import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { CasinoTheme } from '../themes/casino.theme.js';
import { ITEM_MAP } from '../../config/shop.js';
import type { CollectionProgress } from '../../database/services/collection.service.js';

export function buildCollectionListView(
  userId: string,
  progress: CollectionProgress[],
): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.purple);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('📖 **コレクション図鑑**'),
  );
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  const lines: string[] = [];
  for (const p of progress) {
    const status = p.completed ? '✅' : `${p.ownedItems.length}/${p.total}`;
    lines.push(`${p.collection.emoji} **${p.collection.name}** — ${status}`);
    lines.push(`  ${p.collection.rewardDescription}`);
  }

  if (lines.length === 0) {
    lines.push('コレクションはありません。');
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(lines.join('\n')),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Detail buttons
  const detailRow = new ActionRowBuilder<ButtonBuilder>();
  for (const p of progress.slice(0, 5)) {
    detailRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`shop:collection_detail:${userId}:${p.collection.key}`)
        .setLabel(`${p.collection.emoji}`)
        .setStyle(p.completed ? ButtonStyle.Success : ButtonStyle.Secondary),
    );
  }
  if (detailRow.components.length > 0) {
    container.addActionRowComponents(detailRow);
  }

  return container;
}

export function buildCollectionDetailView(
  userId: string,
  progress: CollectionProgress,
): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.purple);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`📖 **${progress.collection.emoji} ${progress.collection.name}**`),
  );
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  const ownedSet = new Set(progress.ownedItems);
  const itemLines = progress.collection.requiredItems.map(id => {
    const item = ITEM_MAP.get(id);
    const owned = ownedSet.has(id);
    return `${owned ? '✅' : '❌'} ${item?.emoji ?? '❓'} ${item?.name ?? id}`;
  });

  const statusLine = progress.completed
    ? '🎉 **コレクション完成！**'
    : `進捗: ${progress.ownedItems.length}/${progress.total}`;

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      [
        progress.collection.description,
        '',
        '必要アイテム:',
        ...itemLines,
        '',
        statusLine,
        '',
        `🏆 報酬: ${progress.collection.rewardDescription}`,
      ].join('\n'),
    ),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`shop:tab_collection:${userId}`)
        .setLabel('📖 図鑑に戻る')
        .setStyle(ButtonStyle.Primary),
    ),
  );

  return container;
}
