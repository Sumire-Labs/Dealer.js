import { type ButtonInteraction, MessageFlags } from 'discord.js';
import { registerButtonHandler } from '../handler.js';
import { findOrCreateUser } from '../../database/repositories/user.repository.js';
import { removeChips } from '../../database/services/economy.service.js';
import {
  getActiveHeistSession,
  setActiveHeistSession,
  addPlayerToHeist,
  isPlayerInHeist,
  type HeistSessionState,
} from '../../games/heist/heist.session.js';
import {
  buildHeistLobbyView,
  buildHeistRiskSelectView,
  buildHeistApproachSelectView,
  buildHeistConfirmView,
} from '../../ui/builders/heist.builder.js';
import { formatChips } from '../../utils/formatters.js';
import {
  HEIST_MAX_PLAYERS,
  HEIST_MIN_ENTRY,
  HEIST_LOBBY_DURATION_MS,
} from '../../config/constants.js';
import { runHeist, startLobbyCountdown } from '../../commands/casino/heist.command.js';
import { calculateMaxEntryFee } from '../../games/heist/heist.engine.js';
import {
  type HeistTarget,
  type HeistRiskLevel,
  type HeistApproach,
  HEIST_TARGET_MAP,
} from '../../config/heist.js';

async function handleHeistButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const action = parts[1];
  const userId = interaction.user.id;

  switch (action) {
    // --- Ephemeral selection phase (no session yet) ---

    case 'target': {
      const ownerId = parts[2];
      const amount = BigInt(parts[3]);
      const targetId = parts[4] as HeistTarget;

      if (userId !== ownerId) {
        await interaction.reply({ content: '他のプレイヤーの操作はできません。', flags: MessageFlags.Ephemeral });
        return;
      }

      // Validate target exists
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
      const ownerId = parts[2];
      const amount = BigInt(parts[3]);
      const targetId = parts[4] as HeistTarget;
      const riskId = parts[5] as HeistRiskLevel;

      if (userId !== ownerId) {
        await interaction.reply({ content: '他のプレイヤーの操作はできません。', flags: MessageFlags.Ephemeral });
        return;
      }

      const view = buildHeistApproachSelectView(ownerId, amount, targetId, riskId);
      await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }

    case 'approach': {
      // Group mode: show confirmation screen
      const ownerId = parts[2];
      const amount = BigInt(parts[3]);
      const targetId = parts[4] as HeistTarget;
      const riskId = parts[5] as HeistRiskLevel;
      const approachId = parts[6] as HeistApproach;

      if (userId !== ownerId) {
        await interaction.reply({ content: '他のプレイヤーの操作はできません。', flags: MessageFlags.Ephemeral });
        return;
      }

      // Validate entry fee against target+risk max
      const maxFee = calculateMaxEntryFee(targetId, riskId);
      if (amount > maxFee) {
        await interaction.reply({
          content: `参加費がこの組み合わせの上限を超えています！最大: ${formatChips(maxFee)}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (amount < HEIST_MIN_ENTRY) {
        await interaction.reply({
          content: `参加費が最低額を下回っています！最低: ${formatChips(HEIST_MIN_ENTRY)}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const confirmView = buildHeistConfirmView(ownerId, amount, targetId, riskId, approachId, false);
      await interaction.update({
        components: [confirmView],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }

    case 'solo': {
      // Solo mode: show confirmation screen
      const ownerId = parts[2];
      const amount = BigInt(parts[3]);
      const targetId = parts[4] as HeistTarget;
      const riskId = parts[5] as HeistRiskLevel;
      const approachId = parts[6] as HeistApproach;

      if (userId !== ownerId) {
        await interaction.reply({ content: '他のプレイヤーの操作はできません。', flags: MessageFlags.Ephemeral });
        return;
      }

      // Validate entry fee
      const maxFee = calculateMaxEntryFee(targetId, riskId);
      if (amount > maxFee) {
        await interaction.reply({
          content: `参加費がこの組み合わせの上限を超えています！最大: ${formatChips(maxFee)}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const confirmView = buildHeistConfirmView(ownerId, amount, targetId, riskId, approachId, true);
      await interaction.update({
        components: [confirmView],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }

    case 'confirm': {
      // Execute heist after confirmation
      const ownerId = parts[2];
      const amount = BigInt(parts[3]);
      const targetId = parts[4] as HeistTarget;
      const riskId = parts[5] as HeistRiskLevel;
      const approachId = parts[6] as HeistApproach;
      const mode = parts[7] as 'group' | 'solo';

      if (userId !== ownerId) {
        await interaction.reply({ content: '他のプレイヤーの操作はできません。', flags: MessageFlags.Ephemeral });
        return;
      }

      // Check for existing session
      const channelId = interaction.channelId;
      const existing = getActiveHeistSession(channelId);
      if (existing) {
        await interaction.reply({
          content: 'このチャンネルではすでにヘイストが進行中です！',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Check balance
      const user = await findOrCreateUser(ownerId);
      if (user.chips < amount) {
        await interaction.reply({
          content: `チップが不足しています！ 残高: ${formatChips(user.chips)}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Deduct chips
      await removeChips(ownerId, amount, 'HEIST_JOIN', 'HEIST');

      if (mode === 'group') {
        // Create group lobby session
        const session: HeistSessionState = {
          channelId,
          hostId: ownerId,
          players: [{ userId: ownerId, isHost: true }],
          status: 'waiting',
          lobbyDeadline: Date.now() + HEIST_LOBBY_DURATION_MS,
          entryFee: amount,
          target: targetId,
          riskLevel: riskId,
          approach: approachId,
          isSolo: false,
        };

        setActiveHeistSession(channelId, session);

        // Dismiss ephemeral
        await interaction.update({
          content: '✅ ロビーを作成しました！',
          components: [],
          flags: MessageFlags.IsComponentsV2,
        });

        // Send public lobby message
        if (interaction.channel && 'send' in interaction.channel) {
          const remainingSeconds = Math.ceil(HEIST_LOBBY_DURATION_MS / 1000);
          const lobbyView = buildHeistLobbyView(session, remainingSeconds);
          const msg = await interaction.channel.send({
            components: [lobbyView],
            flags: MessageFlags.IsComponentsV2,
          });
          session.messageId = msg.id;
          startLobbyCountdown(interaction.channel, session);
        }
      } else {
        // Create solo session and run immediately
        const session: HeistSessionState = {
          channelId,
          hostId: ownerId,
          players: [{ userId: ownerId, isHost: true }],
          status: 'running',
          lobbyDeadline: 0,
          entryFee: amount,
          target: targetId,
          riskLevel: riskId,
          approach: approachId,
          isSolo: true,
        };

        setActiveHeistSession(channelId, session);

        // Dismiss ephemeral
        await interaction.update({
          content: '🔫 ソロヘイスト開始！',
          components: [],
          flags: MessageFlags.IsComponentsV2,
        });

        // Send public message and run immediately
        if (interaction.channel && 'send' in interaction.channel) {
          const target = HEIST_TARGET_MAP.get(targetId)!;
          const initMsg = await interaction.channel.send({
            content: `🔫 <@${ownerId}> が ${target.emoji} **${target.name}** にソロ強盗を仕掛ける！`,
          });
          session.messageId = initMsg.id;
          await runHeist(interaction.channel, session);
        }
      }
      break;
    }

    case 'back': {
      // Return to approach selection
      const ownerId = parts[2];
      const amount = BigInt(parts[3]);
      const targetId = parts[4] as HeistTarget;
      const riskId = parts[5] as HeistRiskLevel;

      if (userId !== ownerId) {
        await interaction.reply({ content: '他のプレイヤーの操作はできません。', flags: MessageFlags.Ephemeral });
        return;
      }

      const view = buildHeistApproachSelectView(ownerId, amount, targetId, riskId);
      await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }

    // --- Lobby phase (session exists) ---

    case 'join': {
      const channelId = parts[2];
      const session = getActiveHeistSession(channelId);

      if (!session || session.status !== 'waiting') {
        await interaction.reply({
          content: 'このヘイストは終了しています。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (isPlayerInHeist(channelId, userId)) {
        await interaction.reply({
          content: 'すでに参加しています！',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

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
      const channelId = parts[2];
      const hostId = parts[3];
      const session = getActiveHeistSession(channelId);

      if (!session || session.status !== 'waiting') {
        await interaction.reply({
          content: 'このヘイストは終了しています。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

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
