import {
  type ModalSubmitInteraction,
  MessageFlags,
} from 'discord.js';
import { registerModalHandler } from '../handler.js';
import { configService } from '../../config/config.service.js';
import { buildHorseNameSettingView } from '../../ui/builders/setting.builder.js';

async function handleSettingModal(interaction: ModalSubmitInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const action = parts[1];

  if (action === 'edit_names') {
    const raw = interaction.fields.getTextInputValue('horse_names');
    const names = raw
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (names.length < 5) {
      await interaction.reply({
        content: `馬名は最低5つ必要です（現在: ${names.length}つ）。レースでは5頭使用します。`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await configService.setHorseNames(names);

    const container = buildHorseNameSettingView(names, interaction.user.id);
    await interaction.reply({
      content: `馬名を **${names.length}頭** に更新しました。`,
      components: [container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }
}

registerModalHandler('setting_modal', handleSettingModal as never);
