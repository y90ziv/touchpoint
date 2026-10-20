import { google } from 'googleapis';
import { eq, isNotNull } from 'drizzle-orm';
import { getDb } from '@/db';
import { contacts, settings, googleSyncTombstones } from '@/db/schema';
import { logger } from '@/lib/logger';
import { splitFullName, listContactsWithDetails } from '@/lib/contacts-service';

export interface GooglePersonCandidate {
  resourceName: string;
  fullName: string;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
  jobTitle?: string | null;
  birthday?: string | null;
  updatedAt?: string | null;
}

/**
 * Pure Additive-Only Sync Engine (Option 1 + Option 3):
 * - Option 1 (Tombstone Ledger): Skips any `resourceName` present in `contacts.google_resource_name`
 *   OR in `google_sync_tombstones` (previously merged or deleted Google contacts).
 * - Option 3 (Timestamp Cutoff): When the database already has Google contacts and `lastGoogleSyncAt`
 *   is recorded, skips any candidate whose Google `updatedAt` timestamp is older than or equal to
 *   `lastGoogleSyncAt` (and records a tombstone so previously merged/dismissed contacts never return).
 * - NEVER overwrites existing contacts in Touchpoint.
 * - NEVER deletes contacts in Touchpoint that were removed from Google.
 */
export function importGoogleCandidatesAdditiveOnly(
  candidates: GooglePersonCandidate[],
  options: { skipEmailOnly?: boolean; lastGoogleSyncAt?: string | null } = {}
): {
  scanned: number;
  imported: number;
  skippedExisting: number;
  skippedFiltered: number;
} {
  const db = getDb();
  const existingRows = db
    .select({ googleResourceName: contacts.googleResourceName })
    .from(contacts)
    .where(isNotNull(contacts.googleResourceName))
    .all();

  const tombstoneRows = db
    .select({ googleResourceName: googleSyncTombstones.googleResourceName })
    .from(googleSyncTombstones)
    .all();

  const existingResourceNames = new Set(
    existingRows.map((r) => r.googleResourceName).filter(Boolean) as string[]
  );
  const tombstonedResourceNames = new Set(
    tombstoneRows.map((r) => r.googleResourceName).filter(Boolean) as string[]
  );

  const currentSettings = db.select().from(settings).get();
  const effectiveLastSyncIso =
    options.lastGoogleSyncAt !== undefined
      ? options.lastGoogleSyncAt
      : currentSettings?.lastGoogleSyncAt || null;
  const lastSyncEpochMs =
    existingRows.length > 0 && effectiveLastSyncIso ? Date.parse(effectiveLastSyncIso) : NaN;

  let imported = 0;
  let skippedExisting = 0;
  let skippedFiltered = 0;
  const now = new Date().toISOString();

  for (const person of candidates) {
    if (!person.resourceName || !person.fullName?.trim()) {
      skippedFiltered++;
      continue;
    }

    // Rule 1 (Option 1): Never overwrite existing contacts or re-import merged/deleted tombstones
    if (
      existingResourceNames.has(person.resourceName) ||
      tombstonedResourceNames.has(person.resourceName)
    ) {
      skippedExisting++;
      continue;
    }

    // Rule 2 (Option 3): If an initial sync has already occurred, skip candidates whose Google
    // updateTime is older than or equal to lastGoogleSyncAt (and backfill a tombstone so they
    // stay permanently dismissed even if touched later).
    if (!Number.isNaN(lastSyncEpochMs) && person.updatedAt) {
      const candidateEpochMs = Date.parse(person.updatedAt);
      if (!Number.isNaN(candidateEpochMs) && candidateEpochMs <= lastSyncEpochMs) {
        db.insert(googleSyncTombstones)
          .values({
            googleResourceName: person.resourceName,
            reason: 'merged',
            createdAt: now,
          })
          .onConflictDoNothing()
          .run();
        tombstonedResourceNames.add(person.resourceName);
        skippedExisting++;
        continue;
      }
    }

    // Optional filter: skip email-only contacts if enabled
    if (options.skipEmailOnly && !person.phone?.trim()) {
      skippedFiltered++;
      continue;
    }

    // Rule 3: Insert genuinely new contact with keepInTouch = false
    const { firstName, lastName } = splitFullName(person.fullName);
    db.insert(contacts)
      .values({
        source: 'google',
        googleResourceName: person.resourceName,
        firstName: firstName || null,
        lastName: lastName || null,
        fullName: person.fullName.trim(),
        phone: person.phone?.trim() || null,
        email: person.email?.trim() || null,
        company: person.company?.trim() || null,
        jobTitle: person.jobTitle?.trim() || null,
        pets: '[]',
        birthday: person.birthday || null,
        keepInTouch: false,
        createdAt: now,
      })
      .run();

    existingResourceNames.add(person.resourceName);
    imported++;
  }

  // Update lastGoogleSyncAt in settings if row exists
  if (currentSettings) {
    db.update(settings)
      .set({ lastGoogleSyncAt: now })
      .where(eq(settings.id, currentSettings.id))
      .run();
  }

  logger.info('google.sync', 'Completed additive-only Google Contacts sync', {
    scanned: candidates.length,
    imported,
    skippedExisting,
    skippedFiltered,
  });

  return {
    scanned: candidates.length,
    imported,
    skippedExisting,
    skippedFiltered,
  };
}

