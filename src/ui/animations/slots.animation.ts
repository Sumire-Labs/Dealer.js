import type { MessageComponentInteraction, ChatInputCommandInteraction } from 'discord.js';
import { MessageFlags } from 'discord.js';
import { SLOTS_CONFIG } from '../../config/games.js';
import { generateRandomReelDisplay, type SlotsResult } from '../../games/slots/slots.engine.js';
import { SPIN_EMOJIS } from '../../games/slots/slots.symbols.js';
import { buildSlotsSpinningView, buildSlotsResultView } from '../builders/slots.builder.js';
import { secureRandomInt } from '../../utils/random.js';

function pickRandomEmoji(): string {
  return SPIN_EMOJIS[secureRandomInt(0, SPIN_EMOJIS.length - 1)];
}

export async function playSlotsAnimation(
  interaction: ChatInputCommandInteraction | MessageComponentInteraction,
  result: SlotsResult,
  bet: bigint,
  payout: bigint,
  newBalance: bigint,
  userId: string,
): Promise<void> {
  const { animationSpinFrames, animationSpinInterval, animationStopInterval } = SLOTS_CONFIG;

  // Phase 1: spinning frames — all reels random
  for (let i = 0; i < animationSpinFrames; i++) {
    const randomReels = generateRandomReelDisplay();
    const symbols: [string, string, string] = [
      randomReels[0].emoji,
      randomReels[1].emoji,
      randomReels[2].emoji,
    ];
    const spinView = buildSlotsSpinningView(symbols);

    if (i === 0) {
      await interaction.editReply({
        components: [spinView],
        flags: MessageFlags.IsComponentsV2,
      });
    } else {
      await interaction.editReply({
        components: [spinView],
        flags: MessageFlags.IsComponentsV2,
      });
    }
    await sleep(animationSpinInterval);
  }

  // Phase 2: stop reels left to right
  const finalEmojis = result.reels.map(r => r.emoji);

  // Stop reel 1
  const stop1View = buildSlotsSpinningView([
    finalEmojis[0],
    pickRandomEmoji(),
    pickRandomEmoji(),
  ]);
  await interaction.editReply({
    components: [stop1View],
    flags: MessageFlags.IsComponentsV2,
  });
  await sleep(animationStopInterval);

  // Stop reel 2
  const stop2View = buildSlotsSpinningView([
    finalEmojis[0],
    finalEmojis[1],
    pickRandomEmoji(),
  ]);
  await interaction.editReply({
    components: [stop2View],
    flags: MessageFlags.IsComponentsV2,
  });
  await sleep(animationStopInterval);

  // Phase 3: final result
  const resultView = buildSlotsResultView(
    result.reels,
    result.paytable,
    bet,
    payout,
    newBalance,
    userId,
  );
  await interaction.editReply({
    components: [resultView],
    flags: MessageFlags.IsComponentsV2,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
