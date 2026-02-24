import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  UserSelectMenuBuilder,
} from 'discord.js';
import type { BankViewData } from './types.js';

export function buildTransferSelectTab(container: ContainerBuilder, data: BankViewData): void {
  const { userId } = data;

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `📤 送金先を選択\n\n` +
      `下のメニューから送金先のメンバーを選んでください。\n` +
      `選択後、金額入力のモーダルが表示されます。`,
    ),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // UserSelectMenu
  container.addActionRowComponents(
    new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId(`bank_select:transfer_user:${userId}`)
        .setPlaceholder('送金先メンバーを選択...')
        .setMinValues(1)
        .setMaxValues(1),
    ),
  );

  // Back button
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`bank:tab_account:${userId}`)
        .setLabel('🔙 口座に戻る')
        .setStyle(ButtonStyle.Secondary),
    ),
  );
}
