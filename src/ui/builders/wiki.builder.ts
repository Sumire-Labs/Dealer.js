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
import {
    getCollectionsForItem,
    getItemsByCategory,
    getRecipeForItem,
    getRecipesUsingItem,
    WIKI_CATEGORIES,
    WIKI_CATEGORY_MAP,
} from '../../config/wiki.js';
import {
    GOLDEN_BOX_LOOT,
    ITEM_MAP,
    MYSTERY_BOX_MAP,
    type MysteryBoxLoot,
    RARITY_EMOJI,
    RARITY_LABELS,
} from '../../config/shop.js';
import {WORK_TOOL_MAP} from '../../config/work-tools.js';
import {JOBS} from '../../config/jobs.js';
import {SHOP_RANKS} from '../../config/shop-ranks.js';
import {formatChips} from '../../utils/formatters.js';

const ITEMS_PER_PAGE = 4;

const JOB_NAME_MAP = new Map(JOBS.map(j => [j.id, j.name]));

// ─── Wiki Category Select Menu ───

function buildWikiCategorySelectMenu(
  userId: string,
  activeCategoryKey?: string,
): ActionRowBuilder<StringSelectMenuBuilder> {
  const options = WIKI_CATEGORIES.map(cat =>
    new StringSelectMenuOptionBuilder()
      .setLabel(`${cat.emoji} ${cat.label}`)
      .setValue(cat.key)
      .setDescription(`${cat.label}のアイテム一覧`)
      .setDefault(cat.key === activeCategoryKey),
  );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`wiki_select:cat:${userId}`)
      .setPlaceholder('カテゴリを選択...')
      .addOptions(options),
  );
}

// ─── View 1: Wiki Top ───

export function buildWikiTopView(userId: string): ContainerBuilder {
  const lines = WIKI_CATEGORIES.map(cat => {
    const count = getItemsByCategory(cat.key).length;
    return `${cat.emoji} **${cat.label}** — ${count}アイテム`;
  });

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('📖 ━━━ ITEM WIKI ━━━ 📖'),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(lines.join('\n')),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  container.addActionRowComponents(buildWikiCategorySelectMenu(userId));

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`wiki:back_help:${userId}`)
        .setLabel('🏠 ヘルプに戻る')
        .setStyle(ButtonStyle.Secondary),
    ),
  );

  return container;
}

// ─── View 2: Category Item List ───

export function buildWikiCategoryView(
  userId: string,
  categoryKey: string,
  page: number,
): ContainerBuilder {
  const cat = WIKI_CATEGORY_MAP.get(categoryKey);
  if (!cat) return buildWikiTopView(userId);

  const items = getItemsByCategory(categoryKey);
  const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const pageItems = items.slice(safePage * ITEMS_PER_PAGE, (safePage + 1) * ITEMS_PER_PAGE);

  const itemLines = pageItems.map(item => {
    const priceStr = item.price > 0n ? formatChips(item.price) : '🔨クラフト限定';
    return `${item.emoji} **${item.name}** — ${priceStr}\n　${item.description}`;
  }).join('\n\n');

  const headerText = `${cat.emoji} **${cat.label}** (${safePage + 1}/${totalPages}ページ)`;

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('📖 ━━━ ITEM WIKI ━━━ 📖'),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(headerText + '\n\n' + itemLines),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  // Item detail buttons (one per item on this page)
  if (pageItems.length > 0) {
    const itemButtons = new ActionRowBuilder<ButtonBuilder>();
    for (const item of pageItems) {
      itemButtons.addComponents(
        new ButtonBuilder()
          .setCustomId(`wiki:item:${userId}:${item.id}`)
          .setLabel(item.emoji)
          .setStyle(ButtonStyle.Primary),
      );
    }
    container.addActionRowComponents(itemButtons);
  }

  // Pagination buttons
  if (totalPages > 1) {
    const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`wiki:prev:${userId}`)
        .setLabel('◀ 前へ')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(safePage === 0),
      new ButtonBuilder()
        .setCustomId(`wiki:next:${userId}`)
        .setLabel('次へ ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(safePage >= totalPages - 1),
    );
    container.addActionRowComponents(navRow);
  }

  // Category select + back button
  container.addActionRowComponents(buildWikiCategorySelectMenu(userId, categoryKey));

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`wiki:back_top:${userId}`)
        .setLabel('📖 図鑑トップ')
        .setStyle(ButtonStyle.Secondary),
    ),
  );

  return container;
}

// ─── View 3: Item Detail ───

