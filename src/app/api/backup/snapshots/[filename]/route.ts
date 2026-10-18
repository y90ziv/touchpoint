import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getRequestUserId } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const start = Date.now();
  const userId = getRequestUserId(request);
  const { filename } = await params;

  // Path traversal & extension validation
  if (!filename || !filename.endsWith('.db') || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }

  const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'touchpoint.db');
  const backupDir = path.join(path.dirname(dbPath), 'backups');
  const fullPath = path.join(backupDir, filename);

  if (!fs.existsSync(fullPath)) {
    return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });
  }

  try {
    const fileBuffer = fs.readFileSync(fullPath);
    logger.http('GET', `/api/backup/snapshots/${filename}`, 200, Date.now() - start, { userId, filename });

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-sqlite3',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(fileBuffer.length),
      },
    });
  } catch (err) {
    logger.error('api.backup.snapshots.download', 'Failed to read snapshot file', err);
    return NextResponse.json({ error: 'Failed to read snapshot file' }, { status: 500 });
  }
}
