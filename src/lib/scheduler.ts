import { Cron } from 'croner';
import { Bot } from 'grammy';
import { getAuthDb, getUserDb, getDb, runWithUser } from '@/db';
import { settings, users } from '@/db/schema';
import {
  buildDailyDigestPayloads,
  startTelegramLongPolling,
} from '@/lib/telegram-service';
import { dispatchOutgoingWebhook } from '@/lib/webhook-service';
import { logger } from '@/lib/logger';
import { registerGracefulShutdown } from '@/lib/lifecycle';

let schedulerStarted = false;
let digestJob: Cron | null = null;
const lastDispatchedMinuteByUser = new Map<number, string>();

/**
 * Returns current HH:MM string formatted according to the given IANA timezone.
 * Falls back to UTC if the timezone string is invalid.
 */
export function getCurrentTimeInTimezone(tz: string = 'UTC', date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return formatter.format(date);
  } catch {
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
}

/**
 * Returns a Date set to UTC midnight representing the local calendar day
 * in the specified timezone (e.g. 2026-10-19T00:00:00.000Z).
 */
export function getLocalDateInTimezone(tz: string = 'UTC', date: Date = new Date()): Date {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const [year, month, day] = formatter.format(date).split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  } catch {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }
}

/**
 * Retrieves all registered user IDs, defaulting to user 1 if users table is empty.
 */
export function getAllActiveUserIds(): number[] {
  try {
    const authDb = getAuthDb();
    const allUsers = authDb.select({ id: users.id }).from(users).all();
    if (allUsers.length > 0) {
      return allUsers.map((u) => u.id);
    }
  } catch {
    // ignore
  }
  return [1];
}

/**
 * Dispatches the daily digest for a given user across enabled channels (Telegram, Webhook).
 */
export async function runDailyDigestForUser(userId: number, now: Date = new Date()) {
  return runWithUser(userId, async () => {
    const uDb = getUserDb(userId).db;
    const currentCfg = uDb.select().from(settings).get();
    if (!currentCfg || !currentCfg.dailyDigestEnabled) return;

    const localRefDate = getLocalDateInTimezone(currentCfg.timezone || 'UTC', now);

    // Channel 1: Telegram Bot (if configured)
    if (currentCfg.telegramBotToken && currentCfg.telegramChatId) {
      try {
        const digest = buildDailyDigestPayloads(localRefDate);
        const bot = new Bot(currentCfg.telegramBotToken);

        for (const r of digest.reminders) {
          await bot.api.sendMessage(currentCfg.telegramChatId, r.text, {
            parse_mode: 'HTML',
            reply_markup: r.keyboard,
          });
        }

        if (digest.upcomingBirthdays.length > 0) {
          const bdayLines = digest.upcomingBirthdays.map((b) => {
            const dayLabel = b.daysAway === 0 ? '🎉 <b>Today!</b>' : `in ${b.daysAway}d (${b.date})`;
            return `• <b>${b.contactName}</b> — ${b.label}: ${dayLabel}`;
          });
          await bot.api.sendMessage(
            currentCfg.telegramChatId,
            `🎂 <b>Upcoming Dates & Birthdays:</b>\n\n${bdayLines.join('\n')}`,
            { parse_mode: 'HTML' }
          );
        }

        if (digest.reminders.length === 0 && digest.upcomingBirthdays.length === 0 && !digest.skipEmpty) {
          await bot.api.sendMessage(currentCfg.telegramChatId, '🎉 <b>Touchpoint:</b> All caught up today!', {
            parse_mode: 'HTML',
          });
        }
      } catch (tgErr) {
        logger.error('scheduler.digest.telegram', 'Telegram digest dispatch failed', tgErr);
      }
    }

    // Channel 2: Outgoing Webhook (if enabled and URL configured)
    if (currentCfg.webhookEnabled && currentCfg.webhookUrl) {
      try {
        await dispatchOutgoingWebhook(localRefDate, false);
      } catch (whErr) {
        logger.error('scheduler.digest.webhook', 'Webhook digest dispatch failed', whErr);
      }
    }
  });
}

export async function initializeBackgroundServices() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  try {
    const userIds = getAllActiveUserIds();

    // Start Telegram long-polling for first user who has a configured bot token
    for (const uid of userIds) {
      const uDb = getUserDb(uid).db;
      const cfg = uDb.select().from(settings).get();
      if (cfg?.telegramBotToken) {
        try {
          await startTelegramLongPolling(cfg.telegramBotToken);
          break;
        } catch (botErr) {
          logger.error('scheduler.telegram.init', `Failed to start Telegram long polling for user ${uid}`, botErr);
        }
      }
    }

    // Run every minute to check if current HH:MM matches configured dailyDigestTime for each user
    digestJob = new Cron('* * * * *', async () => {
      try {
        const activeIds = getAllActiveUserIds();
        const now = new Date();

        for (const uid of activeIds) {
          const uDb = getUserDb(uid).db;
          const currentCfg = uDb.select().from(settings).get();
          if (!currentCfg || !currentCfg.dailyDigestEnabled) continue;

          const tz = currentCfg.timezone || 'UTC';
          const currentTime = getCurrentTimeInTimezone(tz, now);

          if (currentTime === currentCfg.dailyDigestTime) {
            const dispatchKey = `${now.toISOString().slice(0, 10)}_${currentTime}`;
            if (lastDispatchedMinuteByUser.get(uid) === dispatchKey) {
              continue; // Prevent duplicate execution within the exact same minute
            }
            lastDispatchedMinuteByUser.set(uid, dispatchKey);

            logger.info(
              'scheduler.digest',
              `Running scheduled Daily Digest for user ${uid} at ${currentTime} (${tz})`
            );
            await runDailyDigestForUser(uid, now);
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
  lastDispatchedMinuteByUser.clear();
}
