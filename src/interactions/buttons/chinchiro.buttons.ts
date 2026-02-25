import {type ButtonInteraction, ContainerBuilder, MessageFlags, TextDisplayBuilder} from 'discord.js';
import {registerButtonHandler} from '../handler.js';
import {
    type ChinchiroHand,
    evaluateRoll,
    resolveSoloGame,
    rollDice,
} from '../../games/chinchiro/chinchiro.engine.js';
import {
    buildChinchiroSoloDealerView,
    buildChinchiroSoloRerollView,
    buildChinchiroSoloResultView,
    buildChinchiroLobbyView,
} from '../../ui/builders/chinchiro-table.builder.js';
import {playChinchiroAnimation} from '../../ui/animations/chinchiro.animation.js';
import {findOrCreateUser, incrementGameStats} from '../../database/repositories/user.repository.js';
import {addChips, processGameResult, removeChips} from '../../database/services/economy.service.js';
import {formatChips} from '../../utils/formatters.js';
import {buildMissionNotification, updateMissionProgress} from '../../database/services/mission.service.js';
import {
    type ChinchiroTableSession,
    getActiveChinchiroSession,
    setActiveChinchiroSession,
} from '../../games/chinchiro/chinchiro-table.session.js';
import {CHINCHIRO_LOBBY_DURATION_MS} from '../../config/constants.js';
import {startChinchiroLobbyCountdown} from './chinchiro-table.buttons.js';

// ─── Solo session store ────────────────────────────────

export interface ChinchiroSoloSession {
    bet: bigint;
    dealerHand: ChinchiroHand;
    rollHistory: ChinchiroHand[];
    rollsRemaining: number;
    phase: 'dealer_shown' | 'player_rolling' | 'reroll_prompt' | 'resolved';
}

export const chinchiroSoloSessions = new Map<string, ChinchiroSoloSession>();

// ─── Main handler ──────────────────────────────────────

async function handleChinchiroButton(interaction: ButtonInteraction): Promise<void> {
    const parts = interaction.customId.split(':');
    const action = parts[1];

    switch (action) {
        case 'solo':
            await handleSolo(interaction, parts);
            return;
        case 'table':
            await handleTable(interaction, parts);
            return;
        case 'roll':
            await handleRoll(interaction, parts);
            return;
        case 'reroll':
            await handleRoll(interaction, parts);
            return;
    }
}

// ─── Solo mode ─────────────────────────────────────────

