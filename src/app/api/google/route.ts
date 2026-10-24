import { NextResponse } from 'next/server';
import {
  generateGoogleAuthUrl,
  getGoogleOAuthClient,
  runLiveGooglePeopleSync,
  pushScheduleToGoogleCalendar,
  testGoogleConnection,
  listGoogleSyncTombstones,
  deleteGoogleSyncTombstone,
  deleteGoogleSyncTombstones,
  clearAllDeletedGoogleSyncTombstones,
} from '@/lib/google-sync';
import { listContactsWithDetails } from '@/lib/contacts-service';
import { getDb, runWithUser } from '@/db';
import { settings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { getRequestUserId } from '@/lib/auth';

function resolveRedirectUri(request: Request, override?: string | null): string {
  const url = new URL(request.url);
  const proto = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '') || 'http';
  let host = request.headers.get('x-forwarded-host') || request.headers.get('host') || url.host;
  if (host.includes('0.0.0.0')) {
    host = host.replace('0.0.0.0', 'localhost');
  }

  const defaultUri = `${proto}://${host}/api/google`;
  if (override) {
    try {
      const parsedOverride = new URL(override);
      // Ensure the override has the same origin or localhost to avoid open redirect
      if (parsedOverride.host === host || parsedOverride.hostname === 'localhost') {
        return override.replace('0.0.0.0', 'localhost');
      }
    } catch {
      // ignore invalid URL
    }
  }
  return defaultUri;
}

export async function GET(request: Request) {
  const start = Date.now();
  const userId = getRequestUserId(request);
  const requestId =
    request.headers.get('x-request-id') ||
    request.headers.get('x-correlation-id') ||
    crypto.randomUUID();

  return runWithUser(
    userId,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const mode = searchParams.get('mode');

        if (mode === 'tombstones') {
          const tombstones = listGoogleSyncTombstones();
          logger.http('GET', '/api/google?mode=tombstones', 200, Date.now() - start, {
            count: tombstones.length,
            userId,
            requestId,
          });
          return NextResponse.json({ tombstones, requestId });
        }

        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const clientRedirectUri = searchParams.get('redirect_uri');
        const redirectUri = resolveRedirectUri(request, state || clientRedirectUri);

        if (code) {
          const oauth2Client = getGoogleOAuthClient(redirectUri);
          const { tokens } = await oauth2Client.getToken(code);
          const db = getDb();
          const cfg = db.select().from(settings).get();
          if (cfg && tokens.refresh_token) {
            db.update(settings)
              .set({ googleRefreshToken: tokens.refresh_token })
              .where(eq(settings.id, cfg.id))
              .run();
          }
          logger.http('GET', '/api/google (oauth_callback)', 302, Date.now() - start, {
            userId,
            requestId,
            grantedScope: tokens.scope,
          });
          const callbackTarget = redirectUri.replace(
            /\/api\/google.*$/,
            '/?tab=settings&google=connected'
          );
          return NextResponse.redirect(callbackTarget);
        }

        const authUrl = generateGoogleAuthUrl(redirectUri);
        logger.http('GET', '/api/google (auth_url)', 200, Date.now() - start, {
          userId,
          requestId,
        });
        return NextResponse.json({ authUrl, redirectUri, requestId });
      } catch (err) {
        logger.error('api.google.get', 'Google OAuth error', err, { requestId, userId });
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'Google OAuth error', requestId },
          { status: 400 }
        );
      }
    },
    requestId
  );
}

