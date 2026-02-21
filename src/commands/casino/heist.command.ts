import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type TextBasedChannel,
  MessageFlags,
} from 'discord.js';
import { registerCommand } from '../registry.js';
import {
  HEIST_MIN_ENTRY,
  HEIST_MAX_ENTRY,
  HEIST_MIN_PLAYERS,
  HEIST_LOBBY_DURATION_MS,
  HEIST_CHANNEL_COOLDOWN_MS,
} from '../../config/constants.js';
import { findOrCreateUser } from '../../database/repositories/user.repository.js';
import { removeChips, addChips } from '../../database/services/economy.service.js';
import { incrementGameStats } from '../../database/repositories/user.repository.js';
import { calculateHeistOutcome } from '../../games/heist/heist.engine.js';
import {
  getActiveHeistSession,
  setActiveHeistSession,
  removeActiveHeistSession,
  type HeistSessionState,
} from '../../games/heist/heist.session.js';
import {
  buildHeistLobbyView,
  buildHeistResultView,
  buildHeistCancelledView,
} from '../../ui/builders/heist.builder.js';
import { playHeistAnimation } from '../../ui/animations/heist.animation.js';
import { formatChips } from '../../utils/formatters.js';
import { isOnCooldown, setCooldown, getRemainingCooldown } from '../../utils/cooldown.js';
import { formatTimeDelta } from '../../utils/formatters.js';
import { logger } from '../../utils/logger.js';
import { checkAchievements, buildAchievementNotification } from '../../database/services/achievement.service.js';

