import { NextResponse } from 'next/server';
import { dispatchOutgoingWebhook } from '@/lib/webhook-service';
import { logger } from '@/lib/logger';
import { getRequestUserId } from '@/lib/auth';
import { runWithUser } from '@/db';
import { consumeRateLimit } from '@/lib/rate-limiter';

export async function POST(request: Request) {
  const start = Date.now();
  const rate = consumeRateLimit(request, 'webhook_dispatch', 20, 5 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `Too many webhook requests. Try again in ${rate.retryAfterSeconds} seconds.` },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
    );
  }
  const userId = getRequestUserId(request);
  try {
    const body = await request.json().catch(() => ({}));
    const isTest = body.action === 'test_webhook';

    return await runWithUser(userId, async () => {
      const result = await dispatchOutgoingWebhook(new Date(), isTest);
      logger.http('POST', `/api/webhook (${body.action || 'digest'})`, 200, Date.now() - start, {
        ...result,
        userId,
      });
      return NextResponse.json(result);
    });
  } catch (err) {
    logger.error('api.webhook.post', 'Outgoing webhook dispatch failed', err);
    return NextResponse.json({ error: 'Outgoing webhook dispatch failed' }, { status: 500 });
  }
}
