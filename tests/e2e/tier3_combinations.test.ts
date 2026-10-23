import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, setTestDb, closeAllDbs, getUserDb, runWithUser, getDb } from '@/db';
import {
  calculateEffectiveIntervalDays,
  evaluateContactCadence,
  calculateRelationshipHealthScore,
} from '@/lib/cadence';
import {
  createContact,
  updateContact,
  deleteContact,
  createGroup,
  updateGroup,
  listContactsWithDetails,
  getContactById,
  createCustomFieldTemplate,
  executeBulkContactOperation,
  detectDuplicateContacts,
  mergeContacts,
} from '@/lib/contacts-service';
import {
  logTouchpoint,
  snoozeContact,
  addTopic,
  createRelationship,
  buildRelationshipNetworkGraph,
} from '@/lib/touchpoints-service';
import {
  importGoogleCandidatesAdditiveOnly,
  listGoogleSyncTombstones,
} from '@/lib/google-sync';
import {
  buildContactReminderMessage,
  processTelegramCallbackData,
} from '@/lib/telegram-service';
import {
  signWebhookPayload,
  buildWebhookDigestPayload,
} from '@/lib/webhook-service';
import {
  generateIcalFeed,
  wipeAllData,
  exportFullBackupJson,
  restoreFromBackupJson,
} from '@/lib/portability-service';
import {
  registerOwnerAccount,
  registerUserAccount,
  authenticateOwner,
  createSessionToken,
  verifySessionToken,
} from '@/lib/auth';
import {
  generateTotpSecret,
  generateTotp,
  verifyTotp,
  generateBackupCodes,
  verifyAndConsumeBackupCode,
} from '@/lib/totp';
import {
  initFtsTable,
  indexContactInFts,
  searchContactsFts,
} from '@/lib/search-service';
import {
  createDatabaseSnapshot,
  listDatabaseSnapshots,
  isSnapshotOwnedByUser,
} from '@/lib/backup-rotator';
import { getDormantContacts, getSerendipitySuggestion } from '@/lib/serendipity';
import { settings, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';

describe('Tier 3: Cross-Feature Combinations & Pairwise Interactions', () => {
  beforeEach(() => {
    const { db, sqlite } = createDatabase(':memory:');
    setTestDb(db, sqlite);
  });

  afterEach(() => {
    closeAllDbs();
  });

  it('3.1 Contact Cadence Override + Group Pause interaction', () => {
    const refDate = new Date('2026-10-20T12:00:00Z');
    // Group A (7d cadence) is paused until next month
    const gPaused = createGroup({
      name: 'Paused Sprint Circle',
      intervalDays: 7,
      pausedUntil: '2026-11-20T00:00:00Z',
    });
    // Group B (30d cadence) is active
    const gActive = createGroup({
      name: 'Active Circle',
      intervalDays: 30,
    });

    // Contact with customIntervalDays = 14
    const contact = createContact({
      fullName: 'Override & Pause Contact',
      keepInTouch: true,
      customIntervalDays: 14,
      groupIds: [gPaused.id, gActive.id],
      lastContactedAt: '2026-10-10T12:00:00Z',
    });

    let evalResult = getContactById(contact.id, refDate);
    // Custom interval override (14) takes precedence over both group intervals
    expect(evalResult?.cadence.effectiveIntervalDays).toBe(14);
    expect(evalResult?.cadence.status).toBe('on_track');

    // Now pause Group B as well, so all assigned groups are paused
    updateGroup(gActive.id, { pausedUntil: '2026-11-20T00:00:00Z' });
    evalResult = getContactById(contact.id, refDate);
    // When all assigned groups are paused, status evaluates to 'paused'
    expect(evalResult?.cadence.status).toBe('paused');

    // Unpausing Group B restores active cadence status
    updateGroup(gActive.id, { pausedUntil: null });
    evalResult = getContactById(contact.id, refDate);
    expect(evalResult?.cadence.status).toBe('on_track');
    expect(evalResult?.cadence.effectiveIntervalDays).toBe(14);
  });

  it('3.2 Google Sync Tombstone + Contact Merge interaction', () => {
    // 1. Existing local contact with Google link in Touchpoint
    const localContact = createContact({
      fullName: 'Alice Walker',
      phone: '+972-54-1111111',
      source: 'google',
      googleResourceName: 'people/c_primary_alice',
      keepInTouch: true,
      notes: 'Local contact profile',
    });

    // 2. Incoming Google contact candidate with matching phone
    const googleCandidate = {
      resourceName: 'people/c_google_alice',
      fullName: 'Alice Walker Google',
      phone: '054-1111111', // local Israeli format matching +972541111111
    };
    const syncRes1 = importGoogleCandidatesAdditiveOnly([googleCandidate]);
    expect(syncRes1.imported).toBe(1);

    // 3. Duplicate detection finds them
    const pairs = detectDuplicateContacts();
    expect(pairs.length).toBeGreaterThanOrEqual(1);
    const dupe = pairs.find(
      (p) =>
        (p.contactA.id === localContact.id && p.contactB.googleResourceName === 'people/c_google_alice') ||
        (p.contactB.id === localContact.id && p.contactA.googleResourceName === 'people/c_google_alice')
    );
    expect(dupe).toBeDefined();

    const googleContactId =
      dupe!.contactA.id === localContact.id ? dupe!.contactB.id : dupe!.contactA.id;

    // 4. Merge Google duplicate into local primary
    mergeContacts(localContact.id, googleContactId);

    // Verify Google tombstone recorded
    const tombstones = listGoogleSyncTombstones();
    expect(tombstones.some((t) => t.googleResourceName === 'people/c_google_alice')).toBe(true);

    // 5. Subsequent Google sync must never re-import the merged Google contact
    const syncRes2 = importGoogleCandidatesAdditiveOnly([googleCandidate]);
    expect(syncRes2.imported).toBe(0);
    expect(syncRes2.skippedExisting).toBe(1);
  });

  it('3.3 2FA Security Setup + Danger Zone Data Wipe interaction', async () => {
    // 1. Setup user account with 2FA
    const { user } = registerOwnerAccount({
      email: 'security_owner@touchpoint.local',
      username: 'sec_owner',
      password: 'StrongPassword#123',
    });

    const { secret } = await generateTotpSecret(user.email);
    const { hashedCodes } = generateBackupCodes(8);
    const db = getDb();
    db.update(users)
      .set({
        totpSecret: secret,
        totpEnabled: true,
        totpBackupCodes: JSON.stringify(hashedCodes),
      })
      .where(eq(users.id, user.id))
      .run();

    // 2. Populate contacts and groups
    const grp = createGroup({ name: 'Secret Group', intervalDays: 30 });
    createContact({ fullName: 'Confidential Contact', groupIds: [grp.id] });
    expect(listContactsWithDetails().length).toBe(1);

    // 3. Perform Danger Zone wipeAllData
    const wipe = wipeAllData();
    expect(wipe.deleted).toBe(true);

    // 4. Verify contacts are cleared
    expect(listContactsWithDetails().length).toBe(0);

    // 5. Verify user security credentials remain intact!
    const userRow = db.select().from(users).where(eq(users.id, user.id)).get();
    expect(userRow).toBeDefined();
    expect(userRow?.totpEnabled).toBeTruthy();
    expect(userRow?.totpSecret).toBe(secret);
    expect(JSON.parse(userRow?.totpBackupCodes || '[]').length).toBe(8);

    // User can still authenticate
    expect(authenticateOwner('security_owner@touchpoint.local', 'StrongPassword#123')).not.toBeNull();
  });

  it('3.4 Touchpoint Logging + Webhook Dispatch with HMAC verification', () => {
    const refDate = new Date('2026-10-20T12:00:00Z');
    const secret = 'webhook-hmac-secret-xyz';

    // 1. Create overdue contact
    const contact = createContact({
      fullName: 'Overdue Contact',
      keepInTouch: true,
      lastContactedAt: '2026-08-01T00:00:00Z',
    });

    // 2. Initial webhook digest reflects overdue contact
    const initialPayload = buildWebhookDigestPayload(refDate, false);
    expect(initialPayload.summary.overdueCount).toBe(1);
    const sig1 = signWebhookPayload(JSON.stringify(initialPayload), secret);
    expect(sig1.startsWith('sha256=')).toBe(true);

    // 3. Log touchpoint resetting cadence
    logTouchpoint({
      contactId: contact.id,
      method: 'call',
      note: 'Caught up for an hour',
      contactedAt: '2026-10-20T11:00:00Z',
    });

    // 4. Second webhook digest reflects on-track status
    const updatedPayload = buildWebhookDigestPayload(refDate, false);
    expect(updatedPayload.summary.overdueCount).toBe(0);
    expect(updatedPayload.summary.totalDispatched).toBe(0);
    const sig2 = signWebhookPayload(JSON.stringify(updatedPayload), secret);
    expect(sig2.startsWith('sha256=')).toBe(true);
    expect(sig2).not.toBe(sig1);
  });

  it('3.5 Snooze Contact + Telegram Reminder message rendering interaction', () => {
    const refDate = new Date('2026-10-20T12:00:00Z');
    const contact = createContact({
      fullName: 'Snooze Candidate',
      keepInTouch: true,
      lastContactedAt: '2026-09-01T00:00:00Z',
    });

    // 1. Initial reminder message indicates Overdue
    const beforeSnooze = buildContactReminderMessage(contact.id, '+972', refDate);
    expect(beforeSnooze.text).toContain('Overdue');

    // 2. Execute snooze via Telegram callback
    const res = processTelegramCallbackData(
      `tp:snooze:${contact.id}:7`,
      '12345',
      '12345',
      refDate
    );
    expect(res.authorized).toBe(true);
    expect(res.action).toBe('snoozed');

    // 3. Re-evaluated contact is on_track and reminder message reflects updated state
    const afterSnooze = buildContactReminderMessage(contact.id, '+972', refDate);
    expect(afterSnooze.text).not.toContain('Overdue');
    expect(getContactById(contact.id, refDate)?.cadence.status).toBe('on_track');
  });

  it('3.6 Bulk Operations + Private iCal Feed Generation interaction', () => {
    registerOwnerAccount({
      email: 'ical_bulk@touchpoint.local',
      username: 'ical_bulk',
      password: 'password123',
    });

    const c1 = createContact({ fullName: 'Friend One', birthday: '1990-05-10', keepInTouch: true, lastContactedAt: '2026-10-01T00:00:00Z' });
    const c2 = createContact({ fullName: 'Friend Two', birthday: '1992-07-20', keepInTouch: true, lastContactedAt: '2026-10-01T00:00:00Z' });
    const c3 = createContact({ fullName: 'Friend Three', birthday: '1995-11-15', keepInTouch: true, lastContactedAt: '2026-10-01T00:00:00Z' });

    // Initial feed contains 3 reach out reminders
    let ical = generateIcalFeed(new Date('2026-10-20T12:00:00Z'));
    expect(ical).toContain('Reach out to Friend One');
    expect(ical).toContain('Reach out to Friend Two');
    expect(ical).toContain('Reach out to Friend Three');

    // Bulk disable keep_in_touch for c1 and c2
    executeBulkContactOperation({
      contactIds: [c1.id, c2.id],
      action: 'disable_keep_in_touch',
    });

    // Updated iCal feed retains all birthdays, but excludes disabled contacts from cadence reminders
    ical = generateIcalFeed(new Date('2026-10-20T12:00:00Z'));
    expect(ical).not.toContain('Reach out to Friend One');
    expect(ical).not.toContain('Reach out to Friend Two');
    expect(ical).toContain('Reach out to Friend Three');
    // Birthdays remain present for all contacts
    expect(ical).toContain("Friend One's Birthday");
    expect(ical).toContain("Friend Two's Birthday");
    expect(ical).toContain("Friend Three's Birthday");
  });

  it('3.7 Duplicate Detection + Merge with Pets and Custom Fields interaction', () => {
    const tCity = createCustomFieldTemplate({ name: 'City', fieldType: 'text' });
    const grp = createGroup({ name: 'Tech Leaders', intervalDays: 30 });

    const cPrimary = createContact({
      fullName: 'David Levy',
      email: 'david@tech.io',
      pets: ['Barnaby (Dog)'],
      customFields: { [tCity.id]: 'Tel Aviv' },
    });

    const cSecondary = createContact({
      fullName: 'David Levy Duplicate',
      email: 'david@tech.io',
      pets: ['Miso (Cat)', 'Barnaby (Dog)'],
      groupIds: [grp.id],
      notes: 'Secondary profile notes',
    });

    // Detect duplicate
    const pairs = detectDuplicateContacts();
    expect(pairs.length).toBeGreaterThanOrEqual(1);

    // Merge secondary into primary
    mergeContacts(cPrimary.id, cSecondary.id);

    const merged = getContactById(cPrimary.id);
    expect(merged).not.toBeNull();
    // Pets union deduplicated
    expect(merged?.pets).toContain('Barnaby (Dog)');
    expect(merged?.pets).toContain('Miso (Cat)');
    expect(merged?.pets.length).toBe(2);
    // Custom fields preserved
    expect(merged?.customFields[tCity.id]).toBe('Tel Aviv');
    // Groups merged
    expect(merged?.groups.some((g) => g.id === grp.id)).toBe(true);
    // Secondary deleted
    expect(getContactById(cSecondary.id)).toBeNull();
  });

  it('3.8 Topics Checklist + Touchpoint Multi-Topic Completion + FTS5 Search indexing interaction', () => {
    const contact = createContact({ fullName: 'Searchable Engineer' });
    const t1 = addTopic(contact.id, 'Kubernetes cluster upgrade');
    const t2 = addTopic(contact.id, 'Postgres partition pruning');

    // Index before touchpoint
    indexContactInFts(contact.id);
    let results = searchContactsFts('Kubernetes');
    expect(results.length).toBe(1);
    expect(results[0].contactId).toBe(contact.id);
    expect(results[0].matchField).toBe('topic');

    // Complete topic 1 via touchpoint
    logTouchpoint({
      contactId: contact.id,
      method: 'call',
      note: 'Discussed Kubernetes migration smoothly',
      completedTopicIds: [t1.id],
    });

    // Re-index
    indexContactInFts(contact.id);

    // Query for note content
    results = searchContactsFts('migration');
    expect(results.length).toBe(1);
    expect(results[0].contactId).toBe(contact.id);
    expect(results[0].matchField).toBe('touchpoint');
  });

  it('3.9 Vacation Global Pause + Relationship Health Score interaction', () => {
    registerOwnerAccount({
      email: 'vacation_owner@touchpoint.local',
      username: 'vacation_owner',
      password: 'password123',
    });

    const refDate = new Date('2026-10-20T12:00:00Z');
    // 2 overdue contacts, 2 on track contacts -> 50% health score
    createContact({ fullName: 'C1', keepInTouch: true, lastContactedAt: '2026-08-01T00:00:00Z' });
    createContact({ fullName: 'C2', keepInTouch: true, lastContactedAt: '2026-08-01T00:00:00Z' });
    createContact({ fullName: 'C3', keepInTouch: true, lastContactedAt: '2026-10-15T00:00:00Z' });
    createContact({ fullName: 'C4', keepInTouch: true, lastContactedAt: '2026-10-15T00:00:00Z' });

    let evaluated = listContactsWithDetails(refDate).map((c) => c.cadence);
    let health = calculateRelationshipHealthScore(evaluated);
    expect(health.scorePercent).toBe(50);
    expect(health.overdueCount).toBe(2);

    // Activate global pause in settings
    const db = getDb();
    db.update(settings).set({ globalPausedUntil: '2026-11-15T00:00:00Z' }).run();

    // Now all contacts are evaluated as 'paused'
    evaluated = listContactsWithDetails(refDate).map((c) => c.cadence);
    expect(evaluated.every((c) => c.status === 'paused')).toBe(true);

    // Paused contacts are omitted from health calculation, yielding 100% baseline
    health = calculateRelationshipHealthScore(evaluated);
    expect(health.scorePercent).toBe(100);
    expect(health.totalTrackedCount).toBe(0);
  });

  it('3.10 Database Snapshots + Data Wipe + File Verification interaction', () => {
    createGroup({ name: 'Snapshot Group', intervalDays: 14 });
    createContact({ fullName: 'Snapshot Contact', keepInTouch: true });

    // Create snapshot
    const snap = createDatabaseSnapshot('manual', 1);
    expect(snap.filename).toContain('manual');
    expect(snap.sizeBytes).toBeGreaterThan(0);

    // Wipe active database
    wipeAllData();
    expect(listContactsWithDetails().length).toBe(0);

    // List snapshots to verify snapshot was preserved on disk
    const snapshots = listDatabaseSnapshots(1);
    expect(snapshots.some((s) => s.filename === snap.filename)).toBe(true);
  });

  it('3.11 Multi-Tenant Segregation + Snapshot Ownership interaction', () => {
    // Multi-tenant snapshot authorization isolation
    expect(isSnapshotOwnedByUser('u1_admin-daily-2026-10-20.db', 1)).toBe(true);
    expect(isSnapshotOwnedByUser('u1_admin-daily-2026-10-20.db', 2)).toBe(false);
    expect(isSnapshotOwnedByUser('u2_member-daily-2026-10-20.db', 2)).toBe(true);
    expect(isSnapshotOwnedByUser('u2_member-daily-2026-10-20.db', 1)).toBe(false);

    // Multi-tenant runWithUser execution verification
    runWithUser(1, () => {
      createContact({ fullName: 'Alice (User 1)' });
      expect(listContactsWithDetails().some((c) => c.fullName.includes('Alice'))).toBe(true);
    });

    runWithUser(2, () => {
      createContact({ fullName: 'Bob (User 2)' });
      expect(listContactsWithDetails().some((c) => c.fullName.includes('Bob'))).toBe(true);
    });
  });

  it('3.12 Serendipity Dormant Suggestion + Touchpoint Logging interaction', () => {
    // Contact with no interaction for 200 days (> 180 threshold)
    const contact = createContact({
      fullName: 'Dormant Old Friend',
      keepInTouch: true,
      lastContactedAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
    });

    // Initially surfaced by Serendipity engine
    const dormantBefore = getDormantContacts(180);
    expect(dormantBefore.some((d) => d.contactId === contact.id)).toBe(true);

    const suggestionBefore = getSerendipitySuggestion(0, 180);
    expect(suggestionBefore.suggestion?.contactId).toBe(contact.id);

    // Log touchpoint today
    logTouchpoint({
      contactId: contact.id,
      method: 'message',
      note: 'Rekindled contact via serendipity suggestion!',
    });

    // Contact is no longer dormant
    const dormantAfter = getDormantContacts(180);
    expect(dormantAfter.some((d) => d.contactId === contact.id)).toBe(false);
  });
});
