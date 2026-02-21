import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { registerCommand } from '../registry.js';
import { MIN_BET, MAX_BET_ROULETTE } from '../../config/constants.js';
import { findOrCreateUser } from '../../database/repositories/user.repository.js';
import { buildRouletteIdleView } from '../../ui/builders/roulette.builder.js';
import { rouletteSessionManager } from '../../interactions/buttons/roulette.buttons.js';
import { formatChips } from '../../utils/formatters.js';

const data = new SlashCommandBuilder()
  .setName('roulette')
  .setDescription('ヨーロピアンルーレット')
  .addIntegerOption(option =>
    option
      .setName('bet')
      .setDescription('ベット額')
      .setRequired(false)
      .setMinValue(Number(MIN_BET))
      .setMaxValue(Number(MAX_BET_ROULETTE)),
  )
  .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  const betInput = interaction.options.getInteger('bet');
  const bet = betInput ? BigInt(betInput) : MIN_BET;

  const user = await findOrCreateUser(userId);
  if (user.chips < bet) {
    await interaction.reply({
      content: `チップが不足しています！ 残高: ${formatChips(user.chips)}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  rouletteSessionManager.set(userId, bet);

  const view = buildRouletteIdleView(bet, user.chips, userId);
  await interaction.reply({
    components: [view],
    flags: MessageFlags.IsComponentsV2,
  });
}

registerCommand({ data, execute: execute as never });
