import {loadYamlConfig} from './yaml-loader.js';

const configPath = process.env['CONFIG_PATH'] || './config.yaml';
const yaml = loadYamlConfig(configPath);

function requireConfig(key: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required config: "${key}" in config.yaml`);
  }
  return value;
}

export const config = {
  discordToken: requireConfig('bot.token', yaml.bot?.token),
  clientId: requireConfig('bot.client-id', yaml.bot?.clientId),
  guildId: yaml.bot?.guildId,
  databaseUrl: requireConfig('bot.database-url', yaml.bot?.databaseUrl),
  configPath,
} as const;

// Prisma Client reads DATABASE_URL from process.env at runtime
process.env.DATABASE_URL = config.databaseUrl;
