import {
  ActionRowBuilder,
  type ButtonInteraction,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import {registerButtonHandler} from '../handler.js';
import {configService} from '../../config/config.service.js';
import {
  buildHorseNameSettingView,
  buildSettingCategoryPicker,
  buildSettingCategoryView,
  buildSettingEditModal,
  buildSettingMenuView,
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

    // ── Horse name actions (legacy, unchanged) ─────────────────────────

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

    // ── Generic config actions ─────────────────────────────────────────

    if (action === 'cfg_menu') {
        const container = buildSettingCategoryPicker(ownerId);
        await interaction.update({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        });
        return;
    }

    if (action === 'cfg_cat') {
        const catId = parts[3];
        const container = buildSettingCategoryView(catId, ownerId);
        await interaction.update({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        });
        return;
    }

    if (action === 'cfg_edit') {
        const catId = parts[3];
        const page = parseInt(parts[4], 10);
        const modal = buildSettingEditModal(catId, page);
        if (!modal) return;
        await interaction.showModal(modal);
        return;
    }

    if (action === 'cfg_reset') {
        const catId = parts[3];
        await configService.resetCategory(catId);
        const container = buildSettingCategoryView(catId, ownerId);
        await interaction.update({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        });
        return;
    }

    if (action === 'cfg_back') {
        const container = buildSettingCategoryPicker(ownerId);
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
