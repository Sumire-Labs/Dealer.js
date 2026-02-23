import {
  type ButtonInteraction,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  type ModalActionRowComponentBuilder,
} from 'discord.js';
import { registerButtonHandler } from '../handler.js';
import {
  getBusinessDashboard,
  buyBusiness,
  upgradeBusinessLevel,
  collectIncome,
  fireEmployee,
} from '../../database/services/business.service.js';
import {
  buildBusinessDashboardView,
  buildBusinessCollectView,
  buildBusinessUpgradeConfirmView,
  buildBusinessEmployeeView,
} from '../../ui/builders/business.builder.js';
import { BUSINESS_TYPE_MAP, getBusinessLevel } from '../../config/business.js';
import { getBusiness } from '../../database/repositories/business.repository.js';

async function handleBusinessButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const action = parts[1];
  const userId = interaction.user.id;

  switch (action) {
    case 'buy': {
      const ownerId = parts[2];
      const typeId = parts[3];

      if (userId !== ownerId) {
        await interaction.reply({
          content: '`/business` で自分のビジネスを管理してください。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

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

    case 'collect': {
      const ownerId = parts[2];

      if (userId !== ownerId) {
        await interaction.reply({
          content: '`/business` で自分のビジネスを管理してください。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const result = await collectIncome(ownerId);
      if (!result.success) {
        await interaction.reply({
          content: result.error!,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const view = buildBusinessCollectView(result, ownerId);
      await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }

    case 'upgrade': {
      const ownerId = parts[2];

      if (userId !== ownerId) {
        await interaction.reply({
          content: '`/business` で自分のビジネスを管理してください。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const business = await getBusiness(ownerId);
      if (!business) {
        await interaction.reply({
          content: 'ビジネスを所持していません。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const typeDef = BUSINESS_TYPE_MAP.get(business.type);
      if (!typeDef) return;

      const nextLevel = getBusinessLevel(business.type, business.level + 1);
      if (!nextLevel) {
        await interaction.reply({
          content: 'すでに最大レベルです。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const view = buildBusinessUpgradeConfirmView(
        ownerId,
        typeDef.name,
        typeDef.emoji,
        business.level,
        nextLevel.description,
        nextLevel.upgradeCost,
        nextLevel.incomePerHour,
      );

      await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }

    case 'upgrade_confirm': {
      const ownerId = parts[2];

      if (userId !== ownerId) {
        await interaction.reply({
          content: '`/business` で自分のビジネスを管理してください。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const result = await upgradeBusinessLevel(ownerId);
      if (!result.success) {
        await interaction.reply({
          content: result.error!,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.reply({
        content: `⬆️ レベルアップ成功！ Lv.${result.newLevel}`,
        flags: MessageFlags.Ephemeral,
      });

      // Refresh dashboard
      const dashboard = await getBusinessDashboard(ownerId);
      const view = buildBusinessDashboardView(dashboard, ownerId);
      await interaction.message.edit({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }

    case 'employees': {
      const ownerId = parts[2];

      if (userId !== ownerId) {
        await interaction.reply({
          content: '`/business` で自分のビジネスを管理してください。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const business = await getBusiness(ownerId);
      if (!business) {
        await interaction.reply({
          content: 'ビジネスを所持していません。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const employees = business.employees.map(e => ({
        userId: e.userId,
        hiredAt: e.hiredAt,
      }));

      const view = buildBusinessEmployeeView(ownerId, employees);
      await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }

    case 'hire': {
      const ownerId = parts[2];

      if (userId !== ownerId) {
        await interaction.reply({
          content: '`/business` で自分のビジネスを管理してください。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId(`biz_modal:hire:${ownerId}`)
        .setTitle('従業員を雇う');

      const userIdInput = new TextInputBuilder()
        .setCustomId('employee_id')
        .setLabel('従業員のユーザーID')
        .setPlaceholder('DiscordユーザーIDを入力')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(17)
        .setMaxLength(20);

      modal.addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(userIdInput),
      );

      await interaction.showModal(modal);
      break;
    }

    case 'fire': {
      const ownerId = parts[2];
      const employeeId = parts[3];

      if (userId !== ownerId) {
        await interaction.reply({
          content: '`/business` で自分のビジネスを管理してください。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const result = await fireEmployee(ownerId, employeeId);
      if (!result.success) {
        await interaction.reply({
          content: result.error!,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.reply({
        content: `👤 <@${employeeId}> を解雇しました。`,
        flags: MessageFlags.Ephemeral,
      });

      // Refresh employee view
      const business = await getBusiness(ownerId);
      if (business) {
        const employees = business.employees.map(e => ({
          userId: e.userId,
          hiredAt: e.hiredAt,
        }));
        const view = buildBusinessEmployeeView(ownerId, employees);
        await interaction.message.edit({
          components: [view],
          flags: MessageFlags.IsComponentsV2,
        });
      }
      break;
    }

    case 'back': {
      const ownerId = parts[2];

      if (userId !== ownerId) {
        await interaction.reply({
          content: '`/business` で自分のビジネスを管理してください。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const dashboard = await getBusinessDashboard(ownerId);
      const view = buildBusinessDashboardView(dashboard, ownerId);
      await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }
  }
}

registerButtonHandler('biz', handleBusinessButton as never);