export async function POST(request: Request) {
  const start = Date.now();
  const userId = getRequestUserId(request);
  const requestId =
    request.headers.get('x-request-id') ||
    request.headers.get('x-correlation-id') ||
    crypto.randomUUID();

  return runWithUser(
    userId,
    async () => {
      let action = 'sync';
      try {
        const body = await request.json().catch(() => ({}));
        action = body.action || 'sync';
        const redirectUri = resolveRedirectUri(request, body.redirect_uri);

        if (action === 'test_connection') {
          const result = await testGoogleConnection(redirectUri);
          logger.http('POST', '/api/google (test_connection)', 200, Date.now() - start, {
            ...result,
            userId,
            requestId,
          });
          return NextResponse.json({ ...result, requestId });
        }

        if (action === 'push_calendar') {
          const advanceDays = typeof body.advanceDays === 'number' ? body.advanceDays : undefined;
          const result = await pushScheduleToGoogleCalendar(redirectUri, undefined, advanceDays);
          logger.http('POST', '/api/google (push_calendar)', 200, Date.now() - start, {
            ...result,
            userId,
            requestId,
          });
          return NextResponse.json({ ...result, requestId });
        }

        if (action === 'unblock_tombstone') {
          const tombstoneId = Number(body.tombstoneId);
          if (!tombstoneId) {
            return NextResponse.json({ error: 'tombstoneId is required', requestId }, { status: 400 });
          }
          const success = deleteGoogleSyncTombstone(tombstoneId);
          logger.http('POST', '/api/google (unblock_tombstone)', 200, Date.now() - start, {
            tombstoneId,
            success,
            userId,
            requestId,
          });
          return NextResponse.json({ success, requestId });
        }

        if (action === 'bulk_unblock_tombstones') {
          const rawIds = Array.isArray(body.tombstoneIds) ? body.tombstoneIds : [];
          const tombstoneIds = rawIds.map((id: unknown) => Number(id)).filter(Boolean);
          if (!tombstoneIds.length) {
            return NextResponse.json({ error: 'tombstoneIds array is required', requestId }, { status: 400 });
          }
          const count = deleteGoogleSyncTombstones(tombstoneIds);
          logger.http('POST', '/api/google (bulk_unblock_tombstones)', 200, Date.now() - start, {
            count,
            userId,
            requestId,
          });
          return NextResponse.json({ success: true, count, requestId });
        }

        if (action === 'clear_deleted_tombstones') {
          const count = clearAllDeletedGoogleSyncTombstones();
          logger.http('POST', '/api/google (clear_deleted_tombstones)', 200, Date.now() - start, {
            count,
            userId,
            requestId,
          });
          return NextResponse.json({ success: true, count, requestId });
        }

        const fullRescan = Boolean(body.fullRescan);
        const summary = await runLiveGooglePeopleSync(redirectUri, { fullRescan });
        logger.http('POST', `/api/google (sync${fullRescan ? '_full_rescan' : ''})`, 200, Date.now() - start, {
          ...summary,
          fullRescan,
          userId,
          requestId,
        });
        return NextResponse.json({ ...summary, requestId });
      } catch (err) {
        const rawMessage = err instanceof Error ? err.message : 'Google operation failed';
        const isInsufficientPerm = /insufficient permission|insufficient authentication scopes/i.test(
          rawMessage
        );
        const requiredScope =
          action === 'push_calendar'
            ? 'https://www.googleapis.com/auth/calendar.events (Google Calendar API)'
            : 'https://www.googleapis.com/auth/contacts.readonly (Google People API)';

        const friendlyError = isInsufficientPerm
          ? action === 'push_calendar'
            ? 'Insufficient Permission for Google Calendar Push: Your current Google Refresh Token was created BEFORE Outbound Google Calendar Push was enabled (so it only has the contacts.readonly scope). Please go to Settings → 3. Google Contacts Integration and click "Authorize with Google (OAuth)" again (and ensure "Google Calendar API" is enabled in your Google Cloud project) to grant the calendar.events scope.'
            : 'Insufficient Permission for Google Contacts Sync: Your token is missing the https://www.googleapis.com/auth/contacts.readonly scope. Click "Authorize with Google (OAuth)" in Settings.'
          : rawMessage;

        logger.error('api.google.sync', 'Google operation failed', err, {
          requestId,
          userId,
          action,
          requiredScope,
          resolutionHint: isInsufficientPerm
            ? 'Re-authorize via Settings -> Authorize with Google (OAuth) after enabling Outbound Calendar Push so the OAuth token includes https://www.googleapis.com/auth/calendar.events, and ensure Google Calendar API is enabled in Google Cloud Console.'
            : undefined,
        });
        return NextResponse.json({ error: friendlyError, requestId, requiredScope }, { status: 500 });
      }
    },
    requestId
  );
}
