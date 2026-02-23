import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type TextBasedChannel,
  MessageFlags,
} from 'discord.js';
import { registerCommand } from '../registry.js';
import {
  HEIST_GROUP_MIN_PLAYERS,
} from '../../config/constants.js';
import { configService } from '../../config/config.service.js';
import { S } from '../../config/setting-defs.js';
import { findOrCreateUser } from '../../database/repositories/user.repository.js';
import { addChips } from '../../database/services/economy.service.js';
import { incrementGameStats } from '../../database/repositories/user.repository.js';
import { calculateHeistOutcome, type HeistCalcParams } from '../../games/heist/heist.engine.js';
import {
  getActiveHeistSession,
  removeActiveHeistSession,
  type HeistSessionState,
} from '../../games/heist/heist.session.js';
import {
  buildHeistLobbyView,
  buildHeistResultView,
  buildHeistCancelledView,
  buildHeistTargetSelectView,
} from '../../ui/builders/heist.builder.js';
import { playHeistAnimation } from '../../ui/animations/heist.animation.js';
import { formatChips } from '../../utils/formatters.js';
import { isOnCooldown, setCooldown, getRemainingCooldown } from '../../utils/cooldown.js';
import { formatTimeDelta } from '../../utils/formatters.js';
import { logger } from '../../utils/logger.js';
import { checkAchievements, buildAchievementNotification } from '../../database/services/achievement.service.js';
import { jailUser } from '../../games/prison/prison.session.js';
import { HEIST_TARGET_MAP } from '../../config/heist.js';
import { hasInventoryItem, consumeInventoryItem } from '../../database/services/shop.service.js';

const data = new SlashCommandBuilder()
  .setName('heist')
  .setDescription('強盗ミッションを開始する')
  .addIntegerOption(option =>
    option
      .setName('amount')
      .setDescription('参加費')
      .setRequired(true)
      .setMinValue(Number(S.heistMinEntry.defaultValue))
      .setMaxValue(300_000),
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

  // Show target selection (ephemeral)
  const view = buildHeistTargetSelectView(userId, entryFee);
  await interaction.reply({
    components: [view],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

export function startLobbyCountdown(
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

  // Check minimum players for group mode
  if (!session.isSolo && session.players.length < HEIST_GROUP_MIN_PLAYERS) {
    session.status = 'cancelled';

    // Refund all players
    for (const p of session.players) {
      await addChips(p.userId, session.entryFee, 'HEIST_WIN', 'HEIST');
    }

    const cancelView = buildHeistCancelledView(
      `参加者不足（${session.players.length}/${HEIST_GROUP_MIN_PLAYERS}）。全員に返金しました。`,
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

  // Check if host has HEIST_INTEL item
  const hostId = session.players[0].userId;
  const hostHasIntel = await hasInventoryItem(hostId, 'HEIST_INTEL');

  const params: HeistCalcParams = {
    playerCount: session.players.length,
    target: session.target,
    riskLevel: session.riskLevel,
    approach: session.approach,
    isSolo: session.isSolo,
    hasHeistIntel: hostHasIntel,
  };
  const outcome = calculateHeistOutcome(params);

  // Consume HEIST_INTEL after use
  if (hostHasIntel) {
    await consumeInventoryItem(hostId, 'HEIST_INTEL');
  }

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
  let arrested = false;
  if (outcome.success) {
    const multiplierInt = Math.round(outcome.multiplier * 1_000_000);
    const payout = (session.entryFee * BigInt(multiplierInt)) / 1_000_000n;

    for (const p of session.players) {
      await addChips(p.userId, payout, 'HEIST_WIN', 'HEIST');
      const net = payout - session.entryFee;
      await incrementGameStats(p.userId, net > 0n ? net : 0n, 0n);
    }
  } else {
    // Failed: arrest all players
    arrested = true;
    const targetDef = HEIST_TARGET_MAP.get(session.target)!;
    for (const p of session.players) {
      await incrementGameStats(p.userId, 0n, session.entryFee);
      jailUser(p.userId, configService.getBigInt(S.prisonFine), targetDef.name);
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
    session.target,
    arrested,
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

  // Notify HEIST_INTEL usage
  if (hostHasIntel && channel && 'send' in channel) {
    try {
      await channel.send({
        content: `🕵️ <@${hostId}> の**強盗情報**を使用！(成功率+15%)`,
      });
    } catch {
      // ignore
    }
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
  setCooldown(`heist:${session.channelId}`, configService.getNumber(S.heistChannelCD));

  removeActiveHeistSession(session.channelId);
}

registerCommand({ data, execute: execute as never });