export function getGoogleOAuthClient(redirectUri: string) {
  const db = getDb();
  const cfg = db.select().from(settings).get();
  if (!cfg?.googleClientId || !cfg?.googleClientSecret) {
    throw new Error('Google OAuth Client ID and Secret are not configured in Settings.');
  }
  const cleanRedirectUri = redirectUri.replace('0.0.0.0', 'localhost');
  return new google.auth.OAuth2(cfg.googleClientId, cfg.googleClientSecret, cleanRedirectUri);
}

export function generateGoogleAuthUrl(redirectUri: string): string {
  const cleanUri = redirectUri.replace('0.0.0.0', 'localhost');
  const db = getDb();
  const cfg = db.select().from(settings).get();
  const oauth2Client = getGoogleOAuthClient(cleanUri);

  const scopes = ['https://www.googleapis.com/auth/contacts.readonly'];
  if (cfg?.googleCalendarPushEnabled) {
    scopes.push('https://www.googleapis.com/auth/calendar.events');
  }

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
    state: cleanUri,
  });
}

export async function runLiveGooglePeopleSync(redirectUri: string) {
  const db = getDb();
  const cfg = db.select().from(settings).get();
  if (!cfg?.googleRefreshToken) {
    throw new Error('Google account is not connected yet.');
  }

  const oauth2Client = getGoogleOAuthClient(redirectUri);
  oauth2Client.setCredentials({ refresh_token: cfg.googleRefreshToken });

  const peopleService = google.people({ version: 'v1', auth: oauth2Client });
  const candidates: GooglePersonCandidate[] = [];
  let nextPageToken: string | undefined = undefined;

  logger.info('google.sync', 'Fetching contacts from Google People API (outbound permitted)');

  do {
    const res: { data: { connections?: Array<Record<string, any>>; nextPageToken?: string | null } } =
      await peopleService.people.connections.list({
        resourceName: 'people/me',
        pageSize: 500,
        pageToken: nextPageToken,
        personFields: 'names,emailAddresses,phoneNumbers,birthdays,organizations,metadata',
      });

    const connections = res.data.connections || [];
    for (const c of connections) {
      const resourceName = c.resourceName || '';
      const fullName = c.names?.[0]?.displayName || '';
      if (!resourceName || !fullName) continue;

      const phone = c.phoneNumbers?.[0]?.value || null;
      const email = c.emailAddresses?.[0]?.value || null;
      const org = c.organizations?.[0];
      const company = org?.name || null;
      const jobTitle = org?.title || null;

      let birthday: string | null = null;
      const bday = c.birthdays?.[0]?.date;
      if (bday && bday.month && bday.day) {
        const mm = String(bday.month).padStart(2, '0');
        const dd = String(bday.day).padStart(2, '0');
        birthday = bday.year ? `${bday.year}-${mm}-${dd}` : `${mm}-${dd}`;
      }

      // Extract latest updateTime from Google PersonMetadata sources
      let updatedAt: string | null = null;
      const sources: Array<{ updateTime?: string }> = c.metadata?.sources || [];
      for (const src of sources) {
        if (src.updateTime && (!updatedAt || src.updateTime > updatedAt)) {
          updatedAt = src.updateTime;
        }
      }

      candidates.push({
        resourceName,
        fullName,
        phone,
        email,
        company,
        jobTitle,
        birthday,
        updatedAt,
      });
    }

    nextPageToken = res.data.nextPageToken || undefined;
  } while (nextPageToken);

  return importGoogleCandidatesAdditiveOnly(candidates, {
    skipEmailOnly: cfg.skipGoogleEmailOnly,
    lastGoogleSyncAt: cfg.lastGoogleSyncAt,
  });
}

/**
 * Outbound Google Calendar Push:
 * Disabled by default for strict privacy. When explicitly enabled by the user,
 * pushes upcoming touchpoint due dates outward from the container to Google Calendar API.
 * Deduplicates against existing events in the calendar so running repeatedly never spams.
 */
