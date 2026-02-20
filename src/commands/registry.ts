import {
  REST,
  Routes,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export interface CommandModule {
  data: RESTPostAPIChatInputApplicationCommandsJSONBody;
  execute: (interaction: never) => Promise<void>;
}

const commands = new Map<string, CommandModule>();

export function registerCommand(module: CommandModule): void {
  commands.set(module.data.name, module);
}

export function getCommand(name: string): CommandModule | undefined {
  return commands.get(name);
}

export async function deployCommands(): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(config.discordToken);
  const commandData = [...commands.values()].map(c => c.data);

  logger.info(`Deploying ${commandData.length} commands to guild ${config.guildId}`);

  await rest.put(
    Routes.applicationGuildCommands(config.clientId, config.guildId),
    { body: commandData },
  );

  logger.info('Commands deployed successfully');
}
