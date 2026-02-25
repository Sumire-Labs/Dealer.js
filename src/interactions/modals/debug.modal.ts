import {MessageFlags, type ModalSubmitInteraction,} from 'discord.js';
import {registerModalHandler} from '../handler.js';
import {findOrCreateUser} from '../../database/repositories/user.repository.js';
import {addChips} from '../../database/services/economy.service.js';
import {getBusiness} from '../../database/repositories/business.repository.js';
import {prisma} from '../../database/client.js';
import {formatChips} from '../../utils/formatters.js';
import {loadDebugViewData} from '../buttons/debug.buttons.js';
import {buildDebugTabView} from '../../ui/builders/debug.builder.js';

function parseInput(interaction: ModalSubmitInteraction): number | null {
  const raw = interaction.fields.getTextInputValue('value').trim();
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) return null;
  return parsed;
}

async function handleDebugModal(interaction: ModalSubmitInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const action = parts[1];
  const targetId = parts[2];

  const value = parseInput(interaction);
  if (value === null) {
    await interaction.reply({
      content: '有効な数値を入力してください。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  switch (action) {
    // ── Economy ──
    case 'give': {
      if (value <= 0) {
        await interaction.reply({ content: '1以上の値を入力してください。', flags: MessageFlags.Ephemeral });
        return;
      }
      const before = await findOrCreateUser(targetId);
      const newBalance = await addChips(targetId, BigInt(value), 'ADMIN_GIVE');

      const data = await loadDebugViewData(targetId);
      const view = buildDebugTabView(data, interaction.user.id, 'economy');
      await interaction.reply({
        content: `✅ <@${targetId}> に **${formatChips(BigInt(value))}** を付与 (${formatChips(before.chips)} → ${formatChips(newBalance)})`,
        components: [view],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
      break;
    }

    case 'set_chips': {
      if (value < 0) {
        await interaction.reply({ content: '0以上の値を入力してください。', flags: MessageFlags.Ephemeral });
        return;
      }
      const before = await findOrCreateUser(targetId);
      await prisma.user.update({
        where: { id: targetId },
        data: { chips: BigInt(value) },
      });

      const data = await loadDebugViewData(targetId);
      const view = buildDebugTabView(data, interaction.user.id, 'economy');
      await interaction.reply({
        content: `✅ <@${targetId}> のチップを設定 (${formatChips(before.chips)} → ${formatChips(BigInt(value))})`,
        components: [view],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
      break;
    }

    case 'set_bank': {
      if (value < 0) {
        await interaction.reply({ content: '0以上の値を入力してください。', flags: MessageFlags.Ephemeral });
        return;
      }
      const before = await findOrCreateUser(targetId);
      await prisma.user.update({
        where: { id: targetId },
        data: { bankBalance: BigInt(value) },
      });

      const data = await loadDebugViewData(targetId);
      const view = buildDebugTabView(data, interaction.user.id, 'economy');
      await interaction.reply({
        content: `✅ <@${targetId}> の銀行残高を設定 (${formatChips(before.bankBalance)} → ${formatChips(BigInt(value))})`,
        components: [view],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
      break;
    }

    // ── Work ──
    case 'set_level': {
      if (value < 0 || value > 5) {
        await interaction.reply({ content: 'レベルは0〜5の範囲で入力してください。', flags: MessageFlags.Ephemeral });
        return;
      }
      const before = await findOrCreateUser(targetId);
      await prisma.user.update({
        where: { id: targetId },
        data: { workLevel: value },
      });

      const data = await loadDebugViewData(targetId);
      const view = buildDebugTabView(data, interaction.user.id, 'work');
      await interaction.reply({
        content: `✅ <@${targetId}> の労働レベルを設定 (${before.workLevel} → ${value})`,
        components: [view],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
      break;
    }

    case 'set_xp': {
      if (value < 0) {
        await interaction.reply({ content: '0以上の値を入力してください。', flags: MessageFlags.Ephemeral });
        return;
      }
      const before = await findOrCreateUser(targetId);
      await prisma.user.update({
        where: { id: targetId },
        data: { workXp: value },
      });

      const data = await loadDebugViewData(targetId);
      const view = buildDebugTabView(data, interaction.user.id, 'work');
      await interaction.reply({
        content: `✅ <@${targetId}> のXPを設定 (${before.workXp} → ${value})`,
        components: [view],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
      break;
    }

    case 'set_work_streak': {
      if (value < 0) {
        await interaction.reply({ content: '0以上の値を入力してください。', flags: MessageFlags.Ephemeral });
        return;
      }
      const before = await findOrCreateUser(targetId);
      await prisma.user.update({
        where: { id: targetId },
        data: { workStreak: value },
      });

      const data = await loadDebugViewData(targetId);
      const view = buildDebugTabView(data, interaction.user.id, 'work');
      await interaction.reply({
        content: `✅ <@${targetId}> の労働連続を設定 (${before.workStreak} → ${value})`,
        components: [view],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
      break;
    }

    case 'set_daily_streak': {
      if (value < 0) {
        await interaction.reply({ content: '0以上の値を入力してください。', flags: MessageFlags.Ephemeral });
        return;
      }
      const before = await findOrCreateUser(targetId);
      await prisma.user.update({
        where: { id: targetId },
        data: { dailyStreak: value },
      });

      const data = await loadDebugViewData(targetId);
      const view = buildDebugTabView(data, interaction.user.id, 'work');
      await interaction.reply({
        content: `✅ <@${targetId}> のログイン連続を設定 (${before.dailyStreak} → ${value})`,
        components: [view],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
      break;
    }

    // ── Business ──
    case 'set_biz_level': {
      if (value < 1 || value > 5) {
        await interaction.reply({ content: 'レベルは1〜5の範囲で入力してください。', flags: MessageFlags.Ephemeral });
        return;
      }
      const business = await getBusiness(targetId);
      if (!business) {
        await interaction.reply({ content: 'このユーザーはビジネスを所持していません。', flags: MessageFlags.Ephemeral });
        return;
      }
      const beforeLevel = business.level;
      await prisma.business.update({
        where: { ownerId: targetId },
        data: { level: value },
      });

      const data = await loadDebugViewData(targetId);
      const view = buildDebugTabView(data, interaction.user.id, 'business');
      await interaction.reply({
        content: `✅ <@${targetId}> のビジネスレベルを設定 (${beforeLevel} → ${value})`,
        components: [view],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
      break;
    }
  }
}

registerModalHandler('debug_modal', handleDebugModal as never);
