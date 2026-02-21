import { startBot } from './client.js';
import { startScheduler } from './scheduler/daily-reset.scheduler.js';
import { configService } from './config/config.service.js';
import { logger } from './utils/logger.js';

async function loadModules(): Promise<void> {
  // Economy commands
  await import('./commands/economy/balance.command.js');
  await import('./commands/economy/leaderboard.command.js');
  await import('./commands/economy/bank.command.js');

  // Casino commands
  await import('./commands/casino/daily.command.js');
  await import('./commands/casino/slots.command.js');
  await import('./commands/casino/coinflip.command.js');
  await import('./commands/casino/blackjack.command.js');
  await import('./commands/casino/horse-race.command.js');
  await import('./commands/casino/poker.command.js');
  await import('./commands/casino/lottery.command.js');
  await import('./commands/casino/heist.command.js');
  await import('./commands/casino/achievements.command.js');

  // Button handlers
  await import('./interactions/buttons/slots.buttons.js');
  await import('./interactions/buttons/coinflip.buttons.js');
  await import('./interactions/buttons/blackjack.buttons.js');
  await import('./interactions/buttons/horse-race.buttons.js');
  await import('./interactions/buttons/poker.buttons.js');
  await import('./interactions/buttons/bank.buttons.js');
  await import('./interactions/buttons/balance.buttons.js');
  await import('./interactions/buttons/leaderboard.buttons.js');
  await import('./interactions/buttons/lottery.buttons.js');
  await import('./interactions/buttons/heist.buttons.js');
  await import('./interactions/buttons/achievements.buttons.js');

  // Modal handlers
  await import('./interactions/modals/bet-amount.modal.js');
  await import('./interactions/modals/setting.modal.js');
  await import('./interactions/modals/poker.modal.js');
  await import('./interactions/modals/bank.modal.js');
  await import('./interactions/modals/lottery.modal.js');

  // Admin commands
  await import('./commands/admin/give.command.js');
  await import('./commands/admin/reset.command.js');
  await import('./commands/admin/setting.command.js');

  // Admin button handlers
  await import('./interactions/buttons/setting.buttons.js');
}

async function main(): Promise<void> {
  logger.info('Starting Dealer.js...');
  await configService.initialize();
  await loadModules();
  await startBot();
  startScheduler();
}

main().catch((error) => {
  logger.error('Fatal error during startup', { error: String(error) });
  process.exit(1);
});
