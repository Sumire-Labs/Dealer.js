import {type ButtonInteraction, MessageFlags, type TextBasedChannel,} from 'discord.js';
import {registerButtonHandler} from '../handler.js';
import {
  addPlayerToTable,
  type BlackjackTableSession,
  getActiveTableSession,
  hasPlayerInTable,
  removeActiveTableSession,
} from '../../games/blackjack/blackjack-table.session.js';
import {
  advanceTableTurn,
  calculatePlayerPayout,
  initializeTable,
  isPlayerDone,
  tableDoubleDown,
  tableHit,
  tableInsurance,
  tableSplit,
  tableStand,
} from '../../games/blackjack/blackjack-table.engine.js';
import {
  buildBjTableCancelledView,
  buildBjTableLobbyView,
  buildBjTablePlayingView,
  buildBjTableResultView,
} from '../../ui/builders/blackjack-table.builder.js';
import {findOrCreateUser, incrementGameStats} from '../../database/repositories/user.repository.js';
import {addChips, removeChips} from '../../database/services/economy.service.js';
import {applyPenalty, getBankruptcyPenaltyMultiplier} from '../../database/services/loan.service.js';
import {formatChips} from '../../utils/formatters.js';
import {buildMissionNotification, updateMissionProgress} from '../../database/services/mission.service.js';
import {BJ_TABLE_MAX_PLAYERS, BJ_TABLE_MIN_PLAYERS, BJ_TABLE_TURN_TIMEOUT_MS,} from '../../config/constants.js';
import {logger} from '../../utils/logger.js';

// ─── Main handler ──────────────────────────────────────

async function handleBjTableButton(interaction: ButtonInteraction): Promise<void> {
    const parts = interaction.customId.split(':');
    const action = parts[1];
    const channelId = parts[2];
    const userId = interaction.user.id;

    const session = getActiveTableSession(channelId);

    switch (action) {
        case 'join':
            await handleJoin(interaction, session, channelId, userId);
            break;
        case 'start':
            await handleStart(interaction, session, channelId, parts[3], userId);
            break;
        case 'hit':
        case 'stand':
        case 'double':
        case 'split':
        case 'insurance':
            await handleGameAction(interaction, session, channelId, action, parts[3]);
            break;
    }
}

// ─── Lobby handlers ────────────────────────────────────

