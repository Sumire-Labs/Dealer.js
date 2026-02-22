import type { MessageComponentInteraction } from 'discord.js';
import { MessageFlags, ContainerBuilder, TextDisplayBuilder } from 'discord.js';
import { CasinoTheme } from '../themes/casino.theme.js';
import { buildMysteryBoxResultView } from '../builders/shop.builder.js';
import type { ItemRarity } from '../../config/shop.js';

const ANIMATION_FRAMES = [
  '📦 . . .',
  '📦 . . 🔮',
  '📦 . 🔮 .',
  '📦 🔮 . .',
  '📦 💫 . .',
  '📦 . 💫 .',
  '📦 . . 💫',
  '✨ ━━━ !! ━━━ ✨',
];

const FRAME_INTERVAL = 350;

export async function playMysteryBoxAnimation(
  interaction: MessageComponentInteraction,
  userId: string,
  boxEmoji: string,
  resultEmoji: string,
  resultName: string,
  rarity: ItemRarity,
  chipsAwarded: bigint | undefined,
  newBalance: bigint | undefined,
): Promise<void> {
  // Play spinning frames
  for (const frame of ANIMATION_FRAMES) {
    const container = new ContainerBuilder()
      .setAccentColor(CasinoTheme.colors.purple)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(CasinoTheme.prefixes.mystery),
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`\n${frame}\n`),
      );

    await interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
    await sleep(FRAME_INTERVAL);
  }

  // Short pause
  await sleep(300);

  // Show result
  const resultView = buildMysteryBoxResultView(
    userId,
    boxEmoji,
    resultEmoji,
    resultName,
    rarity,
    chipsAwarded,
    newBalance,
  );

  await interaction.editReply({
    components: [resultView],
    flags: MessageFlags.IsComponentsV2,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
