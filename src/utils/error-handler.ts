import {ContainerBuilder, type Interaction, MessageFlags, TextDisplayBuilder,} from 'discord.js';
import {logger} from './logger.js';

export async function handleInteractionError(
  interaction: Interaction,
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : '予期しないエラーが発生しました。';
  logger.error('Interaction error', { error: message, interactionId: interaction.id });

  const container = new ContainerBuilder()
    .setAccentColor(0xD32F2F)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**エラー**: ${message}`),
    );

  try {
    if (interaction.isRepliable()) {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          components: [container],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      } else {
        await interaction.reply({
          components: [container],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }
    }
  } catch (replyError) {
    logger.error('Failed to send error response', { error: replyError });
  }
}
