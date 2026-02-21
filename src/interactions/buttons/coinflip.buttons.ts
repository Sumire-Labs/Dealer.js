import { type ButtonInteraction, MessageFlags } from 'discord.js';
import { registerButtonHandler } from '../handler.js';
import { findOrCreateUser } from '../../database/repositories/user.repository.js';
import { processGameResult } from '../../database/services/economy.service.js';
import { playCoinflip, type CoinSide } from '../../games/coinflip/coinflip.engine.js';
import {
  buildCoinflipFlippingView,
  buildCoinflipResultView,
} from '../../ui/builders/coinflip.builder.js';
import { formatChips } from '../../utils/formatters.js';

// Session storage: userId -> bet amount
export const coinflipSessionManager = new Map<string, bigint>();

async function handleCoinflipButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const choice = parts[1] as CoinSide;
  const ownerId = parts[2];

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: 'これはあなたのコインフリップではありません！ `/coinflip` で遊んでください。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const userId = interaction.user.id;
  const bet = coinflipSessionManager.get(userId);
  if (!bet) {
    await interaction.reply({
      content: 'セッションが期限切れです。`/coinflip` で新しいゲームを始めてください。',
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

  // Show flipping animation
  const flippingView = buildCoinflipFlippingView();
  await interaction.update({
    components: [flippingView],
    flags: MessageFlags.IsComponentsV2,
  });

  // Wait for suspense
  await sleep(1500);

  // Resolve game
  const result = playCoinflip(choice);
  const gameResult = await processGameResult(userId, 'COINFLIP', bet, result.multiplier);

  // Show result
  const resultView = buildCoinflipResultView(
    result.outcome,
    result.playerChoice,
    result.won,
    bet,
    gameResult.payout,
    gameResult.newBalance,
  );
  await interaction.editReply({
    components: [resultView],
    flags: MessageFlags.IsComponentsV2,
  });

  // Clean up session
  coinflipSessionManager.delete(userId);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

registerButtonHandler('coinflip', handleCoinflipButton as never);
