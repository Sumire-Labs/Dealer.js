import { config } from './index.js';
import { DEFAULT_HORSE_NAMES } from './defaults.js';
import { INITIAL_CHIPS, BANK_INTEREST_RATE } from './constants.js';
import { loadYamlConfig, type YamlConfig } from './yaml-loader.js';
import {
  getSetting,
  upsertSetting,
  deleteSetting,
} from '../database/repositories/setting.repository.js';
import { logger } from '../utils/logger.js';

const SETTING_KEYS = {
  horseNames: 'horse_race.names',
  initialChips: 'economy.initial_chips',
  bankInterestRate: 'economy.bank_interest_rate',
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

  // --- Economy: Initial Chips ---

  getInitialChips(): bigint {
    const dbValue = this.dbCache.get(SETTING_KEYS.initialChips);
    if (typeof dbValue === 'number' && dbValue > 0) {
      return BigInt(dbValue);
    }
    if (this.yamlConfig.economy?.initialChips != null && this.yamlConfig.economy.initialChips > 0) {
      return BigInt(this.yamlConfig.economy.initialChips);
    }
    return INITIAL_CHIPS;
  }

  async setInitialChips(value: bigint): Promise<void> {
    await upsertSetting(SETTING_KEYS.initialChips, Number(value));
    this.dbCache.set(SETTING_KEYS.initialChips, Number(value));
  }

  async resetInitialChips(): Promise<void> {
    await deleteSetting(SETTING_KEYS.initialChips);
    this.dbCache.delete(SETTING_KEYS.initialChips);
  }

  // --- Economy: Bank Interest Rate ---

  getBankInterestRate(): bigint {
    const dbValue = this.dbCache.get(SETTING_KEYS.bankInterestRate);
    if (typeof dbValue === 'number' && dbValue >= 0) {
      return BigInt(dbValue);
    }
    if (this.yamlConfig.economy?.bankInterestRate != null && this.yamlConfig.economy.bankInterestRate >= 0) {
      return BigInt(this.yamlConfig.economy.bankInterestRate);
    }
    return BANK_INTEREST_RATE;
  }

  async setBankInterestRate(value: bigint): Promise<void> {
    await upsertSetting(SETTING_KEYS.bankInterestRate, Number(value));
    this.dbCache.set(SETTING_KEYS.bankInterestRate, Number(value));
  }

  async resetBankInterestRate(): Promise<void> {
    await deleteSetting(SETTING_KEYS.bankInterestRate);
    this.dbCache.delete(SETTING_KEYS.bankInterestRate);
  }

  async reload(): Promise<void> {
    this.yamlConfig = loadYamlConfig(config.configPath);
    await this.reloadDbCache();
    logger.info('Config reloaded');
  }
}

export const configService = new ConfigService();
