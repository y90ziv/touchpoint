import { NextResponse } from 'next/server';
import { generateIcalFeed, findUserIdByIcalToken } from '@/lib/portability-service';
import { logger } from '@/lib/logger';
import { runWithUser } from '@/db';

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const start = Date.now();
  const { token } = await context.params;
  const cleanToken = token.replace(/\.ics$/i, '');

  const userId = findUserIdByIcalToken(cleanToken);
  if (!userId) {
    logger.http('GET', '/api/calendar/[token]', 401, Date.now() - start);
    return NextResponse.json({ error: 'Invalid calendar feed token' }, { status: 401 });
  }

  return runWithUser(userId, () => {
    const icsContent = generateIcalFeed();
    logger.http('GET', '/api/calendar/[token]', 200, Date.now() - start, { userId });

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="touchpoint.ics"',
      },
    });
  });
}
