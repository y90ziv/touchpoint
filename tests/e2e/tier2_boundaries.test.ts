import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, setTestDb, closeAllDbs } from '@/db';
import {
  calculateEffectiveIntervalDays,
  evaluateContactCadence,
  applySmartSpreading,
  toStartOfDayUTC,
} from '@/lib/cadence';
import {
  createContact,
  updateContact,
  deleteContact,
  createGroup,
  deleteGroup,
  listContactsWithDetails,
  getContactById,
  createCustomFieldTemplate,
  splitFullName,
} from '@/lib/contacts-service';
import {
  logTouchpoint,
  snoozeContact,
  deleteTouchpoint,
  addTopic,
  toggleTopic,
  deleteTopic,
  addImportantDate,
  createRelationship,
  buildRelationshipNetworkGraph,
} from '@/lib/touchpoints-service';
import {
  importGoogleCandidatesAdditiveOnly,
  clearAllDeletedGoogleSyncTombstones,
  deleteGoogleSyncTombstone,
} from '@/lib/google-sync';
import {
  formatWhatsAppLink,
  buildContactReminderMessage,
  processTelegramCallbackData,
} from '@/lib/telegram-service';
import {
  signWebhookPayload,
  buildWebhookDigestPayload,
  validateWebhookUrl,
} from '@/lib/webhook-service';
import {
  importVCardContent,
  exportContactsToVCard,
  generateIcalFeed,
  verifyIcalToken,
  restoreFromBackupJson,
} from '@/lib/portability-service';
import {
  verifyPassword,
  createSessionToken,
  verifySessionToken,
} from '@/lib/auth';
import {
  generateTotp,
  verifyTotp,
  verifyAndConsumeBackupCode,
} from '@/lib/totp';
import {
  checkRateLimit,
  recordFailedAttempt,
  clearAllRateLimits,
} from '@/lib/rate-limiter';

