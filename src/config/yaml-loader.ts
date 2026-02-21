import { readFileSync, existsSync } from 'node:fs';
import { parse } from 'yaml';
import { logger } from '../utils/logger.js';

export interface YamlBotConfig {
  token?: string;
  clientId?: string;
  guildId?: string;
  databaseUrl?: string;
}

export interface YamlConfig {
  bot?: YamlBotConfig;
  horseRace?: {
    names?: string[];
  };
}

export function loadYamlConfig(path: string): YamlConfig {
  if (!existsSync(path)) {
    logger.info(`Config file not found at ${path}, using defaults`);
    return {};
  }

  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = parse(raw) as Record<string, unknown> | null;

    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    const result: YamlConfig = {};

    // Parse bot section
    const bot = parsed['bot'] as Record<string, unknown> | undefined;
    if (bot && typeof bot === 'object') {
      result.bot = {};
      if (typeof bot['token'] === 'string' && bot['token'].trim()) {
        result.bot.token = bot['token'].trim();
      }
      if (typeof bot['client-id'] === 'string' && bot['client-id'].trim()) {
        result.bot.clientId = bot['client-id'].trim();
      }
      if (typeof bot['guild-id'] === 'string' && bot['guild-id'].trim()) {
        result.bot.guildId = bot['guild-id'].trim();
      }
      if (typeof bot['database-url'] === 'string' && bot['database-url'].trim()) {
        result.bot.databaseUrl = bot['database-url'].trim();
      }
    }

    // Parse horse-race section
    const horseRace = parsed['horse-race'] as Record<string, unknown> | undefined;
    if (horseRace && typeof horseRace === 'object') {
      if (Array.isArray(horseRace.names)) {
        result.horseRace = {
          names: horseRace.names.filter(
            (n: unknown): n is string => typeof n === 'string' && n.trim().length > 0,
          ),
        };
      }
    }

    return result;
  } catch (error) {
    logger.error('Failed to parse config.yaml', { error: String(error) });
    return {};
  }
}
