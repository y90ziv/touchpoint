import { Cron } from 'croner';
import { Bot } from 'grammy';
import { getAuthDb, getUserDb, getDb, runWithUser } from '@/db';
import { settings, users } from '@/db/schema';
import {
  buildDailyDigestPayloads,
  buildWeeklyBirthdayDigestPayload,
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
import { eq } from 'drizzle-orm';

interface GlobalSchedulerState {
  schedulerStarted: boolean;
  digestJob: Cron | null;
  lastDispatchedMinuteByUser: Map<string, string>;
  lastDispatchedDigestDateByChat: Map<string, string>;
}

const g = globalThis as unknown as { __touchpoint_scheduler__?: GlobalSchedulerState };
if (!g.__touchpoint_scheduler__) {
  g.__touchpoint_scheduler__ = {
    schedulerStarted: false,
    digestJob: null,
    lastDispatchedMinuteByUser: new Map<string, string>(),
    lastDispatchedDigestDateByChat: new Map<string, string>(),
  };
}
const schedulerState = g.__touchpoint_scheduler__;

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

      if (
        schedulerState.lastDispatchedDigestDateByChat.has(chatDispatchKey) ||
        currentCfg.lastTelegramDigestDate === localDateStr
      ) {
        logger.info(
          'scheduler.digest.telegram',
          `Telegram digest already dispatched to chat ${currentCfg.telegramChatId} for ${localDateStr}, skipping duplicate`
        );
      } else {
        schedulerState.lastDispatchedDigestDateByChat.set(chatDispatchKey, localDateStr);
        // Persist to database immediately to guard across process restarts or multi-instance triggers
        try {
          uDb
            .update(settings)
            .set({ lastTelegramDigestDate: localDateStr })
            .where(eq(settings.id, currentCfg.id))
            .run();
        } catch (dbErr) {
          logger.warn('scheduler.digest.telegram', 'Failed to update lastTelegramDigestDate', { error: String(dbErr) });
        }

        try {
          const digest = buildDailyDigestPayloads(localRefDate);
          const bot = new Bot(currentCfg.telegramBotToken);

          if (digest.reminders.length === 0 && digest.upcomingBirthdays.length === 0 && digest.skipEmpty) {
            logger.info('scheduler.digest.telegram', 'Zero due contacts and birthdays, skipEmptyDigest is true');
          } else {
            // When there are no reminders (e.g., only birthdays or non-empty caught-up digest), send the summary text.
            // When sending reminders, the summary header is omitted to prevent duplicate notifications.
            if (digest.reminders.length === 0) {
              await bot.api.sendMessage(currentCfg.telegramChatId, digest.summaryText, {
                parse_mode: 'HTML',
              });
            }

            // Dispatch interactive per-contact action cards
            const sentContactIds = new Set<number>();
            for (const r of digest.reminders) {
              if (sentContactIds.has(r.contactId)) continue;
              sentContactIds.add(r.contactId);

              await bot.api.sendMessage(currentCfg.telegramChatId, r.text, {
                parse_mode: 'HTML',
                reply_markup: r.keyboard,
              });
            }
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
 * Dispatches the centralized Weekly Birthday & Milestone Briefing for a given user across enabled channels.
 */
export async function runWeeklyBirthdayDigestForUser(userId: number, now: Date = new Date()) {
  return runWithUser(userId, async () => {
    const uDb = getUserDb(userId).db;
    const currentCfg = uDb.select().from(settings).get();
    if (!currentCfg || currentCfg.birthdayDigestEnabled === false) return;

    const tz = resolveEffectiveTimezone(currentCfg.timezone, currentCfg.defaultCountryCode);
    const localRefDate = getLocalDateInTimezone(tz, now);
    const localDateStr = localRefDate.toISOString().slice(0, 10);

    // Dedup guard check
    const bdayDispatchKey = `${currentCfg.telegramChatId || 'user'}_bday_${localDateStr}`;
    if (
      schedulerState.lastDispatchedDigestDateByChat.has(bdayDispatchKey) ||
      currentCfg.lastBirthdayDigestDate === localDateStr
    ) {
      logger.info(
        'scheduler.birthday',
        `Weekly Birthday Briefing already dispatched for ${localDateStr}, skipping duplicate`
      );
      return;
    }

    schedulerState.lastDispatchedDigestDateByChat.set(bdayDispatchKey, localDateStr);

    try {
      uDb
        .update(settings)
        .set({ lastBirthdayDigestDate: localDateStr })
        .where(eq(settings.id, currentCfg.id))
        .run();
    } catch (dbErr) {
      logger.warn('scheduler.birthday', 'Failed to update lastBirthdayDigestDate', { error: String(dbErr) });
    }

    // Channel 1: Telegram Bot
    if (currentCfg.telegramBotToken && currentCfg.telegramChatId) {
      try {
        const payload = buildWeeklyBirthdayDigestPayload(
          localRefDate,
          currentCfg.dateFormat || 'YYYY-MM-DD',
          currentCfg.defaultCountryCode || '+972',
          currentCfg.birthdayDigestDay ?? 6
        );

        const bot = new Bot(currentCfg.telegramBotToken);
        await bot.api.sendMessage(currentCfg.telegramChatId, payload.summaryText, {
          parse_mode: 'HTML',
          reply_markup: payload.keyboard,
        });
      } catch (tgErr) {
        logger.error('scheduler.birthday.telegram', 'Telegram birthday digest dispatch failed', tgErr);
      }
    }

    // Channel 2: Outgoing Webhook
    if (currentCfg.webhookEnabled && currentCfg.webhookUrl) {
      try {
        const payload = buildWeeklyBirthdayDigestPayload(
          localRefDate,
          currentCfg.dateFormat || 'YYYY-MM-DD',
          currentCfg.defaultCountryCode || '+972',
          currentCfg.birthdayDigestDay ?? 6
        );
        const { dispatchOutgoingWebhook } = await import('@/lib/webhook-service');
        await dispatchOutgoingWebhook(localRefDate, false);
      } catch (whErr) {
        logger.error('scheduler.birthday.webhook', 'Webhook birthday digest dispatch failed', whErr);
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
  if (schedulerState.schedulerStarted) return;
  schedulerState.schedulerStarted = true;

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
    schedulerState.digestJob = new Cron('* * * * *', async () => {
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
              if (!schedulerState.lastDispatchedMinuteByUser.has(dispatchKey)) {
                schedulerState.lastDispatchedMinuteByUser.set(dispatchKey, localDateStr);
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
                if (!schedulerState.lastDispatchedMinuteByUser.has(pushKey)) {
                  schedulerState.lastDispatchedMinuteByUser.set(pushKey, localDateStr);
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
            if (!schedulerState.lastDispatchedMinuteByUser.has(backupKey)) {
              schedulerState.lastDispatchedMinuteByUser.set(backupKey, localDateStr);
              logger.info('scheduler.backup', `Running scheduled backup rotation for user ${uid} at 03:00 (${tz})`);
              runScheduledBackupRotation(uid, now);
            }
          }

          // 4. Centralized Weekly Birthday & Milestone Briefing
          if (currentCfg.birthdayDigestEnabled !== false) {
            const targetDay = currentCfg.birthdayDigestDay ?? 6; // 6 = Saturday
            const targetTime = (currentCfg.birthdayDigestTime || '19:00').trim().padStart(5, '0');
            const localDayOfWeek = getLocalDayOfWeekInTimezone(tz, now);

            if (localDayOfWeek === targetDay && currentTime === targetTime) {
              const bdayKey = `bday_${uid}_${localDateStr}_${targetTime}`;
              if (!schedulerState.lastDispatchedMinuteByUser.has(bdayKey)) {
                schedulerState.lastDispatchedMinuteByUser.set(bdayKey, localDateStr);
                logger.info(
                  'scheduler.birthday',
                  `Running scheduled Weekly Birthday Briefing for user ${uid} at ${currentTime} (${tz})`
                );
                await runWeeklyBirthdayDigestForUser(uid, now);
              }
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
    schedulerStarted: schedulerState.schedulerStarted,
    dailyDigestRunning: schedulerState.digestJob !== null && Boolean(schedulerState.digestJob.isRunning()),
    weeklySummaryRunning: false,
  };
}

export function stopBackgroundServices() {
  if (schedulerState.digestJob) {
    schedulerState.digestJob.stop();
    schedulerState.digestJob = null;
  }
  schedulerState.schedulerStarted = false;
  schedulerState.lastDispatchedMinuteByUser.clear();
  schedulerState.lastDispatchedDigestDateByChat.clear();
}
