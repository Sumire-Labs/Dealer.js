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
  SHOP_EFFECTS,
  type ShopItem,
} from '../../config/shop.js';
import type { UserInventory, ActiveBuff } from '@prisma/client';

const ITEMS_PER_INV_PAGE = 5;

// ── Inventory view ──

export function buildInventoryView(
  userId: string,
  inventory: UserInventory[],
  activeBuffs: ActiveBuff[],
  activeTitle: string | null,
  activeBadge: string | null,
  page: number,
): ContainerBuilder {
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
        ? `inv:unequip:${userId}:${inv.itemId}`
        : `inv:equip:${userId}:${inv.itemId}`;
      actionLabel = equipped ? '装備解除' : '装備';
    } else if (item.category === 'mystery' || inv.itemId === 'GOLDEN_BOX') {
      actionId = `inv:open_box:${userId}:${inv.itemId}`;
      actionLabel = '開封';
    } else if (item.category === 'consumable' && (inv.itemId === 'MISSION_REROLL' || inv.itemId === 'WORK_COOLDOWN_SKIP')) {
      actionId = `inv:use:${userId}:${inv.itemId}`;
      actionLabel = '使う';
    }

    // Recycle available for items with a price
    if (item.price > 0n && item.category !== 'craft') {
      recycleId = `inv:recycle:${userId}:${inv.itemId}`;
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
      new TextDisplayBuilder().setContent('アイテムはありません。`/shop` で購入しましょう！'),
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

  // Pagination + shop link
  const navRow = new ActionRowBuilder<ButtonBuilder>();
  if (totalPages > 1) {
    navRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`inv:prev:${userId}`)
        .setLabel('◀')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId(`inv:info:${userId}`)
        .setLabel(`${page + 1}/${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`inv:next:${userId}`)
        .setLabel('▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages - 1),
    );
  }
  if (navRow.components.length > 0) {
    container.addActionRowComponents(navRow);
  }

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
        .setCustomId(`inv:confirm_recycle:${userId}:${item.id}:${quantity}`)
        .setLabel('✅ リサイクルする')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`inv:back:${userId}`)
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
    new TextDisplayBuilder().setContent(CasinoTheme.prefixes.inventory),
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
        .setCustomId(`inv:back:${userId}`)
        .setLabel('🎒 インベントリに戻る')
        .setStyle(ButtonStyle.Primary),
    ),
  );

  return container;
}
