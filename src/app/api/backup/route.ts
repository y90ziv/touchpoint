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
import { getBackupsDirectory } from '@/lib/backup-rotator';
import { logger } from '@/lib/logger';
import { getRequestUserId } from '@/lib/auth';
import { runWithUser } from '@/db';

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
  try {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'No file uploaded in form data' }, { status: 400 });
      }

      const fileName = file.name.toLowerCase();
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

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
        } else if (body.filePath) {
          input = body.filePath;
        } else if (body.snapshotFilename) {
          const backupDir = getBackupsDirectory();
          input = path.join(backupDir, body.snapshotFilename);
        } else {
          return NextResponse.json({ error: 'Missing sqlite data, filePath, or snapshotFilename' }, { status: 400 });
        }
        const res = importSqliteDatabase(input);
        logger.http('POST', '/api/backup (sqlite_import)', 200, Date.now() - start, { ...res, userId });
        return NextResponse.json(res);
      }

      if (body.snapshotFilename) {
        const backupDir = getBackupsDirectory();
        const fullPath = path.join(backupDir, body.snapshotFilename);
        const res = importSqliteDatabase(fullPath);
        logger.http('POST', '/api/backup (snapshot_restore)', 200, Date.now() - start, { ...res, userId });
        return NextResponse.json(res);
      }

      const res = restoreFromBackupJson(body.backup || body);
      logger.http('POST', '/api/backup (restore_json)', 200, Date.now() - start, { ...res, userId });
      return NextResponse.json(res);
    });
  } catch (err) {
    logger.error('api.backup.post', 'Backup/import operation failed', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Operation failed' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const start = Date.now();
  const userId = getRequestUserId(request);
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to wipe database' },
      { status: 500 }
    );
  }
}
