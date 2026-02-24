import {
  type UserSelectMenuInteraction,
  type StringSelectMenuInteraction,
  MessageFlags,
} from 'discord.js';
import { registerSelectMenuHandler } from '../handler.js';
import { findOrCreateUser } from '../../database/repositories/user.repository.js';
import { createBusiness, getBusiness } from '../../database/repositories/business.repository.js';
import { BUSINESS_TYPE_MAP } from '../../config/business.js';
import { loadDebugViewData } from '../buttons/debug.buttons.js';
import { buildDebugTabView, buildDebugResultView } from '../../ui/builders/debug.builder.js';

async function handleDebugSelectMenu(
  interaction: UserSelectMenuInteraction | StringSelectMenuInteraction,
): Promise<void> {
  const parts = interaction.customId.split(':');
  const action = parts[1];
  const adminId = parts[2];

  if (interaction.user.id !== adminId) {
    await interaction.reply({
      content: 'このパネルは操作できません。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  switch (action) {
    // ── User selection → show economy tab ──
    case 'user': {
      if (!interaction.isUserSelectMenu()) return;
      const targetId = interaction.values[0];
      await findOrCreateUser(targetId);

      const data = await loadDebugViewData(targetId);
      const view = buildDebugTabView(data, adminId, 'economy');
      await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }

    // ── Business type selection → create business ──
    case 'biz_create': {
      if (!interaction.isStringSelectMenu()) return;
      const targetId = parts[3];
      const typeId = interaction.values[0];

      const existing = await getBusiness(targetId);
      if (existing) {
        await interaction.reply({
          content: 'このユーザーは既にビジネスを所持しています。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await findOrCreateUser(targetId);
      await createBusiness(targetId, typeId);

      const typeDef = BUSINESS_TYPE_MAP.get(typeId);
      const view = buildDebugResultView(
        adminId,
        targetId,
        'ビジネス作成完了',
        `<@${targetId}> に ${typeDef?.emoji ?? '🏢'} **${typeDef?.name ?? typeId}** を作成しました。`,
        'business',
      );
      await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }
  }
}

registerSelectMenuHandler('debug_select', handleDebugSelectMenu as never);
