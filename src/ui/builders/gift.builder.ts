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
import {ITEM_MAP, SHOP_EFFECTS} from '../../config/shop.js';
import type {UserInventory} from '@prisma/client';

// ── Gift type selection ──

export function buildGiftTypeSelectView(
  senderId: string,
  receiverId: string,
  receiverName: string,
  remainingGifts: number,
): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('🎁 **ギフト**'),
  );
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      [
        `宛先: **${receiverName}**`,
        `本日の残り送信回数: **${remainingGifts}回**`,
        '',
        '何を送りますか？',
      ].join('\n'),
    ),
  );
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`gift:type_item:${senderId}:${receiverId}`)
        .setLabel('🎒 アイテム')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(remainingGifts <= 0),
      new ButtonBuilder()
        .setCustomId(`gift:type_chips:${senderId}:${receiverId}`)
        .setLabel('💰 チップ')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(remainingGifts <= 0),
      new ButtonBuilder()
        .setCustomId(`gift:cancel:${senderId}`)
        .setLabel('❌ キャンセル')
        .setStyle(ButtonStyle.Danger),
    ),
  );

  return container;
}

// ── Gift item selection ──

export function buildGiftItemSelectView(
  senderId: string,
  receiverId: string,
  inventory: UserInventory[],
  page: number,
): ContainerBuilder {
  const ITEMS_PER_PAGE = 5;
  const giftableItems = inventory.filter(inv => {
    const item = ITEM_MAP.get(inv.itemId);
    return item && item.giftable && inv.quantity > 0;
  });
  const totalPages = Math.max(1, Math.ceil(giftableItems.length / ITEMS_PER_PAGE));
  const pageItems = giftableItems.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('🎁 **アイテムを選択**'),
  );
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  if (giftableItems.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('ギフト可能なアイテムがありません。'),
    );
  } else {
    const lines = pageItems.map(inv => {
      const item = ITEM_MAP.get(inv.itemId);
      const qty = inv.quantity > 1 ? ` x${inv.quantity}` : '';
      return `${item?.emoji ?? '❓'} ${item?.name ?? inv.itemId}${qty}`;
    });
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(lines.join('\n')),
    );
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Select buttons
  if (pageItems.length > 0) {
    const selectRow = new ActionRowBuilder<ButtonBuilder>();
    for (const inv of pageItems) {
      const item = ITEM_MAP.get(inv.itemId);
      selectRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`gift:select_item:${senderId}:${receiverId}:${inv.itemId}`)
          .setLabel(`${item?.emoji ?? '❓'}`)
          .setStyle(ButtonStyle.Primary),
      );
    }
    container.addActionRowComponents(selectRow);
  }

  // Pagination + back
  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`gift:item_prev:${senderId}:${receiverId}`)
      .setLabel('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(`gift:item_page:${senderId}`)
      .setLabel(`${page + 1}/${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`gift:item_next:${senderId}:${receiverId}`)
      .setLabel('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
    new ButtonBuilder()
      .setCustomId(`gift:back:${senderId}:${receiverId}`)
      .setLabel('🔙 戻る')
      .setStyle(ButtonStyle.Danger),
  );
  container.addActionRowComponents(navRow);

  return container;
}

// ── Gift confirmation ──

export function buildGiftConfirmView(
  senderId: string,
  receiverId: string,
  receiverName: string,
  options: { itemId?: string; chips?: bigint },
): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('🎁 **ギフト確認**'),
  );
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  const lines = [`宛先: **${receiverName}**`, ''];
  if (options.itemId) {
    const item = ITEM_MAP.get(options.itemId);
    lines.push(`送るもの: ${item?.emoji ?? '❓'} **${item?.name ?? options.itemId}**`);
  } else if (options.chips) {
    const fee = (options.chips * BigInt(SHOP_EFFECTS.GIFT_FEE_RATE)) / 100n;
    lines.push(`送金額: ${formatChips(options.chips)}`);
    lines.push(`手数料 (${SHOP_EFFECTS.GIFT_FEE_RATE}%): ${formatChips(fee)}`);
    lines.push(`合計差引: ${formatChips(options.chips + fee)}`);
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(lines.join('\n')),
  );
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  const extra = options.itemId
    ? `:item:${options.itemId}`
    : `:chips:${options.chips!.toString()}`;

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`gift:confirm:${senderId}:${receiverId}${extra}`)
        .setLabel('✅ 送る')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`gift:cancel:${senderId}`)
        .setLabel('❌ キャンセル')
        .setStyle(ButtonStyle.Danger),
    ),
  );

  return container;
}

// ── Gift result ──

export function buildGiftResultView(
  _senderId: string,
  receiverName: string,
  options: { itemId?: string; chips?: bigint; fee?: bigint },
): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('🎁 **ギフト完了！**'),
  );
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  const lines = [`**${receiverName}** にギフトを送りました！`, ''];
  if (options.itemId) {
    const item = ITEM_MAP.get(options.itemId);
    lines.push(`${item?.emoji ?? '❓'} **${item?.name ?? options.itemId}**`);
  } else if (options.chips) {
    lines.push(`💰 ${formatChips(options.chips)}`);
    if (options.fee) {
      lines.push(`手数料: ${formatChips(options.fee)}`);
    }
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(lines.join('\n')),
  );

  return container;
}