const data = new SlashCommandBuilder()
  .setName('heist')
  .setDescription('強盗ミッションを開始する')
  .addIntegerOption(option =>
    option
      .setName('amount')
      .setDescription('参加費')
      .setRequired(true)
      .setMinValue(Number(HEIST_MIN_ENTRY))
      .setMaxValue(Number(HEIST_MAX_ENTRY)),
  )
  .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const channelId = interaction.channelId;
  const userId = interaction.user.id;

  // Check channel cooldown
  const cooldownKey = `heist:${channelId}`;
  if (isOnCooldown(cooldownKey)) {
    const remaining = getRemainingCooldown(cooldownKey);
    await interaction.reply({
      content: `このチャンネルのヘイストクールダウン中です。**${formatTimeDelta(remaining)}** 後に再度お試しください。`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Check existing session
  const existing = getActiveHeistSession(channelId);
  if (existing) {
    await interaction.reply({
      content: 'このチャンネルではすでにヘイストが進行中です！',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const entryFee = BigInt(interaction.options.getInteger('amount', true));

  // Check balance
  const user = await findOrCreateUser(userId);
  if (user.chips < entryFee) {
    await interaction.reply({
      content: `チップが不足しています！ 残高: ${formatChips(user.chips)}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Deduct chips from host
  await removeChips(userId, entryFee, 'HEIST_JOIN', 'HEIST');

  // Create session
  const session: HeistSessionState = {
    channelId,
    hostId: userId,
    players: [{ userId, isHost: true }],
    status: 'waiting',
    lobbyDeadline: Date.now() + HEIST_LOBBY_DURATION_MS,
    entryFee,
  };

  setActiveHeistSession(channelId, session);

  // Show lobby
  const remainingSeconds = Math.ceil(HEIST_LOBBY_DURATION_MS / 1000);
  const lobbyView = buildHeistLobbyView(session, remainingSeconds);

  const reply = await interaction.reply({
    components: [lobbyView],
    flags: MessageFlags.IsComponentsV2,
    withResponse: true,
  });

  session.messageId = reply.resource?.message?.id;

  // Start lobby countdown
  startLobbyCountdown(interaction.channel, session);
}

function startLobbyCountdown(
  channel: TextBasedChannel | null,
  session: HeistSessionState,
): void {
  const updateInterval = 15_000;

  session.lobbyTimer = setInterval(async () => {
    const remaining = session.lobbyDeadline - Date.now();

    if (remaining <= 0 || session.status !== 'waiting') {
      if (session.lobbyTimer) clearInterval(session.lobbyTimer);
      if (session.status === 'waiting') {
        await runHeist(channel, session);
      }
      return;
    }

    try {
      if (session.messageId && channel && 'messages' in channel) {
        const remainingSec = Math.ceil(remaining / 1000);
        const view = buildHeistLobbyView(session, remainingSec);
        await channel.messages.edit(session.messageId, {
          components: [view],
          flags: MessageFlags.IsComponentsV2,
        });
      }
    } catch (err) {
      logger.error('Failed to update heist lobby', { error: String(err) });
    }
  }, updateInterval);
}

export async function runHeist(
  channel: TextBasedChannel | null,
  session: HeistSessionState,
): Promise<void> {
  if (session.lobbyTimer) clearInterval(session.lobbyTimer);

  // Check minimum players
  if (session.players.length < HEIST_MIN_PLAYERS) {
    session.status = 'cancelled';

    // Refund all players
    for (const p of session.players) {
      await addChips(p.userId, session.entryFee, 'HEIST_WIN', 'HEIST');
    }

    const cancelView = buildHeistCancelledView(
      `参加者不足（${session.players.length}/${HEIST_MIN_PLAYERS}）。全員に返金しました。`,
    );

    try {
      if (session.messageId && channel && 'messages' in channel) {
        await channel.messages.edit(session.messageId, {
          components: [cancelView],
          flags: MessageFlags.IsComponentsV2,
        });
      }
    } catch {
      // ignore
    }

    removeActiveHeistSession(session.channelId);
    return;
  }

  // Run heist
  session.status = 'running';
  const outcome = calculateHeistOutcome(session.players.length);

  // Play animation
  try {
    if (session.messageId && channel && 'messages' in channel) {
      const message = await channel.messages.fetch(session.messageId);
      await playHeistAnimation(message, outcome.phaseResults);
    }
  } catch (err) {
    logger.error('Heist animation failed', { error: String(err) });
  }

  // Process result
  if (outcome.success) {
    const multiplierInt = Math.round(outcome.multiplier * 1_000_000);
    const payout = (session.entryFee * BigInt(multiplierInt)) / 1_000_000n;

    for (const p of session.players) {
      await addChips(p.userId, payout, 'HEIST_WIN', 'HEIST');
      const net = payout - session.entryFee;
      await incrementGameStats(p.userId, net > 0n ? net : 0n, 0n);
    }
  } else {
    for (const p of session.players) {
      // Record as HEIST_LOSS (chips already deducted at join)
      await incrementGameStats(p.userId, 0n, session.entryFee);
    }
  }

  session.status = 'finished';

  // Show result
  const resultView = buildHeistResultView(
    outcome.success,
    outcome.phaseResults,
    session.players,
    session.entryFee,
    outcome.multiplier,
  );

  try {
    if (session.messageId && channel && 'messages' in channel) {
      await channel.messages.edit(session.messageId, {
        components: [resultView],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  } catch (err) {
    logger.error('Failed to show heist result', { error: String(err) });
  }

  // Achievement checks for all players
  for (const p of session.players) {
    try {
      const heistAchievements = await checkAchievements({
        userId: p.userId,
        context: 'heist',
      });
      const multiplayerAchievements = await checkAchievements({
        userId: p.userId,
        context: 'multiplayer',
      });
      const allAchievements = [...heistAchievements, ...multiplayerAchievements];

      if (allAchievements.length > 0 && channel && 'send' in channel) {
        await channel.send({
          content: `<@${p.userId}> ${buildAchievementNotification(allAchievements)}`,
        });
      }
    } catch {
      // Achievement notification should not block
    }
  }

  // Set channel cooldown
  setCooldown(`heist:${session.channelId}`, HEIST_CHANNEL_COOLDOWN_MS);

  removeActiveHeistSession(session.channelId);
}

registerCommand({ data, execute: execute as never });