async function handleJoin(
    interaction: ButtonInteraction,
    session: BlackjackTableSession | undefined,
    channelId: string,
    userId: string,
): Promise<void> {
    if (!session || session.phase !== 'waiting') {
        await interaction.reply({
            content: 'このテーブルは終了しています。',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (hasPlayerInTable(channelId, userId)) {
        await interaction.reply({
            content: 'すでに参加しています！',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (session.players.length >= BJ_TABLE_MAX_PLAYERS) {
        await interaction.reply({
            content: `満席です（最大${BJ_TABLE_MAX_PLAYERS}人）。`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Check balance
    const user = await findOrCreateUser(userId);
    if (user.chips < session.bet) {
        await interaction.reply({
            content: `チップが不足しています！ 必要: ${formatChips(session.bet)} / 残高: ${formatChips(user.chips)}`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Deduct bet
    await removeChips(userId, session.bet, 'LOSS', 'BLACKJACK');

    // Add player
    const displayName = interaction.user.displayName;
    addPlayerToTable(channelId, userId, displayName, session.bet);

    // Update lobby view
    const remaining = Math.max(0, Math.ceil((session.lobbyDeadline - Date.now()) / 1000));
    const view = buildBjTableLobbyView(session, remaining);
    await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
    });
}

async function handleStart(
    interaction: ButtonInteraction,
    session: BlackjackTableSession | undefined,
    _channelId: string,
    hostId: string,
    userId: string,
): Promise<void> {
    if (!session || session.phase !== 'waiting') {
        await interaction.reply({
            content: 'このテーブルは終了しています。',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (userId !== hostId) {
        await interaction.reply({
            content: 'ゲーム開始はホストのみ行えます。',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Force lobby to end
    session.lobbyDeadline = Date.now();
    if (session.lobbyTimer) clearInterval(session.lobbyTimer);

    await interaction.deferUpdate();
    await tryStartTable(interaction.channel, session);
}

// ─── Game action handler ───────────────────────────────

async function handleGameAction(
    interaction: ButtonInteraction,
    session: BlackjackTableSession | undefined,
    _channelId: string,
    action: string,
    targetUserId: string,
): Promise<void> {
    const userId = interaction.user.id;

    if (!session || session.phase !== 'playing') {
        await interaction.reply({
            content: 'ゲームが進行していません。',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (userId !== targetUserId) {
        await interaction.reply({
            content: 'あなたのターンではありません。',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const currentPlayer = session.players[session.currentPlayerIndex];
    if (!currentPlayer || currentPlayer.userId !== userId) {
        await interaction.reply({
            content: 'あなたのターンではありません。',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    switch (action) {
        case 'hit':
            tableHit(session, currentPlayer);
            break;

        case 'stand':
            tableStand(session, currentPlayer);
            break;

        case 'double': {
            const hand = currentPlayer.hands[currentPlayer.activeHandIndex];
            try {
                await removeChips(userId, hand.bet, 'LOSS', 'BLACKJACK');
            } catch {
                await interaction.reply({
                    content: `ダブルに必要なチップが足りません！ 必要: ${formatChips(hand.bet)}`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }
            tableDoubleDown(session, currentPlayer);
            break;
        }

        case 'split': {
            const hand = currentPlayer.hands[currentPlayer.activeHandIndex];
            try {
                await removeChips(userId, hand.bet, 'LOSS', 'BLACKJACK');
            } catch {
                await interaction.reply({
                    content: `スプリットに必要なチップが足りません！ 必要: ${formatChips(hand.bet)}`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }
            tableSplit(session, currentPlayer);
            break;
        }

        case 'insurance': {
            const insBet = currentPlayer.hands[0].bet / 2n;
            try {
                await removeChips(userId, insBet, 'LOSS', 'BLACKJACK');
            } catch {
                await interaction.reply({
                    content: `インシュランスに必要なチップが足りません！ 必要: ${formatChips(insBet)}`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }
            tableInsurance(currentPlayer);
            break;
        }

        default:
            return;
    }

    // Clear turn timer
    if (session.turnTimer) clearTimeout(session.turnTimer);

    // Check if current player is done and advance turn
    if (isPlayerDone(currentPlayer)) {
        const resolved = advanceTableTurn(session);
        if (resolved) {
            await interaction.deferUpdate();
            await handleTableResolution(interaction.channel, session);
            return;
        }
    }

    // Update table view and restart turn timer
    startTableTurnTimer(interaction.channel, session);
    await updateTableMessage(interaction, session);
}

// ─── Lobby countdown ───────────────────────────────────

export function startBjTableLobbyCountdown(
    channel: TextBasedChannel | null,
    session: BlackjackTableSession,
): void {
    const updateInterval = 15_000;

    session.lobbyTimer = setInterval(async () => {
        const now = Date.now();
        const remaining = session.lobbyDeadline - now;

        if (remaining <= 0 || session.phase !== 'waiting') {
            if (session.lobbyTimer) clearInterval(session.lobbyTimer);
            if (session.phase === 'waiting') {
                await tryStartTable(channel, session);
            }
            return;
        }

        try {
            if (session.messageId && channel && 'messages' in channel) {
                const remainingSec = Math.ceil(remaining / 1000);
                const view = buildBjTableLobbyView(session, remainingSec);
                await channel.messages.edit(session.messageId, {
                    components: [view],
                    flags: MessageFlags.IsComponentsV2,
                });
            }
        } catch (err) {
            logger.error('Failed to update BJ table lobby', {error: String(err)});
        }
    }, updateInterval);
}

// ─── Start table ───────────────────────────────────────

async function tryStartTable(
    channel: TextBasedChannel | null,
    session: BlackjackTableSession,
): Promise<void> {
    if (session.lobbyTimer) clearInterval(session.lobbyTimer);

    if (session.players.length < BJ_TABLE_MIN_PLAYERS) {
        session.phase = 'cancelled';

        // Refund all bets
        for (const p of session.players) {
            await addChips(p.userId, p.bet, 'WIN', 'BLACKJACK');
        }

        const cancelView = buildBjTableCancelledView(
            `参加者不足（${session.players.length}/${BJ_TABLE_MIN_PLAYERS}）。全ベットを返金しました。`,
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

        removeActiveTableSession(session.channelId);
        return;
    }

    // Initialize the game
    initializeTable(session);

    // If immediately resolved (all natural BJs), handle resolution
    if (session.phase === 'resolved') {
        await handleTableResolution(channel, session);
        return;
    }

    // Start turn timer and show table
    startTableTurnTimer(channel, session);

    try {
        if (session.messageId && channel && 'messages' in channel) {
            const view = buildBjTablePlayingView(session);
            await channel.messages.edit(session.messageId, {
                components: [view],
                flags: MessageFlags.IsComponentsV2,
            });
        }
    } catch (err) {
        logger.error('Failed to show BJ table playing view', {error: String(err)});
    }
}

// ─── Turn timer ────────────────────────────────────────

function startTableTurnTimer(
    channel: TextBasedChannel | null,
    session: BlackjackTableSession,
): void {
    if (session.turnTimer) clearTimeout(session.turnTimer);

    session.turnDeadline = Date.now() + BJ_TABLE_TURN_TIMEOUT_MS;

    session.turnTimer = setTimeout(async () => {
        try {
            const player = session.players[session.currentPlayerIndex];
            if (player && !player.done && session.phase === 'playing') {
                // Auto-stand on timeout
                for (const hand of player.hands) {
                    hand.stood = true;
                }
                player.done = true;

                const resolved = advanceTableTurn(session);
                if (resolved) {
                    await handleTableResolution(channel, session);
                    return;
                }

                // Next player's turn
                startTableTurnTimer(channel, session);

                try {
                    if (session.messageId && channel && 'messages' in channel) {
                        const view = buildBjTablePlayingView(session);
                        await channel.messages.edit(session.messageId, {
                            components: [view],
                            flags: MessageFlags.IsComponentsV2,
                        });
                    }
                } catch (err) {
                    logger.error('Failed to update BJ table after timeout', {error: String(err)});
                }
            }
        } catch (err) {
            logger.error('BJ table turn timer failed', {error: String(err)});
            removeActiveTableSession(session.channelId);
        }
    }, BJ_TABLE_TURN_TIMEOUT_MS);
}

// ─── Update table message ──────────────────────────────

async function updateTableMessage(
    interaction: ButtonInteraction,
    session: BlackjackTableSession,
): Promise<void> {
    const view = buildBjTablePlayingView(session);

    // If the interaction is on the table message, use update; otherwise edit
    if (interaction.message.id === session.messageId) {
        await interaction.update({
            components: [view],
            flags: MessageFlags.IsComponentsV2,
        });
    } else {
        await interaction.deferUpdate();
        try {
            const channel = interaction.channel;
            if (session.messageId && channel && 'messages' in channel) {
                await channel.messages.edit(session.messageId, {
                    components: [view],
                    flags: MessageFlags.IsComponentsV2,
                });
            }
        } catch (err) {
            logger.error('Failed to update BJ table message', {error: String(err)});
        }
    }
}

// ─── Resolution ────────────────────────────────────────

async function handleTableResolution(
    channel: TextBasedChannel | null,
    session: BlackjackTableSession,
): Promise<void> {
    try {
        // Cache penalty multipliers
        const penaltyCache = new Map<string, number>();
        const getCachedPenalty = async (userId: string): Promise<number> => {
            const cached = penaltyCache.get(userId);
            if (cached !== undefined) return cached;
            const multiplier = await getBankruptcyPenaltyMultiplier(userId);
            penaltyCache.set(userId, multiplier);
            return multiplier;
        };

        const playerNets = new Map<string, bigint>();

        // Process each player's payout
        for (const player of session.players) {
            const result = calculatePlayerPayout(player);
            let {totalPayout, net} = result;

            // Apply bankruptcy penalty
            if (totalPayout > 0n) {
                const penaltyMultiplier = await getCachedPenalty(player.userId);
                if (penaltyMultiplier < 1.0) {
                    totalPayout = applyPenalty(totalPayout, penaltyMultiplier);
                    net = totalPayout - result.totalBet;
                }
            }

            playerNets.set(player.userId, net);

            // Add payout
            if (totalPayout > 0n) {
                await addChips(player.userId, totalPayout, 'WIN', 'BLACKJACK');
            }

            // Update game stats
            const won = net > 0n ? net : 0n;
            const lost = net < 0n ? -net : 0n;
            await incrementGameStats(player.userId, won, lost);
        }

        // Show result view
        const resultView = buildBjTableResultView(session, playerNets);

        try {
            if (session.messageId && channel && 'messages' in channel) {
                await channel.messages.edit(session.messageId, {
                    components: [resultView],
                    flags: MessageFlags.IsComponentsV2,
                });
            }
        } catch (err) {
            logger.error('Failed to show BJ table result', {error: String(err)});
        }

        // Mission hooks for each player
        for (const player of session.players) {
            try {
                const net = playerNets.get(player.userId) ?? 0n;
                const result = calculatePlayerPayout(player);
                const allCompleted = [];

                const playResults = await updateMissionProgress(player.userId, {
                    type: 'game_play',
                    gameType: 'BLACKJACK'
                });
                allCompleted.push(...playResults);

                if (net > 0n) {
                    const winResults = await updateMissionProgress(player.userId, {
                        type: 'game_win',
                        gameType: 'BLACKJACK'
                    });
                    allCompleted.push(...winResults);
                    const earnResults = await updateMissionProgress(player.userId, {
                        type: 'chips_earned',
                        amount: Number(net)
                    });
                    allCompleted.push(...earnResults);
                }

                const betResults = await updateMissionProgress(player.userId, {
                    type: 'chips_bet',
                    amount: Number(result.totalBet)
                });
                allCompleted.push(...betResults);

                if (allCompleted.length > 0 && channel && 'send' in channel) {
                    await channel.send({
                        content: `<@${player.userId}> ${buildMissionNotification(allCompleted)}`,
                    });
                }
            } catch {
                // Mission check should never block game result
            }
        }
    } finally {
        removeActiveTableSession(session.channelId);
    }
}

registerButtonHandler('bjt', handleBjTableButton as never);
