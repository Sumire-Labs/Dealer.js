import {
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
  type ButtonInteraction,
} from 'discord.js';
import { CasinoTheme } from '../themes/casino.theme.js';
import { buildCraftResultView } from '../builders/craft.builder.js';

const CRAFT_FRAMES = [
  '🔨 素材を集めています...',
  '⚡ 合成中... ✨',
  '🌟 完成！',
];
const FRAME_DELAY_MS = 600;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function playCraftAnimation(
  interaction: ButtonInteraction,
  userId: string,
  recipeName: string,
  resultEmoji: string,
  resultName: string,
): Promise<void> {
  // Play animation frames
  for (const frame of CRAFT_FRAMES.slice(0, -1)) {
    const container = new ContainerBuilder()
      .setAccentColor(CasinoTheme.colors.gold);
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(frame),
    );
    await interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
    await sleep(FRAME_DELAY_MS);
  }

  // Show final result
  const resultView = buildCraftResultView(userId, recipeName, resultEmoji, resultName);
  await interaction.editReply({
    components: [resultView],
    flags: MessageFlags.IsComponentsV2,
  });
}
