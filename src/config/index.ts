import { loadYamlConfig } from './yaml-loader.js';

const configPath = process.env['CONFIG_PATH'] || './config.yaml';
const yaml = loadYamlConfig(configPath);

function require(key: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required config: "${key}" in config.yaml`);
  }
  return value;
}

export const config = {
  discordToken: require('bot.token', yaml.bot?.token),
  clientId: require('bot.client-id', yaml.bot?.clientId),
  guildId: yaml.bot?.guildId,
  databaseUrl: require('bot.database-url', yaml.bot?.databaseUrl),
  configPath,
} as const;
