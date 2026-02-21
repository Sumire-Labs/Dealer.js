import {
  type ModalSubmitInteraction,
  MessageFlags,
} from 'discord.js';
import { registerModalHandler } from '../handler.js';
import { MIN_BET, MAX_BET_HORSE_RACE } from '../../config/constants.js';
import { findOrCreateUser } from '../../database/repositories/user.repository.js';
import { removeChips } from '../../database/services/economy.service.js';
import {
  getActiveSession,
  addBetToSession,
} from '../../games/horse-race/race.session.js';
import { formatChips } from '../../utils/formatters.js';

async function handleBetAmountModal(interaction: ModalSubmitInteraction): Promise<void> {
  // customId format: racebet:<channelId>:<horseIndex>
  const parts = interaction.customId.split(':');
  const channelId = parts[1];
  const horseIndex = parseInt(parts[2]);

  const session = getActiveSession(channelId);
  if (!session || session.status !== 'betting') {
    await interaction.reply({
      content: 'This race is no longer accepting bets.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Validate horseIndex bounds
  if (isNaN(horseIndex) || horseIndex < 0 || horseIndex >= session.horses.length) {
    await interaction.reply({
      content: 'Invalid horse selection.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Parse and validate bet amount
  const amountStr = interaction.fields.getTextInputValue('bet_amount').trim();
  const parsed = parseInt(amountStr);
  if (isNaN(parsed) || parsed <= 0) {
    await interaction.reply({
      content: 'Please enter a valid number.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const amount = BigInt(parsed);
  if (amount < MIN_BET || amount > MAX_BET_HORSE_RACE) {
    await interaction.reply({
      content: `Bet must be between ${formatChips(MIN_BET)} and ${formatChips(MAX_BET_HORSE_RACE)}.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const user = await findOrCreateUser(interaction.user.id);
  if (user.chips < amount) {
    await interaction.reply({
      content: `Insufficient chips! You have ${formatChips(user.chips)}.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const added = addBetToSession(channelId, {
    userId: interaction.user.id,
    horseIndex,
    amount,
  });

  if (!added) {
    await interaction.reply({
      content: 'You already placed a bet in this race!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Deduct chips
  await removeChips(interaction.user.id, amount, 'LOSS', 'HORSE_RACE');

  const horse = session.horses[horseIndex];
  await interaction.reply({
    content: `✅ Bet placed! **${formatChips(amount)}** on **${horse.name}** (x${horse.odds})`,
    flags: MessageFlags.Ephemeral,
  });
}

registerModalHandler('racebet', handleBetAmountModal as never);
