import {
  type StringSelectMenuInteraction,
  MessageFlags,
} from 'discord.js';
import { registerSelectMenuHandler } from '../handler.js';
import { buildWikiCategoryView } from '../../ui/builders/wiki.builder.js';
import { wikiState } from '../buttons/wiki.buttons.js';

async function handleWikiSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const ownerId = parts[2];

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: 'これはあなたのパネルではありません！ `/help` で開いてください。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const userId = interaction.user.id;
  const categoryKey = interaction.values[0];

  // Reset page when selecting a new category
  if (wikiState.size > 10_000) wikiState.clear();
  wikiState.set(userId, { category: categoryKey, page: 0 });

  const view = buildWikiCategoryView(userId, categoryKey, 0);

  await interaction.update({
    components: [view],
    flags: MessageFlags.IsComponentsV2,
  });
}

registerSelectMenuHandler('wiki_select', handleWikiSelectMenu as never);
