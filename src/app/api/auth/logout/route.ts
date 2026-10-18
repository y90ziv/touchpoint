import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function POST() {
  const start = Date.now();
  const response = NextResponse.json({ success: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  logger.http('POST', '/api/auth/logout', 200, Date.now() - start);
  return response;
}
