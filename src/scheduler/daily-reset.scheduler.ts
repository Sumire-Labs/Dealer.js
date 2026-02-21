import { cleanupStaleSessions } from '../database/repositories/race.repository.js';
import { logger } from '../utils/logger.js';

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

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

  logger.info('Scheduler started');
}
