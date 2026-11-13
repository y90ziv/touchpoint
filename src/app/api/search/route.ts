import { NextResponse } from 'next/server';
import { searchContactsFts, rebuildAllFts } from '@/lib/search-service';
import { getRequestUserId } from '@/lib/auth';
import { runWithUser } from '@/db';
import { logger } from '@/lib/logger';
import { consumeRateLimit } from '@/lib/rate-limiter';

export async function GET(request: Request) {
  const start = Date.now();
  const userId = getRequestUserId(request);
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const rebuild = searchParams.get('rebuild') === 'true';

  if (rebuild) {
    const rate = consumeRateLimit(request, 'search_rebuild', 5, 5 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: `Too many index rebuild requests. Try again in ${rate.retryAfterSeconds} seconds.` },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
      );
    }
  }

  return runWithUser(userId, () => {
    if (rebuild) {
      const res = rebuildAllFts(userId);
      logger.http('GET', '/api/search?rebuild=true', 200, Date.now() - start, { userId });
      return NextResponse.json(res);
    }

    const results = searchContactsFts(q, userId);
    logger.http('GET', `/api/search?q=${encodeURIComponent(q)}`, 200, Date.now() - start, {
      userId,
      query: q,
      count: results.length,
    });
    return NextResponse.json({ query: q, results, total: results.length });
  });
}