export function buildWikiItemDetailView(
  userId: string,
  itemId: string,
  fromCategory: string,
): ContainerBuilder {
  const item = ITEM_MAP.get(itemId);
  if (!item) return buildWikiTopView(userId);

  const cat = WIKI_CATEGORY_MAP.get(item.category);
  const sections: string[] = [];

  // Header
  sections.push(`${item.emoji} **${item.name}**`);
  sections.push(`📁 カテゴリ: ${cat?.emoji ?? ''} ${cat?.label ?? item.category}`);

  // Price
  if (item.price > 0n) {
    sections.push(`💰 価格: ${formatChips(item.price)}`);
  } else {
    sections.push('💰 価格: 🔨 クラフト限定');
  }

  // Description
  sections.push(`📝 ${item.description}`);

  // Giftable
  sections.push(`🎁 ギフト: ${item.giftable ? '可能' : '不可'}`);

  // ── Category-specific info ──

  // Buff: duration & effect
  if (item.category === 'buff' && item.buffDurationMs) {
    const hours = item.buffDurationMs / (1000 * 60 * 60);
    sections.push(`⏱️ 効果時間: ${hours}時間`);
  }

  // Upgrade: max stack
  if (item.category === 'upgrade' && item.maxStack) {
    sections.push(`📦 最大購入数: ${item.maxStack}`);
  }

  // Cosmetic: type & rank requirement
  if (item.category === 'cosmetic') {
    if (item.cosmeticType) {
      sections.push(`🏷️ タイプ: ${item.cosmeticType === 'title' ? '称号' : 'バッジ'}`);
    }
    if (item.rankRequired) {
      const rankDef = SHOP_RANKS.find(r => r.rank === item.rankRequired);
      if (rankDef) {
        sections.push(`🔒 ランク要件: ${rankDef.emoji} ${rankDef.label}`);
      }
    }
  }

  // Insurance: duration & max stack
  if (item.category === 'insurance') {
    if (item.buffDurationMs) {
      const hours = item.buffDurationMs / (1000 * 60 * 60);
      sections.push(`⏱️ 効果時間: ${hours}時間`);
    }
    if (item.maxStack) {
      sections.push(`📦 最大スタック: ${item.maxStack}`);
    }
  }

  // Mystery Box: loot table
  const mysteryBox = MYSTERY_BOX_MAP.get(itemId);
  if (mysteryBox) {
    sections.push('');
    sections.push('🎲 **ドロップテーブル**');
    sections.push(formatLootTable(mysteryBox.lootTable));
  }

  // Golden Box special
  if (itemId === 'GOLDEN_BOX') {
    sections.push('');
    sections.push('🎲 **ドロップテーブル** (伝説確定)');
    sections.push(formatLootTable(GOLDEN_BOX_LOOT));
  }

  // Work Tool: target job & bonus
  const workTool = WORK_TOOL_MAP.get(itemId);
  if (workTool) {
    const jobName = workTool.targetJobId === 'all'
      ? '全ジョブ'
      : (JOB_NAME_MAP.get(workTool.targetJobId) ?? workTool.targetJobId);
    sections.push(`👷 対象ジョブ: ${jobName}`);
    if (workTool.toolPayBonus) sections.push(`💵 報酬ボーナス: +${workTool.toolPayBonus}%`);
    if (workTool.toolGreatSuccessBonus) sections.push(`⭐ 大成功率: +${workTool.toolGreatSuccessBonus}%`);
    if (workTool.toolRiskReduction) sections.push(`🛡️ リスク軽減: -${workTool.toolRiskReduction}%`);
    if (workTool.toolXpBonus) sections.push(`📈 XPボーナス: +${workTool.toolXpBonus}%`);
  }

  // Craft recipe (this item is the result)
  const recipe = getRecipeForItem(itemId);
  if (recipe) {
    sections.push('');
    sections.push('🔨 **クラフトレシピ**');
    const matLines = recipe.materials.map(m => {
      const matItem = ITEM_MAP.get(m.itemId);
      return `　${matItem?.emoji ?? '❓'} ${matItem?.name ?? m.itemId} x${m.quantity}`;
    });
    sections.push(matLines.join('\n'));
  }

  // Used as material in other recipes
  const usedIn = getRecipesUsingItem(itemId);
  if (usedIn.length > 0) {
    sections.push('');
    sections.push('🔧 **クラフト素材として**');
    const recipeLines = usedIn.map(r => {
      const resultItem = ITEM_MAP.get(r.resultItemId);
      return `　→ ${resultItem?.emoji ?? '❓'} ${resultItem?.name ?? r.resultItemId}`;
    });
    sections.push(recipeLines.join('\n'));
  }

  // Collection membership
  const collections = getCollectionsForItem(itemId);
  if (collections.length > 0) {
    sections.push('');
    sections.push('📚 **コレクション所属**');
    const colLines = collections.map(c => `　${c.emoji} ${c.name}`);
    sections.push(colLines.join('\n'));
  }

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('📖 ━━━ ITEM WIKI ━━━ 📖'),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(sections.join('\n')),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`wiki:back_cat:${userId}:${fromCategory}`)
        .setLabel('◀ 一覧に戻る')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`wiki:back_top:${userId}`)
        .setLabel('📖 図鑑トップ')
        .setStyle(ButtonStyle.Secondary),
    ),
  );

  return container;
}

// ─── Helpers ───

function formatLootTable(lootTable: MysteryBoxLoot[]): string {
  // Group by rarity
  const grouped = new Map<string, MysteryBoxLoot[]>();
  for (const loot of lootTable) {
    const group = grouped.get(loot.rarity) ?? [];
    group.push(loot);
    grouped.set(loot.rarity, group);
  }

  const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
  const lines: string[] = [];

  for (const rarity of rarityOrder) {
    const group = grouped.get(rarity);
    if (!group) continue;

    const emoji = RARITY_EMOJI[rarity];
    const label = RARITY_LABELS[rarity];
    lines.push(`${emoji} **${label}**`);

    for (const loot of group) {
      if (loot.type === 'chips') {
        lines.push(`　💰 ${formatChips(loot.chipsMin!)}〜${formatChips(loot.chipsMax!)}`);
      } else {
        const item = ITEM_MAP.get(loot.itemId!);
        lines.push(`　${item?.emoji ?? '❓'} ${item?.name ?? loot.itemId}`);
      }
    }
  }

  return lines.join('\n');
}
