import {type ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder,} from 'discord.js';
import {registerCommand} from '../registry.js';
import {findOrCreateUser} from '../../database/repositories/user.repository.js';
import {getOrCreateCurrentRound} from '../../database/services/lottery.service.js';
import {getRoundTicketCount, getUserTickets,} from '../../database/repositories/lottery.repository.js';
import {buildLotteryView} from '../../ui/builders/lottery.builder.js';

const data = new SlashCommandBuilder()
    .setName('lottery')
    .setDescription('宝くじの現在のラウンドを表示する')
    .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
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
}

registerCommand({data, execute: execute as never});
