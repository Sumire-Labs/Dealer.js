import {
    ActionRowBuilder,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    type UserSelectMenuInteraction,
} from 'discord.js';
import {registerSelectMenuHandler} from '../handler.js';

async function handleBankSelectMenu(interaction: UserSelectMenuInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const action = parts[1];
  const ownerId = parts[2];

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: 'これはあなたのパネルではありません！ `/bank` で開いてください。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  switch (action) {
    case 'transfer_user': {
      const selectedUserId = interaction.values[0];

      if (selectedUserId === interaction.user.id) {
        await interaction.reply({
          content: '自分自身には送金できません。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Show amount input modal
      const modal = new ModalBuilder()
        .setCustomId(`bank_modal:transfer_amount:${selectedUserId}`)
        .setTitle('送金額の入力')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('amount')
              .setLabel(`送金先: ${interaction.users.first()?.username ?? selectedUserId}`)
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('例: 10000')
              .setRequired(true),
          ),
        );

      await interaction.showModal(modal);
      break;
    }
  }
}

registerSelectMenuHandler('bank_select', handleBankSelectMenu as never);
