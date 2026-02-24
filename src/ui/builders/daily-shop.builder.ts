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
import { formatChips } from '../../utils/formatters.js';
import {
  ITEM_MAP,
  RARITY_EMOJI,
  RARITY_LABELS,
  type ItemRarity,
} from '../../config/shop.js';
import { buildTabRow } from './shop.builder.js';

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
): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.diamondBlue);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(CasinoTheme.prefixes.dailyShop),
  );
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  const lines: string[] = [
    `🔥 **20% OFF!**  次の更新: <t:${nextResetTimestamp}:R>`,
    '',
  ];

  for (const entry of items) {
    const item = ITEM_MAP.get(entry.itemId);
    if (!item) continue;
    lines.push(
      `${item.emoji} **${item.name}** — ~~${formatChips(entry.originalPrice)}~~ → ${formatChips(entry.discountedPrice)}`,
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

  // Buy buttons
  if (items.length > 0) {
    const buyRow = new ActionRowBuilder<ButtonBuilder>();
    for (let i = 0; i < items.length; i++) {
      const item = ITEM_MAP.get(items[i].itemId);
      if (!item) continue;
      buyRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`shop:daily_buy:${userId}:${i}`)
          .setLabel(`${item.emoji} ${formatChips(items[i].discountedPrice)}`)
          .setStyle(ButtonStyle.Success),
      );
    }
    container.addActionRowComponents(buyRow);
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
