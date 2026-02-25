import {config} from './index.js';
import {DEFAULT_HORSE_NAMES} from './defaults.js';
import {loadYamlConfig, type YamlConfig} from './yaml-loader.js';
import {deleteSetting, getAllSettings, upsertSetting,} from '../database/repositories/setting.repository.js';
import {logger} from '../utils/logger.js';
import {type AnySettingDef, SETTING_CATEGORIES, type SettingDef,} from './setting-defs.js';

const HORSE_NAMES_KEY = 'horse_race.names';

class ConfigService {
    private yamlConfig: YamlConfig = {};
    private yamlSettings = new Map<string, number>();
    private dbCache = new Map<string, unknown>();

    async initialize(): Promise<void> {
        this.yamlConfig = loadYamlConfig(config.configPath);
        this.yamlSettings = this.yamlConfig.settings ?? new Map();
        logger.info('YAML config loaded');

        await this.reloadDbCache();
        logger.info('DB settings cached');
    }

    private async reloadDbCache(): Promise<void> {
        this.dbCache.clear();
        const rows = await getAllSettings();
        for (const row of rows) {
            this.dbCache.set(row.key, row.value);
        }
    }

    // ── Generic getters ────────────────────────────────────────────────

    getBigInt(def: SettingDef<'bigint'>): bigint {
        const dbValue = this.dbCache.get(def.key);
        if (typeof dbValue === 'number') return BigInt(dbValue);
        const yamlValue = this.yamlSettings.get(def.key);
        if (yamlValue != null) return BigInt(yamlValue);
        return def.defaultValue;
    }

    getNumber(def: SettingDef<'number'>): number {
        const dbValue = this.dbCache.get(def.key);
        if (typeof dbValue === 'number') return dbValue;
        const yamlValue = this.yamlSettings.get(def.key);
        if (yamlValue != null) return yamlValue;
        return def.defaultValue;
    }

    // ── Generic setters ────────────────────────────────────────────────

    async setNumeric(def: AnySettingDef, value: number): Promise<void> {
        await upsertSetting(def.key, value);
        this.dbCache.set(def.key, value);
    }

    async resetSetting(def: AnySettingDef): Promise<void> {
        await deleteSetting(def.key);
        this.dbCache.delete(def.key);
    }

    async resetCategory(categoryId: string): Promise<void> {
        const cat = SETTING_CATEGORIES.find(c => c.id === categoryId);
        if (!cat) return;
        for (const def of cat.settings) {
            await deleteSetting(def.key);
            this.dbCache.delete(def.key);
        }
    }

    // ── Display helpers ────────────────────────────────────────────────

    getDisplayValue(def: AnySettingDef): string {
        const raw = def.type === 'bigint'
            ? Number(this.getBigInt(def as SettingDef<'bigint'>))
            : this.getNumber(def as SettingDef<'number'>);
        const display = def.uiDivisor === 1 ? raw : raw / def.uiDivisor;
        if (def.unit === 'チップ') return `${display.toLocaleString()} ${def.unit}`;
        if (def.unit) return `${display} ${def.unit}`;
        return `${display}`;
    }

    getRawNumber(def: AnySettingDef): number {
        return def.type === 'bigint'
            ? Number(this.getBigInt(def as SettingDef<'bigint'>))
            : this.getNumber(def as SettingDef<'number'>);
    }

    hasOverride(def: AnySettingDef): boolean {
        return this.dbCache.has(def.key) || this.yamlSettings.has(def.key);
    }

    // ── Horse names (non-numeric, kept separate) ──────────────────────

    getHorseNames(): string[] {
        const dbValue = this.dbCache.get(HORSE_NAMES_KEY);
        if (Array.isArray(dbValue) && dbValue.length > 0) {
            return dbValue as string[];
        }
        if (this.yamlConfig.horseRace?.names && this.yamlConfig.horseRace.names.length > 0) {
            return this.yamlConfig.horseRace.names;
        }
        return DEFAULT_HORSE_NAMES;
    }

    async setHorseNames(names: string[]): Promise<void> {
        await upsertSetting(HORSE_NAMES_KEY, names);
        this.dbCache.set(HORSE_NAMES_KEY, names);
    }

    async resetHorseNames(): Promise<void> {
        await deleteSetting(HORSE_NAMES_KEY);
        this.dbCache.delete(HORSE_NAMES_KEY);
    }

    // ── Reload ─────────────────────────────────────────────────────────

    async reload(): Promise<void> {
        this.yamlConfig = loadYamlConfig(config.configPath);
        this.yamlSettings = this.yamlConfig.settings ?? new Map();
        await this.reloadDbCache();
        logger.info('Config reloaded');
    }
}

export const configService = new ConfigService();
