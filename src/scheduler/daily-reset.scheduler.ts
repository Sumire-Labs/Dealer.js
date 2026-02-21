import { cleanupStaleSessions } from '../database/repositories/race.repository.js';
import { applyInterestToAll } from '../database/services/bank-account.service.js';
import { logger } from '../utils/logger.js';

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const INTEREST_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

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

  logger.info('Scheduler started');
}
