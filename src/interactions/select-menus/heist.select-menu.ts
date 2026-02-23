import {
  type StringSelectMenuInteraction,
  MessageFlags,
} from 'discord.js';
import { registerSelectMenuHandler } from '../handler.js';
import {
  buildHeistRiskSelectView,
  buildHeistApproachSelectView,
  buildHeistConfirmView,
} from '../../ui/builders/heist.builder.js';
import { formatChips } from '../../utils/formatters.js';
import { configService } from '../../config/config.service.js';
import { S } from '../../config/setting-defs.js';
import { calculateMaxEntryFee } from '../../games/heist/heist.engine.js';
import {
  type HeistTarget,
  type HeistRiskLevel,
  type HeistApproach,
  HEIST_TARGET_MAP,
} from '../../config/heist.js';

async function handleHeistSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const action = parts[1];
  const ownerId = parts[2];

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: '他のプレイヤーの操作はできません。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  switch (action) {
    case 'target': {
      const amount = BigInt(parts[3]);
      const targetId = interaction.values[0] as HeistTarget;

      if (!HEIST_TARGET_MAP.has(targetId)) {
        await interaction.reply({ content: '無効なターゲットです。', flags: MessageFlags.Ephemeral });
        return;
      }

      const view = buildHeistRiskSelectView(ownerId, amount, targetId);
      await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }

    case 'risk': {
      const amount = BigInt(parts[3]);
      const targetId = parts[4] as HeistTarget;
      const riskId = interaction.values[0] as HeistRiskLevel;

      const view = buildHeistApproachSelectView(ownerId, amount, targetId, riskId);
      await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }

    case 'approach': {
      const amount = BigInt(parts[3]);
      const targetId = parts[4] as HeistTarget;
      const riskId = parts[5] as HeistRiskLevel;
      const selected = interaction.values[0]; // "group:stealth" or "solo:force"
      const [mode, approachId] = selected.split(':') as ['group' | 'solo', HeistApproach];

      // Validate entry fee against target+risk max
      const maxFee = calculateMaxEntryFee(targetId, riskId);
      if (amount > maxFee) {
        await interaction.reply({
          content: `参加費がこの組み合わせの上限を超えています！最大: ${formatChips(maxFee)}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (amount < configService.getBigInt(S.heistMinEntry)) {
        await interaction.reply({
          content: `参加費が最低額を下回っています！最低: ${formatChips(configService.getBigInt(S.heistMinEntry))}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const isSolo = mode === 'solo';
      const confirmView = buildHeistConfirmView(ownerId, amount, targetId, riskId, approachId, isSolo);
      await interaction.update({
        components: [confirmView],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }
  }
}

registerSelectMenuHandler('heist_select', handleHeistSelectMenu as never);
