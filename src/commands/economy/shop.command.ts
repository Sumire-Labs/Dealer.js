import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { registerCommand } from '../registry.js';
import { getBalance } from '../../database/services/economy.service.js';
import { buildShopView } from '../../ui/builders/shop.builder.js';

const data = new SlashCommandBuilder()
  .setName('shop')
  .setDescription('カジノショップでアイテムを購入')
  .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  const balance = await getBalance(userId);

  const view = buildShopView(userId, 0, 0, balance);

  await interaction.reply({
    components: [view],
    flags: MessageFlags.IsComponentsV2,
  });
}

registerCommand({ data, execute: execute as never });
