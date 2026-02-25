import {type ButtonInteraction, ContainerBuilder, MessageFlags, TextDisplayBuilder,} from 'discord.js';
import type {TeamShiftSession} from '../../../games/work/team-shift.session.js';
import {
    addPlayerToTeam,
    getTeamSession,
    isPlayerInTeam,
    removeTeamSession,
    setTeamSession,
} from '../../../games/work/team-shift.session.js';
import {buildTeamShiftLobbyView} from '../../../ui/builders/team-shift.builder.js';
import {TEAM_SHIFT_MAX_PLAYERS} from '../../../config/constants.js';
import {startTeamLobbyCountdown} from './countdown.js';

export async function handleCreate(interaction: ButtonInteraction, userId: string, parts: string[]): Promise<void> {
  const ownerId = parts[2];
  const shiftType = parts[3] as import('../../../config/jobs.js').ShiftType;

  if (userId !== ownerId) {
    await interaction.reply({ content: '`/work` で自分のワークパネルを開いてください。', flags: MessageFlags.Ephemeral });
    return;
  }

  const channelId = interaction.channelId;
  const existing = getTeamSession(channelId);
  if (existing) {
    await interaction.reply({ content: 'このチャンネルではすでにチームシフトが進行中です！', flags: MessageFlags.Ephemeral });
    return;
  }

  const { TEAM_SHIFT_LOBBY_DURATION_MS } = await import('../../../config/constants.js');

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
    components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent('✅ チームシフトロビーを作成しました！'))],
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
}

export async function handleJoin(interaction: ButtonInteraction, userId: string, parts: string[]): Promise<void> {
  const channelId = parts[2];
  const session = getTeamSession(channelId);

  if (!session || session.status !== 'lobby') {
    await interaction.reply({ content: 'このチームシフトは終了しています。', flags: MessageFlags.Ephemeral });
    return;
  }

  if (isPlayerInTeam(channelId, userId)) {
    await interaction.reply({ content: 'すでに参加しています！', flags: MessageFlags.Ephemeral });
    return;
  }

  if (session.players.length >= TEAM_SHIFT_MAX_PLAYERS) {
    await interaction.reply({ content: '参加者が上限に達しています。', flags: MessageFlags.Ephemeral });
    return;
  }

  addPlayerToTeam(channelId, userId);

  const remaining = Math.max(0, Math.ceil((session.lobbyDeadline - Date.now()) / 1000));
  const view = buildTeamShiftLobbyView(session, remaining);
  await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
}

export async function handleCancel(interaction: ButtonInteraction, userId: string, parts: string[]): Promise<void> {
  const channelId = parts[2];
  const hostId = parts[3];
  const session = getTeamSession(channelId);

  if (!session) {
    await interaction.reply({ content: 'このチームシフトは終了しています。', flags: MessageFlags.Ephemeral });
    return;
  }

  if (userId !== hostId) {
    await interaction.reply({ content: '主催者のみが解散できます。', flags: MessageFlags.Ephemeral });
    return;
  }

  removeTeamSession(channelId);

  await interaction.update({
    components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent('❌ チームシフトが解散されました。'))],
    flags: MessageFlags.IsComponentsV2,
  });
}
