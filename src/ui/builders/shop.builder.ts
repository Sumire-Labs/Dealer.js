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
  SHOP_CATEGORIES,
  ITEM_MAP,
  SHOP_EFFECTS,
  type ShopItem,
} from '../../config/shop.js';
import type { ShopRankDef } from '../../config/shop-ranks.js';
import type { FlashSale } from '../../database/services/shop.service.js';
import type { UserInventory, ActiveBuff } from '@prisma/client';

export type ShopTab = 'shop' | 'inventory' | 'daily' | 'craft' | 'collection';
const ITEMS_PER_PAGE = 3;

// ── Main tab buttons (5 tabs) ──

export function buildTabRow(userId: string, activeTab: ShopTab): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`shop:tab_shop:${userId}`)
      .setLabel('🛒 ショップ')
      .setStyle(activeTab === 'shop' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(activeTab === 'shop'),
    new ButtonBuilder()
      .setCustomId(`shop:tab_inventory:${userId}`)
      .setLabel('🎒 持ち物')
      .setStyle(activeTab === 'inventory' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(activeTab === 'inventory'),
    new ButtonBuilder()
      .setCustomId(`shop:tab_daily:${userId}`)
      .setLabel('📅 日替わり')
      .setStyle(activeTab === 'daily' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(activeTab === 'daily'),
    new ButtonBuilder()
      .setCustomId(`shop:tab_craft:${userId}`)
      .setLabel('🔨 クラフト')
      .setStyle(activeTab === 'craft' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(activeTab === 'craft'),
    new ButtonBuilder()
      .setCustomId(`shop:tab_collection:${userId}`)
      .setLabel('📖 図鑑')
      .setStyle(activeTab === 'collection' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(activeTab === 'collection'),
  );
}

// ── Shop tab ──

export function buildShopView(
  userId: string,
  categoryIndex: number,
  page: number,
  balance: bigint,
  rankInfo?: { rank: ShopRankDef; nextRank: ShopRankDef | null; lifetimeSpend: bigint },
  flashSale?: FlashSale | null,
): ContainerBuilder {
  const cat = SHOP_CATEGORIES[categoryIndex];
  const totalPages = Math.ceil(cat.items.length / ITEMS_PER_PAGE);
  const start = page * ITEMS_PER_PAGE;
  const pageItems = cat.items.slice(start, start + ITEMS_PER_PAGE);

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold);

  // Header
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(CasinoTheme.prefixes.shop),
  );
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Flash sale banner
  if (flashSale) {
    const flashItem = ITEM_MAP.get(flashSale.itemId);
    const remainingMs = flashSale.expiresAt - Date.now();
    const remainingMin = Math.max(0, Math.ceil(remainingMs / 60_000));
    if (flashItem && remainingMin > 0) {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `⚡ **フラッシュセール** — ${flashItem.emoji} ${flashItem.name} ~~${formatChips(flashSale.originalPrice)}~~ → **${formatChips(flashSale.salePrice)}** (残り${remainingMin}分)`,
        ),
      );
      container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`shop:flash_buy:${userId}:${flashSale.itemId}`)
            .setLabel(`⚡ ${formatChips(flashSale.salePrice)}で購入`)
            .setStyle(ButtonStyle.Danger),
        ),
      );
      container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
      );
    }
  }

  // Rank info
  const rankLines: string[] = [];
  if (rankInfo) {
    rankLines.push(`${rankInfo.rank.emoji} ランク: **${rankInfo.rank.label}**`);
    if (rankInfo.rank.discountPercent > 0) {
      rankLines.push(`  割引: ${rankInfo.rank.discountPercent}% OFF`);
    }
    if (rankInfo.nextRank) {
      const remaining = rankInfo.nextRank.threshold - rankInfo.lifetimeSpend;
      rankLines.push(`  次のランクまで: ${formatChips(remaining)}`);
    }
    rankLines.push('');
  }

  // Category header + items
  const lines: string[] = [...rankLines, `${cat.emoji} **${cat.label}**`, ''];
  for (const item of pageItems) {
    let priceLabel = formatChips(item.price);
    if (rankInfo && rankInfo.rank.discountPercent > 0 && item.price > 0n) {
      const discounted = item.price - (item.price * BigInt(rankInfo.rank.discountPercent)) / 100n;
      priceLabel = `~~${formatChips(item.price)}~~ ${formatChips(discounted)}`;
    }
    const rankTag = item.rankRequired ? ` [${item.rankRequired.toUpperCase()}]` : '';
    lines.push(`${item.emoji} **${item.name}** — ${priceLabel}${rankTag}`);
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

  // Buy buttons for page items
  if (pageItems.length > 0) {
    const buyRow = new ActionRowBuilder<ButtonBuilder>();
    for (const item of pageItems) {
      let displayPrice = item.price;
      if (rankInfo && rankInfo.rank.discountPercent > 0 && item.price > 0n) {
        displayPrice = item.price - (item.price * BigInt(rankInfo.rank.discountPercent)) / 100n;
      }
      buyRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`shop:buy:${userId}:${item.id}`)
          .setLabel(`${item.emoji} ${formatChips(displayPrice)}`)
          .setStyle(ButtonStyle.Success),
      );
    }
    container.addActionRowComponents(buyRow);
  }

  // Navigation row
  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`shop:cat_prev:${userId}`)
      .setLabel('◀')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`shop:cat_info:${userId}`)
      .setLabel(`${cat.emoji} ${cat.label} (${page + 1}/${totalPages})`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`shop:cat_next:${userId}`)
      .setLabel('▶')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`shop:page_prev:${userId}`)
      .setLabel('◀pg')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(`shop:page_next:${userId}`)
      .setLabel('pg▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
  );
  container.addActionRowComponents(navRow);

  // Tab row
  container.addActionRowComponents(buildTabRow(userId, 'shop'));

  return container;
}

