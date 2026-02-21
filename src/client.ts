import { Client, Events, GatewayIntentBits, ActivityType } from 'discord.js';
import { createRequire } from 'node:module';
import { config } from './config/index.js';
import { deployCommands } from './commands/registry.js';
import { handleInteraction } from './interactions/handler.js';
import { logger } from './utils/logger.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

export function createClient(): Client {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  client.once(Events.ClientReady, async (readyClient) => {
    logger.info(`Logged in as ${readyClient.user.tag}`);
    readyClient.user.setPresence({
      activities: [{ name: `v${version}`, type: ActivityType.Playing }],
      status: 'online',
    });
    await deployCommands();
  });

  client.on(Events.InteractionCreate, handleInteraction);

  return client;
}

export async function startBot(): Promise<void> {
  const client = createClient();
  await client.login(config.discordToken);
}
