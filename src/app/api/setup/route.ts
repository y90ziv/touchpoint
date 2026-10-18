import { NextResponse } from 'next/server';
import {
  isOwnerSetupComplete,
  isRegistrationAllowed,
  registerUserAccount,
  createSessionToken,
  SESSION_COOKIE_NAME,
} from '@/lib/auth';
import { checkRateLimit, recordFailedAttempt, resetRateLimit, getClientIp } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

export async function GET() {
  const start = Date.now();
  const isComplete = isOwnerSetupComplete();
  const allowSignups = isRegistrationAllowed();
  logger.http('GET', '/api/setup', 200, Date.now() - start, {
    setupComplete: isComplete,
    allowSignups,
  });
  return NextResponse.json({ setupComplete: isComplete, allowSignups });
}

export async function POST(request: Request) {
  const start = Date.now();
  const ip = getClientIp(request);

  // Rate limiting check: max 5 setup attempts per 15 minutes
  const rate = checkRateLimit(ip, 'setup', 5, 15 * 60 * 1000);
  if (!rate.allowed) {
    logger.warn('auth.setup.ratelimit', 'Rate limit exceeded on setup/registration', { ip });
    return NextResponse.json(
      { error: `Too many registration attempts. Please try again in ${rate.retryAfterSeconds} seconds.` },
      {
        status: 429,
        headers: {
          'Retry-After': String(rate.retryAfterSeconds),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  try {
    if (!isRegistrationAllowed()) {
      recordFailedAttempt(ip, 'setup');
      logger.http('POST', '/api/setup', 403, Date.now() - start);
      return NextResponse.json(
        { error: 'Registration is locked.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, username, password, timezone, defaultCountryCode } = body;

    if (!email || !username || !password || password.length < 6) {
      recordFailedAttempt(ip, 'setup');
      logger.http('POST', '/api/setup', 400, Date.now() - start);
      return NextResponse.json(
        { error: 'Email, username, and a password of at least 6 characters are required.' },
        { status: 400 }
      );
    }

    const { user, settings } = registerUserAccount({
      email,
      username,
      password,
      timezone,
      defaultCountryCode,
    });

    resetRateLimit(ip, 'setup');

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      username: user.username,
    });

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, username: user.username },
      settings: {
        themeMode: settings.themeMode,
        themePreset: settings.themePreset,
        timezone: settings.timezone,
      },
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });

    logger.http('POST', '/api/setup', 201, Date.now() - start, { userId: user.id });
    return response;
  } catch (err) {
    logger.error('api.setup', 'Setup registration failed', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to complete setup' },
      { status: 500 }
    );
  }
}
