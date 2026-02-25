import {type ButtonInteraction, MessageFlags, type TextBasedChannel} from 'discord.js';
import {registerButtonHandler} from '../handler.js';
import {
    addPlayerToChinchiro,
    type ChinchiroTableSession,
    getActiveChinchiroSession,
    hasPlayerInChinchiro,
    removeActiveChinchiroSession,
} from '../../games/chinchiro/chinchiro-table.session.js';
import {
    advanceToNextPlayer,
    initializeRound,
    performRoll,
    resolveRound,
    rotateBanker,
} from '../../games/chinchiro/chinchiro-table.engine.js';
import {
    buildChinchiroCancelledView,
    buildChinchiroFinalResultView,
    buildChinchiroLobbyView,
    buildChinchiroRoundResultView,
    buildChinchiroTableView,
} from '../../ui/builders/chinchiro-table.builder.js';
import {findOrCreateUser, incrementGameStats} from '../../database/repositories/user.repository.js';
import {addChips, removeChips} from '../../database/services/economy.service.js';
import {formatChips} from '../../utils/formatters.js';
import {buildMissionNotification, updateMissionProgress} from '../../database/services/mission.service.js';
import {
    CHINCHIRO_MAX_PLAYERS,
    CHINCHIRO_MIN_PLAYERS,
    CHINCHIRO_TURN_TIMEOUT_MS,
} from '../../config/constants.js';
import {logger} from '../../utils/logger.js';

// ─── Main handler ──────────────────────────────────────

async function handleChinchiroTableButton(interaction: ButtonInteraction): Promise<void> {
    const parts = interaction.customId.split(':');
    const action = parts[1];
    const channelId = parts[2];
    const userId = interaction.user.id;

    const session = getActiveChinchiroSession(channelId);

    switch (action) {
        case 'join':
            await handleJoin(interaction, session, channelId, userId);
            break;
        case 'start':
            await handleStart(interaction, session, channelId, parts[3], userId);
            break;
        case 'roll':
        case 'reroll':
            await handleGameRoll(interaction, session, channelId, parts[3]);
            break;
        case 'nextround':
            await handleNextRound(interaction, session, channelId, parts[3], userId);
            break;
    }
}

// ─── Join ──────────────────────────────────────────────