export async function pushScheduleToGoogleCalendar(
  redirectUri: string = 'http://localhost:3000/api/google',
  events?: Array<{ contactId: number; fullName: string; nextDueDate: string; intervalDays: number }>,
  advanceDaysOverride?: number
): Promise<{ pushed: number; skippedExisting: number }> {
  const db = getDb();
  const cfg = db.select().from(settings).get();

  if (!cfg?.googleCalendarPushEnabled) {
    throw new Error(
      'Outbound Google Calendar Push is disabled. Enable it first to allow outbound connections to Google Calendar URLs.'
    );
  }

  if (!cfg.googleRefreshToken) {
    throw new Error('Google account is not connected yet.');
  }

  const effectiveAdvanceDays =
    advanceDaysOverride !== undefined
      ? advanceDaysOverride
      : (cfg.googleCalendarPushAdvanceDays ?? 7);

  // If explicit events not provided, compute from tracked contacts filtered by advanceDays
  let targetEvents = events;
  if (!targetEvents) {
    const allDetailed = listContactsWithDetails();
    targetEvents = allDetailed
      .filter((c) => {
        if (!c.keepInTouch || c.cadence.status === 'paused') return false;
        if (!effectiveAdvanceDays || effectiveAdvanceDays <= 0) return true; // all upcoming
        return c.cadence.daysUntilDue <= effectiveAdvanceDays;
      })
      .map((c) => ({
        contactId: c.id,
        fullName: c.fullName,
        nextDueDate: c.cadence.nextDueDate,
        intervalDays: c.cadence.effectiveIntervalDays,
      }));
  }

  if (targetEvents.length === 0) {
    try {
      db.update(settings)
        .set({ lastGoogleCalendarPushAt: new Date().toISOString() })
        .where(eq(settings.id, cfg.id))
        .run();
    } catch {
      // ignore
    }
    return { pushed: 0, skippedExisting: 0 };
  }

  const oauth2Client = getGoogleOAuthClient(redirectUri);
  oauth2Client.setCredentials({ refresh_token: cfg.googleRefreshToken });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const calendarId = cfg.googleCalendarId || 'primary';

  logger.info(
    'google.calendar.push',
    `Processing ${targetEvents.length} touchpoint reminders outward to Google Calendar (${calendarId}), advanceDays=${effectiveAdvanceDays}`
  );

  // Query existing calendar events in the range to prevent duplicates
  const dueDates = targetEvents.map((e) => e.nextDueDate).filter(Boolean).sort();
  const existingEventKeys = new Set<string>();

  if (dueDates.length > 0) {
    try {
      const minDate = dueDates[0];
      const maxDate = dueDates[dueDates.length - 1];
      const timeMin = new Date(`${minDate}T00:00:00Z`).toISOString();
      const maxDateObj = new Date(`${maxDate}T23:59:59Z`);
      const timeMax = maxDateObj.toISOString();

      const listRes = await calendar.events.list({
        calendarId,
        timeMin,
        timeMax,
        singleEvents: true,
        maxResults: 250,
        q: 'Touchpoint: Reach out to',
      });

      for (const item of listRes.data.items || []) {
        const summary = item.summary || '';
        const date = item.start?.date || (item.start?.dateTime ? item.start.dateTime.slice(0, 10) : '');
        if (summary && date) {
          existingEventKeys.add(`${summary}__${date}`);
        }
      }
    } catch (listErr) {
      logger.warn('google.calendar.push', 'Could not query existing calendar events for dedup, proceeding with insert', listErr);
    }
  }

  let pushed = 0;
  let skippedExisting = 0;
  for (const ev of targetEvents) {
    const summary = `📞 Touchpoint: Reach out to ${ev.fullName}`;
    const key = `${summary}__${ev.nextDueDate}`;

    if (existingEventKeys.has(key)) {
      skippedExisting++;
      continue;
    }

    await calendar.events.insert({
      calendarId,
      requestBody: {
        summary,
        description: `Scheduled Touchpoint reminder (every ${ev.intervalDays} days).`,
        start: { date: ev.nextDueDate },
        end: { date: ev.nextDueDate },
      },
    });
    existingEventKeys.add(key);
    pushed++;
  }

  try {
    db.update(settings)
      .set({ lastGoogleCalendarPushAt: new Date().toISOString() })
      .where(eq(settings.id, cfg.id))
      .run();
  } catch {
    // ignore
  }

  logger.info('google.calendar.push', 'Completed outbound Google Calendar push', { pushed, skippedExisting });
  return { pushed, skippedExisting };
}

export async function testGoogleConnection(redirectUri: string): Promise<{
  ok: boolean;
  totalGoogleContactsSampled: number;
}> {
  const db = getDb();
  const cfg = db.select().from(settings).get();
  if (!cfg?.googleRefreshToken) {
    throw new Error('No Google Refresh Token configured. Click "Authorize with Google" or paste a Refresh Token first.');
  }

  const oauth2Client = getGoogleOAuthClient(redirectUri);
  oauth2Client.setCredentials({ refresh_token: cfg.googleRefreshToken });

  const peopleService = google.people({ version: 'v1', auth: oauth2Client });
  const res: { data: { connections?: Array<Record<string, any>>; totalItems?: number | null } } =
    await peopleService.people.connections.list({
      resourceName: 'people/me',
      pageSize: 10,
      personFields: 'names',
    });

  const count = res.data.totalItems ?? (res.data.connections?.length || 0);
  logger.info('google.test', 'Verified Google People API connection', { count });
  return {
    ok: true,
    totalGoogleContactsSampled: count,
  };
}