async function handleSolo(interaction: ButtonInteraction, parts: string[]): Promise<void> {
    const ownerId = parts[2];
    const bet = BigInt(parts[3]);
    const userId = interaction.user.id;

    if (userId !== ownerId) {
        await interaction.reply({
            content: '他のプレイヤーの操作はできません。',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (chinchiroSoloSessions.has(userId)) {
        await interaction.reply({
            content: '進行中のチンチロがあります！',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const user = await findOrCreateUser(userId);
    if (user.chips < bet) {
        await interaction.reply({
            content: `チップが不足しています！ 残高: ${formatChips(user.chips)}`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Deduct bet
    await removeChips(userId, bet, 'LOSS', 'CHINCHIRO');

    // Dealer rolls (up to 3 times for menashi)
    let dealerHand: ChinchiroHand;
    let attempts = 0;
    do {
        const dice = rollDice();
        dealerHand = evaluateRoll(dice);
        attempts++;
    } while (dealerHand.rank === 'menashi' && attempts < 3);

    // Store session
    const session: ChinchiroSoloSession = {
        bet,
        dealerHand,
        rollHistory: [],
        rollsRemaining: 3,
        phase: 'dealer_shown',
    };
    chinchiroSoloSessions.set(userId, session);

    // Show dealer result + roll button
    const view = buildChinchiroSoloDealerView(dealerHand, userId);
    await interaction.update({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
    });
}

// ─── Player roll / reroll ──────────────────────────────

async function handleRoll(interaction: ButtonInteraction, parts: string[]): Promise<void> {
    const ownerId = parts[2];
    const userId = interaction.user.id;

    if (userId !== ownerId) {
        await interaction.reply({
            content: 'これはあなたのゲームではありません！',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const session = chinchiroSoloSessions.get(userId);
    if (!session || session.phase === 'resolved') {
        await interaction.reply({
            content: 'セッションが期限切れです。`/chinchiro` で新しいゲームを始めてください。',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Defer update for animation
    await interaction.deferUpdate();

    // Roll dice
    const dice = rollDice();
    const hand = evaluateRoll(dice);
    session.rollHistory.push(hand);
    session.rollsRemaining--;

    // Play animation
    await playChinchiroAnimation(interaction, dice);

    // Evaluate result
    if (hand.rank === 'menashi' && session.rollsRemaining > 0) {
        // Menashi with rerolls remaining — show reroll prompt
        session.phase = 'reroll_prompt';
        const view = buildChinchiroSoloRerollView(
            session.dealerHand,
            session.rollHistory,
            session.rollsRemaining,
            userId,
        );
        await interaction.editReply({
            components: [view],
            flags: MessageFlags.IsComponentsV2,
        });
        return;
    }

    // Final result
    session.phase = 'resolved';
    chinchiroSoloSessions.delete(userId);

    const playerHand = hand;
    const bet = session.bet;

    // Handle hifumi (extra bet loss)
    if (playerHand.rank === 'hifumi') {
        // Player loses 2x bet total. We already deducted 1x, so deduct 1 more
        try {
            await removeChips(userId, bet, 'LOSS', 'CHINCHIRO');
        } catch {
            // Not enough chips for extra penalty — just process with what we have
        }
        const updatedUser = await findOrCreateUser(userId);
        await incrementGameStats(userId, 0n, bet * 2n);

        const view = buildChinchiroSoloResultView(
            session.dealerHand, playerHand, 'lose', bet, 0n, updatedUser.chips, userId,
        );
        await interaction.editReply({
            components: [view],
            flags: MessageFlags.IsComponentsV2,
        });

        // Mission hooks
        await fireSoloMissions(interaction, userId, bet, -(bet * 2n));
        return;
    }

    // Resolve game
    const result = resolveSoloGame(session.dealerHand, playerHand);

    if (result.outcome === 'draw') {
        // Return bet
        const newBalance = await addChips(userId, bet, 'WIN', 'CHINCHIRO');
        await incrementGameStats(userId, 0n, 0n);

        const view = buildChinchiroSoloResultView(
            session.dealerHand, playerHand, 'draw', bet, bet, newBalance, userId,
        );
        await interaction.editReply({
            components: [view],
            flags: MessageFlags.IsComponentsV2,
        });
        await fireSoloMissions(interaction, userId, bet, 0n);
        return;
    }

    if (result.outcome === 'win') {
        // Use processGameResult for win — handles achievements, missions, penalties
        const gameResult = await processGameResult(userId, 'CHINCHIRO', bet, result.effectiveMultiplier);

        const view = buildChinchiroSoloResultView(
            session.dealerHand, playerHand, 'win', bet, gameResult.payout, gameResult.newBalance, userId,
        );
        await interaction.editReply({
            components: [view],
            flags: MessageFlags.IsComponentsV2,
        });

        // processGameResult already fires missions, so just notify
        if (gameResult.missionsCompleted.length > 0) {
            try {
                await interaction.followUp({
                    content: buildMissionNotification(gameResult.missionsCompleted),
                    flags: MessageFlags.Ephemeral,
                });
            } catch {
                // ignore
            }
        }
        return;
    }

    // Loss (menashi or lower hand)
    // Bet already deducted, multiplier = 0
    const gameResult = await processGameResult(userId, 'CHINCHIRO', bet, 0);

    const view = buildChinchiroSoloResultView(
        session.dealerHand, playerHand, 'lose', bet, 0n, gameResult.newBalance, userId,
    );
    await interaction.editReply({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
    });

    if (gameResult.missionsCompleted.length > 0) {
        try {
            await interaction.followUp({
                content: buildMissionNotification(gameResult.missionsCompleted),
                flags: MessageFlags.Ephemeral,
            });
        } catch {
            // ignore
        }
    }
}

// ─── Table mode ────────────────────────────────────────

async function handleTable(interaction: ButtonInteraction, parts: string[]): Promise<void> {
    const ownerId = parts[2];
    const bet = BigInt(parts[3]);
    const userId = interaction.user.id;

    if (userId !== ownerId) {
        await interaction.reply({
            content: '他のプレイヤーの操作はできません。',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const channelId = interaction.channelId;

    // Check for existing table session
    const existing = getActiveChinchiroSession(channelId);
    if (existing && existing.phase !== 'resolved' && existing.phase !== 'cancelled') {
        await interaction.reply({
            content: 'このチャンネルではすでにチンチロテーブルが進行中です！',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Check balance
    const user = await findOrCreateUser(userId);
    if (user.chips < bet) {
        await interaction.reply({
            content: `チップが不足しています！ 残高: ${formatChips(user.chips)}`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Deduct bet
    await removeChips(userId, bet, 'LOSS', 'CHINCHIRO');

    const displayName = interaction.user.displayName;

    // Create table session
    const session: ChinchiroTableSession = {
        channelId,
        hostId: userId,
        bet,
        phase: 'waiting',
        lobbyDeadline: Date.now() + CHINCHIRO_LOBBY_DURATION_MS,
        players: [{
            userId,
            displayName,
            bet,
            isHost: true,
            currentHand: null,
            rollHistory: [],
            rollsRemaining: 3,
            done: false,
            netResult: 0n,
        }],
        bankerIndex: 0,
        currentPlayerIndex: 0,
        turnDeadline: 0,
        completedRotations: 0,
    };

    setActiveChinchiroSession(channelId, session);

    // Dismiss ephemeral mode select
    await interaction.update({
        components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent('✅ テーブルを作成しました！'))],
        flags: MessageFlags.IsComponentsV2,
    });

    // Send public lobby message
    if (interaction.channel && 'send' in interaction.channel) {
        const remainingSeconds = Math.ceil(CHINCHIRO_LOBBY_DURATION_MS / 1000);
        const lobbyView = buildChinchiroLobbyView(session, remainingSeconds);
        const msg = await interaction.channel.send({
            components: [lobbyView],
            flags: MessageFlags.IsComponentsV2,
        });
        session.messageId = msg.id;
        startChinchiroLobbyCountdown(interaction.channel, session);
    }
}

// ─── Mission helper ────────────────────────────────────

async function fireSoloMissions(
    interaction: ButtonInteraction,
    userId: string,
    bet: bigint,
    net: bigint,
): Promise<void> {
    try {
        const allCompleted = [];
        const playResults = await updateMissionProgress(userId, {type: 'game_play', gameType: 'CHINCHIRO'});
        allCompleted.push(...playResults);

        if (net > 0n) {
            const winResults = await updateMissionProgress(userId, {type: 'game_win', gameType: 'CHINCHIRO'});
            allCompleted.push(...winResults);
            const earnResults = await updateMissionProgress(userId, {type: 'chips_earned', amount: Number(net)});
            allCompleted.push(...earnResults);
        }

        const betResults = await updateMissionProgress(userId, {type: 'chips_bet', amount: Number(bet)});
        allCompleted.push(...betResults);

        if (allCompleted.length > 0) {
            await interaction.followUp({
                content: buildMissionNotification(allCompleted),
                flags: MessageFlags.Ephemeral,
            });
        }
    } catch {
        // Mission check should never block game result
    }
}

registerButtonHandler('chinchiro', handleChinchiroButton as never);
