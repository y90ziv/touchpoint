import { NextResponse } from 'next/server';
import {
  authenticateUser,
  createSessionToken,
  SESSION_COOKIE_NAME,
} from '@/lib/auth';
import { checkRateLimit, recordFailedAttempt, resetRateLimit, getClientIp } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  const start = Date.now();
  const ip = getClientIp(request);

  // Rate limiting check: max 5 attempts per 15 minutes
  const rate = checkRateLimit(ip, 'login', 5, 15 * 60 * 1000);
  if (!rate.allowed) {
    logger.warn('auth.login.ratelimit', 'Rate limit exceeded on login', { ip });
    return NextResponse.json(
      { error: `Too many failed login attempts. Please try again in ${rate.retryAfterSeconds} seconds.` },
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
    const body = await request.json();
    const { identifier, password, rememberMe } = body;

    if (!identifier || !password) {
      logger.http('POST', '/api/auth/login', 400, Date.now() - start);
      return NextResponse.json(
        { error: 'Email/username and password are required.' },
        { status: 400 }
      );
    }

    const user = authenticateUser(identifier, password);
    if (!user) {
      recordFailedAttempt(ip, 'login');
      logger.http('POST', '/api/auth/login', 401, Date.now() - start);
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    const isRemembered = Boolean(rememberMe);

    // If Two-Factor Authentication is enabled on this account, challenge for 2FA code
    if (user.totpEnabled) {
      // 5-minute temporary token to complete 2FA challenge
      const tempToken = await createSessionToken(
        {
          userId: user.id,
          email: user.email,
          username: user.username,
        },
        5 / (24 * 60)
      );

      logger.info('auth.login.2fa_prompt', 'User prompted for 2FA challenge', { userId: user.id });
      return NextResponse.json({
        require2fa: true,
        tempToken,
        email: user.email,
        rememberMe: isRemembered,
      });
    }

    // Reset rate limits on successful authentication
    resetRateLimit(ip, 'login');

    const ttlDays = isRemembered ? 90 : 1;

    const token = await createSessionToken(
      {
        userId: user.id,
        email: user.email,
        username: user.username,
      },
      ttlDays
    );

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, username: user.username },
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: ttlDays * 24 * 60 * 60,
    });

    logger.http('POST', '/api/auth/login', 200, Date.now() - start, { userId: user.id });
    return response;
  } catch (err) {
    logger.error('api.auth.login', 'Login error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
