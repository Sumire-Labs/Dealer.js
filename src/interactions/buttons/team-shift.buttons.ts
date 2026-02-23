import {
  type ButtonInteraction,
  MessageFlags,
} from 'discord.js';
import { registerButtonHandler } from '../handler.js';
import { findOrCreateUser } from '../../database/repositories/user.repository.js';
import {
  getTeamSession,
  setTeamSession,
  addPlayerToTeam,
  isPlayerInTeam,
  setPlayerJob,
  allPlayersReady,
  removeTeamSession,
} from '../../games/work/team-shift.session.js';
import {
  buildTeamShiftLobbyView,
  buildTeamShiftJobSelectView,
  buildTeamShiftResultView,
} from '../../ui/builders/team-shift.builder.js';
import {
  TEAM_SHIFT_MAX_PLAYERS,
  TEAM_SHIFT_BONUS_PER_PLAYER,
} from '../../config/constants.js';
import { performTeamWork } from '../../database/services/team-work.service.js';
import type { WorkResult } from '../../database/services/work.service.js';
import { JOB_MAP } from '../../config/jobs.js';
import { TEAM_EVENTS, type TeamEvent } from '../../config/team-events.js';
import { weightedRandom } from '../../utils/random.js';
import { buildAchievementNotification } from '../../database/services/achievement.service.js';
import { buildMissionNotification } from '../../database/services/mission.service.js';
import type { TeamShiftSession } from '../../games/work/team-shift.session.js';

function rollTeamEvent(): TeamEvent | undefined {
  // 55% chance of no event
  const noEventWeight = 55;

  const items = [
    { value: 'none' as const, weight: noEventWeight },
    ...TEAM_EVENTS.map(e => ({ value: e.id, weight: e.chance })),
  ];

  const rolled = weightedRandom(items);
  if (rolled === 'none') return undefined;
  return TEAM_EVENTS.find(e => e.id === rolled);
}

