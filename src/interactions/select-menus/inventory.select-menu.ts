import {
  type StringSelectMenuInteraction,
  MessageFlags,
} from 'discord.js';
import { registerSelectMenuHandler } from '../handler.js';
import { getUserInventorySummary } from '../../database/services/shop.service.js';
import { getInvState } from '../buttons/inventory.buttons.js';
import { buildInventoryView } from '../../ui/builders/inventory.builder.js';

async function handleInventorySelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const ownerId = parts[2];

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: 'これはあなたのインベントリではありません！ `/inv` で開いてください。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const userId = interaction.user.id;
  const state = getInvState(userId);

  state.filter = interaction.values[0];
  state.page = 0;
  state.selected = 0;

  const summary = await getUserInventorySummary(userId);
  const view = buildInventoryView(
    userId, summary.inventory, summary.activeBuffs,
    summary.activeTitle, summary.activeBadge, state.page, state.filter, state.selected,
  );
  await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
}

registerSelectMenuHandler('inv_select', handleInventorySelectMenu as never);
