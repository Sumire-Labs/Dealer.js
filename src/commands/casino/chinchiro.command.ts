import {type ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder} from 'discord.js';
import {registerCommand} from '../registry.js';
import {configService} from '../../config/config.service.js';
import {S} from '../../config/setting-defs.js';
import {findOrCreateUser} from '../../database/repositories/user.repository.js';
import {chinchiroSoloSessions} from '../../interactions/buttons/chinchiro.buttons.js';
import {getActiveChinchiroSession} from '../../games/chinchiro/chinchiro-table.session.js';
import {buildChinchiroModeSelectView} from '../../ui/builders/chinchiro-table.builder.js';
import {formatChips} from '../../utils/formatters.js';

const data = new SlashCommandBuilder()
    .setName('chinchiro')
    .setDescription('チンチロリン（サイコロ賭博）で勝負')
    .addIntegerOption(option =>
        option
            .setName('bet')
            .setDescription('ベット額')
            .setRequired(true)
            .setMinValue(Number(S.minBet.defaultValue)),
    )
    .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const bet = BigInt(interaction.options.getInteger('bet', true));

    const maxBet = configService.getBigInt(S.maxChinchiro);
    if (maxBet > 0n && bet > maxBet) {
        await interaction.reply({
            content: `ベット上限は${formatChips(maxBet)}です。`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Check for existing solo session
    if (chinchiroSoloSessions.has(userId)) {
        await interaction.reply({
            content: '進行中のチンチロがあります！ 先にそちらを終わらせてください。',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Check for existing table session in this channel
    const existingTable = getActiveChinchiroSession(interaction.channelId);
    if (existingTable && existingTable.phase !== 'resolved' && existingTable.phase !== 'cancelled') {
        await interaction.reply({
            content: 'このチャンネルではすでにチンチロテーブルが進行中です！',
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

    // Show mode selection (ephemeral)
    const modeView = buildChinchiroModeSelectView(userId, bet);
    await interaction.reply({
        components: [modeView],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
}

registerCommand({data, execute: execute as never});