async function handleTeamButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const action = parts[1];
  const userId = interaction.user.id;

  switch (action) {
    case 'create': {
      const ownerId = parts[2];
      const shiftType = parts[3] as import('../../config/jobs.js').ShiftType;

      if (userId !== ownerId) {
        await interaction.reply({
          content: '`/work` で自分のワークパネルを開いてください。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const channelId = interaction.channelId;
      const existing = getTeamSession(channelId);
      if (existing) {
        await interaction.reply({
          content: 'このチャンネルではすでにチームシフトが進行中です！',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const { TEAM_SHIFT_LOBBY_DURATION_MS } = await import('../../config/constants.js');

      const session: TeamShiftSession = {
        channelId,
        hostId: userId,
        shiftType,
        players: [{ userId, isHost: true }],
        status: 'lobby',
        lobbyDeadline: Date.now() + TEAM_SHIFT_LOBBY_DURATION_MS,
      };

      setTeamSession(channelId, session);

      const remainingSec = Math.ceil(TEAM_SHIFT_LOBBY_DURATION_MS / 1000);
      const lobbyView = buildTeamShiftLobbyView(session, remainingSec);

      // Update the work panel message to confirm
      await interaction.update({
        content: '✅ チームシフトロビーを作成しました！',
        components: [],
        flags: MessageFlags.IsComponentsV2,
      });

      // Send public lobby message
      if (interaction.channel && 'send' in interaction.channel) {
        const msg = await (interaction.channel as any).send({
          components: [lobbyView],
          flags: MessageFlags.IsComponentsV2,
        });
        session.messageId = msg.id;
        startTeamLobbyCountdown(interaction.channel as any, session);
      }
      break;
    }

    case 'join': {
      const channelId = parts[2];
      const session = getTeamSession(channelId);

      if (!session || session.status !== 'lobby') {
        await interaction.reply({
          content: 'このチームシフトは終了しています。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (isPlayerInTeam(channelId, userId)) {
        await interaction.reply({
          content: 'すでに参加しています！',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (session.players.length >= TEAM_SHIFT_MAX_PLAYERS) {
        await interaction.reply({
          content: '参加者が上限に達しています。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      addPlayerToTeam(channelId, userId);

      const remaining = Math.max(0, Math.ceil((session.lobbyDeadline - Date.now()) / 1000));
      const view = buildTeamShiftLobbyView(session, remaining);
      await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }

    case 'start': {
      const channelId = parts[2];
      const hostId = parts[3];
      const session = getTeamSession(channelId);

      if (!session || session.status !== 'lobby') {
        await interaction.reply({
          content: 'このチームシフトは終了しています。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (userId !== hostId) {
        await interaction.reply({
          content: '主催者のみが開始できます。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (session.players.length < 2) {
        await interaction.reply({
          content: '最低2人必要です。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Stop lobby timer
      if (session.lobbyTimer) clearInterval(session.lobbyTimer);
      session.status = 'job_select';

      // Send job select prompt to each player as ephemeral
      await interaction.update({
        components: [buildTeamShiftLobbyView(session, 0)],
        flags: MessageFlags.IsComponentsV2,
      });

      // Notify players to select jobs
      for (const player of session.players) {
        try {
          const user = await findOrCreateUser(player.userId);
          const view = buildTeamShiftJobSelectView(player.userId, channelId, user.workLevel);
          await interaction.followUp({
            content: `<@${player.userId}> ジョブを選択してください！`,
            components: [view],
            flags: MessageFlags.IsComponentsV2,
          });
        } catch { /* ignore */ }
      }
      break;
    }

    case 'job': {
      const ownerId = parts[2];
      const channelId = parts[3];
      const jobId = parts[4];

      if (userId !== ownerId) {
        await interaction.reply({
          content: '他のプレイヤーの操作はできません。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const session = getTeamSession(channelId);
      if (!session || session.status !== 'job_select') {
        await interaction.reply({
          content: 'このチームシフトは終了しています。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (!isPlayerInTeam(channelId, userId)) {
        await interaction.reply({
          content: 'このチームシフトに参加していません。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const job = JOB_MAP.get(jobId);
      if (!job) {
        await interaction.reply({
          content: '無効な職種です。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      setPlayerJob(channelId, userId, jobId);

      await interaction.update({
        content: `✅ **${job.emoji} ${job.name}** を選択しました！他のメンバーを待っています...`,
        components: [],
        flags: MessageFlags.IsComponentsV2,
      });

      // Check if all players are ready
      if (allPlayersReady(channelId)) {
        session.status = 'running';
        await runTeamShift(interaction, session);
      }
      break;
    }
  }
}

async function runTeamShift(
  interaction: ButtonInteraction,
  session: TeamShiftSession,
): Promise<void> {
  const teamSize = session.players.length;
  const teamBonusPercent = (teamSize - 1) * TEAM_SHIFT_BONUS_PER_PLAYER;

  // Roll team event
  const teamEvent = rollTeamEvent();

  // Execute work for each player
  const results: (WorkResult & { playerId: string })[] = [];

  for (const player of session.players) {
    if (!player.jobId) continue;
    const result = await performTeamWork(player.userId, player.jobId, session.shiftType, teamSize);
    results.push({ ...result, playerId: player.userId });
  }

  session.status = 'finished';
  removeTeamSession(session.channelId);

  // Build result view
  const resultView = buildTeamShiftResultView({
    results: results.filter((r): r is WorkResult & { playerId: string; success: true } => r.success === true),
    teamSize,
    teamEvent,
    teamBonusPercent,
  });

  // Send result to channel
  if (interaction.channel && 'send' in interaction.channel) {
    await (interaction.channel as any).send({
      components: [resultView],
      flags: MessageFlags.IsComponentsV2,
    });
  }

  // Achievement and mission notifications per player
  for (const r of results) {
    if (!r.success) continue;
    try {
      if (r.newlyUnlocked && r.newlyUnlocked.length > 0 && interaction.channel && 'send' in interaction.channel) {
        await (interaction.channel as any).send({
          content: `<@${r.playerId}> ${buildAchievementNotification(r.newlyUnlocked)}`,
        });
      }
      if (r.missionsCompleted && r.missionsCompleted.length > 0 && interaction.channel && 'send' in interaction.channel) {
        await (interaction.channel as any).send({
          content: `<@${r.playerId}> ${buildMissionNotification(r.missionsCompleted)}`,
        });
      }
    } catch { /* ignore */ }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function startTeamLobbyCountdown(
  channel: any,
  session: TeamShiftSession,
): Promise<void> {
  const interval = 10_000; // Update every 10 seconds

  session.lobbyTimer = setInterval(async () => {
    const remaining = Math.max(0, Math.ceil((session.lobbyDeadline - Date.now()) / 1000));

    if (remaining <= 0 || session.status !== 'lobby') {
      clearInterval(session.lobbyTimer);

      if (session.status === 'lobby') {
        if (session.players.length >= 2) {
          session.status = 'job_select';
          if (session.messageId && channel.messages) {
            try {
              const msg = await channel.messages.fetch(session.messageId);
              const view = buildTeamShiftLobbyView(session, 0);
              await msg.edit({
                components: [view],
                flags: 1 << 15, // IsComponentsV2
              });
              await channel.send({
                content: `⏰ ロビー時間終了！参加者はジョブを選択してください。\n${session.players.map((p: any) => `<@${p.userId}>`).join(' ')}`,
              });
            } catch { /* ignore */ }
          }
        } else {
          removeTeamSession(session.channelId);
          try {
            await channel.send({ content: '👥 チームシフトは人数不足でキャンセルされました。' });
          } catch { /* ignore */ }
        }
      }
      return;
    }

    // Update lobby view
    if (session.messageId && channel.messages) {
      try {
        const msg = await channel.messages.fetch(session.messageId);
        const view = buildTeamShiftLobbyView(session, remaining);
        await msg.edit({
          components: [view],
          flags: 1 << 15,
        });
      } catch { /* ignore */ }
    }
  }, interval);
}

registerButtonHandler('team', handleTeamButton as never);
