import {type ButtonInteraction, MessageFlags} from 'discord.js';
import {registerButtonHandler} from '../handler.js';
import {buildHelpTopView} from '../../ui/builders/help.builder.js';

async function handleHelpButton(interaction: ButtonInteraction): Promise<void> {
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
    const view = buildHelpTopView(userId);

    await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
    });
}

registerButtonHandler('help', handleHelpButton as never);
