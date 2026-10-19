import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getAuthDb, getDb } from '@/db';
import { getSchedulerStatus, initializeBackgroundServices } from '@/lib/scheduler';
import { isTelegramBotRunning } from '@/lib/telegram-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const start = Date.now();
  let dbOk = false;
  let dbLatencyMs = 0;
  let errorDetail: string | null = null;

  try {
    const dbStart = Date.now();
    const authDb = getAuthDb();
    authDb.run(sql`SELECT 1`);
    const userDb = getDb(1);
    userDb.run(sql`SELECT 1`);
    dbLatencyMs = Date.now() - dbStart;
    dbOk = true;
  } catch (err) {
    dbOk = false;
    errorDetail = err instanceof Error ? err.message : String(err);
  }

  const mem = process.memoryUsage();
  const uptimeSeconds = Math.floor(process.uptime());

  let schedulerRunning = false;
  try {
    const status = getSchedulerStatus();
    schedulerRunning = status.dailyDigestRunning || status.weeklySummaryRunning;
    if (!schedulerRunning && process.env.NEXT_PHASE !== 'phase-production-build') {
      initializeBackgroundServices().catch(() => {});
      schedulerRunning = true;
    }
  } catch {
    schedulerRunning = false;
  }

  const botRunning = isTelegramBotRunning();

  const isHealthy = dbOk;

  const payload = {
    status: isHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptimeSeconds,
    durationMs: Date.now() - start,
    database: {
      status: dbOk ? 'healthy' : 'unhealthy',
      responseTimeMs: dbLatencyMs,
      error: errorDetail,
    },
    services: {
      scheduler: schedulerRunning ? 'running' : 'idle',
      telegramBot: botRunning ? 'running' : 'idle',
    },
    system: {
      nodeVersion: process.version,
      rssMb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
      heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
      heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
    },
  };

  return NextResponse.json(payload, {
    status: isHealthy ? 200 : 503,
  });
}
