import {
    ActionRowBuilder,
    ContainerBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    TextDisplayBuilder,
} from 'discord.js';
import {CasinoTheme} from '../themes/casino.theme.js';
import {HELP_CATEGORIES, HELP_CATEGORY_MAP, HELP_TIPS, HELP_TOP_CONTENT} from '../../config/help.js';

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  casino: 'スロット・BJ・ルーレットなどのゲーム',
  multi: '競馬・ポーカー・強盗・宝くじ',
  economy: 'デイリー・銀行・ローン・破産',
  work: 'ジョブ・シフト・残業・マスタリー',
  business: 'ビジネス購入・アップグレード・従業員',
  shop: 'アイテム・バフ・コスメ・ミステリーボックス',
  missions: 'デイリーミッション・ウィークリーチャレンジ',
  achieve: '実績一覧と解除条件',
};

function buildNavSelectMenu(
  userId: string,
  activeCategoryId?: string,
): ActionRowBuilder<StringSelectMenuBuilder> {
  const options: StringSelectMenuOptionBuilder[] = [
    new StringSelectMenuOptionBuilder()
      .setLabel('🏠 トップ')
      .setValue('top')
      .setDescription('ヘルプのトップページ')
      .setDefault(!activeCategoryId),
  ];

  for (const cat of HELP_CATEGORIES) {
    options.push(
      new StringSelectMenuOptionBuilder()
        .setLabel(`${cat.emoji} ${cat.label}`)
        .setValue(cat.id)
        .setDescription(CATEGORY_DESCRIPTIONS[cat.id] ?? cat.label)
        .setDefault(cat.id === activeCategoryId),
    );
  }

  options.push(
    new StringSelectMenuOptionBuilder()
      .setLabel('📖 アイテム図鑑')
      .setValue('wiki')
      .setDescription('全アイテムの詳細情報')
      .setDefault(activeCategoryId === 'wiki'),
  );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`help_select:nav:${userId}`)
      .setPlaceholder('カテゴリーを選択...')
      .addOptions(options),
  );
}

export function buildHelpTopView(userId: string): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.help),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(HELP_TOP_CONTENT),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(HELP_TIPS),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  container.addActionRowComponents(buildNavSelectMenu(userId));
  return container;
}

export function buildHelpCategoryView(userId: string, categoryId: string): ContainerBuilder {
  const category = HELP_CATEGORY_MAP.get(categoryId);
  if (!category) return buildHelpTopView(userId);

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.help),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(category.content),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  container.addActionRowComponents(buildNavSelectMenu(userId, categoryId));
  return container;
}