async function handleJoin(
    interaction: ButtonInteraction,
    session: ChinchiroTableSession | undefined,
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

    if (hasPlayerInChinchiro(channelId, userId)) {
        await interaction.reply({
            content: 'すでに参加しています！',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (session.players.length >= CHINCHIRO_MAX_PLAYERS) {
        await interaction.reply({
            content: `満席です（最大${CHINCHIRO_MAX_PLAYERS}人）。`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const user = await findOrCreateUser(userId);
    if (user.chips < session.bet) {
        await interaction.reply({
            content: `チップが不足しています！ 必要: ${formatChips(session.bet)} / 残高: ${formatChips(user.chips)}`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Deduct bet
    await removeChips(userId, session.bet, 'LOSS', 'CHINCHIRO');

    // Add player
    const displayName = interaction.user.displayName;
    addPlayerToChinchiro(channelId, userId, displayName, session.bet);

    // Update lobby view
    const remaining = Math.max(0, Math.ceil((session.lobbyDeadline - Date.now()) / 1000));
    const view = buildChinchiroLobbyView(session, remaining);
    await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
    });
}

// ─── Start ─────────────────────────────────────────────

async function handleStart(
    interaction: ButtonInteraction,
    session: ChinchiroTableSession | undefined,
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

// ─── Game roll ─────────────────────────────────────────

async function handleGameRoll(
    interaction: ButtonInteraction,
    session: ChinchiroTableSession | undefined,
    _channelId: string,
    targetUserId: string,
): Promise<void> {
    const userId = interaction.user.id;

    if (!session || (session.phase !== 'banker_roll' && session.phase !== 'player_roll')) {
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

    // Clear turn timer
    if (session.turnTimer) clearTimeout(session.turnTimer);

    // Perform roll
    performRoll(currentPlayer);

    // Check if menashi with rerolls remaining (not done yet)
    if (!currentPlayer.done) {
        // Menashi — update view with reroll button
        startTurnTimer(interaction.channel, session);
        await updateTableMessage(interaction, session);
        return;
    }

    // Player is done — check if we need to advance
    if (session.phase === 'banker_roll') {
        // Banker is done, switch to player rolls
        session.phase = 'player_roll';
        // Find first non-banker player
        const firstPlayer = findFirstNonBankerPlayer(session);
        if (firstPlayer === -1) {
            // No other players? Shouldn't happen with min 2 players
            await handleRoundResolution(interaction.channel, session);
            return;
        }
        session.currentPlayerIndex = firstPlayer;
        startTurnTimer(interaction.channel, session);
        await updateTableMessage(interaction, session);
        return;
    }

    // Player roll phase — advance to next player
    const allDone = advanceToNextPlayer(session);
    if (allDone) {
        await interaction.deferUpdate();
        await handleRoundResolution(interaction.channel, session);
        return;
    }

    startTurnTimer(interaction.channel, session);
    await updateTableMessage(interaction, session);
}

// ─── Next round ────────────────────────────────────────

async function handleNextRound(
    interaction: ButtonInteraction,
    session: ChinchiroTableSession | undefined,
    _channelId: string,
    hostId: string,
    userId: string,
): Promise<void> {
    if (!session || session.phase !== 'round_result') {
        await interaction.reply({
            content: 'このテーブルは終了しています。',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (userId !== hostId) {
        await interaction.reply({
            content: '次のラウンドはホストのみ開始できます。',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Rotate banker
    const gameOver = rotateBanker(session);
    if (gameOver) {
        await interaction.deferUpdate();
        await handleFinalResolution(interaction.channel, session);
        return;
    }

    // Initialize next round
    initializeRound(session);
    startTurnTimer(interaction.channel, session);
    await updateTableMessage(interaction, session);
}

// ─── Lobby countdown ───────────────────────────────────

export function startChinchiroLobbyCountdown(
    channel: TextBasedChannel | null,
    session: ChinchiroTableSession,
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
                const view = buildChinchiroLobbyView(session, remainingSec);
                await channel.messages.edit(session.messageId, {
                    components: [view],
                    flags: MessageFlags.IsComponentsV2,
                });
            }
        } catch (err) {
            logger.error('Failed to update Chinchiro lobby', {error: String(err)});
        }
    }, updateInterval);
}

// ─── Start table ───────────────────────────────────────

async function tryStartTable(
    channel: TextBasedChannel | null,
    session: ChinchiroTableSession,
): Promise<void> {
    if (session.lobbyTimer) clearInterval(session.lobbyTimer);

    if (session.players.length < CHINCHIRO_MIN_PLAYERS) {
        session.phase = 'cancelled';

        // Refund all bets
        for (const p of session.players) {
            await addChips(p.userId, p.bet, 'WIN', 'CHINCHIRO');
        }

        const cancelView = buildChinchiroCancelledView(
            `参加者不足（${session.players.length}/${CHINCHIRO_MIN_PLAYERS}）。全ベットを返金しました。`,
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

        removeActiveChinchiroSession(session.channelId);
        return;
    }

    // Initialize first round — banker = host (index 0)
    initializeRound(session);

    // Start turn timer and show table
    startTurnTimer(channel, session);

    try {
        if (session.messageId && channel && 'messages' in channel) {
            const view = buildChinchiroTableView(session);
            await channel.messages.edit(session.messageId, {
                components: [view],
                flags: MessageFlags.IsComponentsV2,
            });
        }
    } catch (err) {
        logger.error('Failed to show Chinchiro table view', {error: String(err)});
    }
}

// ─── Turn timer ────────────────────────────────────────

function startTurnTimer(
    channel: TextBasedChannel | null,
    session: ChinchiroTableSession,
): void {
    if (session.turnTimer) clearTimeout(session.turnTimer);
    session.turnDeadline = Date.now() + CHINCHIRO_TURN_TIMEOUT_MS;

    session.turnTimer = setTimeout(async () => {
        try {
            const player = session.players[session.currentPlayerIndex];
            if (player && !player.done &&
                (session.phase === 'banker_roll' || session.phase === 'player_roll')) {
                // Auto-roll on timeout
                performRoll(player);

                // If still menashi with rerolls, keep auto-rolling
                while (!player.done) {
                    performRoll(player);
                }

                if (session.phase === 'banker_roll') {
                    session.phase = 'player_roll';
                    const firstPlayer = findFirstNonBankerPlayer(session);
                    if (firstPlayer === -1) {
                        await handleRoundResolution(channel, session);
                        return;
                    }
                    session.currentPlayerIndex = firstPlayer;
                } else {
                    const allDone = advanceToNextPlayer(session);
                    if (allDone) {
                        await handleRoundResolution(channel, session);
                        return;
                    }
                }

                startTurnTimer(channel, session);

                try {
                    if (session.messageId && channel && 'messages' in channel) {
                        const view = buildChinchiroTableView(session);
                        await channel.messages.edit(session.messageId, {
                            components: [view],
                            flags: MessageFlags.IsComponentsV2,
                        });
                    }
                } catch (err) {
                    logger.error('Failed to update Chinchiro table after timeout', {error: String(err)});
                }
            }
        } catch (err) {
            logger.error('Chinchiro turn timer failed', {error: String(err)});
            removeActiveChinchiroSession(session.channelId);
        }
    }, CHINCHIRO_TURN_TIMEOUT_MS);
}

// ─── Update table message ──────────────────────────────

async function updateTableMessage(
    interaction: ButtonInteraction,
    session: ChinchiroTableSession,
): Promise<void> {
    const view = buildChinchiroTableView(session);

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
            logger.error('Failed to update Chinchiro table message', {error: String(err)});
        }
    }
}

// ─── Round resolution ──────────────────────────────────

async function handleRoundResolution(
    channel: TextBasedChannel | null,
    session: ChinchiroTableSession,
): Promise<void> {
    const roundResults = resolveRound(session);
    const banker = session.players[session.bankerIndex];
    let bankerNet = 0n;

    // Process chip movements for each player
    for (const result of roundResults) {
        const player = session.players.find(p => p.userId === result.userId)!;

        if (result.outcome === 'win') {
            const winAmount = session.bet * BigInt(result.multiplier);
            await addChips(player.userId, session.bet + winAmount, 'WIN', 'CHINCHIRO'); // return bet + profit
            player.netResult += winAmount;
            bankerNet -= winAmount;
        } else if (result.outcome === 'draw') {
            await addChips(player.userId, session.bet, 'WIN', 'CHINCHIRO'); // return bet
            // no net change
        } else {
            // lose — bet already deducted
            const loseAmount = session.bet * BigInt(result.multiplier);
            if (result.multiplier > 1) {
                // Hifumi: extra bet loss
                try {
                    await removeChips(player.userId, session.bet * BigInt(result.multiplier - 1), 'LOSS', 'CHINCHIRO');
                } catch {
                    // Not enough for extra penalty
                }
            }
            player.netResult -= loseAmount;
            bankerNet += loseAmount;
        }
    }

    // Apply banker net
    if (bankerNet > 0n) {
        await addChips(banker.userId, bankerNet, 'WIN', 'CHINCHIRO');
    } else if (bankerNet < 0n) {
        try {
            await removeChips(banker.userId, -bankerNet, 'LOSS', 'CHINCHIRO');
        } catch {
            // Banker can't pay full amount — they go broke
        }
    }
    banker.netResult += bankerNet;

    session.phase = 'round_result';

    // Show round result
    const resultView = buildChinchiroRoundResultView(session, roundResults, bankerNet);

    try {
        if (session.messageId && channel && 'messages' in channel) {
            await channel.messages.edit(session.messageId, {
                components: [resultView],
                flags: MessageFlags.IsComponentsV2,
            });
        }
    } catch (err) {
        logger.error('Failed to show Chinchiro round result', {error: String(err)});
    }
}

// ─── Final resolution ──────────────────────────────────

async function handleFinalResolution(
    channel: TextBasedChannel | null,
    session: ChinchiroTableSession,
): Promise<void> {
    try {
        session.phase = 'resolved';

        // Update game stats and missions for each player
        for (const player of session.players) {
            const won = player.netResult > 0n ? player.netResult : 0n;
            const lost = player.netResult < 0n ? -player.netResult : 0n;
            await incrementGameStats(player.userId, won, lost);
        }

        // Show final result
        const finalView = buildChinchiroFinalResultView(session);

        try {
            if (session.messageId && channel && 'messages' in channel) {
                await channel.messages.edit(session.messageId, {
                    components: [finalView],
                    flags: MessageFlags.IsComponentsV2,
                });
            }
        } catch (err) {
            logger.error('Failed to show Chinchiro final result', {error: String(err)});
        }

        // Mission hooks for each player
        for (const player of session.players) {
            try {
                const allCompleted = [];
                const playResults = await updateMissionProgress(player.userId, {
                    type: 'game_play',
                    gameType: 'CHINCHIRO',
                });
                allCompleted.push(...playResults);

                if (player.netResult > 0n) {
                    const winResults = await updateMissionProgress(player.userId, {
                        type: 'game_win',
                        gameType: 'CHINCHIRO',
                    });
                    allCompleted.push(...winResults);
                    const earnResults = await updateMissionProgress(player.userId, {
                        type: 'chips_earned',
                        amount: Number(player.netResult),
                    });
                    allCompleted.push(...earnResults);
                }

                const betResults = await updateMissionProgress(player.userId, {
                    type: 'chips_bet',
                    amount: Number(session.bet),
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
        removeActiveChinchiroSession(session.channelId);
    }
}

// ─── Helpers ───────────────────────────────────────────

function findFirstNonBankerPlayer(session: ChinchiroTableSession): number {
    for (let i = 0; i < session.players.length; i++) {
        if (i !== session.bankerIndex && !session.players[i].done) {
            return i;
        }
    }
    return -1;
}

registerButtonHandler('ct', handleChinchiroTableButton as never);
