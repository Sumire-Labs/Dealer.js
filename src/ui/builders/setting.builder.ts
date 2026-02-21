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

export function buildSettingMenuView(userId: string): ContainerBuilder {
  return new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.diamondBlue)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('⚙️ ━━━ 設定メニュー ━━━ ⚙️'),
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
          .setLabel('🏇 競馬設定')
          .setStyle(ButtonStyle.Primary),
      ),
    );
}

export function buildHorseNameSettingView(
  names: string[],
  userId: string,
): ContainerBuilder {
  const nameList = names.map((name, i) => `${i + 1}. ${name}`).join('\n');

  return new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.diamondBlue)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('🏇 ━━━ 競馬設定 — 馬名一覧 ━━━ 🏇'),
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
          .setLabel('✏️ 編集')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`setting:reset_names:${userId}`)
          .setLabel('🔄 リセット')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`setting:back:${userId}`)
          .setLabel('◀ 戻る')
          .setStyle(ButtonStyle.Secondary),
      ),
    );
}
