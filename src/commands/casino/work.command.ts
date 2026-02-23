import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { registerCommand } from '../registry.js';
import { getWorkPanelData } from '../../database/services/work.service.js';
import { buildWorkPanelView } from '../../ui/builders/work.builder.js';
import { buildTeamShiftLobbyView } from '../../ui/builders/team-shift.builder.js';
import {
  getTeamSession,
  setTeamSession,
  type TeamShiftSession,
} from '../../games/work/team-shift.session.js';
import { TEAM_SHIFT_LOBBY_DURATION_MS } from '../../config/constants.js';
import type { ShiftType } from '../../config/jobs.js';
import { startTeamLobbyCountdown } from '../../interactions/buttons/team-shift.buttons.js';

const data = new SlashCommandBuilder()
  .setName('work')
  .setDescription('カジノ従業員として働いてチップを稼ぐ')
  .addSubcommand(sub =>
    sub
      .setName('solo')
      .setDescription('ソロでワークパネルを開く'),
  )
  .addSubcommand(sub =>
    sub
      .setName('team')
      .setDescription('チームシフトを開始する')
      .addStringOption(opt =>
        opt
          .setName('shift')
          .setDescription('シフトタイプ')
          .setRequired(true)
          .addChoices(
            { name: '⚡ 短時間', value: 'short' },
            { name: '📋 通常', value: 'normal' },
            { name: '💪 長時間', value: 'long' },
          ),
      ),
  )
  .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  const subcommand = interaction.options.getSubcommand(false);

  if (subcommand === 'team') {
    await handleTeamCommand(interaction);
    return;
  }

  // Default: solo panel
  const panelData = await getWorkPanelData(userId);

  let weeklyChallenges: { name: string; progress: number; target: number; completed: boolean }[] = [];
  try {
    const { getWeeklyChallenges } = await import('../../database/services/weekly-challenge.service.js');
    const { WEEKLY_CHALLENGE_POOL } = await import('../../config/weekly-challenges.js');
    const challenges = await getWeeklyChallenges(userId);
    weeklyChallenges = challenges.map(c => {
      const def = WEEKLY_CHALLENGE_POOL.find(p => p.key === c.challengeKey);
      return {
        name: def?.name ?? c.challengeKey,
        progress: c.progress,
        target: c.target,
        completed: c.completed,
      };
    });
  } catch { /* ignore */ }

  const view = buildWorkPanelView({
    userId,
    workLevel: panelData.workLevel,
    workXp: panelData.workXp,
    workStreak: panelData.workStreak,
    lastWorkAt: panelData.lastWorkAt,
    xpForNextLevel: panelData.xpForNextLevel,
    masteries: panelData.masteries,
    weeklyChallenges,
  });

  await interaction.reply({
    components: [view],
    flags: MessageFlags.IsComponentsV2,
  });
}

async function handleTeamCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  const channelId = interaction.channelId;
  const shiftType = interaction.options.getString('shift', true) as ShiftType;

  // Check for existing session
  const existing = getTeamSession(channelId);
  if (existing) {
    await interaction.reply({
      content: 'このチャンネルではすでにチームシフトが進行中です！',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Create session
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

  const msg = await interaction.reply({
    components: [lobbyView],
    flags: MessageFlags.IsComponentsV2,
    fetchReply: true,
  });
  session.messageId = msg.id;

  // Start countdown
  if (interaction.channel) {
    startTeamLobbyCountdown(interaction.channel as any, session);
  }
}

registerCommand({ data, execute: execute as never });
