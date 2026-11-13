import path from 'path';
import { NextResponse } from 'next/server';
import {
  exportFullBackupJson,
  restoreFromBackupJson,
  importVCardContent,
  exportContactsToVCard,
  importSqliteDatabase,
  wipeAllData,
} from '@/lib/portability-service';
import { getBackupsDirectory, isSnapshotOwnedByUser } from '@/lib/backup-rotator';
import { logger } from '@/lib/logger';
import { getRequestUserId } from '@/lib/auth';
import { runWithUser } from '@/db';
import { checkRateLimit, recordFailedAttempt, getClientIp } from '@/lib/rate-limiter';

const MAX_BACKUP_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB
const ALLOWED_UPLOAD_EXTENSIONS = ['.db', '.sqlite', '.sqlite3', '.vcf', '.json'];

function resolveOwnedSnapshotPath(
  filename: string,
  userId: number
): { ok: true; fullPath: string } | { ok: false; status: number; error: string } {
  if (
    !filename ||
    typeof filename !== 'string' ||
    !filename.endsWith('.db') ||
    filename.includes('..') ||
    filename.includes('/') ||
    filename.includes('\\')
  ) {
    return { ok: false, status: 400, error: 'Invalid snapshot filename' };
  }

  if (!isSnapshotOwnedByUser(filename, userId)) {
    logger.warn('api.backup.snapshot_access', `User ${userId} attempted unauthorized snapshot restore: ${filename}`);
    return { ok: false, status: 403, error: 'Access denied: You do not own this snapshot' };
  }

  const backupDir = path.resolve(getBackupsDirectory());
  const fullPath = path.resolve(backupDir, filename);
  if (!fullPath.startsWith(backupDir + path.sep)) {
    return { ok: false, status: 400, error: 'Invalid snapshot path' };
  }

  return { ok: true, fullPath };
}

export async function GET(request: Request) {
  const start = Date.now();
  const userId = getRequestUserId(request);
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'json';

  return runWithUser(userId, () => {
    if (format === 'vcf') {
      const vcf = exportContactsToVCard();
      logger.http('GET', '/api/backup?format=vcf', 200, Date.now() - start, { userId });
      return new NextResponse(vcf, {
        status: 200,
        headers: {
          'Content-Type': 'text/vcard; charset=utf-8',
          'Content-Disposition': 'attachment; filename="touchpoint-contacts.vcf"',
        },
      });
    }

    const payload = exportFullBackupJson();
    logger.http('GET', '/api/backup?format=json', 200, Date.now() - start, { userId });
    return NextResponse.json(payload);
  });
}

export async function POST(request: Request) {
  const start = Date.now();
  const userId = getRequestUserId(request);
  const ip = getClientIp(request);

  const rate = checkRateLimit(ip, 'backup_write', 20, 15 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `Too many backup requests. Try again in ${rate.retryAfterSeconds} seconds.` },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
    );
  }
  recordFailedAttempt(ip, 'backup_write');

  try {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'No file uploaded in form data' }, { status: 400 });
      }

      const fileName = file.name.toLowerCase();
      if (!ALLOWED_UPLOAD_EXTENSIONS.some((ext) => fileName.endsWith(ext))) {
        return NextResponse.json(
          { error: 'Unsupported file type. Allowed extensions: .db, .sqlite, .sqlite3, .vcf, .json' },
          { status: 400 }
        );
      }

      if (file.size > MAX_BACKUP_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: 'File exceeds maximum allowed upload size of 50 MB' },
          { status: 413 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      if (buffer.byteLength > MAX_BACKUP_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: 'File exceeds maximum allowed upload size of 50 MB' },
          { status: 413 }
        );
      }

      return runWithUser(userId, () => {
        if (
          fileName.endsWith('.db') ||
          fileName.endsWith('.sqlite') ||
          fileName.endsWith('.sqlite3') ||
          (buffer.length >= 16 && buffer.subarray(0, 16).equals(Buffer.from('SQLite format 3\0', 'utf8')))
        ) {
          const res = importSqliteDatabase(buffer);
          logger.http('POST', '/api/backup (sqlite_import)', 200, Date.now() - start, { ...res, userId });
          return NextResponse.json(res);
        }

        if (fileName.endsWith('.vcf')) {
          const text = buffer.toString('utf8');
          const res = importVCardContent(text);
          logger.http('POST', '/api/backup (vcard_import)', 200, Date.now() - start, { ...res, userId });
          return NextResponse.json(res);
        }

        const text = buffer.toString('utf8');
        const json = JSON.parse(text);
        const res = restoreFromBackupJson(json.backup || json);
        logger.http('POST', '/api/backup (restore_json)', 200, Date.now() - start, { ...res, userId });
        return NextResponse.json(res);
      });
    }

    const body = await request.json();

    return runWithUser(userId, () => {
      if (body.type === 'vcard') {
        const res = importVCardContent(body.content || '');
        logger.http('POST', '/api/backup (vcard_import)', 200, Date.now() - start, { ...res, userId });
        return NextResponse.json(res);
      }

      if (body.type === 'sqlite' || body.type === 'db') {
        let input: Buffer | string;
        if (body.data) {
          input = Buffer.from(body.data, 'base64');
        } else if (body.snapshotFilename) {
          const resolved = resolveOwnedSnapshotPath(body.snapshotFilename, userId);
          if (!resolved.ok) {
            return NextResponse.json({ error: resolved.error }, { status: resolved.status });
          }
          input = resolved.fullPath;
        } else {
          return NextResponse.json({ error: 'Missing sqlite data or snapshotFilename' }, { status: 400 });
        }
        const res = importSqliteDatabase(input);
        logger.http('POST', '/api/backup (sqlite_import)', 200, Date.now() - start, { ...res, userId });
        return NextResponse.json(res);
      }

      if (body.snapshotFilename) {
        const resolved = resolveOwnedSnapshotPath(body.snapshotFilename, userId);
        if (!resolved.ok) {
          return NextResponse.json({ error: resolved.error }, { status: resolved.status });
        }
        const res = importSqliteDatabase(resolved.fullPath);
        logger.http('POST', '/api/backup (snapshot_restore)', 200, Date.now() - start, { ...res, userId });
        return NextResponse.json(res);
      }

      const res = restoreFromBackupJson(body.backup || body);
      logger.http('POST', '/api/backup (restore_json)', 200, Date.now() - start, { ...res, userId });
      return NextResponse.json(res);
    });
  } catch (err) {
    logger.error('api.backup.post', 'Backup/import operation failed', err);
    return NextResponse.json({ error: 'Backup/import operation failed' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const start = Date.now();
  const userId = getRequestUserId(request);
  const ip = getClientIp(request);

  const rate = checkRateLimit(ip, 'backup_delete', 5, 15 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${rate.retryAfterSeconds} seconds.` },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
    );
  }
  recordFailedAttempt(ip, 'backup_delete');

  try {
    const body = await request.json();
    if (body.confirmation !== 'DELETE') {
      return NextResponse.json(
        { error: 'Confirmation mismatch. You must send { confirmation: "DELETE" }' },
        { status: 400 }
      );
    }

    return runWithUser(userId, () => {
      const res = wipeAllData();
      logger.http('DELETE', '/api/backup (wipe_all_data)', 200, Date.now() - start, { userId });
      return NextResponse.json(res);
    });
  } catch (err) {
    logger.error('api.backup.delete', 'Failed to wipe database', err);
    return NextResponse.json({ error: 'Failed to wipe database' }, { status: 500 });
  }
}
