import { NextResponse } from 'next/server';
import {
  exportFullBackupJson,
  restoreFromBackupJson,
  importVCardContent,
  exportContactsToVCard,
  wipeAllData,
} from '@/lib/portability-service';
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
    const body = await request.json();

    return runWithUser(userId, () => {
      if (body.type === 'vcard') {
        const res = importVCardContent(body.content || '');
        logger.http('POST', '/api/backup (vcard_import)', 200, Date.now() - start, { ...res, userId });
        return NextResponse.json(res);
      }

      const res = restoreFromBackupJson(body.backup);
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
