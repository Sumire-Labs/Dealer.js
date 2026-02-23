import {
  type ModalSubmitInteraction,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import { registerModalHandler } from '../handler.js';
import { configService } from '../../config/config.service.js';
import { buildHorseNameSettingView, buildEconomySettingView } from '../../ui/builders/setting.builder.js';
import { formatChips } from '../../utils/formatters.js';

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

    const successMsg = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`✅ 馬名を **${names.length}頭** に更新しました。`),
    );
    const container = buildHorseNameSettingView(names, interaction.user.id);
    await interaction.reply({
      components: [successMsg, container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  if (action === 'edit_initial_chips') {
    const raw = interaction.fields.getTextInputValue('initial_chips').trim();
    const value = Number(raw);

    if (!Number.isInteger(value) || value < 1_000 || value > 10_000_000) {
      await interaction.reply({
        content: '初期チップは 1,000〜10,000,000 の整数で入力してください。',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await configService.setInitialChips(BigInt(value));

    const successMsg = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`✅ 初期チップを **${formatChips(BigInt(value))}** に更新しました。`),
    );
    const container = buildEconomySettingView(
      configService.getInitialChips(),
      configService.getBankInterestRate(),
      interaction.user.id,
    );
    await interaction.reply({
      components: [successMsg, container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  if (action === 'edit_bank_rate') {
    const raw = interaction.fields.getTextInputValue('bank_rate').trim();
    const value = Number(raw);

    if (!Number.isInteger(value) || value < 0 || value > 100) {
      await interaction.reply({
        content: '銀行利率は 0〜100 の整数で入力してください。',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await configService.setBankInterestRate(BigInt(value));

    const successMsg = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`✅ 銀行利率を **${value}%** に更新しました。`),
    );
    const container = buildEconomySettingView(
      configService.getInitialChips(),
      configService.getBankInterestRate(),
      interaction.user.id,
    );
    await interaction.reply({
      components: [successMsg, container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }
}

registerModalHandler('setting_modal', handleSettingModal as never);
