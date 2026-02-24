import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  type MessageActionRowComponentBuilder,
  UserSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { CasinoTheme } from '../themes/casino.theme.js';
import { formatChips } from '../../utils/formatters.js';
import { BUSINESS_TYPES } from '../../config/business.js';
import { LEVEL_THRESHOLDS } from '../../config/jobs.js';

// ─── Types ───

export type DebugTab = 'economy' | 'work' | 'business' | 'reset';

export interface DebugEconomyData {
  chips: bigint;
  bankBalance: bigint;
  totalWon: bigint;
  totalLost: bigint;
  totalGames: number;
}

export interface DebugWorkData {
  workLevel: number;
  workXp: number;
  workStreak: number;
  dailyStreak: number;
}

export interface DebugBusinessInfo {
  type: string;
  typeName: string;
  typeEmoji: string;
  level: number;
  maxLevel: number;
  totalEarned: bigint;
}

export type DebugBusinessData = DebugBusinessInfo | null;

export interface DebugViewData {
  targetId: string;
  economy: DebugEconomyData;
  work: DebugWorkData;
  business: DebugBusinessData;
}

// ─── Tab labels ───

const TAB_LABELS: Record<DebugTab, { emoji: string; label: string }> = {
  economy: { emoji: '💰', label: '経済' },
  work: { emoji: '💼', label: '労働' },
  business: { emoji: '🏢', label: 'ビジネス' },
  reset: { emoji: '🔄', label: 'リセット' },
};

const ALL_TABS: DebugTab[] = ['economy', 'work', 'business', 'reset'];

// ─── User selection view ───

export function buildDebugUserSelectView(adminId: string): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.diamondBlue)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('🔧 **デバッグパネル**'),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('操作対象のユーザーを選択してください。'),
    );

  const selectRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(`debug_select:user:${adminId}`)
      .setPlaceholder('ユーザーを選択'),
  );
  container.addActionRowComponents(selectRow);

  return container;
}

// ─── Tab bar builder ───

function buildTabBar(activeTab: DebugTab, adminId: string, targetId: string): ActionRowBuilder<MessageActionRowComponentBuilder> {
  const row = new ActionRowBuilder<MessageActionRowComponentBuilder>();

  for (const tab of ALL_TABS) {
    const { emoji, label } = TAB_LABELS[tab];
    const isActive = tab === activeTab;
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`debug:tab_${tab}:${adminId}:${targetId}`)
        .setLabel(`${emoji} ${label}`)
        .setStyle(isActive ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(isActive),
    );
  }

  return row;
}

// ─── Economy tab ───

export function buildDebugEconomyView(data: DebugViewData, adminId: string): ContainerBuilder {
  const { targetId, economy } = data;
  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`🔧 **デバッグパネル** — <@${targetId}>`),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  container.addActionRowComponents(buildTabBar('economy', adminId, targetId));

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `### 💰 経済データ\n` +
      `> **チップ:** ${formatChips(economy.chips)}\n` +
      `> **銀行残高:** ${formatChips(economy.bankBalance)}\n` +
      `> **総勝利額:** ${formatChips(economy.totalWon)}\n` +
      `> **総損失額:** ${formatChips(economy.totalLost)}\n` +
      `> **総ゲーム数:** ${economy.totalGames.toLocaleString()}`,
    ),
  );

  const btnRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`debug:modal_give:${adminId}:${targetId}`)
      .setLabel('チップ付与')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`debug:modal_set_chips:${adminId}:${targetId}`)
      .setLabel('チップ設定')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`debug:modal_set_bank:${adminId}:${targetId}`)
      .setLabel('銀行設定')
      .setStyle(ButtonStyle.Primary),
  );
  container.addActionRowComponents(btnRow);

  return container;
}

// ─── Work tab ───

export function buildDebugWorkView(data: DebugViewData, adminId: string): ContainerBuilder {
  const { targetId, work } = data;
  const nextThreshold = LEVEL_THRESHOLDS[work.workLevel + 1] ?? '—';

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.purple)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`🔧 **デバッグパネル** — <@${targetId}>`),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  container.addActionRowComponents(buildTabBar('work', adminId, targetId));

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `### 💼 労働データ\n` +
      `> **レベル:** ${work.workLevel} / 5\n` +
      `> **XP:** ${work.workXp} / ${nextThreshold}\n` +
      `> **労働連続:** ${work.workStreak}\n` +
      `> **ログイン連続:** ${work.dailyStreak}`,
    ),
  );

  const btnRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`debug:modal_set_level:${adminId}:${targetId}`)
      .setLabel('レベル設定')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`debug:modal_set_xp:${adminId}:${targetId}`)
      .setLabel('XP設定')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`debug:modal_set_work_streak:${adminId}:${targetId}`)
      .setLabel('労働連続設定')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`debug:modal_set_daily_streak:${adminId}:${targetId}`)
      .setLabel('ログイン連続設定')
      .setStyle(ButtonStyle.Primary),
  );
  container.addActionRowComponents(btnRow);

  return container;
}

