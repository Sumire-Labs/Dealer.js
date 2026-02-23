import {
  type StringSelectMenuInteraction,
  MessageFlags,
} from 'discord.js';
import { registerSelectMenuHandler } from '../handler.js';
import { buildHelpTopView, buildHelpCategoryView } from '../../ui/builders/help.builder.js';

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

  const view = selected === 'top'
    ? buildHelpTopView(userId)
    : buildHelpCategoryView(userId, selected);

  await interaction.update({
    components: [view],
    flags: MessageFlags.IsComponentsV2,
  });
}

registerSelectMenuHandler('help_select', handleHelpSelectMenu as never);
