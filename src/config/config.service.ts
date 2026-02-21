import { config } from './index.js';
import { DEFAULT_HORSE_NAMES } from './defaults.js';
import { loadYamlConfig, type YamlConfig } from './yaml-loader.js';
import {
  getSetting,
  upsertSetting,
  deleteSetting,
} from '../database/repositories/setting.repository.js';
import { logger } from '../utils/logger.js';

const SETTING_KEYS = {
  horseNames: 'horse_race.names',
} as const;

class ConfigService {
  private yamlConfig: YamlConfig = {};
  private dbCache = new Map<string, unknown>();

  async initialize(): Promise<void> {
    // Load YAML config
    this.yamlConfig = loadYamlConfig(config.configPath);
    logger.info('YAML config loaded');

    // Load DB settings into cache
    await this.reloadDbCache();
    logger.info('DB settings cached');
  }

  private async reloadDbCache(): Promise<void> {
    this.dbCache.clear();
    for (const key of Object.values(SETTING_KEYS)) {
      const value = await getSetting(key);
      if (value !== null) {
        this.dbCache.set(key, value);
      }
    }
  }

  getHorseNames(): string[] {
    // Priority: DB > YAML > defaults
    const dbValue = this.dbCache.get(SETTING_KEYS.horseNames);
    if (Array.isArray(dbValue) && dbValue.length > 0) {
      return dbValue as string[];
    }

    if (this.yamlConfig.horseRace?.names && this.yamlConfig.horseRace.names.length > 0) {
      return this.yamlConfig.horseRace.names;
    }

    return DEFAULT_HORSE_NAMES;
  }

  async setHorseNames(names: string[]): Promise<void> {
    await upsertSetting(SETTING_KEYS.horseNames, names);
    this.dbCache.set(SETTING_KEYS.horseNames, names);
  }

  async resetHorseNames(): Promise<void> {
    await deleteSetting(SETTING_KEYS.horseNames);
    this.dbCache.delete(SETTING_KEYS.horseNames);
  }

  async reload(): Promise<void> {
    this.yamlConfig = loadYamlConfig(config.configPath);
    await this.reloadDbCache();
    logger.info('Config reloaded');
  }
}

export const configService = new ConfigService();
