import {cleanupStaleSessions} from '../database/repositories/race.repository.js';
import {cleanupExpiredBuffs} from '../database/repositories/shop.repository.js';
import {applyInterestToAll} from '../database/services/bank-account.service.js';
import {checkAndExecuteDraws} from '../database/services/lottery.service.js';
import {checkAndRefreshFlashSale, checkAndRefreshRotation} from '../database/services/shop.service.js';
import {processMatureDeposits} from '../database/services/fixed-deposit.service.js';
import {startCooldownCleanup} from '../utils/cooldown.js';
import {logger} from '../utils/logger.js';

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const INTEREST_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const LOTTERY_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const SHOP_ROTATION_CHECK_MS = 5 * 60 * 1000; // 5 minutes
const FLASH_SALE_CHECK_MS = 2 * 60 * 60 * 1000; // 2 hours
const WEEKLY_CHALLENGE_CHECK_MS = 60 * 60 * 1000; // 1 hour
const FIXED_DEPOSIT_CHECK_MS = 60 * 60 * 1000; // 1 hour
const BUFF_CLEANUP_MS = 15 * 60 * 1000; // 15 minutes

export function startScheduler(): void {
  // Periodic cleanup of stale race sessions
  setInterval(async () => {
    try {
      const result = await cleanupStaleSessions();
      if (result.count > 0) {
        logger.info(`Cleaned up ${result.count} stale race sessions`);
      }
    } catch (err) {
      logger.error('Scheduler cleanup failed', { error: String(err) });
    }
  }, CLEANUP_INTERVAL_MS);

  // Periodic interest distribution
  setInterval(async () => {
    try {
      const count = await applyInterestToAll();
      if (count > 0) {
        logger.info(`Applied interest to ${count} users`);
      }
    } catch (err) {
      logger.error('Interest distribution failed', { error: String(err) });
    }
  }, INTEREST_INTERVAL_MS);

  // Periodic lottery draw check
  setInterval(async () => {
    try {
      const drawn = await checkAndExecuteDraws();
      if (drawn > 0) {
        logger.info(`Executed ${drawn} lottery draws`);
      }
    } catch (err) {
      logger.error('Lottery draw check failed', { error: String(err) });
    }
  }, LOTTERY_CHECK_INTERVAL_MS);

  // Periodic shop rotation check
  setInterval(async () => {
    try {
      const refreshed = await checkAndRefreshRotation();
      if (refreshed) {
        logger.info('Shop daily rotation refreshed');
      }
    } catch (err) {
      logger.error('Shop rotation check failed', { error: String(err) });
    }
  }, SHOP_ROTATION_CHECK_MS);

  // Periodic flash sale refresh (every 2 hours)
  setInterval(async () => {
    try {
      const refreshed = await checkAndRefreshFlashSale();
      if (refreshed) {
        logger.info('Flash sale refreshed');
      }
    } catch (err) {
      logger.error('Flash sale check failed', { error: String(err) });
    }
  }, FLASH_SALE_CHECK_MS);

  // Weekly challenge check (auto-assign on Monday)
  setInterval(async () => {
    try {
      const now = new Date();
      if (now.getDay() === 1 && now.getHours() < 2) {
        logger.info('Weekly challenge period — new challenges will be assigned on demand');
      }
    } catch (err) {
      logger.error('Weekly challenge check failed', { error: String(err) });
    }
  }, WEEKLY_CHALLENGE_CHECK_MS);

  // Periodic fixed deposit maturity check
  setInterval(async () => {
    try {
      const count = await processMatureDeposits();
      if (count > 0) {
        logger.info(`Processed ${count} mature fixed deposits`);
      }
    } catch (err) {
      logger.error('Fixed deposit maturity check failed', { error: String(err) });
    }
  }, FIXED_DEPOSIT_CHECK_MS);

  // Periodic expired buff cleanup (replaces per-query deletion)
  setInterval(async () => {
    try {
      const count = await cleanupExpiredBuffs();
      if (count > 0) {
        logger.info(`Cleaned up ${count} expired buffs`);
      }
    } catch (err) {
      logger.error('Buff cleanup failed', { error: String(err) });
    }
  }, BUFF_CLEANUP_MS);

  // Start cooldown map periodic cleanup
  startCooldownCleanup();

  logger.info('Scheduler started');
}
