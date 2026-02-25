import {
    ActionRowBuilder,
    type ButtonInteraction,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import {registerButtonHandler} from '../handler.js';
import {findOrCreateUser} from '../../database/repositories/user.repository.js';
import {buyTicket, getOrCreateCurrentRound} from '../../database/services/lottery.service.js';
import {
    getRecentCompletedRounds,
    getRoundTicketCount,
    getUserTickets,
} from '../../database/repositories/lottery.repository.js';
import {buildLotteryView} from '../../ui/builders/lottery.builder.js';
import {secureRandomInt} from '../../utils/random.js';
import {LOTTERY_NUMBER_MAX, LOTTERY_NUMBER_MIN, LOTTERY_NUMBERS_COUNT,} from '../../config/constants.js';
import {buildAchievementNotification, checkAchievements} from '../../database/services/achievement.service.js';

async function handleLotteryButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const action = parts[1];
  const ownerId = parts[2];

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: '`/lottery` で自分の宝くじを確認してください。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const userId = interaction.user.id;

  switch (action) {
    case 'tab_current': {
      await showCurrentTab(interaction, userId);
      break;
    }
    case 'tab_history': {
      await showHistoryTab(interaction, userId);
      break;
    }
    case 'buy': {
      const modal = new ModalBuilder()
        .setCustomId(`lottery_modal:buy:${userId}`)
        .setTitle('宝くじ番号選択')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('number1')
              .setLabel(`1つ目の番号 (${LOTTERY_NUMBER_MIN}〜${LOTTERY_NUMBER_MAX})`)
              .setStyle(TextInputStyle.Short)
              .setPlaceholder(`${LOTTERY_NUMBER_MIN}〜${LOTTERY_NUMBER_MAX}`)
              .setRequired(true)
              .setMinLength(1)
              .setMaxLength(1),
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('number2')
              .setLabel(`2つ目の番号 (${LOTTERY_NUMBER_MIN}〜${LOTTERY_NUMBER_MAX})`)
              .setStyle(TextInputStyle.Short)
              .setPlaceholder(`${LOTTERY_NUMBER_MIN}〜${LOTTERY_NUMBER_MAX}`)
              .setRequired(true)
              .setMinLength(1)
              .setMaxLength(1),
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('number3')
              .setLabel(`3つ目の番号 (${LOTTERY_NUMBER_MIN}〜${LOTTERY_NUMBER_MAX})`)
              .setStyle(TextInputStyle.Short)
              .setPlaceholder(`${LOTTERY_NUMBER_MIN}〜${LOTTERY_NUMBER_MAX}`)
              .setRequired(true)
              .setMinLength(1)
              .setMaxLength(1),
          ),
        );
      await interaction.showModal(modal);
      break;
    }
    case 'quick_buy': {
      // Generate random numbers and buy
      const numbers: number[] = [];
      for (let i = 0; i < LOTTERY_NUMBERS_COUNT; i++) {
        numbers.push(secureRandomInt(LOTTERY_NUMBER_MIN, LOTTERY_NUMBER_MAX));
      }

      const result = await buyTicket(userId, numbers);
      if (!result.success) {
        await interaction.reply({
          content: result.error!,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Achievement check for multiplayer
      const multiplayerAchievements = await checkAchievements({
        userId,
        context: 'multiplayer',
      });

      await showCurrentTab(interaction, userId);

      if (multiplayerAchievements.length > 0) {
        await interaction.followUp({
          content: buildAchievementNotification(multiplayerAchievements),
          flags: MessageFlags.Ephemeral,
        });
      }
      break;
    }
  }
}

async function showCurrentTab(
  interaction: ButtonInteraction,
  userId: string,
): Promise<void> {
  await findOrCreateUser(userId);
  const round = await getOrCreateCurrentRound();
  const userTickets = await getUserTickets(round.id, userId);
  const totalTickets = await getRoundTicketCount(round.id);

  const view = buildLotteryView({
    userId,
    round,
    userTickets,
    totalTickets,
    tab: 'current',
  });

  await interaction.update({
    components: [view],
    flags: MessageFlags.IsComponentsV2,
  });
}

async function showHistoryTab(
  interaction: ButtonInteraction,
  userId: string,
): Promise<void> {
  const round = await getOrCreateCurrentRound();
  const userTickets = await getUserTickets(round.id, userId);
  const totalTickets = await getRoundTicketCount(round.id);
  const recentRounds = await getRecentCompletedRounds(5);

  const view = buildLotteryView({
    userId,
    round,
    userTickets,
    totalTickets,
    tab: 'history',
    recentRounds,
  });

  await interaction.update({
    components: [view],
    flags: MessageFlags.IsComponentsV2,
  });
}

registerButtonHandler('lottery', handleLotteryButton as never);
