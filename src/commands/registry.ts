import {REST, type RESTPostAPIChatInputApplicationCommandsJSONBody, Routes,} from 'discord.js';
import {config} from '../config/index.js';
import {logger} from '../utils/logger.js';

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

  if (config.guildId) {
    // Guild-scoped: instant update, useful for development
    logger.info(`Deploying ${commandData.length} commands to guild ${config.guildId}`);
    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: commandData },
    );
  } else {
    // Global: works on all servers, takes up to 1 hour to propagate
    logger.info(`Deploying ${commandData.length} commands globally`);
    await rest.put(
      Routes.applicationCommands(config.clientId),
      { body: commandData },
    );
  }

  logger.info('Commands deployed successfully');
}
