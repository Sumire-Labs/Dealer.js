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

async function handleRaceButton(interaction: ButtonInteraction): Promise<void> {
  // customId format: race:bet:<sessionId>:<horseIndex>
  const parts = interaction.customId.split(':');
  const action = parts[1];

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
          .setMaxLength(6),
      ),
    );

  await interaction.showModal(modal);
}

registerButtonHandler('race', handleRaceButton as never);
