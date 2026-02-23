import {
  type ButtonInteraction,
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} from 'discord.js';
import { registerButtonHandler } from '../handler.js';
import { configService } from '../../config/config.service.js';
import {
  buildSettingMenuView,
  buildHorseNameSettingView,
  buildEconomySettingView,
} from '../../ui/builders/setting.builder.js';

async function handleSettingButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const action = parts[1];
  const ownerId = parts[2];

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: 'この設定パネルはあなたのものではありません。`/setting` で開いてください。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (action === 'horse_names') {
    const names = configService.getHorseNames();
    const container = buildHorseNameSettingView(names, ownerId);
    await interaction.update({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  if (action === 'edit_names') {
    const names = configService.getHorseNames();
    const modal = new ModalBuilder()
      .setCustomId(`setting_modal:edit_names`)
      .setTitle('馬名を編集')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('horse_names')
            .setLabel('馬名（1行に1つ、最低5つ）')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Thunder Bolt\nLucky Strike\nDark Shadow\n...')
            .setValue(names.join('\n'))
            .setRequired(true),
        ),
      );

    await interaction.showModal(modal);
    return;
  }

  if (action === 'reset_names') {
    await configService.resetHorseNames();
    const names = configService.getHorseNames();
    const container = buildHorseNameSettingView(names, ownerId);
    await interaction.update({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  if (action === 'economy_settings') {
    const initialChips = configService.getInitialChips();
    const bankInterestRate = configService.getBankInterestRate();
    const container = buildEconomySettingView(initialChips, bankInterestRate, ownerId);
    await interaction.update({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  if (action === 'edit_initial_chips') {
    const current = configService.getInitialChips();
    const modal = new ModalBuilder()
      .setCustomId('setting_modal:edit_initial_chips')
      .setTitle('初期チップ編集')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('initial_chips')
            .setLabel('初期チップ（1,000〜10,000,000）')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('例: 10000')
            .setValue(current.toString())
            .setRequired(true),
        ),
      );
    await interaction.showModal(modal);
    return;
  }

  if (action === 'edit_bank_rate') {
    const current = configService.getBankInterestRate();
    const modal = new ModalBuilder()
      .setCustomId('setting_modal:edit_bank_rate')
      .setTitle('銀行利率編集')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('bank_rate')
            .setLabel('日利（0〜100）%')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('例: 1')
            .setValue(current.toString())
            .setRequired(true),
        ),
      );
    await interaction.showModal(modal);
    return;
  }

  if (action === 'reset_economy') {
    await configService.resetInitialChips();
    await configService.resetBankInterestRate();
    const initialChips = configService.getInitialChips();
    const bankInterestRate = configService.getBankInterestRate();
    const container = buildEconomySettingView(initialChips, bankInterestRate, ownerId);
    await interaction.update({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  if (action === 'back') {
    const container = buildSettingMenuView(ownerId);
    await interaction.update({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }
}

registerButtonHandler('setting', handleSettingButton as never);
