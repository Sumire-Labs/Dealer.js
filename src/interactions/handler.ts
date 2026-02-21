import { type Interaction, MessageFlags } from 'discord.js';
import { getCommand } from '../commands/registry.js';
import { handleInteractionError } from '../utils/error-handler.js';
import {
  isOnCooldown,
  getRemainingCooldown,
  setCooldown,
  buildCooldownKey,
} from '../utils/cooldown.js';
import { COMMAND_COOLDOWN_MS } from '../config/constants.js';
import { formatTimeDelta } from '../utils/formatters.js';
import { logger } from '../utils/logger.js';

const buttonHandlers = new Map<string, (interaction: never) => Promise<void>>();
const modalHandlers = new Map<string, (interaction: never) => Promise<void>>();

export function registerButtonHandler(
  prefix: string,
  handler: (interaction: never) => Promise<void>,
): void {
  buttonHandlers.set(prefix, handler);
}

export function registerModalHandler(
  prefix: string,
  handler: (interaction: never) => Promise<void>,
): void {
  modalHandlers.set(prefix, handler);
}

export async function handleInteraction(interaction: Interaction): Promise<void> {
  try {
    // Ignore bot users
    if (interaction.user.bot) return;

    if (interaction.isChatInputCommand()) {
      const command = getCommand(interaction.commandName);
      if (!command) {
        logger.warn(`Unknown command: ${interaction.commandName}`);
        return;
      }

      // Cooldown check for game commands
      const cooldownKey = buildCooldownKey(interaction.user.id, interaction.commandName);
      if (isOnCooldown(cooldownKey)) {
        const remaining = getRemainingCooldown(cooldownKey);
        await interaction.reply({
          content: `Please wait **${formatTimeDelta(remaining)}** before using this command again.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await command.execute(interaction as never);
      setCooldown(cooldownKey, COMMAND_COOLDOWN_MS);
      return;
    }

    if (interaction.isButton()) {
      const customId = interaction.customId;
      const prefix = customId.split(':')[0];
      const handler = buttonHandlers.get(prefix);
      if (handler) {
        await handler(interaction as never);
      } else {
        logger.warn(`Unknown button prefix: ${prefix}`);
      }
      return;
    }

    if (interaction.isModalSubmit()) {
      const customId = interaction.customId;
      const prefix = customId.split(':')[0];
      const handler = modalHandlers.get(prefix);
      if (handler) {
        await handler(interaction as never);
      } else {
        logger.warn(`Unknown modal prefix: ${prefix}`);
      }
      return;
    }
  } catch (error) {
    logger.error('Interaction error caught by global handler', {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user?.id,
    });
    await handleInteractionError(interaction, error);
  }
}
