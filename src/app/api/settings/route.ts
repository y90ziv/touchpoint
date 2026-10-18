import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb, runWithUser } from '@/db';
import { settings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logger, setLogLevel, LogLevel, extractRequestId } from '@/lib/logger';
import { getRequestUserId } from '@/lib/auth';

const ALLOWED_SETTING_KEYS = [
  'themeMode',
  'themePreset',
  'timezone',
  'dateFormat',
  'defaultCountryCode',
  'logLevel',
  'telegramBotToken',
  'telegramChatId',
  'dailyDigestEnabled',
  'dailyDigestTime',
  'skipEmptyDigest',
  'weeklySummaryEnabled',
  'weeklySummaryDay',
  'weeklySummaryTime',
  'firstDayOfWeek',
  'birthdayDaysAdvance',
  'maxDailyDue',
  'globalPausedUntil',
  'cadenceFuzzinessEnabled',
  'cadenceFuzzinessPercent',
  'googleClientId',
  'googleClientSecret',
  'googleRefreshToken',
  'googleSyncInterval',
  'skipGoogleEmailOnly',
  'googleCalendarPushEnabled',
  'googleCalendarId',
  'webhookEnabled',
  'webhookUrl',
  'webhookSecret',
] as const;

function ensureSettingsRow(userId: number) {
  const db = getDb(userId);
  let row = db.select().from(settings).get();
  if (!row) {
    db.insert(settings)
      .values({
        ownerUserId: userId,
        icalSecretToken: crypto.randomBytes(24).toString('hex'),
        telegramBindingToken: crypto.randomBytes(16).toString('hex'),
      })
      .run();
    row = db.select().from(settings).get();
  } else if (!row.telegramBindingToken) {
    const token = crypto.randomBytes(16).toString('hex');
    db.update(settings).set({ telegramBindingToken: token }).where(eq(settings.id, row.id)).run();
    row = { ...row, telegramBindingToken: token };
  }
  return row!;
}

export async function GET(request: Request) {
  const start = Date.now();
  const userId = getRequestUserId(request);
  const requestId = extractRequestId(request);

  return runWithUser(
    userId,
    () => {
      const row = ensureSettingsRow(userId);

      // Redact plaintext secrets before returning to client
      const safeSettings = {
        ...row,
        googleClientSecret: row.googleClientSecret ? '••••••••' : null,
        googleRefreshToken: row.googleRefreshToken ? '••••••••' : null,
        telegramBotToken: row.telegramBotToken ? '••••••••' : null,
        webhookSecret: row.webhookSecret ? '••••••••' : null,
        hasGoogleClientSecret: Boolean(row.googleClientSecret),
        hasGoogleRefreshToken: Boolean(row.googleRefreshToken),
        hasTelegramBotToken: Boolean(row.telegramBotToken),
        hasWebhookSecret: Boolean(row.webhookSecret),
      };

      logger.http('GET', '/api/settings', 200, Date.now() - start, { userId, requestId });
      return NextResponse.json({ settings: safeSettings, requestId });
    },
    requestId
  );
}

export async function PATCH(request: Request) {
  const start = Date.now();
  const userId = getRequestUserId(request);
  const requestId = extractRequestId(request);

  return runWithUser(
    userId,
    async () => {
      try {
        const body = await request.json();
        const db = getDb(userId);
        const existing = ensureSettingsRow(userId);

        if (body.logLevel) {
          setLogLevel(body.logLevel as LogLevel);
        }

        const updatePayload: Record<string, unknown> = {};
        for (const key of ALLOWED_SETTING_KEYS) {
          if (body[key] !== undefined) {
            // Do not overwrite secret if client sent back masked value or empty string for an existing secret
            if (
              (key === 'googleClientSecret' ||
                key === 'googleRefreshToken' ||
                key === 'telegramBotToken' ||
                key === 'webhookSecret') &&
              body[key] === '••••••••'
            ) {
              continue;
            }
            updatePayload[key] = body[key];
          }
        }

        if (Object.keys(updatePayload).length > 0) {
          db.update(settings).set(updatePayload).where(eq(settings.id, existing.id)).run();
        }

        const updated = db.select().from(settings).where(eq(settings.id, existing.id)).get();

        const safeUpdated = {
          ...updated,
          googleClientSecret: updated?.googleClientSecret ? '••••••••' : null,
          googleRefreshToken: updated?.googleRefreshToken ? '••••••••' : null,
          telegramBotToken: updated?.telegramBotToken ? '••••••••' : null,
          webhookSecret: updated?.webhookSecret ? '••••••••' : null,
          hasGoogleClientSecret: Boolean(updated?.googleClientSecret),
          hasGoogleRefreshToken: Boolean(updated?.googleRefreshToken),
          hasTelegramBotToken: Boolean(updated?.telegramBotToken),
          hasWebhookSecret: Boolean(updated?.webhookSecret),
        };

        logger.crud('UPDATE', 'settings', {
          updatedKeys: Object.keys(updatePayload),
          userId,
          requestId,
        });
        logger.http('PATCH', '/api/settings', 200, Date.now() - start, { userId, requestId });
        return NextResponse.json({ settings: safeUpdated, requestId });
      } catch (err) {
        logger.error('api.settings.patch', 'Failed to update settings', err, {
          userId,
          requestId,
        });
        return NextResponse.json({ error: 'Failed to update settings', requestId }, { status: 500 });
      }
    },
    requestId
  );
}
