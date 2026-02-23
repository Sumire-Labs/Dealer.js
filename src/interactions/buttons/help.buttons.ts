import { type ButtonInteraction, MessageFlags } from 'discord.js';
import { registerButtonHandler } from '../handler.js';
import { buildHelpTopView, buildHelpCategoryView } from '../../ui/builders/help.builder.js';

async function handleHelpButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const action = parts[1]; // 'top' or 'cat'
  const ownerId = parts[2];

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: 'これはあなたのヘルプではありません！ `/help` で開いてください。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const userId = interaction.user.id;
  let view;

  if (action === 'cat') {
    const categoryId = parts[3];
    view = buildHelpCategoryView(userId, categoryId);
  } else {
    view = buildHelpTopView(userId);
  }

  await interaction.update({
    components: [view],
    flags: MessageFlags.IsComponentsV2,
  });
}

registerButtonHandler('help', handleHelpButton as never);
