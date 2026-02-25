import {MessageFlags, type StringSelectMenuInteraction,} from 'discord.js';
import {registerSelectMenuHandler} from '../handler.js';
import {buildHelpCategoryView, buildHelpTopView} from '../../ui/builders/help.builder.js';
import {buildWikiTopView} from '../../ui/builders/wiki.builder.js';

async function handleHelpSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
    const parts = interaction.customId.split(':');
    const ownerId = parts[2];

    if (interaction.user.id !== ownerId) {
        await interaction.reply({
            content: 'これはあなたのヘルプではありません！ `/help` で開いてください。',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const userId = interaction.user.id;
    const selected = interaction.values[0];

    let view;
    if (selected === 'wiki') {
        view = buildWikiTopView(userId);
    } else if (selected === 'top') {
        view = buildHelpTopView(userId);
    } else {
        view = buildHelpCategoryView(userId, selected);
    }

    await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
    });
}

registerSelectMenuHandler('help_select', handleHelpSelectMenu as never);
