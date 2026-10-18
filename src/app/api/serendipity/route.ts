import { NextResponse } from 'next/server';
import { getSerendipitySuggestion } from '@/lib/serendipity';
import { getRequestUserId } from '@/lib/auth';
import { runWithUser } from '@/db';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  const start = Date.now();
  const userId = getRequestUserId(request);
  const { searchParams } = new URL(request.url);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const thresholdDays = parseInt(searchParams.get('thresholdDays') || '180', 10);

  return runWithUser(userId, () => {
    const result = getSerendipitySuggestion(offset, thresholdDays);
    logger.http('GET', '/api/serendipity', 200, Date.now() - start, {
      userId,
      hasSuggestion: Boolean(result.suggestion),
      totalDormant: result.totalDormantCount,
    });
    return NextResponse.json(result);
  });
}
