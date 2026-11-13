import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/auth';
import { getSessionCookieOptions } from '@/lib/session';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  const start = Date.now();
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, '', getSessionCookieOptions(request, 0));
  logger.http('POST', '/api/auth/logout', 200, Date.now() - start);
  return response;
}
