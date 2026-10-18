import { NextResponse } from 'next/server';
import { getAuthDb } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyTotp, verifyAndConsumeBackupCode } from '@/lib/totp';
import { createSessionToken, verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { checkRateLimit, recordFailedAttempt, resetRateLimit, getClientIp } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  const start = Date.now();
  const ip = getClientIp(request);

  // Rate limiting check
  const rate = checkRateLimit(ip, '2fa_verify', 5, 15 * 60 * 1000);
  if (!rate.allowed) {
    logger.warn('auth.2fa.ratelimit', 'Rate limit exceeded on 2FA verification', { ip });
    return NextResponse.json(
      { error: `Too many failed attempts. Please try again in ${rate.retryAfterSeconds} seconds.` },
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
    const { tempToken, code, rememberMe } = body;

    if (!tempToken || !code) {
      recordFailedAttempt(ip, '2fa_verify');
      return NextResponse.json({ error: 'Verification code and session token are required.' }, { status: 400 });
    }

    const payload = await verifySessionToken(tempToken);
    if (!payload || !payload.userId) {
      recordFailedAttempt(ip, '2fa_verify');
      return NextResponse.json({ error: 'Verification session expired. Please log in again.' }, { status: 401 });
    }

    const authDb = getAuthDb();
    const user = authDb.select().from(users).where(eq(users.id, payload.userId)).get();
    if (!user || !user.totpSecret) {
      recordFailedAttempt(ip, '2fa_verify');
      return NextResponse.json({ error: 'User does not have 2FA enabled.' }, { status: 400 });
    }

    // Verify TOTP code or backup recovery code
    const isTotpValid = verifyTotp(user.totpSecret, code);
    const backupResult = verifyAndConsumeBackupCode(code, user.totpBackupCodes);

    if (!isTotpValid && !backupResult.valid) {
      recordFailedAttempt(ip, '2fa_verify');
      logger.warn('auth.2fa.verify', 'Invalid 2FA code provided', { userId: user.id, ip });
      return NextResponse.json({ error: 'Invalid verification code. Please check your authenticator app.' }, { status: 401 });
    }

    // If a backup code was consumed, update the remaining backup codes in database
    if (backupResult.valid) {
      authDb
        .update(users)
        .set({ totpBackupCodes: backupResult.remainingHashedCodesJson })
        .where(eq(users.id, user.id))
        .run();
      logger.info('auth.2fa.backup_used', 'User authenticated using backup recovery code', { userId: user.id });
    }

    // Reset rate limits on success
    resetRateLimit(ip, '2fa_verify');
    resetRateLimit(ip, 'login');

    const isRemembered = Boolean(rememberMe);
    const ttlDays = isRemembered ? 90 : 1;

    const sessionToken = await createSessionToken(
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

    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: ttlDays * 24 * 60 * 60,
    });

    logger.http('POST', '/api/auth/2fa/verify', 200, Date.now() - start, { userId: user.id });
    return response;
  } catch (err) {
    logger.error('api.auth.2fa.verify', '2FA verify error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
