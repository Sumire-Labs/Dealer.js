import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    ModalBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    TextDisplayBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import {CasinoTheme} from '../themes/casino.theme.js';
import {configService} from '../../config/config.service.js';
import {type AnySettingDef, SETTING_CATEGORIES,} from '../../config/setting-defs.js';

// ── Setting menu (top-level) ─────────────────────────────────────────

export function buildSettingMenuView(userId: string): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.diamondBlue)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('\u2699\uFE0F \u2501\u2501\u2501 設定メニュー \u2501\u2501\u2501 \u2699\uFE0F'),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('変更したい設定カテゴリを選択してください。'),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`setting:horse_names:${userId}`)
          .setLabel('\u{1F3C7} 競馬設定')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`setting:cfg_menu:${userId}`)
          .setLabel('\u2699\uFE0F 数値設定')
          .setStyle(ButtonStyle.Primary),
      ),
    );

  return container;
}

// ── Horse name setting view (unchanged) ──────────────────────────────

export function buildHorseNameSettingView(
  names: string[],
  userId: string,
): ContainerBuilder {
  const nameList = names.map((name, i) => `${i + 1}. ${name}`).join('\n');

  return new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.diamondBlue)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('\u{1F3C7} \u2501\u2501\u2501 競馬設定 \u2014 馬名一覧 \u2501\u2501\u2501 \u{1F3C7}'),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `現在の馬名 (**${names.length}頭**):\n\`\`\`\n${nameList}\n\`\`\``,
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`setting:edit_names:${userId}`)
          .setLabel('\u270F\uFE0F 編集')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`setting:reset_names:${userId}`)
          .setLabel('\u{1F504} リセット')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`setting:back:${userId}`)
          .setLabel('\u25C0 戻る')
          .setStyle(ButtonStyle.Secondary),
      ),
    );
}

// ── Category picker (11 categories in rows of 5+5+1) ────────────────

export function buildSettingCategoryPicker(userId: string): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.diamondBlue)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('\u2699\uFE0F \u2501\u2501\u2501 数値設定 \u2501\u2501\u2501 \u2699\uFE0F'),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('カテゴリを選択してください。'),
    );

  // Build rows of up to 5 buttons
  for (let i = 0; i < SETTING_CATEGORIES.length; i += 5) {
    const slice = SETTING_CATEGORIES.slice(i, i + 5);
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (const cat of slice) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`setting:cfg_cat:${userId}:${cat.id}`)
          .setLabel(`${cat.emoji} ${cat.label}`)
          .setStyle(ButtonStyle.Primary),
      );
    }
    container.addActionRowComponents(row);
  }

  // Back button
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`setting:back:${userId}`)
        .setLabel('\u25C0 戻る')
        .setStyle(ButtonStyle.Secondary),
    ),
  );

  return container;
}

// ── Category detail view ─────────────────────────────────────────────

export function buildSettingCategoryView(catId: string, userId: string): ContainerBuilder {
  const cat = SETTING_CATEGORIES.find(c => c.id === catId);
  if (!cat) return buildSettingCategoryPicker(userId);

  // Build value list
  const lines = cat.settings.map(def => {
    const display = configService.getDisplayValue(def);
    const overridden = configService.hasOverride(def) ? ' \u2728' : '';
    return `**${def.label}**: ${display}${overridden}`;
  });

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.diamondBlue)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`${cat.emoji} \u2501\u2501\u2501 ${cat.label}設定 \u2501\u2501\u2501 ${cat.emoji}`),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(lines.join('\n')),
    );

  // Edit buttons: if >5 settings, split into 2 pages
  const editRow = new ActionRowBuilder<ButtonBuilder>();
  if (cat.settings.length <= 5) {
    editRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`setting:cfg_edit:${userId}:${catId}:0`)
        .setLabel('\u270F\uFE0F 編集')
        .setStyle(ButtonStyle.Primary),
    );
  } else {
    editRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`setting:cfg_edit:${userId}:${catId}:0`)
        .setLabel('\u270F\uFE0F 編集\u2460')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`setting:cfg_edit:${userId}:${catId}:1`)
        .setLabel('\u270F\uFE0F 編集\u2461')
        .setStyle(ButtonStyle.Primary),
    );
  }
  editRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`setting:cfg_reset:${userId}:${catId}`)
      .setLabel('\u{1F504} リセット')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`setting:cfg_back:${userId}`)
      .setLabel('\u25C0 戻る')
      .setStyle(ButtonStyle.Secondary),
  );
  container.addActionRowComponents(editRow);

  return container;
}

// ── Edit modal builder ───────────────────────────────────────────────

export function buildSettingEditModal(catId: string, page: number): ModalBuilder | null {
  const cat = SETTING_CATEGORIES.find(c => c.id === catId);
  if (!cat) return null;

  const start = page * 5;
  const slice = cat.settings.slice(start, start + 5) as AnySettingDef[];
  if (slice.length === 0) return null;

  const pageLabel = cat.settings.length > 5 ? ` (${page + 1}/2)` : '';
  const modal = new ModalBuilder()
    .setCustomId(`setting_modal:cfg_edit:${catId}:${page}`)
    .setTitle(`${cat.label}設定${pageLabel}`);

  for (const def of slice) {
    const raw = configService.getRawNumber(def);
    const display = def.uiDivisor === 1 ? raw : raw / def.uiDivisor;
    const unitHint = def.unit ? ` (${def.min}〜${def.max} ${def.unit})` : ` (${def.min}〜${def.max})`;

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(def.key)
          .setLabel(`${def.label}${unitHint}`)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder(`既定: ${def.uiDivisor === 1 ? (def.type === 'bigint' ? def.defaultValue.toString() : String(def.defaultValue)) : String((def.defaultValue as number) / def.uiDivisor)}`)
          .setValue(String(display))
          .setRequired(true),
      ),
    );
  }

  return modal;
}
