import { type ButtonInteraction, MessageFlags } from 'discord.js';
import { registerButtonHandler } from '../handler.js';
import {
  getJailSession,
  releaseUser,
  attemptJailbreak,
  getJailbreakCooldownRemaining,
  usePrisonKey,
} from '../../games/prison/prison.session.js';
import {
  buildPrisonView,
  buildJailbreakResultView,
  buildReleasedView,
} from '../../ui/builders/prison.builder.js';
import { findOrCreateUser } from '../../database/repositories/user.repository.js';
import { removeChips } from '../../database/services/economy.service.js';
import { formatChips } from '../../utils/formatters.js';
import { hasInventoryItem, consumeInventoryItem } from '../../database/services/shop.service.js';

async function handlePrisonButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const action = parts[1];
  const ownerId = parts[2];

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: '他のプレイヤーの刑務所操作はできません。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const session = getJailSession(ownerId);
  if (!session) {
    await interaction.reply({
      content: 'すでに釈放されています！',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  switch (action) {
    case 'pay': {
      // Check balance
      const user = await findOrCreateUser(ownerId);
      if (user.chips < session.fineAmount) {
        await interaction.reply({
          content: `チップが不足しています！ 残高: ${formatChips(user.chips)} / 罰金: ${formatChips(session.fineAmount)}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Deduct fine and release
      await removeChips(ownerId, session.fineAmount, 'HEIST_LOSS', 'HEIST');
      releaseUser(ownerId);

      const view = buildReleasedView();
      await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }

    case 'jailbreak': {
      const cooldown = getJailbreakCooldownRemaining(ownerId);
      if (cooldown > 0) {
        await interaction.reply({
          content: `脱獄のクールダウン中です。あと **${Math.ceil(cooldown / 1000)}秒** お待ちください。`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const result = attemptJailbreak(ownerId);
      const updatedSession = getJailSession(ownerId);

      const resultView = buildJailbreakResultView(result.success, updatedSession);
      await interaction.update({
        components: [resultView],
        flags: MessageFlags.IsComponentsV2,
      });

      // If failed, follow up with updated prison view after a brief pause
      if (!result.success && updatedSession) {
        const jailbreakCd = getJailbreakCooldownRemaining(ownerId);
        const hasKey = await hasInventoryItem(ownerId, 'PRISON_KEY');
        const prisonView = buildPrisonView(updatedSession, jailbreakCd, hasKey);
        await interaction.followUp({
          components: [prisonView],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }
      break;
    }

    case 'use_key': {
      const hasKey = await hasInventoryItem(ownerId, 'PRISON_KEY');
      if (!hasKey) {
        await interaction.reply({
          content: '🔑 脱獄キーを持っていません！ショップで購入してください。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await consumeInventoryItem(ownerId, 'PRISON_KEY');
      usePrisonKey(ownerId);

      const view = buildReleasedView();
      await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });

      await interaction.followUp({
        content: '🔑 **脱獄キー**を使用して即時釈放されました！',
        flags: MessageFlags.Ephemeral,
      });
      break;
    }
  }
}

registerButtonHandler('prison', handlePrisonButton as never);
