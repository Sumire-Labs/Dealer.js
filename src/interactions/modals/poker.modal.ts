import {MessageFlags, type ModalSubmitInteraction,} from 'discord.js';
import {registerModalHandler} from '../handler.js';
import {configService} from '../../config/config.service.js';
import {S} from '../../config/setting-defs.js';
import {findOrCreateUser} from '../../database/repositories/user.repository.js';
import {removeChips} from '../../database/services/economy.service.js';
import {addPlayer, getActiveSession,} from '../../games/poker/poker.session.js';
import {processAction} from '../../games/poker/poker.engine.js';
import {advanceGame} from '../../commands/casino/poker.command.js';
import {formatChips, parseChipAmount} from '../../utils/formatters.js';
import {buildActionConfirmation, buildPokerLobbyView,} from '../../ui/builders/poker.builder.js';
import {logger} from '../../utils/logger.js';

async function handlePokerModal(interaction: ModalSubmitInteraction): Promise<void> {
    const parts = interaction.customId.split(':');
    const action = parts[1];
    const channelId = parts[2];

    if (action === 'buyin') {
        await handleBuyIn(interaction, channelId);
    } else if (action === 'raise') {
        await handleRaise(interaction, channelId);
    }
}

async function handleBuyIn(
    interaction: ModalSubmitInteraction,
    channelId: string,
): Promise<void> {
    const session = getActiveSession(channelId);
    if (!session || session.status !== 'waiting') {
        await interaction.reply({
            content: '参加受付は終了しています。',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const amountStr = interaction.fields.getTextInputValue('buyin_amount').trim();
    const parsed = parseChipAmount(amountStr);
    if (isNaN(parsed) || parsed <= 0) {
        await interaction.reply({
            content: '有効な数値を入力してください。',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const amount = BigInt(parsed);
    const pokerMinBuyin = configService.getBigInt(S.pokerMinBuyin);
    const pokerMaxBuyin = configService.getBigInt(S.pokerMaxBuyin);
    if (amount < pokerMinBuyin) {
        await interaction.reply({
            content: `最低バイインは${formatChips(pokerMinBuyin)}です。`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    if (pokerMaxBuyin > 0n && amount > pokerMaxBuyin) {
        await interaction.reply({
            content: `バイイン上限は${formatChips(pokerMaxBuyin)}です。`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const user = await findOrCreateUser(interaction.user.id);
    if (user.chips < amount) {
        await interaction.reply({
            content: `チップが不足しています！ 残高: ${formatChips(user.chips)}`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const displayName = interaction.user.displayName ?? interaction.user.username;
    const added = addPlayer(channelId, interaction.user.id, displayName, amount);
    if (!added) {
        await interaction.reply({
            content: 'すでに参加しているか、受付が終了しています。',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Deduct chips
    await removeChips(interaction.user.id, amount, 'LOSS', 'POKER');

    await interaction.reply({
        content: `✅ 参加完了！ バイイン: **${formatChips(amount)}**`,
        flags: MessageFlags.Ephemeral,
    });

    // Update lobby message
    try {
        if (session.messageId && interaction.channel && 'messages' in interaction.channel) {
            const remaining = Math.max(0, Math.ceil((session.lobbyDeadline - Date.now()) / 1000));
            const view = buildPokerLobbyView(session, remaining);
            await interaction.channel.messages.edit(session.messageId, {
                components: [view],
                flags: MessageFlags.IsComponentsV2,
            });
        }
    } catch (err) {
        logger.error('Failed to update poker lobby after join', {error: String(err)});
    }
}

async function handleRaise(
    interaction: ModalSubmitInteraction,
    channelId: string,
): Promise<void> {
    const session = getActiveSession(channelId);
    if (!session || session.status !== 'playing') {
        await interaction.reply({
            content: 'ゲームが進行していません。',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const currentPlayer = session.players[session.currentPlayerIndex];
    if (!currentPlayer || currentPlayer.userId !== interaction.user.id) {
        await interaction.reply({
            content: 'あなたのターンではありません。',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const amountStr = interaction.fields.getTextInputValue('raise_amount').trim();
    const parsed = parseChipAmount(amountStr);
    if (isNaN(parsed) || parsed <= 0) {
        await interaction.reply({
            content: '有効な数値を入力してください。',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const raiseTotal = BigInt(parsed);
    const minRaise = session.currentBet + session.minRaise;
    const maxBet = currentPlayer.currentBet + currentPlayer.stack;

    // Allow all-in even if below min raise
    if (raiseTotal < minRaise && raiseTotal < maxBet) {
        await interaction.reply({
            content: `最低レイズ額は ${formatChips(minRaise)} です。`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (raiseTotal > maxBet) {
        await interaction.reply({
            content: `最大ベット額は ${formatChips(maxBet)} です。`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Update min raise for next raise
    const raiseIncrement = raiseTotal - session.currentBet;
    if (raiseIncrement > session.minRaise) {
        session.minRaise = raiseIncrement;
    }

    const {newCurrentBet} = processAction('raise', currentPlayer, session.currentBet, raiseTotal);
    session.currentBet = newCurrentBet;
    session.lastRaiserIndex = session.currentPlayerIndex;

    // Reset acted flag for all other active players so they must act again
    for (const p of session.players) {
        if (p.userId !== currentPlayer.userId && !p.folded && !p.allIn) {
            p.acted = false;
        }
    }

    // Confirm to user, then advance game
    const confirmText = buildActionConfirmation('raise', raiseTotal);
    await interaction.reply({content: confirmText, flags: MessageFlags.Ephemeral});
    await advanceGame(interaction.channel, session);
}

registerModalHandler('poker_modal', handlePokerModal as never);
