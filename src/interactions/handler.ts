import type { Interaction } from 'discord.js';
import { getCommand } from '../commands/registry.js';
import { handleInteractionError } from '../utils/error-handler.js';
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
    if (interaction.isChatInputCommand()) {
      const command = getCommand(interaction.commandName);
      if (!command) {
        logger.warn(`Unknown command: ${interaction.commandName}`);
        return;
      }
      await command.execute(interaction as never);
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
    await handleInteractionError(interaction, error);
  }
}
