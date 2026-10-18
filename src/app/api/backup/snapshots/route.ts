import { NextResponse } from 'next/server';
import {
  listDatabaseSnapshots,
  createDatabaseSnapshot,
  enforceBackupRetention,
} from '@/lib/backup-rotator';
import { getRequestUserId } from '@/lib/auth';
import { runWithUser } from '@/db';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  const start = Date.now();
  const userId = getRequestUserId(request);

  return runWithUser(userId, () => {
    const snapshots = listDatabaseSnapshots();
    logger.http('GET', '/api/backup/snapshots', 200, Date.now() - start, { userId, count: snapshots.length });
    return NextResponse.json({ snapshots });
  });
}

export async function POST(request: Request) {
  const start = Date.now();
  const userId = getRequestUserId(request);

  return runWithUser(userId, () => {
    try {
      const snapshot = createDatabaseSnapshot('manual', userId);
      enforceBackupRetention(userId);
      logger.http('POST', '/api/backup/snapshots', 201, Date.now() - start, { userId, filename: snapshot.filename });
      return NextResponse.json({ snapshot }, { status: 201 });
    } catch (err) {
      logger.error('api.backup.snapshots.post', 'Failed to generate manual snapshot', err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Snapshot generation failed' },
        { status: 500 }
      );
    }
  });
}
