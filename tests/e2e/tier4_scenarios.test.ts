import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, setTestDb, closeAllDbs, getDb } from '@/db';
import {
  calculateEffectiveIntervalDays,
  evaluateContactCadence,
  applySmartSpreading,
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
  listTouchpointsForContact,
  addTopic,
  createRelationship,
  buildRelationshipNetworkGraph,
} from '@/lib/touchpoints-service';
import {
  importGoogleCandidatesAdditiveOnly,
  listGoogleSyncTombstones,
  deleteGoogleSyncTombstone,
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
  importVCardContent,
  exportContactsToVCard,
  generateIcalFeed,
  verifyIcalToken,
  exportFullBackupJson,
  restoreFromBackupJson,
  wipeAllData,
} from '@/lib/portability-service';
import {
  registerOwnerAccount,
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
  checkRateLimit,
  recordFailedAttempt,
  clearAllRateLimits,
} from '@/lib/rate-limiter';
import { createDatabaseSnapshot, listDatabaseSnapshots } from '@/lib/backup-rotator';
import { settings, users } from '@/db/schema';
import { eq } from 'drizzle-orm';

describe('Tier 4: Real-World Multi-Step Lifecycle Scenarios', () => {
  beforeEach(() => {
    const { db, sqlite } = createDatabase(':memory:');
    setTestDb(db, sqlite);
    clearAllRateLimits();
  });

  afterEach(() => {
    closeAllDbs();
  });

  // =========================================================================
  // Scenario 1: New User Onboarding & Contact Import Lifecycle
  // =========================================================================
  it('Scenario 1: New User Onboarding, 2FA Setup, vCard Import & Cadence Configuration', async () => {
    // 1. Initial Setup: Owner signs up
    const { user, settings: userSettings } = registerOwnerAccount({
      email: 'owner@onboarding.test',
      username: 'onboarding_user',
      password: 'InitialPassword123!',
      timezone: 'Asia/Jerusalem',
      defaultCountryCode: '+972',
    });
    expect(user.id).toBe(1);
    expect(userSettings.ownerUserId).toBe(1);

    // 2. Security Setup: Enable TOTP 2FA & Generate Recovery Codes
    const { secret } = await generateTotpSecret(user.email);
    const validTotp = generateTotp(secret);
    expect(verifyTotp(secret, validTotp)).toBe(true);

    const { plaintextCodes, hashedCodes } = generateBackupCodes(8);
    const db = getDb();
    db.update(users)
      .set({
        totpSecret: secret,
        totpEnabled: true,
        totpBackupCodes: JSON.stringify(hashedCodes),
      })
      .where(eq(users.id, user.id))
      .run();

    // Verify 2FA is active
    const userRow = db.select().from(users).where(eq(users.id, user.id)).get();
    expect(userRow?.totpEnabled).toBeTruthy();

    // 3. Portability Import: User imports contact book via vCard (.vcf)
    const vcfData = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:Maya Lin',
      'TEL:+972-54-111-2222',
      'EMAIL:maya@studio.design',
      'ORG:Lin Design Studio',
      'TITLE:Principal Architect',
      'BDAY:1990-04-15',
      'END:VCARD',
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:Kenji Sato',
      'TEL:+81-90-1234-5678',
      'EMAIL:kenji@tokyo.tech',
      'ORG:Sato Robotics',
      'TITLE:Chief Scientist',
      'BDAY:1988-11-20',
      'END:VCARD',
    ].join('\r\n');

    const importRes = importVCardContent(vcfData);
    expect(importRes.imported).toBe(2);

    let allContacts = listContactsWithDetails();
    expect(allContacts.length).toBe(2);

    // 4. Circle Creation & Cadence Assignment
    const gFamily = createGroup({ name: 'Inner Circle', color: '#10b981', intervalDays: 7 });
    const gTech = createGroup({ name: 'Global Tech', color: '#3b82f6', intervalDays: 30 });

    const maya = allContacts.find((c) => c.fullName === 'Maya Lin')!;
    const kenji = allContacts.find((c) => c.fullName === 'Kenji Sato')!;

    // Assign to groups and enable keep_in_touch
    updateContact(maya.id, {
      groupIds: [gFamily.id],
      keepInTouch: true,
      pets: ['Sora (Akita)'],
    });

    updateContact(kenji.id, {
      groupIds: [gTech.id],
      keepInTouch: true,
      customIntervalDays: 45, // Custom override over 30d group interval
    });

    // 5. Dashboard State Verification
    const mayaEval = getContactById(maya.id);
    const kenjiEval = getContactById(kenji.id);

    expect(mayaEval?.cadence.effectiveIntervalDays).toBe(7);
    expect(mayaEval?.pets).toEqual(['Sora (Akita)']);
    expect(mayaEval?.cadence.status).toBe('on_track');

    expect(kenjiEval?.cadence.effectiveIntervalDays).toBe(45);
    expect(kenjiEval?.cadence.status).toBe('on_track');

    const initialHealth = calculateRelationshipHealthScore([
      mayaEval!.cadence,
      kenjiEval!.cadence,
    ]);
    expect(initialHealth.scorePercent).toBe(100);
    expect(initialHealth.totalTrackedCount).toBe(2);
    expect(initialHealth.overdueCount).toBe(0);
  });

  // =========================================================================
  // Scenario 2: Relationship Management Lifecycle & Cadence Drift
  // =========================================================================
  it('Scenario 2: Relationship Management Lifecycle, Cadence Drift, Telegram Reminder & Interaction Logging', () => {
    registerOwnerAccount({
      email: 'owner@touchpoint.local',
      username: 'owner',
      password: 'password123',
    });

    const gMentors = createGroup({ name: 'Mentors', intervalDays: 14 });
    const contact = createContact({
      fullName: 'Prof. Albus Dumbledore',
      phone: '+972-54-9876543',
      company: 'Hogwarts Academy',
      jobTitle: 'Headmaster',
      pets: ['Fawkes (Phoenix)'],
      keepInTouch: true,
      groupIds: [gMentors.id],
      lastContactedAt: '2026-09-01T10:00:00Z', // 50 days ago
    });

    // 1. Add conversation topics
    const t1 = addTopic(contact.id, 'Ask about the Elder Wand');
    const t2 = addTopic(contact.id, 'Inquire about defense curriculum');

    // 2. Evaluate drift on reference date: 2026-10-20 (overdue by 35 days)
    const refDate = new Date('2026-10-20T12:00:00Z');
    const evalBefore = getContactById(contact.id, refDate);
    expect(evalBefore?.cadence.status).toBe('overdue');
    expect(evalBefore?.cadence.daysUntilDue).toBeLessThan(0);

    // 3. Smart spreading surfaces the overdue contact
    const spread = applySmartSpreading([evalBefore!.cadence], 3);
    expect(spread.surfacedToday.length).toBe(1);
    expect(spread.surfacedToday[0].contactId).toBe(contact.id);

    // 4. Telegram Reminder formatting (minimal card omitting work/life and group data)
    const reminderMsg = buildContactReminderMessage(contact.id, '+972', refDate);
    expect(reminderMsg.text).toContain('Touchpoint Reminder: Prof. Albus Dumbledore');
    expect(reminderMsg.text).not.toContain('Hogwarts Academy');
    expect(reminderMsg.text).not.toContain('Fawkes (Phoenix)');
    expect(reminderMsg.text).not.toContain('Group:');
    expect(reminderMsg.text).toContain('Elder Wand');
    expect(reminderMsg.text).toContain('Overdue');

    // 5. User logs interaction via simulated Telegram two-step callback
    const callbackRes = processTelegramCallbackData(
      `tp:log:${contact.id}:call`,
      '98765',
      '98765',
      refDate
    );
    expect(callbackRes.authorized).toBe(true);
    expect(callbackRes.action).toBe('logged');

    // 6. Complete topic 1 via logTouchpoint
    logTouchpoint({
      contactId: contact.id,
      method: 'call',
      note: 'Long discussion over tea about curriculum and defense.',
      contactedAt: '2026-10-20T14:00:00Z',
      completedTopicIds: [t1.id],
    });

    // 7. Verify post-interaction state
    const evalAfter = getContactById(contact.id, refDate);
    expect(evalAfter?.cadence.status).toBe('on_track');
    expect(evalAfter?.cadence.daysSinceContact).toBe(0);

    const topic1 = evalAfter?.topics.find((t) => t.id === t1.id);
    const topic2 = evalAfter?.topics.find((t) => t.id === t2.id);
    expect(topic1?.isCompleted).toBe(true);
    expect(topic1?.completedAt).not.toBeNull();
    expect(topic2?.isCompleted).toBe(false);

    const history = listTouchpointsForContact(contact.id);
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0].note).toContain('Long discussion over tea');
  });

  // =========================================================================
  // Scenario 3: Conflict Resolution & Google Contacts Deduplication
  // =========================================================================
  it('Scenario 3: Additive Sync, Duplicate Detection, Safe Contact Merge & Tombstone Isolation', () => {
    // 1. Existing local contacts in directory
    const primary = createContact({
      source: 'google',
      googleResourceName: 'people/c_primary_john',
      fullName: 'Johnathan Miller',
      phone: '+1-555-010-9999',
      email: 'john@miller.com',
      company: 'Miller Holdings',
      jobTitle: 'Managing Partner',
      pets: ['Max (Labrador)'],
      notes: 'Key partner for US real estate ventures.',
      keepInTouch: true,
      lastContactedAt: '2026-10-01T00:00:00Z',
    });

    const friend = createContact({ fullName: 'Sarah Miller', keepInTouch: false });
    createRelationship({
      contactAId: primary.id,
      contactBId: friend.id,
      type: 'spouse',
    });

    // 2. Incoming Google batch with a duplicate contact (different name format & phone formatting)
    const duplicateCandidate = {
      resourceName: 'people/c_google_dupe_john',
      fullName: 'John Miller',
      phone: '555-010-9999', // Matches last 7 digits
      email: 'john@miller.com',
      company: 'Miller Holdings Inc',
      jobTitle: 'Partner',
    };

    const sync1 = importGoogleCandidatesAdditiveOnly([duplicateCandidate]);
    expect(sync1.imported).toBe(1);

    // 3. Automated Duplicate Detection
    const dupes = detectDuplicateContacts();
    expect(dupes.length).toBeGreaterThanOrEqual(1);

    const pair = dupes.find(
      (p) =>
        (p.contactA.id === primary.id && p.contactB.googleResourceName === 'people/c_google_dupe_john') ||
        (p.contactB.id === primary.id && p.contactA.googleResourceName === 'people/c_google_dupe_john')
    );
    expect(pair).toBeDefined();
    expect(pair?.reasons).toContain('Matching phone number');
    expect(pair?.reasons).toContain('Identical email');

    const dupeContactId =
      pair!.contactA.id === primary.id ? pair!.contactB.id : pair!.contactA.id;

    // 4. Merge duplicate into primary
    mergeContacts(primary.id, dupeContactId);

    // Verify secondary was deleted and primary preserved
    expect(getContactById(dupeContactId)).toBeNull();
    const merged = getContactById(primary.id);
    expect(merged).not.toBeNull();
    expect(merged?.fullName).toBe('Johnathan Miller');
    expect(merged?.notes).toBe('Key partner for US real estate ventures.');

    // 5. Tombstone Verification
    const tombstones = listGoogleSyncTombstones();
    const dupeTombstone = tombstones.find(
      (t) => t.googleResourceName === 'people/c_google_dupe_john'
    );
    expect(dupeTombstone).toBeDefined();
    expect(dupeTombstone?.reason).toBe('merged');

    // 6. Re-running Google Sync will strictly skip the merged duplicate
    const sync2 = importGoogleCandidatesAdditiveOnly([duplicateCandidate]);
    expect(sync2.imported).toBe(0);
    expect(sync2.skippedExisting).toBe(1);

    // 7. Unblocking tombstone with fullRescan enables future re-import if desired
    deleteGoogleSyncTombstone(dupeTombstone!.id);
    const sync3 = importGoogleCandidatesAdditiveOnly([duplicateCandidate], { fullRescan: true });
    expect(sync3.imported).toBe(1);
  });

  // =========================================================================
  // Scenario 4: Global Vacation Mode, Cadence Freezing & Network Resumption
  // =========================================================================
  it('Scenario 4: Global Vacation Mode, Notification Muting & Seamless Cadence Resumption', () => {
    registerOwnerAccount({
      email: 'vacation_admin@touchpoint.local',
      username: 'vacation_admin',
      password: 'password123',
    });

    const refDate = new Date('2026-10-20T12:00:00Z');

    // 1. Network with mixed statuses
    const cOverdue = createContact({
      fullName: 'Overdue Client',
      keepInTouch: true,
      lastContactedAt: '2026-08-01T00:00:00Z',
    });
    const cDueToday = createContact({
      fullName: 'Due Today Friend',
      keepInTouch: true,
      lastContactedAt: '2026-09-20T12:00:00Z',
    });
    const cOnTrack = createContact({
      fullName: 'On Track Colleague',
      keepInTouch: true,
      lastContactedAt: '2026-10-18T00:00:00Z',
    });

    // Initial Health Score
    let allCadences = listContactsWithDetails(refDate).map((c) => c.cadence);
    let health = calculateRelationshipHealthScore(allCadences);
    expect(health.overdueCount).toBe(1);
    expect(health.scorePercent).toBeLessThan(100);

    // Initial Webhook Digest dispatches overdue and due today contacts
    const initialDigest = buildWebhookDigestPayload(refDate, false);
    expect(initialDigest.contacts.length).toBeGreaterThanOrEqual(1);

    // 2. User activates Global Vacation Pause until 2026-11-05
    const db = getDb();
    db.update(settings).set({ globalPausedUntil: '2026-11-05T00:00:00Z' }).run();

    // 3. During vacation (2026-10-25), all contacts are paused and notifications are muted
    const vacationDate = new Date('2026-10-25T12:00:00Z');
    const vacationCadences = listContactsWithDetails(vacationDate).map((c) => c.cadence);
    expect(vacationCadences.every((c) => c.status === 'paused')).toBe(true);

    const vacationDigest = buildWebhookDigestPayload(vacationDate, false);
    expect(vacationDigest.contacts.length).toBe(0);
    expect(vacationDigest.text).toContain('All tracked contacts are on track today.');

    const vacationHealth = calculateRelationshipHealthScore(vacationCadences);
    expect(vacationHealth.scorePercent).toBe(100);
    expect(vacationHealth.totalTrackedCount).toBe(0);

    // 4. Vacation ends (2026-11-06)
    const postVacationDate = new Date('2026-11-06T12:00:00Z');
    const postCadences = listContactsWithDetails(postVacationDate).map((c) => c.cadence);

    // Cadences unfreeze and resume evaluation
    expect(postCadences.some((c) => c.status === 'overdue')).toBe(true);
    expect(postCadences.every((c) => c.status === 'paused')).toBe(false);

    const postDigest = buildWebhookDigestPayload(postVacationDate, false);
    expect(postDigest.contacts.length).toBeGreaterThanOrEqual(1);
    expect(postDigest.summary.overdueCount).toBeGreaterThan(0);
  });

  // =========================================================================
  // Scenario 5: Security Hardening, Brute-Force Lockout & Full Disaster Recovery
  // =========================================================================
  it('Scenario 5: Security Hardening, Brute-Force Lockout, Backup Snapshots & Atomic Disaster Recovery', async () => {
    // 1. Owner account registration & TOTP setup
    const { user } = registerOwnerAccount({
      email: 'admin@recovery.local',
      username: 'recovery_admin',
      password: 'SuperAdminPassword#2026',
    });

    const { secret } = await generateTotpSecret(user.email);
    const { plaintextCodes, hashedCodes } = generateBackupCodes(8);
    const db = getDb();
    db.update(users)
      .set({
        totpSecret: secret,
        totpEnabled: true,
        totpBackupCodes: JSON.stringify(hashedCodes),
      })
      .where(eq(users.id, user.id))
      .run();

    // 2. Attacker attempts brute-force login from malicious IP
    const attackerIp = '185.220.101.5';
    const action = 'login';
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(attackerIp, action, 5).allowed).toBe(true);
      recordFailedAttempt(attackerIp, action);
    }
    // 6th attempt is blocked
    const blockedResult = checkRateLimit(attackerIp, action, 5);
    expect(blockedResult.allowed).toBe(false);
    expect(blockedResult.remaining).toBe(0);
    expect(blockedResult.retryAfterSeconds).toBeGreaterThan(0);

    // 3. Legitimate user authenticates and consumes one emergency recovery backup code
    const recoveryCode = plaintextCodes[0];
    const userRow = db.select().from(users).where(eq(users.id, user.id)).get();
    const consumeRes = verifyAndConsumeBackupCode(recoveryCode, userRow?.totpBackupCodes);
    expect(consumeRes.valid).toBe(true);

    db.update(users)
      .set({ totpBackupCodes: consumeRes.remainingHashedCodesJson })
      .where(eq(users.id, user.id))
      .run();

    const remainingCodes = JSON.parse(consumeRes.remainingHashedCodesJson);
    expect(remainingCodes.length).toBe(7);

    // 4. Populate critical data
    const grp1 = createGroup({ name: 'Core Allies', intervalDays: 14 });
    const c1 = createContact({
      fullName: 'Prime Minister',
      keepInTouch: true,
      groupIds: [grp1.id],
      notes: 'State level correspondence',
    });
    const c2 = createContact({
      fullName: 'Foreign Minister',
      keepInTouch: true,
      groupIds: [grp1.id],
    });
    createRelationship({ contactAId: c1.id, contactBId: c2.id, type: 'coworker' });
    addTopic(c1.id, 'Bilateral trade agreement');
    logTouchpoint({ contactId: c1.id, method: 'in_person', note: 'Diplomatic summit' });

    // 5. Create point-in-time snapshot and export full JSON backup
    const snapshot = createDatabaseSnapshot('manual', 1);
    expect(snapshot.sizeBytes).toBeGreaterThan(0);

    const fullBackup = exportFullBackupJson();
    expect(fullBackup.contacts.length).toBe(2);
    expect(fullBackup.groups.length).toBe(1);
    expect(fullBackup.relationships.length).toBe(1);
    expect(fullBackup.touchpoints.length).toBe(1);

    // 6. Disaster Strikes: Danger Zone factory reset
    const wipe = wipeAllData();
    expect(wipe.deleted).toBe(true);
    expect(listContactsWithDetails().length).toBe(0);

    // 7. Atomic Restore from Backup JSON
    const restoreRes = restoreFromBackupJson(fullBackup);
    expect(restoreRes.restoredContacts).toBe(2);

    // 8. 100% Data Fidelity Verification
    const restoredContacts = listContactsWithDetails();
    expect(restoredContacts.length).toBe(2);

    const restoredC1 = restoredContacts.find((c) => c.fullName === 'Prime Minister')!;
    expect(restoredC1.notes).toBe('State level correspondence');
    expect(restoredC1.topics.length).toBe(1);
    expect(restoredC1.topics[0].content).toBe('Bilateral trade agreement');
    expect(restoredC1.lastTouchpoint?.note).toBe('Diplomatic summit');

    const graph = buildRelationshipNetworkGraph();
    expect(graph.nodes.length).toBe(2);
    expect(graph.edges.length).toBe(1);
    expect(graph.edges[0].type).toBe('coworker');
  });
});
