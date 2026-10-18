import { Cron } from 'croner';
import { Bot } from 'grammy';
import { getDb } from '@/db';
import { settings } from '@/db/schema';
import {
  buildDailyDigestPayloads,
  startTelegramLongPolling,
} from '@/lib/telegram-service';
import { dispatchOutgoingWebhook } from '@/lib/webhook-service';
import { logger } from '@/lib/logger';
import { registerGracefulShutdown } from '@/lib/lifecycle';

let schedulerStarted = false;
let digestJob: Cron | null = null;

export async function initializeBackgroundServices() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  try {
    const db = getDb();
    const cfg = db.select().from(settings).get();

    if (cfg?.telegramBotToken) {
      await startTelegramLongPolling(cfg.telegramBotToken);
    }

    // Run every minute to check if current HH:MM matches configured dailyDigestTime
    digestJob = new Cron('* * * * *', async () => {
      try {
        const currentCfg = getDb().select().from(settings).get();
        if (!currentCfg || !currentCfg.dailyDigestEnabled) return;

        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const currentTime = `${hh}:${mm}`;

        if (currentTime === currentCfg.dailyDigestTime) {
          logger.info('scheduler.digest', `Running scheduled Daily Digest at ${currentTime}`);

          // Channel 1: Telegram Bot (if configured)
          if (currentCfg.telegramBotToken && currentCfg.telegramChatId) {
            try {
              const digest = buildDailyDigestPayloads(now);
              const bot = new Bot(currentCfg.telegramBotToken);

              for (const r of digest.reminders) {
                await bot.api.sendMessage(currentCfg.telegramChatId, r.text, {
                  parse_mode: 'HTML',
                  reply_markup: r.keyboard,
                });
              }
            } catch (tgErr) {
              logger.error('scheduler.digest.telegram', 'Telegram digest dispatch failed', tgErr);
            }
          }

          // Channel 2: Outgoing Webhook (if enabled and URL configured)
          if (currentCfg.webhookEnabled && currentCfg.webhookUrl) {
            try {
              await dispatchOutgoingWebhook(now, false);
            } catch (whErr) {
              logger.error('scheduler.digest.webhook', 'Webhook digest dispatch failed', whErr);
            }
          }
        }
      } catch (err) {
        logger.error('scheduler.digest', 'Scheduled digest tick failed', err);
      }
    });

    logger.info('scheduler.init', 'In-process background scheduler initialized');
    registerGracefulShutdown();
  } catch (err) {
    logger.error('scheduler.init', 'Failed to initialize background services', err);
  }
}

export function getSchedulerStatus() {
  return {
    schedulerStarted,
    dailyDigestRunning: digestJob !== null && Boolean(digestJob.isRunning()),
    weeklySummaryRunning: false,
  };
}

export function stopBackgroundServices() {
  if (digestJob) {
    digestJob.stop();
    digestJob = null;
  }
  schedulerStarted = false;
}

