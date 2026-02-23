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
  type ShopItem,
} from '../../config/shop.js';
import type { ShopRankDef } from '../../config/shop-ranks.js';
import type { FlashSale } from '../../database/services/shop.service.js';

export type ShopTab = 'shop' | 'daily' | 'craft' | 'collection';
const ITEMS_PER_PAGE = 4;

// ── Main tab buttons (4 tabs) ──

export function buildTabRow(userId: string, activeTab: ShopTab): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`shop:tab_shop:${userId}`)
      .setLabel('🛒 ショップ')
      .setStyle(activeTab === 'shop' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(activeTab === 'shop'),
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

// ── Category buttons (2 rows: 4+3) ──

export function buildCategoryRows(
  userId: string,
  activeCategoryIndex: number,
): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>();
  const row2 = new ActionRowBuilder<ButtonBuilder>();

  for (let i = 0; i < SHOP_CATEGORIES.length; i++) {
    const cat = SHOP_CATEGORIES[i];
    const btn = new ButtonBuilder()
      .setCustomId(`shop:cat_select:${userId}:${i}`)
      .setLabel(`${cat.emoji} ${cat.label}`)
      .setStyle(i === activeCategoryIndex ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(i === activeCategoryIndex);

    if (i < 4) {
      row1.addComponents(btn);
    } else {
      row2.addComponents(btn);
    }
  }

  return [row1, row2];
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

  // Page navigation row
  if (totalPages > 1) {
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`shop:page_prev:${userId}`)
          .setLabel('◀')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId(`shop:page_info:${userId}`)
          .setLabel(`${page + 1} / ${totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`shop:page_next:${userId}`)
          .setLabel('▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= totalPages - 1),
      ),
    );
  }

  // Category button rows (2 rows: 4+3)
  const catRows = buildCategoryRows(userId, categoryIndex);
  for (const row of catRows) {
    container.addActionRowComponents(row);
  }

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
  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`shop:confirm_buy:${userId}:${item.id}${extra}`)
      .setLabel('✅ 購入する')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`shop:buy_qty:${userId}:${item.id}`)
      .setLabel('📦 複数購入')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`shop:cancel_buy:${userId}`)
      .setLabel('❌ キャンセル')
      .setStyle(ButtonStyle.Danger),
  );
  container.addActionRowComponents(actionRow);

  return container;
}

