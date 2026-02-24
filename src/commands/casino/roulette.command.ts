import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { registerCommand } from '../registry.js';
import { configService } from '../../config/config.service.js';
import { S } from '../../config/setting-defs.js';
import { findOrCreateUser } from '../../database/repositories/user.repository.js';
import { buildRouletteIdleView } from '../../ui/builders/roulette.builder.js';
import { setSessionBet as setRouletteBet } from '../../interactions/buttons/roulette.buttons.js';
import { formatChips } from '../../utils/formatters.js';

const data = new SlashCommandBuilder()
  .setName('roulette')
  .setDescription('ヨーロピアンルーレット')
  .addIntegerOption(option =>
    option
      .setName('bet')
      .setDescription('ベット額')
      .setRequired(false)
      .setMinValue(Number(S.minBet.defaultValue)),
  )
  .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  const betInput = interaction.options.getInteger('bet');
  const bet = betInput ? BigInt(betInput) : configService.getBigInt(S.minBet);

  const maxBet = configService.getBigInt(S.maxRoulette);
  if (maxBet > 0n && bet > maxBet) {
    await interaction.reply({
      content: `ベット上限は${formatChips(maxBet)}です。`,
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

  setRouletteBet(userId, bet);

  const view = buildRouletteIdleView(bet, user.chips, userId);
  await interaction.reply({
    components: [view],
    flags: MessageFlags.IsComponentsV2,
  });
}

registerCommand({ data, execute: execute as never });
