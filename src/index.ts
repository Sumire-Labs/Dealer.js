import { startBot } from './client.js';
import { logger } from './utils/logger.js';

async function loadModules(): Promise<void> {
  // Economy commands
  await import('./commands/economy/balance.command.js');
  await import('./commands/economy/leaderboard.command.js');

  // Casino commands
  await import('./commands/casino/daily.command.js');
  await import('./commands/casino/slots.command.js');
  await import('./commands/casino/coinflip.command.js');
  await import('./commands/casino/blackjack.command.js');

  // Button handlers
  await import('./interactions/buttons/slots.buttons.js');
  await import('./interactions/buttons/coinflip.buttons.js');
  await import('./interactions/buttons/blackjack.buttons.js');

  // Admin commands
  await import('./commands/admin/give.command.js');
  await import('./commands/admin/reset.command.js');
}

async function main(): Promise<void> {
  logger.info('Starting Dealer.js...');
  await loadModules();
  await startBot();
}

main().catch((error) => {
  logger.error('Fatal error during startup', { error: String(error) });
  process.exit(1);
});
