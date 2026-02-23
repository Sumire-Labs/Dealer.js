import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { registerCommand } from '../registry.js';
import { S } from '../../config/setting-defs.js';
import { findOrCreateUser } from '../../database/repositories/user.repository.js';
import { buildCoinflipChoiceView } from '../../ui/builders/coinflip.builder.js';
import { setSessionBet as setCoinflipBet } from '../../interactions/buttons/coinflip.buttons.js';
import { formatChips } from '../../utils/formatters.js';

const data = new SlashCommandBuilder()
  .setName('coinflip')
  .setDescription('コイントス — 一か八かの勝負！')
  .addIntegerOption(option =>
    option
      .setName('bet')
      .setDescription('ベット額')
      .setRequired(true)
      .setMinValue(Number(S.minBet.defaultValue))
      .setMaxValue(Number(S.maxCoinflip.defaultValue)),
  )
  .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  const bet = BigInt(interaction.options.getInteger('bet', true));

  const user = await findOrCreateUser(userId);
  if (user.chips < bet) {
    await interaction.reply({
      content: `チップが不足しています！ 残高: ${formatChips(user.chips)}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Store bet for button handler
  setCoinflipBet(userId, bet);

  const choiceView = buildCoinflipChoiceView(bet, user.chips, userId);
  await interaction.reply({
    components: [choiceView],
    flags: MessageFlags.IsComponentsV2,
  });
}

registerCommand({ data, execute: execute as never });
