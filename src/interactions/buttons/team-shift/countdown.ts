import {MessageFlags} from 'discord.js';
import {logger} from '../../../utils/logger.js';
import {findOrCreateUser} from '../../../database/repositories/user.repository.js';
import type {TeamShiftSession} from '../../../games/work/team-shift.session.js';
import {getTeamSession, removeTeamSession,} from '../../../games/work/team-shift.session.js';
import {buildTeamShiftJobSelectView, buildTeamShiftLobbyView,} from '../../../ui/builders/team-shift.builder.js';

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

              // Send job select prompts to each player
              for (const player of session.players) {
                try {
                  const user = await findOrCreateUser(player.userId);
                  const jobView = buildTeamShiftJobSelectView(player.userId, session.channelId, user.workLevel);
                  await channel.send({
                    components: [jobView],
                    flags: MessageFlags.IsComponentsV2,
                  });
                } catch (err) {
                  logger.error(`Team shift job select send failed for ${player.userId}: ${err}`);
                }
              }
            } catch { /* ignore */ }
          }

          // Set a timeout for job_select — auto-cancel after 2 minutes if not all ready
          setTimeout(() => {
            const current = getTeamSession(session.channelId);
            if (current && current.status === 'job_select') {
              removeTeamSession(session.channelId);
              channel.send({
                content: '⏰ ジョブ選択がタイムアウトしました。チームシフトをキャンセルしました。',
              }).catch(() => {});
            }
          }, 120_000);
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
