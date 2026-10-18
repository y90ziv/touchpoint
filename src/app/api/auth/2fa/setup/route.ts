import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { getAuthDb } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateTotpSecret } from '@/lib/totp';
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
    const { secret, otpauthUrl, qrDataUrl } = await generateTotpSecret(user.email);

    // Store pending secret (not enabled until verified)
    authDb
      .update(users)
      .set({ totpSecret: secret })
      .where(eq(users.id, user.id))
      .run();

    logger.info('auth.2fa.setup', 'Generated 2FA TOTP secret', { userId: user.id });
    return NextResponse.json({
      secret,
      otpauthUrl,
      qrDataUrl,
    });
  } catch (err) {
    logger.error('auth.2fa.setup', 'Failed to generate 2FA secret', err);
    return NextResponse.json({ error: 'Failed to generate 2FA secret' }, { status: 500 });
  }
}
