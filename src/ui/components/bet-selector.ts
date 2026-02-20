import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { formatChips } from '../../utils/formatters.js';

export interface BetSelectorOptions {
  currentBet: bigint;
  minBet: bigint;
  maxBet: bigint;
  gamePrefix: string;
}

const BET_STEPS = [100n, 500n, 1_000n, 5_000n, 10_000n, 50_000n];

export function buildBetSelector(options: BetSelectorOptions): ActionRowBuilder<ButtonBuilder> {
  const { currentBet, minBet, maxBet, gamePrefix } = options;

  const lowerStep = BET_STEPS.filter(s => s < currentBet).pop() ?? minBet;
  const higherStep = BET_STEPS.find(s => s > currentBet) ?? maxBet;

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${gamePrefix}:bet_down`)
      .setLabel(`◀ ${formatChips(lowerStep)}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentBet <= minBet),
    new ButtonBuilder()
      .setCustomId(`${gamePrefix}:bet_up`)
      .setLabel(`${formatChips(higherStep)} ▶`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentBet >= maxBet),
    new ButtonBuilder()
      .setCustomId(`${gamePrefix}:bet_max`)
      .setLabel('MAX BET')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(currentBet >= maxBet),
  );
}
