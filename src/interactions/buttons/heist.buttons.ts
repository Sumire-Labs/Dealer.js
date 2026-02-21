import { type ButtonInteraction, MessageFlags } from 'discord.js';
import { registerButtonHandler } from '../handler.js';
import { findOrCreateUser } from '../../database/repositories/user.repository.js';
import { removeChips } from '../../database/services/economy.service.js';
import {
  getActiveHeistSession,
  addPlayerToHeist,
  isPlayerInHeist,
} from '../../games/heist/heist.session.js';
import { buildHeistLobbyView } from '../../ui/builders/heist.builder.js';
import { formatChips } from '../../utils/formatters.js';
import { HEIST_MAX_PLAYERS } from '../../config/constants.js';
import { runHeist } from '../../commands/casino/heist.command.js';

async function handleHeistButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const action = parts[1];
  const channelId = parts[2];

  const session = getActiveHeistSession(channelId);
  if (!session || session.status !== 'waiting') {
    await interaction.reply({
      content: 'このヘイストは終了しています。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const userId = interaction.user.id;

  switch (action) {
    case 'join': {
      // Check if already joined
      if (isPlayerInHeist(channelId, userId)) {
        await interaction.reply({
          content: 'すでに参加しています！',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Check max players
      if (session.players.length >= HEIST_MAX_PLAYERS) {
        await interaction.reply({
          content: '参加者が上限に達しています。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Check balance
      const user = await findOrCreateUser(userId);
      if (user.chips < session.entryFee) {
        await interaction.reply({
          content: `チップが不足しています！ 残高: ${formatChips(user.chips)}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Deduct chips
      await removeChips(userId, session.entryFee, 'HEIST_JOIN', 'HEIST');

      // Add to session
      addPlayerToHeist(channelId, userId);

      // Update lobby view
      const remaining = Math.max(0, Math.ceil((session.lobbyDeadline - Date.now()) / 1000));
      const view = buildHeistLobbyView(session, remaining);
      await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }

    case 'start': {
      // Only host can start early
      const hostId = parts[3];
      if (userId !== hostId) {
        await interaction.reply({
          content: '主催者のみが早期開始できます。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Stop the lobby timer and run immediately
      if (session.lobbyTimer) clearInterval(session.lobbyTimer);
      session.status = 'running';

      await interaction.deferUpdate();
      await runHeist(interaction.channel, session);
      break;
    }
  }
}

registerButtonHandler('heist', handleHeistButton as never);
