import {type ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder,} from 'discord.js';
import {registerCommand} from '../registry.js';
import {getUserInventorySummary} from '../../database/services/shop.service.js';
import {buildInventoryView} from '../../ui/builders/inventory.builder.js';

const data = new SlashCommandBuilder()
    .setName('inv')
    .setDescription('インベントリを確認する')
    .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;

    const summary = await getUserInventorySummary(userId);
    const view = buildInventoryView(
        userId,
        summary.inventory,
        summary.activeBuffs,
        summary.activeTitle,
        summary.activeBadge,
        0,
    );

    await interaction.reply({
        components: [view],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
}

registerCommand({data, execute: execute as never});
