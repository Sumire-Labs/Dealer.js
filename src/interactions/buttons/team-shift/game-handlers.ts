import {
  type ButtonInteraction,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import { logger } from '../../../utils/logger.js';
import { findOrCreateUser } from '../../../database/repositories/user.repository.js';
import {
  getTeamSession,
  isPlayerInTeam,
  setPlayerJob,
  allPlayersReady,
  removeTeamSession,
} from '../../../games/work/team-shift.session.js';
import {
  buildTeamShiftLobbyView,
  buildTeamShiftJobSelectView,
  buildTeamShiftResultView,
} from '../../../ui/builders/team-shift.builder.js';
import { configService } from '../../../config/config.service.js';
import { S } from '../../../config/setting-defs.js';
import { performTeamWork } from '../../../database/services/team-work.service.js';
import type { WorkResult } from '../../../database/services/work.service.js';
import { JOB_MAP } from '../../../config/jobs.js';
import { TEAM_EVENTS, type TeamEvent } from '../../../config/team-events.js';
import { weightedRandom } from '../../../utils/random.js';
import { buildAchievementNotification } from '../../../database/services/achievement.service.js';
import { buildMissionNotification } from '../../../database/services/mission.service.js';
import type { TeamShiftSession } from '../../../games/work/team-shift.session.js';

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

export async function handleStart(interaction: ButtonInteraction, userId: string, parts: string[]): Promise<void> {
  const channelId = parts[2];
  const hostId = parts[3];
  const session = getTeamSession(channelId);

  if (!session || session.status !== 'lobby') {
    await interaction.reply({ content: 'このチームシフトは終了しています。', flags: MessageFlags.Ephemeral });
    return;
  }

  if (userId !== hostId) {
    await interaction.reply({ content: '主催者のみが開始できます。', flags: MessageFlags.Ephemeral });
    return;
  }

  if (session.players.length < 2) {
    await interaction.reply({ content: '最低2人必要です。', flags: MessageFlags.Ephemeral });
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
  let promptsSent = 0;
  for (const player of session.players) {
    try {
      const user = await findOrCreateUser(player.userId);
      const view = buildTeamShiftJobSelectView(player.userId, channelId, user.workLevel);
      await interaction.followUp({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
      });
      promptsSent++;
    } catch (err) {
      logger.error(`Team shift job select followUp failed for ${player.userId}: ${err}`);
    }
  }

  // If no prompts were sent, clean up the stuck session
  if (promptsSent === 0) {
    removeTeamSession(channelId);
    try {
      await interaction.followUp({
        content: '⚠️ ジョブ選択の送信に失敗しました。チームシフトをキャンセルしました。',
      });
    } catch { /* ignore */ }
    return;
  }

  // Set a timeout for job_select — auto-cancel after 2 minutes if not all ready
  setTimeout(() => {
    const current = getTeamSession(channelId);
    if (current && current.status === 'job_select') {
      removeTeamSession(channelId);
      if (interaction.channel && 'send' in interaction.channel) {
        (interaction.channel as any).send({
          content: '⏰ ジョブ選択がタイムアウトしました。チームシフトをキャンセルしました。',
        }).catch(() => {});
      }
    }
  }, 120_000);
}

export async function handleJob(interaction: ButtonInteraction, userId: string, parts: string[]): Promise<void> {
  const ownerId = parts[2];
  const channelId = parts[3];
  const jobId = parts[4];

  if (userId !== ownerId) {
    await interaction.reply({ content: '他のプレイヤーの操作はできません。', flags: MessageFlags.Ephemeral });
    return;
  }

  const session = getTeamSession(channelId);
  if (!session || session.status !== 'job_select') {
    await interaction.reply({ content: 'このチームシフトは終了しています。', flags: MessageFlags.Ephemeral });
    return;
  }

  if (!isPlayerInTeam(channelId, userId)) {
    await interaction.reply({ content: 'このチームシフトに参加していません。', flags: MessageFlags.Ephemeral });
    return;
  }

  const job = JOB_MAP.get(jobId);
  if (!job) {
    await interaction.reply({ content: '無効な職種です。', flags: MessageFlags.Ephemeral });
    return;
  }

  setPlayerJob(channelId, userId, jobId);

  await interaction.update({
    components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`✅ **${job.emoji} ${job.name}** を選択しました！他のメンバーを待っています...`))],
    flags: MessageFlags.IsComponentsV2,
  });

  // Check if all players are ready
  if (allPlayersReady(channelId)) {
    session.status = 'running';
    await runTeamShift(interaction, session);
  }
}

async function runTeamShift(
  interaction: ButtonInteraction,
  session: TeamShiftSession,
): Promise<void> {
  const teamSize = session.players.length;
  const teamBonusPercent = (teamSize - 1) * configService.getNumber(S.teamShiftBonus);

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
