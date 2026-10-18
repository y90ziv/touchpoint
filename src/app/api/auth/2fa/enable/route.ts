import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { getAuthDb } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyTotp, generateBackupCodes } from '@/lib/totp';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  const session = await getAuthenticatedUser(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const authDb = getAuthDb();
  const user = authDb.select().from(users).where(eq(users.id, session.userId)).get();
  if (!user || !user.totpSecret) {
    return NextResponse.json({ error: '2FA setup was not initiated.' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { code } = body;

    if (!code || !verifyTotp(user.totpSecret, code)) {
      return NextResponse.json({ error: 'Invalid verification code. Please check your authenticator app.' }, { status: 400 });
    }

    // Generate 8 one-time backup recovery codes
    const { plaintextCodes, hashedCodes } = generateBackupCodes(8);

    authDb
      .update(users)
      .set({
        totpEnabled: true,
        totpBackupCodes: JSON.stringify(hashedCodes),
      })
      .where(eq(users.id, user.id))
      .run();

    logger.info('auth.2fa.enable', 'Two-Factor Authentication enabled', { userId: user.id });
    return NextResponse.json({
      success: true,
      backupCodes: plaintextCodes,
    });
  } catch (err) {
    logger.error('auth.2fa.enable', 'Failed to enable 2FA', err);
    return NextResponse.json({ error: 'Failed to enable 2FA' }, { status: 500 });
  }
}