// ── Purchase confirmation ──

export function buildPurchaseConfirmView(
  userId: string,
  item: ShopItem,
  balance: bigint,
  price?: bigint,
  dailyItemIndex?: number,
): ContainerBuilder {
  const finalPrice = price ?? item.price;
  const afterBalance = balance - finalPrice;

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(CasinoTheme.prefixes.shop),
  );
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      [
        `${item.emoji} **${item.name}** — ${formatChips(finalPrice)}`,
        item.description,
        '',
        `💰 残高: ${formatChips(balance)} → ${formatChips(afterBalance)}`,
      ].join('\n'),
    ),
  );
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  const extra = dailyItemIndex !== undefined ? `:daily:${dailyItemIndex}` : '';
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`shop:confirm_buy:${userId}:${item.id}${extra}`)
        .setLabel('✅ 購入する')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`shop:cancel_buy:${userId}`)
        .setLabel('❌ キャンセル')
        .setStyle(ButtonStyle.Danger),
    ),
  );

  return container;
}

// ── Inventory tab ──

export function buildInventoryView(
  userId: string,
  inventory: UserInventory[],
  activeBuffs: ActiveBuff[],
  activeTitle: string | null,
  activeBadge: string | null,
  page: number,
): ContainerBuilder {
  const ITEMS_PER_INV_PAGE = 5;
  const allEntries: { label: string; actionId?: string; actionLabel?: string; recycleId?: string }[] = [];

  // Active buffs
  for (const buff of activeBuffs) {
    const item = ITEM_MAP.get(buff.buffId);
    if (!item) continue;
    const remaining = buff.expiresAt.getTime() - Date.now();
    const hours = Math.ceil(remaining / (60 * 60 * 1000));
    allEntries.push({
      label: `${item.emoji} ${item.name} (残り${hours}h)`,
    });
  }

  // Inventory items
  for (const inv of inventory) {
    if (inv.quantity <= 0) continue;
    const item = ITEM_MAP.get(inv.itemId);
    if (!item) continue;
    // Skip collection reward flags
    if (inv.itemId.startsWith('COLLECTION_REWARD_')) continue;

    const isEquippedTitle = item.cosmeticType === 'title' && activeTitle === inv.itemId;
    const isEquippedBadge = item.cosmeticType === 'badge' && activeBadge === inv.itemId;
    const equipped = isEquippedTitle || isEquippedBadge;

    let label = `${item.emoji} ${item.name}`;
    if (inv.quantity > 1) label += ` x${inv.quantity}`;
    if (equipped) label += ' [装備中]';

    let actionId: string | undefined;
    let actionLabel: string | undefined;
    let recycleId: string | undefined;

    if (item.category === 'cosmetic') {
      actionId = equipped
        ? `shop:unequip:${userId}:${inv.itemId}`
        : `shop:equip:${userId}:${inv.itemId}`;
      actionLabel = equipped ? '装備解除' : '装備';
    } else if (item.category === 'mystery' || inv.itemId === 'GOLDEN_BOX') {
      actionId = `shop:open_box:${userId}:${inv.itemId}`;
      actionLabel = '開封';
    } else if (item.category === 'consumable' && (inv.itemId === 'MISSION_REROLL' || inv.itemId === 'WORK_COOLDOWN_SKIP')) {
      actionId = `shop:use:${userId}:${inv.itemId}`;
      actionLabel = '使う';
    }

    // Recycle available for items with a price
    if (item.price > 0n && item.category !== 'craft') {
      recycleId = `shop:recycle:${userId}:${inv.itemId}`;
    }

    allEntries.push({ label, actionId, actionLabel, recycleId });
  }

  const totalPages = Math.max(1, Math.ceil(allEntries.length / ITEMS_PER_INV_PAGE));
  const pageEntries = allEntries.slice(page * ITEMS_PER_INV_PAGE, (page + 1) * ITEMS_PER_INV_PAGE);

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.purple);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(CasinoTheme.prefixes.inventory),
  );
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  if (allEntries.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('アイテムはありません。ショップで購入しましょう！'),
    );
  } else {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        pageEntries.map(e => e.label).join('\n'),
      ),
    );
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Action buttons for page items (use/equip/open)
  const actionEntries = pageEntries.filter(e => e.actionId);
  if (actionEntries.length > 0) {
    const actionRow = new ActionRowBuilder<ButtonBuilder>();
    for (const entry of actionEntries.slice(0, 5)) {
      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(entry.actionId!)
          .setLabel(entry.actionLabel!)
          .setStyle(ButtonStyle.Primary),
      );
    }
    container.addActionRowComponents(actionRow);
  }

  // Recycle buttons
  const recycleEntries = pageEntries.filter(e => e.recycleId);
  if (recycleEntries.length > 0) {
    const recycleRow = new ActionRowBuilder<ButtonBuilder>();
    for (const entry of recycleEntries.slice(0, 5)) {
      const itemId = entry.recycleId!.split(':')[3];
      const item = ITEM_MAP.get(itemId);
      const refund = item ? (item.price * BigInt(SHOP_EFFECTS.RECYCLE_REFUND_RATE)) / 100n : 0n;
      recycleRow.addComponents(
        new ButtonBuilder()
          .setCustomId(entry.recycleId!)
          .setLabel(`♻️ ${formatChips(refund)}`)
          .setStyle(ButtonStyle.Secondary),
      );
    }
    container.addActionRowComponents(recycleRow);
  }

  // Pagination
  if (totalPages > 1) {
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`shop:inv_prev:${userId}`)
          .setLabel('◀')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId(`shop:inv_info:${userId}`)
          .setLabel(`${page + 1}/${totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`shop:inv_next:${userId}`)
          .setLabel('▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= totalPages - 1),
      ),
    );
  }

  // Tab row
  container.addActionRowComponents(buildTabRow(userId, 'inventory'));

  return container;
}

// ── Recycle confirmation ──

export function buildRecycleConfirmView(
  userId: string,
  item: ShopItem,
  quantity: number,
  currentQuantity: number,
): ContainerBuilder {
  const refundPerItem = (item.price * BigInt(SHOP_EFFECTS.RECYCLE_REFUND_RATE)) / 100n;
  const totalRefund = refundPerItem * BigInt(quantity);

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('♻️ **リサイクル**'),
  );
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      [
        `${item.emoji} **${item.name}** x${quantity}`,
        `所持数: ${currentQuantity}`,
        '',
        `返金額: ${formatChips(totalRefund)} (${SHOP_EFFECTS.RECYCLE_REFUND_RATE}%)`,
      ].join('\n'),
    ),
  );
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`shop:confirm_recycle:${userId}:${item.id}:${quantity}`)
        .setLabel('✅ リサイクルする')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`shop:tab_inventory:${userId}`)
        .setLabel('❌ キャンセル')
        .setStyle(ButtonStyle.Danger),
    ),
  );

  return container;
}

// ── Use item result ──

export function buildUseItemResultView(
  userId: string,
  itemEmoji: string,
  itemName: string,
  message: string,
): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(CasinoTheme.prefixes.shop),
  );
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `${itemEmoji} **${itemName}**\n${message}`,
    ),
  );
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`shop:tab_inventory:${userId}`)
        .setLabel('🎒 インベントリに戻る')
        .setStyle(ButtonStyle.Primary),
    ),
  );

  return container;
}
