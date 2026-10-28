import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { Bot } from 'grammy';
import { getDb, runWithUser } from '@/db';
import { settings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  startTelegramLongPolling,
  getLastDetectedTelegramChat,
  buildDailyDigestPayloads,
  buildWeeklyBirthdayDigestPayload,
} from '@/lib/telegram-service';
import { logger } from '@/lib/logger';
import { getRequestUserId } from '@/lib/auth';

export async function GET(request: Request) {
  const start = Date.now();
  const userId = getRequestUserId(request);
  const detected = getLastDetectedTelegramChat();
  logger.http('GET', '/api/telegram', 200, Date.now() - start, { userId });
  return NextResponse.json({ detected });
}

export async function POST(request: Request) {
  const start = Date.now();
  const userId = getRequestUserId(request);
  try {
    const body = await request.json();

    return await runWithUser(userId, async () => {
      const db = getDb();
      let cfg = db.select().from(settings).get();
      if (!cfg) {
        db.insert(settings)
          .values({ ownerUserId: userId, icalSecretToken: crypto.randomBytes(24).toString('hex') })
          .run();
        cfg = db.select().from(settings).get();
      }

      let tokenInput = (body.botToken ?? '').trim();
      if (tokenInput === '••••••••') {
        tokenInput = '';
      }
      const token = tokenInput || (cfg?.telegramBotToken ?? '').trim();
      const chatId = (body.chatId ?? cfg?.telegramChatId ?? '').trim();

      if (cfg && (tokenInput || body.chatId !== undefined)) {
        db.update(settings)
          .set({
            telegramBotToken: token || cfg.telegramBotToken,
            telegramChatId: chatId || cfg.telegramChatId,
          })
          .where(eq(settings.id, cfg.id))
          .run();
      }

      if (!token) {
        return NextResponse.json({ error: 'Telegram Bot Token is required' }, { status: 400 });
      }

      if (body.action === 'start_poller') {
        await startTelegramLongPolling(token);
        logger.http('POST', '/api/telegram (start_poller)', 200, Date.now() - start, { userId });
        return NextResponse.json({ status: 'polling_started' });
      }

      if (!chatId) {
        return NextResponse.json({ error: 'Telegram Chat ID is required' }, { status: 400 });
      }

      const bot = new Bot(token);

      if (body.action === 'test_message') {
        await bot.api.sendMessage(
          chatId,
          '🔔 <b>Touchpoint Test Notification</b>\n\nYour Raspberry Pi container is connected to Telegram and ready to send reminders!',
          { parse_mode: 'HTML' }
        );
        logger.http('POST', '/api/telegram (test_message)', 200, Date.now() - start, { userId });
        return NextResponse.json({ sent: true });
      }

      if (body.action === 'send_digest_now') {
        const digest = buildDailyDigestPayloads();
        if (digest.reminders.length === 0 && digest.upcomingBirthdays.length === 0) {
          await bot.api.sendMessage(chatId, digest.summaryText, {
            parse_mode: 'HTML',
          });
          return NextResponse.json({ sentCount: 0, message: 'All caught up today!' });
        }

        // 1. Send Morning Briefing Header
        await bot.api.sendMessage(chatId, digest.summaryText, {
          parse_mode: 'HTML',
        });

        // 2. Send per-contact interactive reminder cards
        const sentContactIds = new Set<number>();
        for (const r of digest.reminders) {
          if (sentContactIds.has(r.contactId)) continue;
          sentContactIds.add(r.contactId);

          await bot.api.sendMessage(chatId, r.text, {
            parse_mode: 'HTML',
            reply_markup: r.keyboard,
          });
        }

        logger.http('POST', '/api/telegram (send_digest_now)', 200, Date.now() - start, {
          sentCount: digest.reminders.length,
          userId,
        });
        return NextResponse.json({ sentCount: digest.reminders.length });
      }

      if (body.action === 'send_birthday_digest_now' || body.action === 'test_birthday_digest') {
        const payload = buildWeeklyBirthdayDigestPayload(
          new Date(),
          cfg?.dateFormat || 'YYYY-MM-DD',
          cfg?.defaultCountryCode || '+972',
          cfg?.birthdayDigestDay ?? 6
        );

        await bot.api.sendMessage(chatId, payload.summaryText, {
          parse_mode: 'HTML',
          reply_markup: payload.keyboard,
        });

        logger.http('POST', '/api/telegram (test_birthday_digest)', 200, Date.now() - start, {
          celebrationsCount: payload.celebrations.length,
          userId,
        });
        return NextResponse.json({
          sent: true,
          celebrationsCount: payload.celebrations.length,
          summary: payload.summaryText,
        });
      }

      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    });
  } catch (err) {
    logger.error('api.telegram.post', 'Telegram API action failed', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Telegram error' },
      { status: 500 }
    );
  }
}
