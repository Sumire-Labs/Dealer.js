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
      content: 'This race is no longer accepting bets.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (hasUserBet(channelId, interaction.user.id)) {
    await interaction.reply({
      content: 'You already placed a bet in this race!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const horse = session.horses[horseIndex];

  // Show modal for bet amount
  const modal = new ModalBuilder()
    .setCustomId(`racebet:${channelId}:${horseIndex}`)
    .setTitle(`Bet on ${horse.name}`)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('bet_amount')
          .setLabel(`Bet amount (x${horse.odds} odds)`)
          .setPlaceholder('e.g. 5000')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMinLength(3)
          .setMaxLength(6),
      ),
    );

  await interaction.showModal(modal);
}

registerButtonHandler('race', handleRaceButton as never);
