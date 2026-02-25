import {MessageFlags, type StringSelectMenuInteraction,} from 'discord.js';
import {registerSelectMenuHandler} from '../handler.js';
import {buyBusiness, getBusinessDashboard,} from '../../database/services/business.service.js';
import {buildBusinessDashboardView} from '../../ui/builders/business.builder.js';
import {BUSINESS_TYPE_MAP} from '../../config/business.js';

async function handleBusinessSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const action = parts[1];
  const ownerId = parts[2];

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: '`/business` で自分のビジネスを管理してください。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  switch (action) {
    case 'buy': {
      const typeId = interaction.values[0];

      const result = await buyBusiness(ownerId, typeId);
      if (!result.success) {
        await interaction.reply({
          content: result.error!,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const typeDef = BUSINESS_TYPE_MAP.get(typeId);
      await interaction.reply({
        content: `${typeDef?.emoji ?? '🏢'} **${typeDef?.name ?? typeId}** を購入しました！`,
        flags: MessageFlags.Ephemeral,
      });

      // Update the dashboard
      const dashboard = await getBusinessDashboard(ownerId);
      const view = buildBusinessDashboardView(dashboard, ownerId);
      await interaction.message.edit({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }
  }
}

registerSelectMenuHandler('biz_select', handleBusinessSelectMenu as never);
