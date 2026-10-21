import { Cron } from 'croner';
import { Bot } from 'grammy';
import { getAuthDb, getUserDb, getDb, runWithUser } from '@/db';
import { settings, users } from '@/db/schema';
import {
  buildDailyDigestPayloads,
  startTelegramLongPolling,
} from '@/lib/telegram-service';
import { dispatchOutgoingWebhook } from '@/lib/webhook-service';
import { pushScheduleToGoogleCalendar } from '@/lib/google-sync';
import { runScheduledBackupRotation } from '@/lib/backup-rotator';
import { logger } from '@/lib/logger';
import { registerGracefulShutdown } from '@/lib/lifecycle';
import {
  resolveEffectiveTimezone,
  normalizeTimezone,
} from '@/lib/geo-data';

let schedulerStarted = false;
let digestJob: Cron | null = null;
const lastDispatchedMinuteByUser = new Map<string, string>();
const lastDispatchedDigestDateByChat = new Map<string, string>();

/**
 * Returns current HH:MM string formatted according to the given IANA timezone.
 * Falls back to UTC if the timezone string is invalid.
 */
export function getCurrentTimeInTimezone(tz: string = 'UTC', date: Date = new Date()): string {
  const normalized = normalizeTimezone(tz);
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: normalized,
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
  const normalized = normalizeTimezone(tz);
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: normalized,
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
 * Returns the local day of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 * for the given IANA timezone.
 */
export function getLocalDayOfWeekInTimezone(tz: string = 'UTC', date: Date = new Date()): number {
  const normalized = normalizeTimezone(tz);
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: normalized,
      weekday: 'short',
    });
    const weekdayStr = formatter.format(date); // 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'
    const days: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return days[weekdayStr] ?? date.getUTCDay();
  } catch {
    return date.getUTCDay();
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

    const tz = resolveEffectiveTimezone(currentCfg.timezone, currentCfg.defaultCountryCode);
    const localRefDate = getLocalDateInTimezone(tz, now);

    // Channel 1: Telegram Bot (if configured)
    if (currentCfg.telegramBotToken && currentCfg.telegramChatId) {
      const localDateStr = localRefDate.toISOString().slice(0, 10);
      const chatDispatchKey = `${currentCfg.telegramChatId}_${localDateStr}`;

      if (lastDispatchedDigestDateByChat.has(chatDispatchKey)) {
        logger.info(
          'scheduler.digest.telegram',
          `Telegram digest already dispatched to chat ${currentCfg.telegramChatId} for ${localDateStr}, skipping duplicate`
        );
      } else {
        lastDispatchedDigestDateByChat.set(chatDispatchKey, localDateStr);
        try {
          const digest = buildDailyDigestPayloads(localRefDate);
          const bot = new Bot(currentCfg.telegramBotToken);

          const sentContactIds = new Set<number>();
          for (const r of digest.reminders) {
            if (sentContactIds.has(r.contactId)) continue;
            sentContactIds.add(r.contactId);

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

/**
 * Executes outbound Google Calendar auto-push for a user within their database context.
 */
export async function runGoogleCalendarAutoPushForUser(userId: number) {
  return runWithUser(userId, async () => {
    const uDb = getUserDb(userId).db;
    const currentCfg = uDb.select().from(settings).get();
    if (!currentCfg || !currentCfg.googleCalendarPushEnabled || !currentCfg.googleRefreshToken) return;

    try {
      const result = await pushScheduleToGoogleCalendar();
      logger.info('scheduler.google.push', `Google Calendar auto-push completed for user ${userId}`, {
        userId,
        ...result,
      });
    } catch (pushErr) {
      logger.error('scheduler.google.push', `Google Calendar auto-push failed for user ${userId}`, pushErr);
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

    // Run every minute to check if current HH:MM matches configured schedule for each user
    digestJob = new Cron('* * * * *', async () => {
      try {
        const activeIds = getAllActiveUserIds();
        const now = new Date();

        for (const uid of activeIds) {
          const uDb = getUserDb(uid).db;
          const currentCfg = uDb.select().from(settings).get();
          if (!currentCfg) continue;

          const tz = resolveEffectiveTimezone(currentCfg.timezone, currentCfg.defaultCountryCode);
          const currentTime = getCurrentTimeInTimezone(tz, now);
          const localDateStr = getLocalDateInTimezone(tz, now).toISOString().slice(0, 10);

          // 1. Daily Notification Digest
          if (currentCfg.dailyDigestEnabled) {
            const targetTime = (currentCfg.dailyDigestTime || '09:00').trim().padStart(5, '0');
            if (currentTime === targetTime) {
              const dispatchKey = `digest_${uid}_${localDateStr}_${currentTime}`;
              if (!lastDispatchedMinuteByUser.has(dispatchKey)) {
                lastDispatchedMinuteByUser.set(dispatchKey, localDateStr);
                logger.info(
                  'scheduler.digest',
                  `Running scheduled Daily Digest for user ${uid} at ${currentTime} (${tz})`
                );
                await runDailyDigestForUser(uid, now);
              }
            }
          }

          // 2. Outbound Google Calendar Auto-Push
          if (
            currentCfg.googleCalendarPushEnabled &&
            currentCfg.googleRefreshToken &&
            currentCfg.googleCalendarAutoPush &&
            currentCfg.googleCalendarAutoPush !== 'manual'
          ) {
            const targetPushTime = (currentCfg.googleCalendarPushTime || '08:00').trim().padStart(5, '0');
            if (currentTime === targetPushTime) {
              let shouldPush = false;
              if (currentCfg.googleCalendarAutoPush === 'daily') {
                shouldPush = true;
              } else if (currentCfg.googleCalendarAutoPush === 'weekly') {
                const localDayOfWeek = getLocalDayOfWeekInTimezone(tz, now);
                const targetDay = currentCfg.googleCalendarPushDay ?? 0;
                if (localDayOfWeek === targetDay) {
                  shouldPush = true;
                }
              }

              if (shouldPush) {
                const pushKey = `cal_${uid}_${localDateStr}_${targetPushTime}`;
                if (!lastDispatchedMinuteByUser.has(pushKey)) {
                  lastDispatchedMinuteByUser.set(pushKey, localDateStr);
                  logger.info(
                    'scheduler.google.push',
                    `Running scheduled Google Calendar auto-push for user ${uid} (${currentCfg.googleCalendarAutoPush}) at ${currentTime} (${tz})`
                  );
                  await runGoogleCalendarAutoPushForUser(uid);
                }
              }
            }
          }

          // 3. Automated Database Snapshot Rotation (at 03:00 local time)
          if (currentTime === '03:00') {
            const backupKey = `backup_${uid}_${localDateStr}`;
            if (!lastDispatchedMinuteByUser.has(backupKey)) {
              lastDispatchedMinuteByUser.set(backupKey, localDateStr);
              logger.info('scheduler.backup', `Running scheduled backup rotation for user ${uid} at 03:00 (${tz})`);
              runScheduledBackupRotation(uid);
            }
          }
        }
      } catch (err) {
        logger.error('scheduler.tick', 'Scheduled background tick failed', err);
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
  lastDispatchedDigestDateByChat.clear();
}
