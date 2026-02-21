import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { registerCommand } from '../registry.js';
import { RACE_BETTING_DURATION_MS, RACE_MIN_PLAYERS } from '../../config/constants.js';
import { generateHorses } from '../../games/horse-race/race.horses.js';
import { simulateRace } from '../../games/horse-race/race.engine.js';
import { calculatePayouts } from '../../games/horse-race/race.betting.js';
import {
  getActiveSession,
  setActiveSession,
  removeActiveSession,
  type RaceSessionState,
} from '../../games/horse-race/race.session.js';
import {
  createRaceSession,
  updateRaceStatus,
} from '../../database/repositories/race.repository.js';
import { addChips } from '../../database/services/economy.service.js';
import {
  buildBettingView,
  buildRaceResultView,
  buildRaceCancelledView,
} from '../../ui/builders/horse-race.builder.js';
import { playRaceAnimation } from '../../ui/animations/race.animation.js';
import { logger } from '../../utils/logger.js';

const data = new SlashCommandBuilder()
  .setName('race')
  .setDescription('競馬レースの開始・管理')
  .addSubcommand(sub =>
    sub.setName('start').setDescription('新しいレースを開始'),
  )
  .addSubcommand(sub =>
    sub.setName('close').setDescription('ベットを締め切ってレース開始'),
  )
  .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'start') {
    await handleStart(interaction);
  } else if (subcommand === 'close') {
    await handleClose(interaction);
  }
}

async function handleStart(interaction: ChatInputCommandInteraction): Promise<void> {
  const channelId = interaction.channelId;

  // Check for existing race
  const existing = getActiveSession(channelId);
  if (existing) {
    await interaction.reply({
      content: 'このチャンネルではすでにレースが進行中です！',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Generate horses & create session
  const horses = generateHorses();
  const startsAt = new Date(Date.now() + RACE_BETTING_DURATION_MS);

  const dbSession = await createRaceSession({
    channelId,
    horses: horses.map(h => ({ ...h })),
    startsAt,
  });

  const session: RaceSessionState = {
    id: dbSession.id,
    channelId,
    horses,
    bets: [],
    status: 'betting',
    startsAt: startsAt.getTime(),
  };
  setActiveSession(channelId, session);

  // Show betting view
  const remainingSeconds = Math.ceil(RACE_BETTING_DURATION_MS / 1000);
  const bettingView = buildBettingView(session.id, horses, [], remainingSeconds);

  const reply = await interaction.reply({
    components: [bettingView],
    flags: MessageFlags.IsComponentsV2,
    withResponse: true,
  });

  session.messageId = reply.resource?.message?.id;

  // Start countdown timer
  startBettingCountdown(interaction, session);
}

async function handleClose(interaction: ChatInputCommandInteraction): Promise<void> {
  const channelId = interaction.channelId;
  const session = getActiveSession(channelId);

  if (!session || session.status !== 'betting') {
    await interaction.reply({
      content: 'このチャンネルにはベット受付中のレースがありません。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.reply({
    content: '⏰ ベット締め切り！ レースを開始します...',
    flags: MessageFlags.Ephemeral,
  });

  // Force close
  session.startsAt = Date.now();
  await runRace(interaction, session);
}

function startBettingCountdown(
  interaction: ChatInputCommandInteraction,
  session: RaceSessionState,
): void {
  const updateInterval = 15_000; // update every 15 seconds

  const timer = setInterval(async () => {
    const now = Date.now();
    const remaining = session.startsAt - now;

    if (remaining <= 0 || session.status !== 'betting') {
      clearInterval(timer);
      if (session.status === 'betting') {
        await runRace(interaction, session);
      }
      return;
    }

    // Update betting view with remaining time
    try {
      if (session.messageId) {
        const channel = interaction.channel;
        if (channel && 'messages' in channel) {
          const message = await channel.messages.fetch(session.messageId);
          const remainingSec = Math.ceil(remaining / 1000);
          const view = buildBettingView(session.id, session.horses, session.bets, remainingSec);
          await message.edit({
            components: [view],
            flags: MessageFlags.IsComponentsV2,
          });
        }
      }
    } catch (err) {
      logger.error('Failed to update betting view', { error: String(err) });
    }
  }, updateInterval);
}

async function runRace(
  interaction: ChatInputCommandInteraction,
  session: RaceSessionState,
): Promise<void> {
  const channelId = session.channelId;

  // Check minimum players
  if (session.bets.length < RACE_MIN_PLAYERS) {
    session.status = 'cancelled';
    await updateRaceStatus(session.id, 'CANCELLED');

    // Refund all bets
    for (const bet of session.bets) {
      await addChips(bet.userId, bet.amount, 'WIN', 'HORSE_RACE');
    }

    const cancelView = buildRaceCancelledView(
      `参加者不足（${session.bets.length}/${RACE_MIN_PLAYERS}）。全ベットを返金しました。`,
    );

    try {
      if (session.messageId && interaction.channel && 'messages' in interaction.channel) {
        const message = await interaction.channel.messages.fetch(session.messageId);
        await message.edit({
          components: [cancelView],
          flags: MessageFlags.IsComponentsV2,
        });
      }
    } catch {
      // If edit fails, try to follow up
    }

    removeActiveSession(channelId);
    return;
  }

  // Start race
  session.status = 'running';
  await updateRaceStatus(session.id, 'RUNNING');

  const result = simulateRace(session.horses);

  // Play animation
  try {
    if (session.messageId && interaction.channel && 'messages' in interaction.channel) {
      const message = await interaction.channel.messages.fetch(session.messageId);
      await playRaceAnimation(message, session.horses, result.frames);
    }
  } catch (err) {
    logger.error('Race animation failed', { error: String(err) });
  }

  // Calculate payouts
  const winnerIndex = result.placements[0];
  const payouts = calculatePayouts(session.bets, winnerIndex, session.horses);

  // Process payouts
  for (const p of payouts) {
    await addChips(p.userId, p.payout, 'WIN', 'HORSE_RACE');
  }

  // Mark finished
  session.status = 'finished';
  await updateRaceStatus(
    session.id,
    'FINISHED',
    result.placements.map((idx, rank) => ({
      horseIndex: idx,
      horseName: session.horses[idx].name,
      rank: rank + 1,
    })),
  );

  // Show results
  const resultView = buildRaceResultView(
    session.horses,
    result.placements,
    session.bets,
    payouts,
  );

  try {
    if (session.messageId && interaction.channel && 'messages' in interaction.channel) {
      const message = await interaction.channel.messages.fetch(session.messageId);
      await message.edit({
        components: [resultView],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  } catch (err) {
    logger.error('Failed to show race result', { error: String(err) });
  }

  removeActiveSession(channelId);
}

registerCommand({ data, execute: execute as never });
