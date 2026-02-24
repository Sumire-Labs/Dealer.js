import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type TextBasedChannel,
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
import { getBankruptcyPenaltyMultiplier, applyPenalty } from '../../database/services/loan.service.js';
import { incrementGameStats } from '../../database/repositories/user.repository.js';
import {
  buildBettingView,
  buildRaceResultView,
  buildRaceCancelledView,
} from '../../ui/builders/horse-race.builder.js';
import { playRaceAnimation } from '../../ui/animations/race.animation.js';
import { logger } from '../../utils/logger.js';

const data = new SlashCommandBuilder()
  .setName('race')
  .setDescription('競馬レースを開始する')
  .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await handleStart(interaction);
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
    ownerId: interaction.user.id,
    horses,
    bets: [],
    status: 'betting',
    startsAt: startsAt.getTime(),
  };
  setActiveSession(channelId, session);

  // Show betting view
  const remainingSeconds = Math.ceil(RACE_BETTING_DURATION_MS / 1000);
  const bettingView = buildBettingView(session.id, horses, [], remainingSeconds, session.ownerId);

  const reply = await interaction.reply({
    components: [bettingView],
    flags: MessageFlags.IsComponentsV2,
    withResponse: true,
  });

  session.messageId = reply.resource?.message?.id;

  // Start countdown timer
  startBettingCountdown(interaction.channel, session);
}

function startBettingCountdown(
  channel: TextBasedChannel | null,
  session: RaceSessionState,
): void {
  const updateInterval = 15_000; // update every 15 seconds

  const timer = setInterval(async () => {
    const now = Date.now();
    const remaining = session.startsAt - now;

    if (remaining <= 0 || session.status !== 'betting') {
      clearInterval(timer);
      if (session.status === 'betting') {
        await runRace(channel, session);
      }
      return;
    }

    // Update betting view with remaining time
    try {
      if (session.messageId && channel && 'messages' in channel) {
        const remainingSec = Math.ceil(remaining / 1000);
        const view = buildBettingView(session.id, session.horses, session.bets, remainingSec, session.ownerId);
        await channel.messages.edit(session.messageId, {
          components: [view],
          flags: MessageFlags.IsComponentsV2,
        });
      }
    } catch (err) {
      logger.error('Failed to update betting view', { error: String(err) });
    }
  }, updateInterval);
}

export async function runRace(
  channel: TextBasedChannel | null,
  session: RaceSessionState,
): Promise<void> {
  const channelId = session.channelId;

  try {
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
        if (session.messageId && channel && 'messages' in channel) {
          await channel.messages.edit(session.messageId, {
            components: [cancelView],
            flags: MessageFlags.IsComponentsV2,
          });
        }
      } catch {
        // If edit fails, ignore
      }

      return;
    }

    // Start race
    session.status = 'running';
    await updateRaceStatus(session.id, 'RUNNING');

    const result = simulateRace(session.horses);

    // Play animation
    try {
      if (session.messageId && channel && 'messages' in channel) {
        const message = await channel.messages.fetch(session.messageId);
        await playRaceAnimation(message, session.horses, result.frames);
      }
    } catch (err) {
      logger.error('Race animation failed', { error: String(err) });
    }

    // Calculate payouts
    const winnerIndex = result.placements[0];
    const payouts = calculatePayouts(session.bets, winnerIndex, session.horses);

    // Cache penalty multipliers to avoid duplicate DB queries per user
    const penaltyCache = new Map<string, number>();
    const getCachedPenalty = async (userId: string): Promise<number> => {
      const cached = penaltyCache.get(userId);
      if (cached !== undefined) return cached;
      const multiplier = await getBankruptcyPenaltyMultiplier(userId);
      penaltyCache.set(userId, multiplier);
      return multiplier;
    };

    // Process payouts with bankruptcy penalty
    for (const p of payouts) {
      let payout = p.payout;
      const bet = session.bets.find(b => b.userId === p.userId);
      const betAmount = bet ? bet.amount : 0n;
      if (payout > betAmount) {
        const penaltyMultiplier = await getCachedPenalty(p.userId);
        if (penaltyMultiplier < 1.0) {
          const winnings = payout - betAmount;
          payout = betAmount + applyPenalty(winnings, penaltyMultiplier);
        }
      }
      await addChips(p.userId, payout, 'WIN', 'HORSE_RACE');
    }

    // Update game stats for all bettors
    for (const bet of session.bets) {
      const payoutEntry = payouts.find(p => p.userId === bet.userId);
      if (payoutEntry) {
        let payout = payoutEntry.payout;
        if (payout > bet.amount) {
          const penaltyMultiplier = await getCachedPenalty(bet.userId);
          if (penaltyMultiplier < 1.0) {
            const winnings = payout - bet.amount;
            payout = bet.amount + applyPenalty(winnings, penaltyMultiplier);
          }
        }
        const profit = payout - bet.amount;
        await incrementGameStats(bet.userId, profit > 0n ? profit : 0n, profit < 0n ? -profit : 0n);
      } else {
        await incrementGameStats(bet.userId, 0n, bet.amount);
      }
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
      if (session.messageId && channel && 'messages' in channel) {
        await channel.messages.edit(session.messageId, {
          components: [resultView],
          flags: MessageFlags.IsComponentsV2,
        });
      }
    } catch (err) {
      logger.error('Failed to show race result', { error: String(err) });
    }
  } finally {
    removeActiveSession(channelId);
  }
}

registerCommand({ data, execute: execute as never });
