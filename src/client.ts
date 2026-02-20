import { Client, Events, GatewayIntentBits } from 'discord.js';
import { config } from './config/index.js';
import { deployCommands } from './commands/registry.js';
import { handleInteraction } from './interactions/handler.js';
import { logger } from './utils/logger.js';

export function createClient(): Client {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  client.once(Events.ClientReady, async (readyClient) => {
    logger.info(`Logged in as ${readyClient.user.tag}`);
    await deployCommands();
  });

  client.on(Events.InteractionCreate, handleInteraction);

  return client;
}

export async function startBot(): Promise<void> {
  const client = createClient();
  await client.login(config.discordToken);
}