// ─── Business tab ───

export function buildDebugBusinessView(data: DebugViewData, adminId: string): ContainerBuilder {
  const { targetId, business } = data;

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.darkGreen)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`🔧 **デバッグパネル** — <@${targetId}>`),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  container.addActionRowComponents(buildTabBar('business', adminId, targetId));

  if (business) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### 🏢 ビジネスデータ\n` +
        `> **タイプ:** ${business.typeEmoji} ${business.typeName}\n` +
        `> **レベル:** ${business.level} / ${business.maxLevel}\n` +
        `> **総収益:** ${formatChips(business.totalEarned)}`,
      ),
    );

    const btnRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`debug:modal_set_biz_level:${adminId}:${targetId}`)
        .setLabel('レベル設定')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`debug:delete_biz:${adminId}:${targetId}`)
        .setLabel('ビジネス削除')
        .setStyle(ButtonStyle.Danger),
    );
    container.addActionRowComponents(btnRow);
  } else {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('### 🏢 ビジネスなし\n> このユーザーはビジネスを所持していません。'),
    );

    const selectRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`debug_select:biz_create:${adminId}:${targetId}`)
        .setPlaceholder('ビジネスを作成...')
        .addOptions(
          BUSINESS_TYPES.map(bt =>
            new StringSelectMenuOptionBuilder()
              .setLabel(`${bt.emoji} ${bt.name}`)
              .setValue(bt.id)
              .setDescription(`購入価格: ${formatChips(bt.purchaseCost)}`),
          ),
        ),
    );
    container.addActionRowComponents(selectRow);
  }

  return container;
}

// ─── Reset tab ───

export function buildDebugResetView(data: DebugViewData, adminId: string): ContainerBuilder {
  const { targetId } = data;

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.red)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`🔧 **デバッグパネル** — <@${targetId}>`),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  container.addActionRowComponents(buildTabBar('reset', adminId, targetId));

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `### 🔄 リセット操作\n` +
      `> 以下の操作は取り消せません。`,
    ),
  );

  const btnRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`debug:reset_confirm:${adminId}:${targetId}`)
      .setLabel('完全リセット')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`debug:reset_stats:${adminId}:${targetId}`)
      .setLabel('統計リセット')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`debug:reset_work:${adminId}:${targetId}`)
      .setLabel('労働リセット')
      .setStyle(ButtonStyle.Danger),
  );
  container.addActionRowComponents(btnRow);

  return container;
}

// ─── Reset confirmation view ───

export function buildDebugResetConfirmView(adminId: string, targetId: string): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.red)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('🔧 **デバッグパネル — リセット確認**'),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `⚠️ <@${targetId}> のデータを**完全にリセット**します。\n` +
        `チップ・銀行・統計・労働データがすべて初期化されます。\n\n` +
        `本当に実行しますか？`,
      ),
    );

  const btnRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`debug:reset_execute:${adminId}:${targetId}`)
      .setLabel('リセット実行')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`debug:tab_reset:${adminId}:${targetId}`)
      .setLabel('戻る')
      .setStyle(ButtonStyle.Secondary),
  );
  container.addActionRowComponents(btnRow);

  return container;
}

// ─── Result view ───

export function buildDebugResultView(
  adminId: string,
  targetId: string,
  title: string,
  description: string,
  tab: DebugTab,
): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.diamondBlue)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`🔧 **${title}**`),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(description),
    );

  const btnRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`debug:tab_${tab}:${adminId}:${targetId}`)
      .setLabel('戻る')
      .setStyle(ButtonStyle.Secondary),
  );
  container.addActionRowComponents(btnRow);

  return container;
}

// ─── Tab view dispatcher ───

export function buildDebugTabView(data: DebugViewData, adminId: string, tab: DebugTab): ContainerBuilder {
  switch (tab) {
    case 'economy': return buildDebugEconomyView(data, adminId);
    case 'work': return buildDebugWorkView(data, adminId);
    case 'business': return buildDebugBusinessView(data, adminId);
    case 'reset': return buildDebugResetView(data, adminId);
  }
}
