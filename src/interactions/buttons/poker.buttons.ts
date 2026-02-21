import {
  type ButtonInteraction,
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} from 'discord.js';
import { registerButtonHandler } from '../handler.js';
import { POKER_MAX_BUYIN, POKER_MAX_PLAYERS } from '../../config/constants.js';
import {
  getActiveSession,
  hasPlayer,
} from '../../games/poker/poker.session.js';
import {
  processAction,
  canCheck,
} from '../../games/poker/poker.engine.js';
import { advanceGame, tryStartGame } from '../../commands/casino/poker.command.js';
import { formatCard } from '../../games/poker/poker.deck.js';
import { formatChips } from '../../utils/formatters.js';

async function handlePokerButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const action = parts[1];
  const sessionId = parts[2];

  const channelId = interaction.channelId;
  const session = getActiveSession(channelId);

  if (!session || session.id !== sessionId) {
    await interaction.reply({
      content: 'このポーカーセッションは終了しています。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  switch (action) {
    case 'join':
      await handleJoin(interaction, channelId, sessionId);
      break;
    case 'start':
      await handleStart(interaction, parts);
      break;
    case 'view_hand':
      await handleViewHand(interaction, channelId);
      break;
    case 'fold':
      await handleGameAction(interaction, channelId, 'fold');
      break;
    case 'check':
      await handleGameAction(interaction, channelId, 'check');
      break;
    case 'call':
      await handleGameAction(interaction, channelId, 'call');
      break;
    case 'raise':
      await handleRaiseModal(interaction, channelId);
      break;
  }
}

async function handleJoin(
  interaction: ButtonInteraction,
  channelId: string,
  _sessionId: string,
): Promise<void> {
  const session = getActiveSession(channelId);
  if (!session || session.status !== 'waiting') {
    await interaction.reply({
      content: '参加受付は終了しています。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (hasPlayer(channelId, interaction.user.id)) {
    await interaction.reply({
      content: 'すでに参加しています！',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (session.players.length >= POKER_MAX_PLAYERS) {
    await interaction.reply({
      content: '満席です（最大6人）。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Show buy-in modal
  const modal = new ModalBuilder()
    .setCustomId(`poker_modal:buyin:${channelId}`)
    .setTitle('テキサスホールデム — バイイン')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('buyin_amount')
          .setLabel('バイイン額 ($2,000〜$100,000)')
          .setPlaceholder('例: 10000')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMinLength(4)
          .setMaxLength(6),
      ),
    );

  await interaction.showModal(modal);
}

async function handleStart(
  interaction: ButtonInteraction,
  parts: string[],
): Promise<void> {
  const ownerId = parts[3];
  const channelId = interaction.channelId;

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: 'ゲーム開始はホストのみ行えます。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const session = getActiveSession(channelId);
  if (!session || session.status !== 'waiting') {
    await interaction.reply({
      content: 'このセッションは既に開始されています。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Force close lobby
  session.lobbyDeadline = Date.now();
  if (session.lobbyTimer) clearInterval(session.lobbyTimer);
  await interaction.deferUpdate();
  await tryStartGame(interaction.channel, session);
}

async function handleViewHand(
  interaction: ButtonInteraction,
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

  const player = session.players.find(p => p.userId === interaction.user.id);
  if (!player) {
    await interaction.reply({
      content: 'このゲームに参加していません。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const handDisplay = player.holeCards.map(c => formatCard(c)).join(' ');
  await interaction.reply({
    content: `🃏 あなたの手札: **${handDisplay}**`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handleGameAction(
  interaction: ButtonInteraction,
  channelId: string,
  action: 'fold' | 'check' | 'call',
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

  // Validate the action
  if (action === 'check' && !canCheck(currentPlayer, session.currentBet)) {
    await interaction.reply({
      content: 'チェックはできません。コールまたはレイズしてください。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferUpdate();

  const { newCurrentBet } = processAction(action, currentPlayer, session.currentBet);
  session.currentBet = newCurrentBet;

  await advanceGame(interaction.channel, session);
}

async function handleRaiseModal(
  interaction: ButtonInteraction,
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

  const minRaise = session.currentBet + session.minRaise;
  const maxRaise = currentPlayer.currentBet + currentPlayer.stack;
  const maxDisplay = maxRaise < POKER_MAX_BUYIN ? maxRaise : POKER_MAX_BUYIN;

  const modal = new ModalBuilder()
    .setCustomId(`poker_modal:raise:${channelId}`)
    .setTitle('レイズ')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('raise_amount')
          .setLabel(`レイズ額（最低: ${formatChips(minRaise)} / 最大: ${formatChips(maxDisplay)}）`)
          .setPlaceholder(`例: ${minRaise.toString()}`)
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMinLength(3)
          .setMaxLength(6),
      ),
    );

  await interaction.showModal(modal);
}

registerButtonHandler('poker', handlePokerButton as never);
