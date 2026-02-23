import { type ModalSubmitInteraction, MessageFlags } from 'discord.js';
import { registerModalHandler } from '../handler.js';
import { hireEmployee } from '../../database/services/business.service.js';
import { buildBusinessEmployeeView } from '../../ui/builders/business.builder.js';
import { getBusiness } from '../../database/repositories/business.repository.js';

async function handleBusinessModal(interaction: ModalSubmitInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const action = parts[1];

  switch (action) {
    case 'hire': {
      const ownerId = parts[2];

      if (interaction.user.id !== ownerId) {
        await interaction.reply({
          content: '他のプレイヤーの操作はできません。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const employeeId = interaction.fields.getTextInputValue('employee_id').trim();

      // Basic validation
      if (!/^\d{17,20}$/.test(employeeId)) {
        await interaction.reply({
          content: '無効なユーザーIDです。17〜20桁の数字を入力してください。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const result = await hireEmployee(ownerId, employeeId);
      if (!result.success) {
        await interaction.reply({
          content: result.error!,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.reply({
        content: `✅ <@${employeeId}> を従業員として雇いました！`,
        flags: MessageFlags.Ephemeral,
      });

      // Refresh employee view on the original message
      try {
        const business = await getBusiness(ownerId);
        if (business && interaction.message) {
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
      } catch { /* ignore */ }
      break;
    }
  }
}

registerModalHandler('biz_modal', handleBusinessModal as never);