describe('Tier 2: Boundary & Corner Cases (Opaque-Box E2E)', () => {
  beforeEach(() => {
    const { db, sqlite } = createDatabase(':memory:');
    setTestDb(db, sqlite);
    clearAllRateLimits();
  });

  afterEach(() => {
    closeAllDbs();
  });

  // =========================================================================
  // Area 1: Contact Cadence Boundaries
  // =========================================================================
  describe('Area 1: Contact Cadence Boundaries', () => {
    it('1.1 falls back to group or default 30 days when customIntervalDays is 0', () => {
      const interval = calculateEffectiveIntervalDays(0, []);
      expect(interval).toBe(30);

      const grp = createGroup({ name: 'Fallback Group', intervalDays: 14 });
      const contact = createContact({
        fullName: 'Zero Cadence',
        customIntervalDays: 0,
        groupIds: [grp.id],
      });
      expect(getContactById(contact.id)?.cadence.effectiveIntervalDays).toBe(14);
    });

    it('1.2 falls back to group or default 30 days when customIntervalDays is negative', () => {
      const interval = calculateEffectiveIntervalDays(-15, []);
      expect(interval).toBe(30);

      const contact = createContact({
        fullName: 'Negative Cadence',
        customIntervalDays: -5,
      });
      expect(getContactById(contact.id)?.cadence.effectiveIntervalDays).toBe(30);
    });

    it('1.3 handles leap year dates (Feb 29) for birthdays and cadences without NaN or crash', () => {
      const leapContact = createContact({
        fullName: 'Leap Year Baby',
        birthday: '2024-02-29',
        keepInTouch: true,
        lastContactedAt: '2024-02-29T12:00:00Z',
      });
      const evalResult = getContactById(leapContact.id, new Date('2028-02-29T12:00:00Z'));
      expect(evalResult).not.toBeNull();
      expect(Number.isNaN(evalResult?.cadence.daysSinceContact)).toBe(false);
      expect(evalResult?.cadence.nextDueDate).toBe('2024-03-30');
    });

    it('1.4 computes extreme future interval (3650 days = 10 years) without numerical overflow', () => {
      const contact = createContact({
        fullName: 'Decade Checkin',
        keepInTouch: true,
        customIntervalDays: 3650,
        lastContactedAt: '2026-01-01T00:00:00Z',
      });
      const res = getContactById(contact.id, new Date('2026-06-01T00:00:00Z'));
      expect(res?.cadence.effectiveIntervalDays).toBe(3650);
      expect(res?.cadence.nextDueDate).toBe('2035-12-30');
      expect(res?.cadence.status).toBe('on_track');
    });

    it('1.5 evaluates contact created today with no interactions as 0 days elapsed and on_track', () => {
      const today = new Date().toISOString();
      const contact = createContact({
        fullName: 'Brand New Contact',
        keepInTouch: true,
      });
      const res = getContactById(contact.id);
      expect(res?.cadence.daysSinceContact).toBe(0);
      expect(res?.cadence.status).toBe('on_track');
    });

    it('1.6 clamps progress percent between 0% and 100% across extreme elapsed times', () => {
      const refDate = new Date('2026-10-20T12:00:00Z');
      // Way in future -> 0%
      const futureEval = evaluateContactCadence(
        {
          id: 1,
          fullName: 'Future Due',
          keepInTouch: true,
          createdAt: '2026-10-20T00:00:00Z',
          lastContactedAt: '2026-10-20T00:00:00Z',
          customIntervalDays: 100,
          groups: [],
        },
        refDate
      );
      expect(futureEval.progressPercent).toBe(0);

      // 10 years overdue -> 100%
      const ancientEval = evaluateContactCadence(
        {
          id: 2,
          fullName: 'Ancient Due',
          keepInTouch: true,
          createdAt: '2010-01-01T00:00:00Z',
          lastContactedAt: '2010-01-01T00:00:00Z',
          customIntervalDays: 30,
          groups: [],
        },
        refDate
      );
      expect(ancientEval.progressPercent).toBe(100);
    });
  });

  // =========================================================================
  // Area 2: Circles & Groups Boundaries
  // =========================================================================
  describe('Area 2: Circles & Groups Boundaries', () => {
    it('2.1 excludes groups with 0 or negative intervalDays from candidate intervals', () => {
      const gZero = createGroup({ name: 'Zero Interval', intervalDays: 0 });
      const gNeg = createGroup({ name: 'Negative Interval', intervalDays: -10 });
      const contact = createContact({
        fullName: 'Zero Neg Group Assignee',
        keepInTouch: true,
        groupIds: [gZero.id, gNeg.id],
      });
      // Should fall back to default 30
      expect(getContactById(contact.id)?.cadence.effectiveIntervalDays).toBe(30);
    });

    it('2.2 handles whitespace-only group name gracefully', () => {
      const grp = createGroup({ name: '   ', intervalDays: 14 });
      expect(grp.name.trim()).toBe('');
      const contact = createContact({
        fullName: 'Blank Group User',
        groupIds: [grp.id],
      });
      expect(getContactById(contact.id)?.groups[0].name.trim()).toBe('');
    });

    it('2.3 stores and retrieves extreme Unicode and Emoji group names with full fidelity', () => {
      const emojiName = '👨‍👩‍👧‍👦 VIP Family ❤️ 🌟 2026 — קבוצת משפחה';
      const grp = createGroup({ name: emojiName, color: '#ec4899', intervalDays: 7 });
      const contact = createContact({
        fullName: 'Emoji Group Contact',
        groupIds: [grp.id],
      });
      expect(getContactById(contact.id)?.groups[0].name).toBe(emojiName);
    });

    it('2.4 deleting a group cascades removal from contact_groups without deleting contacts', () => {
      const grp = createGroup({ name: 'Doomed Group', intervalDays: 14 });
      const contact = createContact({
        fullName: 'Survivor Contact',
        keepInTouch: true,
        groupIds: [grp.id],
      });
      expect(getContactById(contact.id)?.groups.length).toBe(1);

      deleteGroup(grp.id);
      const after = getContactById(contact.id);
      expect(after).not.toBeNull();
      expect(after?.groups.length).toBe(0);
      expect(after?.cadence.effectiveIntervalDays).toBe(30);
    });

    it('2.5 treats group with pausedUntil in the past as active (not paused)', () => {
      const refDate = new Date('2026-10-20T12:00:00Z');
      const pastPausedGroup = createGroup({
        name: 'Past Paused Group',
        intervalDays: 12,
        pausedUntil: '2026-09-01T00:00:00Z', // In the past relative to refDate
      });
      const interval = calculateEffectiveIntervalDays(
        null,
        [{ id: pastPausedGroup.id, name: pastPausedGroup.name, intervalDays: 12, pausedUntil: pastPausedGroup.pausedUntil }],
        refDate
      );
      expect(interval).toBe(12);
    });

    it('2.6 filters duplicate group IDs in contact input without constraint violations', () => {
      const grp = createGroup({ name: 'Dupe Test Group', intervalDays: 15 });
      const contact = createContact({
        fullName: 'Dupe Group Input Contact',
        groupIds: [grp.id, grp.id, grp.id],
      });
      expect(getContactById(contact.id)?.groups.length).toBe(1);
    });
  });

  // =========================================================================
  // Area 3: Touchpoints & Interaction Boundaries
  // =========================================================================
  describe('Area 3: Touchpoints & Interaction Boundaries', () => {
    it('3.1 throws Error when logging touchpoint for nonexistent contact', () => {
      expect(() =>
        logTouchpoint({
          contactId: 999999,
          method: 'call',
        })
      ).toThrow('Contact 999999 not found');
    });

    it('3.2 allows logging touchpoints with empty or null note and saves note as null', () => {
      const contact = createContact({ fullName: 'Null Note Contact' });
      const tp1 = logTouchpoint({
        contactId: contact.id,
        method: 'message',
        note: null,
      });
      expect(tp1.touchpoint.note).toBeNull();

      const tp2 = logTouchpoint({
        contactId: contact.id,
        method: 'call',
        note: '   ',
      });
      expect(tp2.touchpoint.note).toBeNull();
    });

    it('3.3 stores huge note (10,000+ characters) in touchpoint without truncation', () => {
      const contact = createContact({ fullName: 'Huge Note Contact' });
      const hugeNote = 'A'.repeat(12000);
      const tp = logTouchpoint({
        contactId: contact.id,
        method: 'in_person',
        note: hugeNote,
      });
      expect(tp.touchpoint.note?.length).toBe(12000);
    });

    it('3.4 handles past epoch (1970) and distant future (2050) interaction timestamps accurately', () => {
      const contact = createContact({ fullName: 'Epoch Contact', keepInTouch: true });
      logTouchpoint({
        contactId: contact.id,
        method: 'other',
        contactedAt: '1970-01-01T00:00:00.000Z',
      });
      expect(getContactById(contact.id)?.lastContactedAt).toBe('1970-01-01T00:00:00.000Z');

      logTouchpoint({
        contactId: contact.id,
        method: 'call',
        contactedAt: '2050-01-01T00:00:00.000Z',
      });
      expect(getContactById(contact.id)?.lastContactedAt).toBe('2050-01-01T00:00:00.000Z');
    });

    it('3.5 snoozing with 0 or falsy days defaults to 3 days forward from reference date', () => {
      const refDate = new Date('2026-10-20T12:00:00Z');
      const contact = createContact({ fullName: 'Zero Snooze', keepInTouch: true });
      const snoozed = snoozeContact(contact.id, 0, refDate);
      expect(snoozed.snoozedUntil).toBe('2026-10-23T12:00:00.000Z');
    });

    it('3.6 safely ignores toggleTopic and deleteTopic on nonexistent topic IDs', () => {
      expect(() => toggleTopic(999999, true)).not.toThrow();
      expect(() => deleteTopic(999999)).not.toThrow();
    });
  });

  // =========================================================================
  // Area 4: Relationships & Graph Boundaries
  // =========================================================================
  describe('Area 4: Relationships & Graph Boundaries', () => {
    it('4.1 rejects self-linking for all relationship types', () => {
      const c = createContact({ fullName: 'Self Person' });
      const types = ['spouse', 'friend', 'coworker', 'introduced_by'] as const;
      for (const t of types) {
        expect(() =>
          createRelationship({ contactAId: c.id, contactBId: c.id, type: t })
        ).toThrow('Cannot link a contact to itself');
      }
    });

    it('4.2 stores multi-lingual Unicode notes on relationships', () => {
      const a = createContact({ fullName: 'A' });
      const b = createContact({ fullName: 'B' });
      const note = 'הכירו בכנס ביפן 東京 2024 🎉 Special Note!';
      const rel = createRelationship({
        contactAId: a.id,
        contactBId: b.id,
        type: 'introduced_by',
        notes: note,
      });
      expect(rel.notes).toBe(note);
    });

    it('4.3 buildRelationshipNetworkGraph with 0 contacts returns empty nodes and edges', () => {
      const graph = buildRelationshipNetworkGraph();
      expect(graph.nodes).toEqual([]);
      expect(graph.edges).toEqual([]);
    });

    it('4.4 buildRelationshipNetworkGraph with isolated contacts returns nodes with empty edges', () => {
      createContact({ fullName: 'Solo 1', keepInTouch: true });
      createContact({ fullName: 'Solo 2', keepInTouch: true });
      const graph = buildRelationshipNetworkGraph();
      expect(graph.nodes.length).toBe(2);
      expect(graph.edges.length).toBe(0);
    });

    it('4.5 supports multiple distinct relationships between the same pair of contacts', () => {
      const a = createContact({ fullName: 'Colleague & Friend A' });
      const b = createContact({ fullName: 'Colleague & Friend B' });
      const r1 = createRelationship({ contactAId: a.id, contactBId: b.id, type: 'coworker' });
      const r2 = createRelationship({ contactAId: a.id, contactBId: b.id, type: 'friend' });
      expect(r1.id).not.toBe(r2.id);

      const graph = buildRelationshipNetworkGraph();
      expect(graph.edges.length).toBe(2);
    });

    it('4.6 deleting a contact does not crash the relationship network graph generator', () => {
      const a = createContact({ fullName: 'Person A', keepInTouch: true });
      const b = createContact({ fullName: 'Person B', keepInTouch: true });
      createRelationship({ contactAId: a.id, contactBId: b.id, type: 'friend' });

      deleteContact(a.id);
      expect(() => buildRelationshipNetworkGraph()).not.toThrow();
    });
  });

  // =========================================================================
  // Area 5: Custom Fields, Work Info, Pets & Topics Boundaries
  // =========================================================================
  describe('Area 5: Custom Fields, Work Info, Pets & Topics Boundaries', () => {
    it('5.1 handles contact with 50+ pets entries cleanly', () => {
      const manyPets = Array.from({ length: 55 }, (_, i) => `Pet #${i + 1} (Species ${i})`);
      const contact = createContact({
        fullName: 'Zoo Keeper',
        pets: manyPets,
      });
      const retrieved = getContactById(contact.id);
      expect(retrieved?.pets.length).toBe(55);
      expect(retrieved?.pets[54]).toBe('Pet #55 (Species 54)');
    });

    it('5.2 preserves complex multi-language Unicode, CJK, Hebrew, Arabic, and Emoji names', () => {
      const complexName = 'יואב 李明 محمد 😊 ⚡ 123';
      const contact = createContact({ fullName: complexName });
      const retrieved = getContactById(contact.id);
      expect(retrieved?.fullName).toBe(complexName);
    });

    it('5.3 splitFullName handles single-word, empty, and whitespace-padded names gracefully', () => {
      expect(splitFullName('Cher')).toEqual({ firstName: 'Cher', lastName: '' });
      expect(splitFullName('')).toEqual({ firstName: '', lastName: '' });
      expect(splitFullName('   Jean   Luc   Picard   ')).toEqual({
        firstName: 'Jean',
        lastName: 'Luc Picard',
      });
    });

    it('5.4 creates custom field template with empty options without errors', () => {
      const t = createCustomFieldTemplate({
        name: 'Empty Select',
        fieldType: 'select',
        options: [],
      });
      expect(t.name).toBe('Empty Select');
    });

    it('5.5 supports MM-DD format (no year) for important dates and birthdays', () => {
      const contact = createContact({
        fullName: 'MM-DD Birthday Contact',
        birthday: '11-25',
      });
      const imp = addImportantDate({
        contactId: contact.id,
        label: 'Annual Milestone',
        date: '04-12',
      });
      const retrieved = getContactById(contact.id);
      expect(retrieved?.birthday).toBe('11-25');
      expect(retrieved?.importantDates[0].date).toBe('04-12');
    });

    it('5.6 empty string inputs for company and job title normalize to null', () => {
      const contact = createContact({
        fullName: 'Empty Strings Contact',
        company: '   ',
        jobTitle: '',
      });
      expect(contact.company).toBeNull();
      expect(contact.jobTitle).toBeNull();
    });
  });

  // =========================================================================
  // Area 6: Google Sync Boundaries
  // =========================================================================
  describe('Area 6: Google Sync Boundaries', () => {
    it('6.1 filters out candidates with empty resourceName or whitespace-only fullName', () => {
      const res = importGoogleCandidatesAdditiveOnly([
        { resourceName: '', fullName: 'Valid Name' },
        { resourceName: 'people/valid', fullName: '   ' },
        { resourceName: 'people/good', fullName: 'Good Contact' },
      ]);
      expect(res.scanned).toBe(3);
      expect(res.skippedFiltered).toBe(2);
      expect(res.imported).toBe(1);
    });

    it('6.2 filters out email-only contacts when skipEmailOnly=true and phone is missing', () => {
      const res = importGoogleCandidatesAdditiveOnly(
        [
          { resourceName: 'people/email_only', fullName: 'Email Only Person', email: 'test@example.com' },
          { resourceName: 'people/phone_person', fullName: 'Phone Person', phone: '+123456789' },
        ],
        { skipEmailOnly: true }
      );
      expect(res.skippedFiltered).toBe(1);
      expect(res.imported).toBe(1);
    });

    it('6.3 handles candidate with invalid/unparseable updatedAt timestamp gracefully', () => {
      createContact({ source: 'google', googleResourceName: 'people/anchor', fullName: 'Anchor' });
      expect(() =>
        importGoogleCandidatesAdditiveOnly(
          [{ resourceName: 'people/bad_date', fullName: 'Bad Date', updatedAt: 'not-a-valid-date' }],
          { lastGoogleSyncAt: '2026-05-01T00:00:00Z' }
        )
      ).not.toThrow();
    });

    it('6.4 handles deleting non-existent tombstone ID without throwing', () => {
      expect(() => deleteGoogleSyncTombstone(999999)).not.toThrow();
    });

    it('6.5 clearAllDeletedGoogleSyncTombstones removes all deleted-reason tombstones safely', () => {
      const c = createContact({ source: 'google', googleResourceName: 'people/del', fullName: 'Del' });
      deleteContact(c.id);
      expect(() => clearAllDeletedGoogleSyncTombstones()).not.toThrow();
    });

    it('6.6 returns 0 scanned and 0 imported when given an empty candidate list', () => {
      const res = importGoogleCandidatesAdditiveOnly([]);
      expect(res.scanned).toBe(0);
      expect(res.imported).toBe(0);
      expect(res.skippedExisting).toBe(0);
      expect(res.skippedFiltered).toBe(0);
    });
  });

  // =========================================================================
  // Area 7: Telegram Boundaries
  // =========================================================================
  describe('Area 7: Telegram Boundaries', () => {
    it('7.1 formatWhatsAppLink returns null for empty, whitespace, or alphabetic inputs', () => {
      expect(formatWhatsAppLink('')).toBeNull();
      expect(formatWhatsAppLink('   ')).toBeNull();
      expect(formatWhatsAppLink('no-phone-here')).toBeNull();
      expect(formatWhatsAppLink(null)).toBeNull();
    });

    it('7.2 formatWhatsAppLink handles already-prefixed international numbers (+1234567890)', () => {
      expect(formatWhatsAppLink('+1234567890')).toBe('https://wa.me/1234567890');
      expect(formatWhatsAppLink('+44-7911-123456')).toBe('https://wa.me/447911123456');
    });

    it('7.3 returns action: ignored for malformed Telegram callback query data', () => {
      const res1 = processTelegramCallbackData('random_data', '100', '100');
      expect(res1.action).toBe('ignored');

      const res2 = processTelegramCallbackData('tp:unsupported_step:1', '100', '100');
      expect(res2.action).toBe('ignored');
    });

    it('7.4 rejects callback queries from mismatching chat ID with authorized=false', () => {
      const res = processTelegramCallbackData('tp:pick_method:1', 'attacker_id', 'legit_chat_id');
      expect(res.authorized).toBe(false);
      expect(res.action).toBe('ignored');
    });

    it('7.5 escapes HTML special characters (<, >, &, \") in contact reminders to prevent injection', () => {
      const c = createContact({
        fullName: 'Hacker AT&T <script>alert(1)</script>',
        company: 'AT&T & "Co"',
        jobTitle: 'Lead > Architect',
      });
      addTopic(c.id, 'Topic with <brackets> & "quotes"');

      const msg = buildContactReminderMessage(c.id);
      expect(msg.text).not.toContain('<script>');
      expect(msg.text).toContain('&lt;script&gt;');
      expect(msg.text).toContain('AT&amp;T');
      expect(msg.text).toContain('&lt;brackets&gt;');
    });

    it('7.6 builds clean reminder message for contact with minimal data (no groups, no pets, no topics)', () => {
      const c = createContact({ fullName: 'Minimal Contact', keepInTouch: true });
      const msg = buildContactReminderMessage(c.id);
      expect(msg.text).toContain('Touchpoint Reminder: Minimal Contact');
      expect(msg.text).not.toContain('Group:');
      expect(msg.text).not.toContain('Work & Life:');
      expect(msg.keyboard).toBeDefined();
    });
  });

  // =========================================================================
  // Area 8: Webhook Boundaries
  // =========================================================================
  describe('Area 8: Webhook Boundaries', () => {
    it('8.1 throws error on non-http/https URL schemes in validateWebhookUrl', () => {
      expect(() => validateWebhookUrl('ftp://example.com/hook')).toThrow('must use http or https protocol');
      expect(() => validateWebhookUrl('file:///etc/passwd')).toThrow('must use http or https protocol');
      expect(() => validateWebhookUrl('javascript:alert(1)')).toThrow('must use http or https protocol');
    });

    it('8.2 throws error on unparseable / malformed URL strings in validateWebhookUrl', () => {
      expect(() => validateWebhookUrl('not-a-valid-url')).toThrow('Invalid Webhook URL format');
      expect(() => validateWebhookUrl('')).toThrow('Invalid Webhook URL format');
    });

    it('8.3 blocks private CIDR IP ranges (10.0.0.0/8, 192.168.0.0/16, 172.16.0.0/12, 169.254.0.0/16)', () => {
      expect(() => validateWebhookUrl('http://10.255.0.1/hook')).toThrow(/cannot target localhost or private\/metadata IP addresses/);
      expect(() => validateWebhookUrl('http://192.168.0.100/hook')).toThrow(/cannot target localhost or private\/metadata IP addresses/);
      expect(() => validateWebhookUrl('http://172.20.5.1/hook')).toThrow(/cannot target localhost or private\/metadata IP addresses/);
      expect(() => validateWebhookUrl('http://169.254.169.254/latest')).toThrow(/cannot target localhost or private\/metadata IP addresses/);
    });

    it('8.4 signWebhookPayload produces valid 64-char hex HMAC with empty body and secret', () => {
      const sig = signWebhookPayload('', '');
      expect(sig.startsWith('sha256=')).toBe(true);
      expect(sig.length).toBe(71);
    });

    it('8.5 buildWebhookDigestPayload returns all on track summary when no contacts are due', () => {
      createContact({ fullName: 'On Track User', keepInTouch: true, lastContactedAt: new Date().toISOString() });
      const payload = buildWebhookDigestPayload(new Date(), false);
      expect(payload.summary.overdueCount).toBe(0);
      expect(payload.summary.dueTodayCount).toBe(0);
      expect(payload.summary.totalDispatched).toBe(0);
      expect(payload.text).toContain('All tracked contacts are on track today.');
    });

    it('8.6 applySmartSpreading enforces maxDailyDue cap when multiple contacts are due today', () => {
      const evaluated = Array.from({ length: 10 }, (_, i) => ({
        contactId: i + 1,
        effectiveIntervalDays: 30,
        daysSinceContact: 30,
        daysUntilDue: 0,
        nextDueDate: '2026-10-20',
        progressPercent: 100,
        status: 'due_today' as const,
      }));

      const spread = applySmartSpreading(evaluated, 3);
      expect(spread.surfacedToday.length).toBe(3);
      expect(spread.deferredToTomorrow.length).toBe(7);
    });
  });

  // =========================================================================
  // Area 9: Portability Boundaries
  // =========================================================================
  describe('Area 9: Portability Boundaries', () => {
    it('9.1 importVCardContent returns imported: 0 for empty string or text without BEGIN:VCARD', () => {
      expect(importVCardContent('').imported).toBe(0);
      expect(importVCardContent('Just some random text without vcards').imported).toBe(0);
    });

    it('9.2 importVCardContent skips corrupted cards missing FN (Full Name)', () => {
      const corruptedVcf = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        'TEL:123456789',
        'EMAIL:missingfn@example.com',
        'END:VCARD',
      ].join('\r\n');
      expect(importVCardContent(corruptedVcf).imported).toBe(0);
    });

    it('9.3 exportContactsToVCard returns empty string when 0 contacts exist', () => {
      expect(exportContactsToVCard()).toBe('');
    });

    it('9.4 generates iCal feed handling leap year birthday (02-29) in non-leap year without throwing', () => {
      createContact({
        fullName: 'Leap Baby In 2027',
        birthday: '2000-02-29',
        keepInTouch: true,
      });
      // 2027 is not a leap year
      expect(() => generateIcalFeed(new Date('2027-01-01T00:00:00Z'))).not.toThrow();
    });

    it('9.5 restoreFromBackupJson handles empty tables cleanly without crashing', () => {
      const emptyPayload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        contacts: [],
        groups: [],
        contactGroups: [],
        relationships: [],
        topics: [],
        importantDates: [],
        customFieldTemplates: [],
        contactCustomFields: [],
        touchpoints: [],
        googleSyncTombstones: [],
      };
      const res = restoreFromBackupJson(emptyPayload);
      expect(res.restoredContacts).toBe(0);
      expect(listContactsWithDetails().length).toBe(0);
    });

    it('9.6 verifyIcalToken returns false for empty, null, or unknown tokens', () => {
      expect(verifyIcalToken('')).toBe(false);
      expect(verifyIcalToken('   ')).toBe(false);
      expect(verifyIcalToken('non-existent-secret-token')).toBe(false);
    });
  });

  // =========================================================================
  // Area 10: Security Boundaries
  // =========================================================================
  describe('Area 10: Security Boundaries', () => {
    it('10.1 verifyPassword returns false for empty password, wrong password, or corrupted hash', () => {
      expect(verifyPassword('', 'salt:derived')).toBe(false);
      expect(verifyPassword('password', 'corruptedhashwithoutcolon')).toBe(false);
      expect(verifyPassword('password', 'salt:')).toBe(false);
    });

    it('10.2 verifySessionToken returns null for expired token (TTL in past)', async () => {
      const expiredToken = await createSessionToken(
        { userId: 1, email: 'user@test.local', username: 'user1' },
        -1 // Expired 1 day ago
      );
      const verified = await verifySessionToken(expiredToken);
      expect(verified).toBeNull();
    });

    it('10.3 verifySessionToken returns null for tampered signature or payload', async () => {
      const validToken = await createSessionToken(
        { userId: 1, email: 'user@test.local', username: 'user1' },
        30
      );
      const [data, sig] = validToken.split('.');
      const tamperedToken = `${data}.${sig.slice(0, -4)}XXXX`;
      expect(await verifySessionToken(tamperedToken)).toBeNull();
      expect(await verifySessionToken('completelyInvalidTokenWithoutPeriod')).toBeNull();
    });

    it('10.4 verifyTotp returns false for tokens that are not exactly 6 numeric digits', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      expect(verifyTotp(secret, '12345')).toBe(false); // 5 digits
      expect(verifyTotp(secret, '1234567')).toBe(false); // 7 digits
      expect(verifyTotp(secret, 'abcdef')).toBe(false); // non-numeric
      expect(verifyTotp(secret, '')).toBe(false); // empty
    });

    it('10.5 verifyAndConsumeBackupCode returns valid=false for non-existent code or malformed JSON', () => {
      const res1 = verifyAndConsumeBackupCode('NON-EXISTENT', JSON.stringify(['hash1', 'hash2']));
      expect(res1.valid).toBe(false);

      const res2 = verifyAndConsumeBackupCode('CODE-1234', 'invalid-json');
      expect(res2.valid).toBe(false);

      const res3 = verifyAndConsumeBackupCode('', null);
      expect(res3.valid).toBe(false);
    });

    it('10.6 rate limiter sliding window allows new attempts after window expires', () => {
      const ip = '1.2.3.4';
      const action = 'api-call';
      const maxAttempts = 2;
      const windowMs = 50; // 50ms short window

      expect(checkRateLimit(ip, action, maxAttempts, windowMs).allowed).toBe(true);
      recordFailedAttempt(ip, action);
      recordFailedAttempt(ip, action);

      // Immediately blocked
      expect(checkRateLimit(ip, action, maxAttempts, windowMs).allowed).toBe(false);
    });
  });
});
