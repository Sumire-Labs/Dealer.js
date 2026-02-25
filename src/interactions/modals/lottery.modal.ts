import {MessageFlags, type ModalSubmitInteraction,} from 'discord.js';
import {registerModalHandler} from '../handler.js';
import {LOTTERY_NUMBER_MAX, LOTTERY_NUMBER_MIN,} from '../../config/constants.js';
import {findOrCreateUser} from '../../database/repositories/user.repository.js';
import {buyTicket, getOrCreateCurrentRound} from '../../database/services/lottery.service.js';
import {getRoundTicketCount, getUserTickets,} from '../../database/repositories/lottery.repository.js';
import {buildLotteryView} from '../../ui/builders/lottery.builder.js';
import {buildAchievementNotification, checkAchievements} from '../../database/services/achievement.service.js';

async function handleLotteryModal(interaction: ModalSubmitInteraction): Promise<void> {
    const userId = interaction.user.id;

    // Parse numbers
    const numbers: number[] = [];
    for (let i = 1; i <= 3; i++) {
        const val = parseInt(interaction.fields.getTextInputValue(`number${i}`).trim());
        if (isNaN(val) || val < LOTTERY_NUMBER_MIN || val > LOTTERY_NUMBER_MAX) {
            await interaction.reply({
                content: `番号は ${LOTTERY_NUMBER_MIN}〜${LOTTERY_NUMBER_MAX} の範囲で入力してください。`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
        numbers.push(val);
    }

    const result = await buyTicket(userId, numbers);
    if (!result.success) {
        await interaction.reply({
            content: result.error!,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Rebuild and show updated view
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

    await interaction.reply({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
    });

    // Achievement check
    const multiplayerAchievements = await checkAchievements({
        userId,
        context: 'multiplayer',
    });
    if (multiplayerAchievements.length > 0) {
        await interaction.followUp({
            content: buildAchievementNotification(multiplayerAchievements),
            flags: MessageFlags.Ephemeral,
        });
    }
}

registerModalHandler('lottery_modal', handleLotteryModal as never);
