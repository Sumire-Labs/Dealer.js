import {
  type ButtonInteraction,
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} from 'discord.js';
import { registerButtonHandler } from '../handler.js';
import {
  getActiveSession,
  hasUserBet,
} from '../../games/horse-race/race.session.js';
import { runRace } from '../../commands/casino/horse-race.command.js';

async function handleRaceButton(interaction: ButtonInteraction): Promise<void> {
  // customId format: race:<action>:<sessionId>:<param>
  const parts = interaction.customId.split(':');
  const action = parts[1];

  if (action === 'start_race') {
    await handleStartRace(interaction, parts);
    return;
  }

  if (action !== 'bet') return;

  const sessionId = parts[2];
  const horseIndex = parseInt(parts[3]);
  const channelId = interaction.channelId;

  const session = getActiveSession(channelId);
  if (!session || session.id !== sessionId || session.status !== 'betting') {
    await interaction.reply({
      content: 'このレースのベット受付は終了しています。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (hasUserBet(channelId, interaction.user.id)) {
    await interaction.reply({
      content: 'このレースには既にベット済みです！',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const horse = session.horses[horseIndex];

  // Show modal for bet amount
  const modal = new ModalBuilder()
    .setCustomId(`racebet:${channelId}:${horseIndex}`)
    .setTitle(`${horse.name} にベット`)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('bet_amount')
          .setLabel(`ベット額（x${horse.odds} オッズ）`)
          .setPlaceholder('例: 5000')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMinLength(3)
          .setMaxLength(10),
      ),
    );

  await interaction.showModal(modal);
}

async function handleStartRace(interaction: ButtonInteraction, parts: string[]): Promise<void> {
  const ownerId = parts[3];
  const channelId = interaction.channelId;

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: 'レース開始は主催者のみ行えます。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const session = getActiveSession(channelId);
  if (!session || session.status !== 'betting') {
    await interaction.reply({
      content: 'このレースのベット受付は終了しています。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Force close betting
  session.startsAt = Date.now();
  await interaction.deferUpdate();
  await runRace(interaction.channel, session);
}

registerButtonHandler('race', handleRaceButton as never);
