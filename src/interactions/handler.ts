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
import { isJailed, getRemainingJailTime } from '../games/prison/prison.session.js';

const buttonHandlers = new Map<string, (interaction: never) => Promise<void>>();
const modalHandlers = new Map<string, (interaction: never) => Promise<void>>();
const selectMenuHandlers = new Map<string, (interaction: never) => Promise<void>>();

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

export function registerSelectMenuHandler(
  prefix: string,
  handler: (interaction: never) => Promise<void>,
): void {
  selectMenuHandlers.set(prefix, handler);
}

export async function handleInteraction(interaction: Interaction): Promise<void> {
  try {
    // Ignore bot users
    if (interaction.user.bot) return;

    // Prison check: block all interactions except /prison and prison buttons
    if (isJailed(interaction.user.id)) {
      const isPrisonCommand = interaction.isChatInputCommand() && interaction.commandName === 'prison';
      const isPrisonButton = interaction.isButton() && interaction.customId.startsWith('prison:');

      if (!isPrisonCommand && !isPrisonButton) {
        const remaining = getRemainingJailTime(interaction.user.id);
        if (interaction.isRepliable()) {
          await interaction.reply({
            content: `🔒 あなたは刑務所にいます！残り: **${formatTimeDelta(remaining)}**\n\`/prison\` で状況を確認できます。`,
            flags: MessageFlags.Ephemeral,
          });
        }
        return;
      }
    }

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
          content: `このコマンドは **${formatTimeDelta(remaining)}** 後に再使用できます。`,
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

    if (interaction.isAnySelectMenu()) {
      const customId = interaction.customId;
      const prefix = customId.split(':')[0];
      const handler = selectMenuHandlers.get(prefix);
      if (handler) {
        await handler(interaction as never);
      } else {
        logger.warn(`Unknown select menu prefix: ${prefix}`);
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
