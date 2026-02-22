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
  RARITY_EMOJI,
  RARITY_LABELS,
  type ShopItem,
  type ItemRarity,
} from '../../config/shop.js';
import type { UserInventory, ActiveBuff } from '@prisma/client';

export type ShopTab = 'shop' | 'inventory' | 'daily';
const ITEMS_PER_PAGE = 3;

// ── Main tab buttons ──

function buildTabRow(userId: string, activeTab: ShopTab): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`shop:tab_shop:${userId}`)
      .setLabel('🛒 ショップ')
      .setStyle(activeTab === 'shop' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(activeTab === 'shop'),
    new ButtonBuilder()
      .setCustomId(`shop:tab_inventory:${userId}`)
      .setLabel('🎒 インベントリ')
      .setStyle(activeTab === 'inventory' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(activeTab === 'inventory'),
    new ButtonBuilder()
      .setCustomId(`shop:tab_daily:${userId}`)
      .setLabel('📅 日替わり')
      .setStyle(activeTab === 'daily' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(activeTab === 'daily'),
  );
}

// ── Shop tab ──

export function buildShopView(
  userId: string,
  categoryIndex: number,
  page: number,
  balance: bigint,
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

  // Category header + items
  const lines: string[] = [`${cat.emoji} **${cat.label}**`, ''];
  for (const item of pageItems) {
    lines.push(`${item.emoji} **${item.name}** — ${formatChips(item.price)}`);
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
      buyRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`shop:buy:${userId}:${item.id}`)
          .setLabel(`${item.emoji} ${formatChips(item.price)}`)
          .setStyle(ButtonStyle.Success),
      );
    }
    container.addActionRowComponents(buyRow);
  }

  // Navigation row: [◀ category] [category name (page)] [▶ category]
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
  const allEntries: { label: string; actionId?: string; actionLabel?: string }[] = [];

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

    const isEquippedTitle = item.cosmeticType === 'title' && activeTitle === inv.itemId;
    const isEquippedBadge = item.cosmeticType === 'badge' && activeBadge === inv.itemId;
    const equipped = isEquippedTitle || isEquippedBadge;

    let label = `${item.emoji} ${item.name}`;
    if (inv.quantity > 1) label += ` x${inv.quantity}`;
    if (equipped) label += ' [装備中]';

    let actionId: string | undefined;
    let actionLabel: string | undefined;

    if (item.category === 'cosmetic') {
      actionId = equipped
        ? `shop:unequip:${userId}:${inv.itemId}`
        : `shop:equip:${userId}:${inv.itemId}`;
      actionLabel = equipped ? '装備解除' : '装備';
    } else if (item.category === 'mystery') {
      actionId = `shop:open_box:${userId}:${inv.itemId}`;
      actionLabel = '開封';
    } else if (item.category === 'consumable' && (inv.itemId === 'MISSION_REROLL' || inv.itemId === 'WORK_COOLDOWN_SKIP')) {
      actionId = `shop:use:${userId}:${inv.itemId}`;
      actionLabel = '使う';
    }

    allEntries.push({ label, actionId, actionLabel });
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

  // Action buttons for page items
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

// ── Daily rotation tab ──

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

// ── Mystery box result ──

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
        .setCustomId(`shop:tab_shop:${userId}`)
        .setLabel('🛒 ショップに戻る')
        .setStyle(ButtonStyle.Primary),
    ),
  );

  return container;
}

// ── Profile tab for /balance ──

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
