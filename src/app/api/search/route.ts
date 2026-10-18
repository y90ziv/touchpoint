import { NextResponse } from 'next/server';
import { searchContactsFts, rebuildAllFts } from '@/lib/search-service';
import { getRequestUserId } from '@/lib/auth';
import { runWithUser } from '@/db';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  const start = Date.now();
  const userId = getRequestUserId(request);
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const rebuild = searchParams.get('rebuild') === 'true';

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
