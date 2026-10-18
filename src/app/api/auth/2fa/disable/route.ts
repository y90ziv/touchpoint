import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { getAuthDb } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyPassword } from '@/lib/auth';
import { verifyTotp, verifyAndConsumeBackupCode } from '@/lib/totp';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  const session = await getAuthenticatedUser(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const authDb = getAuthDb();
  const user = authDb.select().from(users).where(eq(users.id, session.userId)).get();
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { password, code } = body;

    if (!password || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: 'Invalid account password.' }, { status: 400 });
    }

    if (user.totpEnabled && user.totpSecret) {
      const isTotpValid = verifyTotp(user.totpSecret, code || '');
      const backupResult = verifyAndConsumeBackupCode(code || '', user.totpBackupCodes);
      if (!isTotpValid && !backupResult.valid) {
        return NextResponse.json({ error: 'Invalid 2FA code or backup code.' }, { status: 400 });
      }
    }

    authDb
      .update(users)
      .set({
        totpSecret: null,
        totpEnabled: false,
        totpBackupCodes: null,
      })
      .where(eq(users.id, user.id))
      .run();

    logger.info('auth.2fa.disable', 'Two-Factor Authentication disabled', { userId: user.id });
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('auth.2fa.disable', 'Failed to disable 2FA', err);
    return NextResponse.json({ error: 'Failed to disable 2FA' }, { status: 500 });
  }
}
