import {type ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder,} from 'discord.js';
import {registerCommand} from '../registry.js';
import {getRemainingGifts} from '../../database/services/gift.service.js';
import {buildGiftTypeSelectView} from '../../ui/builders/gift.builder.js';

const data = new SlashCommandBuilder()
    .setName('gift')
    .setDescription('他のユーザーにアイテムやチップを送る')
    .addUserOption(option =>
        option
            .setName('user')
            .setDescription('ギフトを送るユーザー')
            .setRequired(true),
    )
    .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const senderId = interaction.user.id;
    const target = interaction.options.getUser('user', true);

    if (target.bot) {
        await interaction.reply({
            content: 'ボットにはギフトを送れません。',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (target.id === senderId) {
        await interaction.reply({
            content: '自分自身にはギフトを送れません。',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const remaining = await getRemainingGifts(senderId);
    const view = buildGiftTypeSelectView(senderId, target.id, target.displayName, remaining);

    await interaction.reply({
        components: [view],
        flags: MessageFlags.IsComponentsV2,
    });
}

registerCommand({data, execute: execute as never});
