import { logger } from '@/lib/logger';
import { stopBackgroundServices } from '@/lib/scheduler';
import { stopTelegramBot } from '@/lib/telegram-service';
import { closeAllDbs } from '@/db';

let isShuttingDown = false;
let lifecycleRegistered = false;

export async function shutdownGracefully(signal: string = 'SIGTERM') {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info('process.lifecycle', `Received ${signal}. Initiating graceful shutdown...`);

  // Force exit fallback after 5 seconds in case any connection hangs
  const forceTimer = setTimeout(() => {
    logger.warn('process.lifecycle', 'Graceful shutdown timed out after 5s. Exiting.');
    process.exit(0);
  }, 5000);
  if (forceTimer.unref) forceTimer.unref();

  try {
    // 1. Stop cron scheduler
    stopBackgroundServices();
    logger.info('process.lifecycle', 'Scheduler stopped');

    // 2. Stop Telegram bot long-polling
    await stopTelegramBot();
    logger.info('process.lifecycle', 'Telegram bot stopped');

    // 3. Flush & close SQLite database connections
    closeAllDbs();
    logger.info('process.lifecycle', 'Database connections closed');

    logger.info('process.lifecycle', 'Graceful shutdown complete. Exiting cleanly.');
    process.exit(0);
  } catch (err) {
    logger.error('process.lifecycle', 'Error during graceful shutdown', err);
    process.exit(1);
  }
}

export function registerGracefulShutdown() {
  if (lifecycleRegistered) return;
  if (typeof process === 'undefined') return;

  lifecycleRegistered = true;

  process.once('SIGTERM', () => {
    shutdownGracefully('SIGTERM');
  });

  process.once('SIGINT', () => {
    shutdownGracefully('SIGINT');
  });

  logger.info('process.lifecycle', 'Registered SIGTERM and SIGINT graceful shutdown handlers');
}
