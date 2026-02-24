import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { registerCommand } from '../registry.js';
import { configService } from '../../config/config.service.js';
import { S } from '../../config/setting-defs.js';
import { findOrCreateUser } from '../../database/repositories/user.repository.js';
import { bjSessionManager } from '../../interactions/buttons/blackjack.buttons.js';
import { getActiveTableSession } from '../../games/blackjack/blackjack-table.session.js';
import { buildModeSelectView } from '../../ui/builders/blackjack-table.builder.js';
import { formatChips } from '../../utils/formatters.js';

const data = new SlashCommandBuilder()
  .setName('blackjack')
  .setDescription('ディーラーとブラックジャックで対戦')
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

  const maxBet = configService.getBigInt(S.maxBlackjack);
  if (maxBet > 0n && bet > maxBet) {
    await interaction.reply({
      content: `ベット上限は${formatChips(maxBet)}です。`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Check for existing solo session
  if (bjSessionManager.has(userId)) {
    await interaction.reply({
      content: '進行中のブラックジャックがあります！ 先にそちらを終わらせてください。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Check for existing table session in this channel
  const existingTable = getActiveTableSession(interaction.channelId);
  if (existingTable && existingTable.phase !== 'resolved' && existingTable.phase !== 'cancelled') {
    await interaction.reply({
      content: 'このチャンネルではすでにブラックジャックテーブルが進行中です！',
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
  const modeView = buildModeSelectView(userId, bet);
  await interaction.reply({
    components: [modeView],
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
  });
}

registerCommand({ data, execute: execute as never });
