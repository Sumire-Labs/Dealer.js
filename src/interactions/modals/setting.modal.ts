import {ContainerBuilder, MessageFlags, type ModalSubmitInteraction, TextDisplayBuilder,} from 'discord.js';
import {registerModalHandler} from '../handler.js';
import {configService} from '../../config/config.service.js';
import {buildHorseNameSettingView, buildSettingCategoryView} from '../../ui/builders/setting.builder.js';
import {SETTING_CATEGORIES} from '../../config/setting-defs.js';

async function handleSettingModal(interaction: ModalSubmitInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const action = parts[1];

  // ── Horse name edit (legacy) ───────────────────────────────────────

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
      new TextDisplayBuilder().setContent(`\u2705 馬名を **${names.length}頭** に更新しました。`),
    );
    const container = buildHorseNameSettingView(names, interaction.user.id);
    await interaction.reply({
      components: [successMsg, container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  // ── Generic config edit ────────────────────────────────────────────

  if (action === 'cfg_edit') {
    const catId = parts[2];
    const page = parseInt(parts[3], 10);

    const cat = SETTING_CATEGORIES.find(c => c.id === catId);
    if (!cat) return;

    const start = page * 5;
    const slice = cat.settings.slice(start, start + 5);
    const errors: string[] = [];
    const updates: string[] = [];

    for (const def of slice) {
      const rawInput = interaction.fields.getTextInputValue(def.key).trim();
      const num = Number(rawInput);

      if (isNaN(num) || !Number.isFinite(num)) {
        errors.push(`**${def.label}**: 数値を入力してください`);
        continue;
      }

      if (num < def.min || num > def.max) {
        errors.push(`**${def.label}**: ${def.min}〜${def.max} の範囲で入力してください`);
        continue;
      }

      if (!Number.isInteger(num)) {
        errors.push(`**${def.label}**: 整数で入力してください`);
        continue;
      }

      // Convert display value to stored value
      const storedValue = def.uiDivisor === 1 ? num : num * def.uiDivisor;
      await configService.setNumeric(def, storedValue);
      const unitStr = def.unit ? ` ${def.unit}` : '';
      updates.push(`**${def.label}** \u2192 ${num}${unitStr}`);
    }

    const lines: string[] = [];
    if (updates.length > 0) {
      lines.push(`\u2705 ${updates.length}件更新しました:\n${updates.join('\n')}`);
    }
    if (errors.length > 0) {
      lines.push(`\u274C エラー:\n${errors.join('\n')}`);
    }

    const successMsg = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(lines.join('\n\n')),
    );
    const container = buildSettingCategoryView(catId, interaction.user.id);
    await interaction.reply({
      components: [successMsg, container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }
}

registerModalHandler('setting_modal', handleSettingModal as never);
