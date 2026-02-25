import {type ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder,} from 'discord.js';
import {registerCommand} from '../registry.js';
import {getBalance} from '../../database/services/economy.service.js';
import {getFlashSale} from '../../database/services/shop.service.js';
import {getLifetimeShopSpend} from '../../database/repositories/shop.repository.js';
import {getNextRank, getShopRank} from '../../config/shop-ranks.js';
import {buildShopView} from '../../ui/builders/shop.builder.js';

const data = new SlashCommandBuilder()
  .setName('shop')
  .setDescription('カジノショップでアイテムを購入')
  .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;

  const [balance, spend, flashSale] = await Promise.all([
    getBalance(userId),
    getLifetimeShopSpend(userId),
    getFlashSale(),
  ]);

  const rank = getShopRank(spend);
  const nextRank = getNextRank(rank);
  const rankInfo = { rank, nextRank, lifetimeSpend: spend };

  const view = buildShopView(userId, 0, 0, balance, rankInfo, flashSale);

  await interaction.reply({
    components: [view],
    flags: MessageFlags.IsComponentsV2,
  });
}

registerCommand({ data, execute: execute as never });
