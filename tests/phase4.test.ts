import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, setTestDb } from '@/db';
import {
  createContact,
  createGroup,
  listContactsWithDetails,
  mergeContacts,
  deleteContact,
} from '@/lib/contacts-service';
import { addTopic, createRelationship } from '@/lib/touchpoints-service';
import {
  importGoogleCandidatesAdditiveOnly,
  listGoogleSyncTombstones,
  deleteGoogleSyncTombstone,
  clearAllDeletedGoogleSyncTombstones,
} from '@/lib/google-sync';
import {
  buildContactReminderMessage,
  processTelegramCallbackData,
  formatWhatsAppLink,
} from '@/lib/telegram-service';
import {
  buildWebhookDigestPayload,
  signWebhookPayload,
} from '@/lib/webhook-service';

describe('Phase 4: Google Additive-Only Sync, Telegram Bot & Outgoing Webhook', () => {
  beforeEach(() => {
    const { db, sqlite } = createDatabase(':memory:');
    setTestDb(db, sqlite);
  });

  it('strictly imports ONLY new Google contacts without overwriting existing or deleting missing contacts', () => {
    // 1. Pre-existing Google contact that user edited locally in Touchpoint
    const existingGoogle = createContact({
      source: 'google',
      googleResourceName: 'people/c100',
      fullName: 'Dan Cohen (Edited in Touchpoint)',
      phone: '+972541111111',
      keepInTouch: true,
      notes: 'Important personal note that must never be overwritten',
    });

    // 2. Pre-existing Google contact that was deleted from Google Cloud later
    const removedFromGoogle = createContact({
      source: 'google',
      googleResourceName: 'people/c200',
      fullName: 'Old Friend Still In Touchpoint',
      keepInTouch: true,
    });

    // 3. Incoming batch from Google People API (c100 has different name/phone, c200 is gone, c300 is brand new)
    const syncSummary = importGoogleCandidatesAdditiveOnly([
      {
        resourceName: 'people/c100',
        fullName: 'Dan Cohen Google Raw Name',
        phone: '+972549999999',
      },
      {
        resourceName: 'people/c300',
        fullName: 'Brand New Contact',
        phone: '054-7654321',
        company: 'Wix',
        jobTitle: 'Tech Lead',
        birthday: '1992-05-14',
      },
    ]);

    expect(syncSummary.scanned).toBe(2);
    expect(syncSummary.imported).toBe(1);
    expect(syncSummary.skippedExisting).toBe(1);

    const all = listContactsWithDetails();
    expect(all.length).toBe(3);

    const checkC100 = all.find((c) => c.id === existingGoogle.id)!;
    expect(checkC100.fullName).toBe('Dan Cohen (Edited in Touchpoint)');
    expect(checkC100.phone).toBe('+972541111111');
    expect(checkC100.notes).toBe('Important personal note that must never be overwritten');

    const checkC200 = all.find((c) => c.id === removedFromGoogle.id);
    expect(checkC200).toBeDefined();

    const checkC300 = all.find((c) => c.googleResourceName === 'people/c300')!;
    expect(checkC300.fullName).toBe('Brand New Contact');
    expect(checkC300.company).toBe('Wix');
    expect(checkC300.keepInTouch).toBe(false);
  });

  it('never re-imports merged duplicates, deleted Google contacts (Option 1), or pre-sync timestamped contacts (Option 3)', () => {
    // Initial import of 3 Google contacts (c1 and c2 are duplicates, c3 will be deleted)
    const firstBatch = [
      {
        resourceName: 'people/c1',
        fullName: 'Alex Rivera',
        phone: '+1-555-010-1111',
        updatedAt: '2026-10-10T10:00:00Z',
      },
      {
        resourceName: 'people/c2',
        fullName: 'Alex Rivera',
        phone: '+1-555-010-1111',
        email: 'alex@example.com',
        updatedAt: '2026-10-10T10:05:00Z',
      },
      {
        resourceName: 'people/c3',
        fullName: 'Unwanted Contact',
        phone: '+1-555-010-2222',
        updatedAt: '2026-10-10T10:10:00Z',
      },
    ];

    const firstSync = importGoogleCandidatesAdditiveOnly(firstBatch);
    expect(firstSync.imported).toBe(3);

    const importedContacts = listContactsWithDetails();
    const c1 = importedContacts.find((c) => c.googleResourceName === 'people/c1')!;
    const c2 = importedContacts.find((c) => c.googleResourceName === 'people/c2')!;
    const c3 = importedContacts.find((c) => c.googleResourceName === 'people/c3')!;

    // User merges c2 into c1, and deletes c3
    mergeContacts(c1.id, c2.id);
    deleteContact(c3.id);
    expect(listContactsWithDetails().length).toBe(1);

    // User clicks Import again:
    // - c1 is existing
    // - c2 and c3 are tombstoned (Option 1) even if their updatedAt in Google changed
    // - c_legacy is an old contact with updatedAt <= lastGoogleSyncAt (Option 3)
    // - c_new is a genuinely new contact created after lastGoogleSyncAt
    const secondSync = importGoogleCandidatesAdditiveOnly(
      [
        {
          resourceName: 'people/c1',
          fullName: 'Alex Rivera',
          updatedAt: '2026-10-18T12:00:00Z',
        },
        {
          resourceName: 'people/c2',
          fullName: 'Alex Rivera',
          updatedAt: '2026-10-18T12:05:00Z',
        },
        {
          resourceName: 'people/c3',
          fullName: 'Unwanted Contact',
          updatedAt: '2026-10-18T12:10:00Z',
        },
        {
          resourceName: 'people/c_legacy',
          fullName: 'Previously Merged Before Upgrade',
          updatedAt: '2026-10-10T09:00:00Z',
        },
        {
          resourceName: 'people/c_new',
          fullName: 'New Contact Added Today',
          phone: '+1-555-010-9999',
          updatedAt: '2026-10-18T15:00:00Z',
        },
      ],
      { lastGoogleSyncAt: '2026-10-18T11:00:00Z' }
    );

    expect(secondSync.scanned).toBe(5);
    expect(secondSync.imported).toBe(1);
    expect(secondSync.skippedExisting).toBe(4);

    const finalContacts = listContactsWithDetails();
    expect(finalContacts.length).toBe(2);
    expect(finalContacts.map((c) => c.googleResourceName).sort()).toEqual([
      'people/c1',
      'people/c_new',
    ]);
  });

  it('builds rich Telegram reminders (with Work, Pets, Relationships, Topics & WhatsApp link) and handles two-step button callbacks', () => {
    const refDate = new Date('2026-10-16T12:00:00Z');
    const group = createGroup({ name: 'Workplace 1', intervalDays: 30 });

    const dan = createContact({
      fullName: 'Dan Cohen',
      phone: '054-1234567',
      email: 'dan@acme.io',
      company: 'Acme',
      jobTitle: 'Product Manager',
      pets: ['Barnaby (Golden Retriever)'],
      keepInTouch: true,
      lastContactedAt: '2026-09-01T10:00:00Z',
      groupIds: [group.id],
    });

    const sarah = createContact({ fullName: 'Sarah Cohen' });
    createRelationship({
      contactAId: dan.id,
      contactBId: sarah.id,
      type: 'spouse',
    });

    addTopic(dan.id, 'Ask about the kitchen renovation');

    expect(formatWhatsAppLink('054-1234567', '+972')).toBe('https://wa.me/972541234567');

    const reminder = buildContactReminderMessage(dan.id, '+972', refDate);
    expect(reminder.text).toContain('Dan Cohen');
    expect(reminder.text).not.toContain('Product Manager @ Acme');
    expect(reminder.text).not.toContain('Barnaby (Golden Retriever)');
    expect(reminder.text).not.toContain('Group:');
    expect(reminder.text).toContain('Spouse / Partner: Sarah Cohen');
    expect(reminder.text).toContain('Ask about the kitchen renovation');
    expect(reminder.text).toContain('https://wa.me/972541234567');

    // Unauthorized Telegram user click is rejected
    const unauthorizedAttempt = processTelegramCallbackData(
      `tp:pick_method:${dan.id}`,
      '999999',
      '12345678',
      refDate
    );
    expect(unauthorizedAttempt.authorized).toBe(false);

    // Step 1: Owner clicks "[✅ Mark Contacted]" -> flips to Method Selection buttons
    const step1 = processTelegramCallbackData(
      `tp:pick_method:${dan.id}`,
      '12345678',
      '12345678',
      refDate
    );
    expect(step1.authorized).toBe(true);
    expect(step1.action).toBe('show_methods');

    // Step 2: Owner clicks "[📞 Call]" -> logs Call touchpoint and resets timer
    const step2 = processTelegramCallbackData(
      `tp:log:${dan.id}:call`,
      '12345678',
      '12345678',
      refDate
    );
    expect(step2.authorized).toBe(true);
    expect(step2.action).toBe('logged');
    expect(step2.confirmationText).toContain('Logged Call with Dan Cohen');
    expect(step2.confirmationText).toContain('2026-11-15');
  });

  it('builds structured Outgoing Webhook JSON payloads and signs them with HMAC-SHA256', () => {
    const refDate = new Date('2026-10-16T12:00:00Z');
    const group = createGroup({ name: 'Family', intervalDays: 7 });

    const mom = createContact({
      fullName: 'Mom',
      phone: '052-9998887',
      keepInTouch: true,
      lastContactedAt: '2026-10-01T10:00:00Z',
      groupIds: [group.id],
    });
    addTopic(mom.id, 'Bring olive oil on Friday');

    const payload = buildWebhookDigestPayload(refDate, false);
    expect(payload.event).toBe('daily_digest');
    expect(payload.summary.overdueCount).toBe(1);
    expect(payload.contacts.length).toBe(1);
    expect(payload.contacts[0].fullName).toBe('Mom');
    expect(payload.contacts[0].whatsappUrl).toBe('https://wa.me/972529998887');
    expect(payload.contacts[0].pendingTopics).toEqual(['Bring olive oil on Friday']);
    expect(payload.text).toContain('Mom (overdue)');

    const sig = signWebhookPayload(JSON.stringify(payload), 'my-webhook-secret');
    expect(sig).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it('allows unblocking tombstoned Google contacts and re-importing them via fullRescan', () => {
    // 1. Initial import of Google contact
    const candidate = {
      resourceName: 'people/c999',
      fullName: 'Shirael Cohen',
      phone: '+972-50-1234567',
      updatedAt: '2026-10-10T10:00:00Z',
    };
    const firstSync = importGoogleCandidatesAdditiveOnly([candidate]);
    expect(firstSync.imported).toBe(1);

    const contact = listContactsWithDetails().find((c) => c.googleResourceName === 'people/c999')!;
    expect(contact.fullName).toBe('Shirael Cohen');

    // 2. User deletes the contact in Touchpoint
    deleteContact(contact.id);
    expect(listContactsWithDetails().length).toBe(0);

    // 3. Verify tombstone was created with contactName and reason = 'deleted'
    const tombstones = listGoogleSyncTombstones();
    expect(tombstones.length).toBe(1);
    expect(tombstones[0].googleResourceName).toBe('people/c999');
    expect(tombstones[0].contactName).toBe('Shirael Cohen');
    expect(tombstones[0].reason).toBe('deleted');

    // 4. While tombstoned, sync will never re-import it
    const blockedSync = importGoogleCandidatesAdditiveOnly([candidate], { fullRescan: true });
    expect(blockedSync.imported).toBe(0);
    expect(blockedSync.skippedExisting).toBe(1);

    // 5. User unblocks the tombstone in the Tombstone Manager
    const unblocked = deleteGoogleSyncTombstone(tombstones[0].id);
    expect(unblocked).toBe(true);
    expect(listGoogleSyncTombstones().length).toBe(0);

    // 6. User re-syncs with fullRescan: true -> contact is cleanly imported back!
    const resync = importGoogleCandidatesAdditiveOnly([candidate], {
      lastGoogleSyncAt: '2026-10-21T00:00:00Z',
      fullRescan: true,
    });
    expect(resync.imported).toBe(1);
    expect(listContactsWithDetails().length).toBe(1);
    expect(listContactsWithDetails()[0].fullName).toBe('Shirael Cohen');
  });
});
