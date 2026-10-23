import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, setTestDb, closeAllDbs } from '@/db';
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
  deleteGroup,
  listContactsWithDetails,
  getContactById,
  createCustomFieldTemplate,
  listCustomFieldTemplates,
} from '@/lib/contacts-service';
import {
  logTouchpoint,
  snoozeContact,
  listTouchpointsForContact,
  updateTouchpoint,
  deleteTouchpoint,
  addTopic,
  toggleTopic,
  deleteTopic,
  addImportantDate,
  deleteImportantDate,
  createRelationship,
  deleteRelationship,
  getRelationshipsForContact,
  buildRelationshipNetworkGraph,
} from '@/lib/touchpoints-service';
import {
  importGoogleCandidatesAdditiveOnly,
  listGoogleSyncTombstones,
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
  exportFullBackupJson,
  restoreFromBackupJson,
} from '@/lib/portability-service';
import {
  registerOwnerAccount,
  hashPassword,
  verifyPassword,
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
import { wipeAllData } from '@/lib/portability-service';

describe('Tier 1: Feature Coverage (Opaque-Box E2E)', () => {
  beforeEach(() => {
    const { db, sqlite } = createDatabase(':memory:');
    setTestDb(db, sqlite);
    clearAllRateLimits();
  });

  afterEach(() => {
    closeAllDbs();
  });

  // =========================================================================
  // Area 1: Contact Lifecycle & Cadence Calculation
  // =========================================================================
  describe('Area 1: Contact Lifecycle & Cadence Calculation', () => {
    it('1.1 falls back to 30 days default interval when no custom override and no groups assigned', () => {
      const contact = createContact({
        fullName: 'Jane Doe',
        keepInTouch: true,
      });
      const evaluated = getContactById(contact.id);
      expect(evaluated).not.toBeNull();
      expect(evaluated?.cadence.effectiveIntervalDays).toBe(30);
    });

    it('1.2 prioritizes per-contact customIntervalDays over assigned group intervals', () => {
      const group = createGroup({ name: 'Inner Circle', intervalDays: 7 });
      const contact = createContact({
        fullName: 'Custom Cadence Contact',
        keepInTouch: true,
        groupIds: [group.id],
        customIntervalDays: 14,
      });
      const evaluated = getContactById(contact.id);
      expect(evaluated?.cadence.effectiveIntervalDays).toBe(14);
    });

    it('1.3 chooses the shortest interval among assigned active groups when no custom interval is set', () => {
      const g1 = createGroup({ name: 'Monthly Friends', intervalDays: 30 });
      const g2 = createGroup({ name: 'Weekly Catchup', intervalDays: 7 });
      const g3 = createGroup({ name: 'Quarterly Checkin', intervalDays: 90 });
      const contact = createContact({
        fullName: 'Multi-Group Contact',
        keepInTouch: true,
        groupIds: [g1.id, g2.id, g3.id],
      });
      const evaluated = getContactById(contact.id);
      expect(evaluated?.cadence.effectiveIntervalDays).toBe(7);
    });

    it('1.4 evaluates status transitions accurately: overdue, due_today, due_soon, on_track', () => {
      const refDate = new Date('2026-10-20T12:00:00Z');

      // Overdue: last contacted 35 days ago on a 30-day interval (due 5 days ago)
      const cOverdue = evaluateContactCadence(
        {
          id: 1,
          fullName: 'Alice Overdue',
          keepInTouch: true,
          createdAt: '2026-01-01T00:00:00Z',
          lastContactedAt: '2026-09-15T12:00:00Z',
          groups: [{ id: 1, name: 'General', intervalDays: 30 }],
        },
        refDate
      );
      expect(cOverdue.status).toBe('overdue');
      expect(cOverdue.daysUntilDue).toBeLessThan(0);

      // Due today: last contacted 30 days ago on a 30-day interval
      const cDueToday = evaluateContactCadence(
        {
          id: 2,
          fullName: 'Bob DueToday',
          keepInTouch: true,
          createdAt: '2026-01-01T00:00:00Z',
          lastContactedAt: '2026-09-20T12:00:00Z',
          groups: [{ id: 1, name: 'General', intervalDays: 30 }],
        },
        refDate
      );
      expect(cDueToday.status).toBe('due_today');
      expect(cDueToday.daysUntilDue).toBe(0);

      // Due soon: due in 2 days (<= 3 days)
      const cDueSoon = evaluateContactCadence(
        {
          id: 3,
          fullName: 'Charlie DueSoon',
          keepInTouch: true,
          createdAt: '2026-01-01T00:00:00Z',
          lastContactedAt: '2026-09-22T12:00:00Z',
          groups: [{ id: 1, name: 'General', intervalDays: 30 }],
        },
        refDate
      );
      expect(cDueSoon.status).toBe('due_soon');
      expect(cDueSoon.daysUntilDue).toBe(2);

      // On track: last contacted 5 days ago on a 30-day interval
      const cOnTrack = evaluateContactCadence(
        {
          id: 4,
          fullName: 'Diana OnTrack',
          keepInTouch: true,
          createdAt: '2026-01-01T00:00:00Z',
          lastContactedAt: '2026-10-15T12:00:00Z',
          groups: [{ id: 1, name: 'General', intervalDays: 30 }],
        },
        refDate
      );
      expect(cOnTrack.status).toBe('on_track');
      expect(cOnTrack.daysUntilDue).toBe(25);
    });

    it('1.5 marks contacts with keepInTouch=false as untracked regardless of elapsed time', () => {
      const contact = createContact({
        fullName: 'Untracked Acquaintance',
        keepInTouch: false,
        lastContactedAt: '2020-01-01T00:00:00Z',
      });
      const evaluated = getContactById(contact.id);
      expect(evaluated?.cadence.status).toBe('untracked');
    });

    it('1.6 calculates progress percent correctly from 0% to 100% when due or overdue', () => {
      const refDate = new Date('2026-10-20T12:00:00Z');
      // 15 days elapsed out of 30 days interval -> ~50%
      const resHalf = evaluateContactCadence(
        {
          id: 1,
          fullName: 'Progress Half',
          keepInTouch: true,
          createdAt: '2026-01-01T00:00:00Z',
          lastContactedAt: '2026-10-05T12:00:00Z',
          groups: [{ id: 1, name: 'General', intervalDays: 30 }],
        },
        refDate
      );
      expect(resHalf.progressPercent).toBe(50);

      // Overdue -> 100%
      const resOverdue = evaluateContactCadence(
        {
          id: 2,
          fullName: 'Progress Full',
          keepInTouch: true,
          createdAt: '2026-01-01T00:00:00Z',
          lastContactedAt: '2026-08-01T12:00:00Z',
          groups: [{ id: 1, name: 'General', intervalDays: 30 }],
        },
        refDate
      );
      expect(resOverdue.progressPercent).toBe(100);
    });
  });

  // =========================================================================
  // Area 2: Circles & Groups Cadence Overrides
  // =========================================================================
  describe('Area 2: Circles & Groups Cadence Overrides', () => {
    it('2.1 creates a group with name, color, and default cadence intervalDays', () => {
      const grp = createGroup({
        name: 'Work Colleagues',
        color: '#3b82f6',
        intervalDays: 14,
      });
      expect(grp.id).toBeGreaterThan(0);
      expect(grp.name).toBe('Work Colleagues');
      expect(grp.color).toBe('#3b82f6');
      expect(grp.intervalDays).toBe(14);
    });

    it('2.2 updates group cadence and propagates new effective interval to assigned contacts', () => {
      const grp = createGroup({ name: 'College Friends', intervalDays: 60 });
      const contact = createContact({
        fullName: 'Dave Oldfriend',
        keepInTouch: true,
        groupIds: [grp.id],
      });
      expect(getContactById(contact.id)?.cadence.effectiveIntervalDays).toBe(60);

      updateGroup(grp.id, { intervalDays: 21 });
      expect(getContactById(contact.id)?.cadence.effectiveIntervalDays).toBe(21);
    });

    it('2.3 dynamically updates contact effective interval when assigned to multiple groups', () => {
      const g1 = createGroup({ name: 'Group A', intervalDays: 45 });
      const contact = createContact({
        fullName: 'Multi Assignee',
        keepInTouch: true,
        groupIds: [g1.id],
      });
      expect(getContactById(contact.id)?.cadence.effectiveIntervalDays).toBe(45);

      const g2 = createGroup({ name: 'Group B', intervalDays: 10 });
      updateContact(contact.id, { groupIds: [g1.id, g2.id] });
      expect(getContactById(contact.id)?.cadence.effectiveIntervalDays).toBe(10);
    });

    it('2.4 removing a contact from a group reverts to next shortest group or default 30 days', () => {
      const gFast = createGroup({ name: 'Fast Catchup', intervalDays: 7 });
      const gSlow = createGroup({ name: 'Slow Catchup', intervalDays: 60 });
      const contact = createContact({
        fullName: 'Revert Contact',
        keepInTouch: true,
        groupIds: [gFast.id, gSlow.id],
      });
      expect(getContactById(contact.id)?.cadence.effectiveIntervalDays).toBe(7);

      updateContact(contact.id, { groupIds: [gSlow.id] });
      expect(getContactById(contact.id)?.cadence.effectiveIntervalDays).toBe(60);

      updateContact(contact.id, { groupIds: [] });
      expect(getContactById(contact.id)?.cadence.effectiveIntervalDays).toBe(30);
    });

    it('2.5 ignores paused groups when other active groups have valid cadence', () => {
      const refDate = new Date('2026-10-20T12:00:00Z');
      const gPaused = createGroup({
        name: 'Paused Circle',
        intervalDays: 7,
        pausedUntil: '2026-11-01T00:00:00Z',
      });
      const gActive = createGroup({
        name: 'Active Circle',
        intervalDays: 25,
      });

      const effectiveInterval = calculateEffectiveIntervalDays(
        null,
        [
          { id: gPaused.id, name: gPaused.name, intervalDays: 7, pausedUntil: gPaused.pausedUntil },
          { id: gActive.id, name: gActive.name, intervalDays: 25 },
        ],
        refDate
      );
      expect(effectiveInterval).toBe(25);
    });

    it('2.6 marks contact cadence status as paused when all assigned groups are paused', () => {
      const refDate = new Date('2026-10-20T12:00:00Z');
      const g1 = createGroup({
        name: 'Team On Holiday 1',
        intervalDays: 7,
        pausedUntil: '2026-11-01T00:00:00Z',
      });
      const g2 = createGroup({
        name: 'Team On Holiday 2',
        intervalDays: 14,
        pausedUntil: '2026-11-05T00:00:00Z',
      });

      const evaluation = evaluateContactCadence(
        {
          id: 1,
          fullName: 'Holiday Contact',
          keepInTouch: true,
          createdAt: '2026-01-01T00:00:00Z',
          groups: [
            { id: g1.id, name: g1.name, intervalDays: 7, pausedUntil: g1.pausedUntil },
            { id: g2.id, name: g2.name, intervalDays: 14, pausedUntil: g2.pausedUntil },
          ],
        },
        refDate
      );
      expect(evaluation.status).toBe('paused');
    });
  });

  // =========================================================================
  // Area 3: Touchpoints & Interaction Logging
  // =========================================================================
  describe('Area 3: Touchpoints & Interaction Logging', () => {
    it('3.1 logs touchpoints with call, message, in_person, other and updates lastContactedAt', () => {
      const contact = createContact({ fullName: 'Touchpoint User', keepInTouch: true });
      const methods: Array<'call' | 'message' | 'in_person' | 'other'> = [
        'call',
        'message',
        'in_person',
        'other',
      ];

      for (const m of methods) {
        const dateStr = `2026-10-1${methods.indexOf(m) + 1}T10:00:00Z`;
        const result = logTouchpoint({
          contactId: contact.id,
          method: m,
          note: `Met via ${m}`,
          contactedAt: dateStr,
        });
        expect(result.touchpoint.method).toBe(m);
        expect(result.contact.lastContactedAt).toBe(dateStr);
      }

      const history = listTouchpointsForContact(contact.id);
      expect(history.length).toBe(4);
    });

    it('3.2 marks selected topics as completed when logging a touchpoint', () => {
      const contact = createContact({ fullName: 'Topic Contact', keepInTouch: true });
      const top1 = addTopic(contact.id, 'Ask about kitchen remodeling');
      const top2 = addTopic(contact.id, 'Ask about new puppy');

      logTouchpoint({
        contactId: contact.id,
        method: 'call',
        note: 'Great chat',
        completedTopicIds: [top1.id],
      });

      const updated = getContactById(contact.id);
      const t1 = updated?.topics.find((t) => t.id === top1.id);
      const t2 = updated?.topics.find((t) => t.id === top2.id);
      expect(t1?.isCompleted).toBe(true);
      expect(t1?.completedAt).not.toBeNull();
      expect(t2?.isCompleted).toBe(false);
    });

    it('3.3 logging a touchpoint automatically clears any active snooze on the contact', () => {
      const contact = createContact({ fullName: 'Snoozed Contact', keepInTouch: true });
      snoozeContact(contact.id, 10);
      expect(getContactById(contact.id)?.snoozedUntil).not.toBeNull();

      logTouchpoint({
        contactId: contact.id,
        method: 'message',
        note: 'Reached out early',
      });
      expect(getContactById(contact.id)?.snoozedUntil).toBeNull();
    });

    it('3.4 updates an existing touchpoint and recalculates contact rolling lastContactedAt', () => {
      const contact = createContact({ fullName: 'Edit TP Contact', keepInTouch: true });
      const tp1 = logTouchpoint({
        contactId: contact.id,
        method: 'call',
        note: 'Old call',
        contactedAt: '2026-10-01T10:00:00Z',
      });
      const tp2 = logTouchpoint({
        contactId: contact.id,
        method: 'message',
        note: 'Latest message',
        contactedAt: '2026-10-10T10:00:00Z',
      });

      expect(getContactById(contact.id)?.lastContactedAt).toBe('2026-10-10T10:00:00Z');

      updateTouchpoint(tp2.touchpoint.id, { contactedAt: '2026-09-20T10:00:00Z' });
      // Now tp1 at 2026-10-01 is the most recent
      expect(getContactById(contact.id)?.lastContactedAt).toBe('2026-10-01T10:00:00Z');
    });

    it('3.5 deleting a touchpoint rolls back lastContactedAt to previous touchpoint or null', () => {
      const contact = createContact({ fullName: 'Delete TP Contact', keepInTouch: true });
      const tp = logTouchpoint({
        contactId: contact.id,
        method: 'in_person',
        note: 'Sole meetup',
      });
      expect(getContactById(contact.id)?.lastContactedAt).not.toBeNull();

      deleteTouchpoint(tp.touchpoint.id);
      expect(getContactById(contact.id)?.lastContactedAt).toBeNull();
      expect(listTouchpointsForContact(contact.id).length).toBe(0);
    });

    it('3.6 snoozing an overdue contact shifts their next due date forward by N days', () => {
      const refDate = new Date('2026-10-20T12:00:00Z');
      const contact = createContact({
        fullName: 'Snooze Tester',
        keepInTouch: true,
        lastContactedAt: '2026-09-01T00:00:00Z',
      });
      const snoozed = snoozeContact(contact.id, 5, refDate);
      expect(snoozed.snoozedUntil).toBe('2026-10-25T12:00:00.000Z');
      expect(snoozed.cadence.nextDueDate).toBe('2026-10-25');
      expect(snoozed.cadence.status).not.toBe('overdue');
    });
  });

  // =========================================================================
  // Area 4: Relationships & Network Graph Data
  // =========================================================================
  describe('Area 4: Relationships & Network Graph Data', () => {
    it('4.1 creates relationships between contacts across supported relationship types', () => {
      const a = createContact({ fullName: 'Contact A' });
      const b = createContact({ fullName: 'Contact B' });
      const types = ['spouse', 'parent_child', 'sibling', 'friend', 'coworker', 'introduced_by'] as const;

      for (const t of types) {
        const rel = createRelationship({
          contactAId: a.id,
          contactBId: b.id,
          type: t,
          notes: `Linked as ${t}`,
        });
        expect(rel.id).toBeGreaterThan(0);
        expect(rel.type).toBe(t);
        deleteRelationship(rel.id);
      }
    });

    it('4.2 throws an error when attempting to link a contact to itself', () => {
      const a = createContact({ fullName: 'Self Linker' });
      expect(() =>
        createRelationship({
          contactAId: a.id,
          contactBId: a.id,
          type: 'friend',
        })
      ).toThrow('Cannot link a contact to itself');
    });

    it('4.3 presents symmetric/bidirectional relationship views from both perspectives', () => {
      const parent = createContact({ fullName: 'Sarah Cohen' });
      const child = createContact({ fullName: 'Dan Cohen' });
      createRelationship({
        contactAId: parent.id,
        contactBId: child.id,
        type: 'parent_child',
      });

      // From parent perspective: other is Dan, displayLabel is Child
      const fromParent = getRelationshipsForContact(parent.id);
      expect(fromParent.length).toBe(1);
      expect(fromParent[0].otherContactName).toBe('Dan Cohen');
      expect(fromParent[0].displayLabel).toBe('Child');

      // From child perspective: other is Sarah, displayLabel is Parent
      const fromChild = getRelationshipsForContact(child.id);
      expect(fromChild.length).toBe(1);
      expect(fromChild[0].otherContactName).toBe('Sarah Cohen');
      expect(fromChild[0].displayLabel).toBe('Parent');
    });

    it('4.4 generates network graph nodes and edges for the relationship map', () => {
      const c1 = createContact({ fullName: 'Node 1', keepInTouch: true });
      const c2 = createContact({ fullName: 'Node 2', keepInTouch: true });
      const c3 = createContact({ fullName: 'Node 3', keepInTouch: true });
      createRelationship({ contactAId: c1.id, contactBId: c2.id, type: 'friend' });
      createRelationship({ contactAId: c2.id, contactBId: c3.id, type: 'coworker' });

      const graph = buildRelationshipNetworkGraph(false);
      expect(graph.nodes.length).toBe(3);
      expect(graph.edges.length).toBe(2);
      expect(graph.edges.some((e) => e.type === 'friend')).toBe(true);
      expect(graph.edges.some((e) => e.type === 'coworker')).toBe(true);
    });

    it('4.5 filters graph data with trackedOnly=true to exclude untracked unlinked contacts', () => {
      const trackedLinked = createContact({ fullName: 'Tracked Linked', keepInTouch: true });
      const untrackedLinked = createContact({ fullName: 'Untracked Linked', keepInTouch: false });
      const untrackedUnlinked = createContact({ fullName: 'Untracked Solo', keepInTouch: false });
      createRelationship({ contactAId: trackedLinked.id, contactBId: untrackedLinked.id, type: 'friend' });

      const graphAll = buildRelationshipNetworkGraph(false);
      // Untracked solo is excluded if unlinked
      expect(graphAll.nodes.some((n) => n.id === untrackedUnlinked.id)).toBe(false);
      expect(graphAll.nodes.some((n) => n.id === untrackedLinked.id)).toBe(true);

      const graphTracked = buildRelationshipNetworkGraph(true);
      // With trackedOnly=true, only keepInTouch contacts are included
      expect(graphTracked.nodes.some((n) => n.id === untrackedLinked.id)).toBe(false);
      expect(graphTracked.nodes.some((n) => n.id === trackedLinked.id)).toBe(true);
    });

    it('4.6 deletes a relationship and cleans up graph edges', () => {
      const c1 = createContact({ fullName: 'Edge A', keepInTouch: true });
      const c2 = createContact({ fullName: 'Edge B', keepInTouch: true });
      const rel = createRelationship({ contactAId: c1.id, contactBId: c2.id, type: 'sibling' });

      expect(buildRelationshipNetworkGraph().edges.length).toBe(1);
      deleteRelationship(rel.id);
      expect(buildRelationshipNetworkGraph().edges.length).toBe(0);
    });
  });

  // =========================================================================
  // Area 5: Custom Fields, Work Info, Pets & Topics
  // =========================================================================
  describe('Area 5: Custom Fields, Work Info, Pets & Topics', () => {
    it('5.1 creates custom field templates (text, date, select, url) and stores contact values', () => {
      const tText = createCustomFieldTemplate({ name: 'Hometown', fieldType: 'text' });
      const tSelect = createCustomFieldTemplate({
        name: 'Dietary Preference',
        fieldType: 'select',
        options: ['Vegetarian', 'Vegan', 'Omnivore'],
      });

      const contact = createContact({
        fullName: 'Field User',
        customFields: {
          [tText.id]: 'Amsterdam',
          [tSelect.id]: 'Vegan',
        },
      });

      const retrieved = getContactById(contact.id);
      expect(retrieved?.customFields[tText.id]).toBe('Amsterdam');
      expect(retrieved?.customFields[tSelect.id]).toBe('Vegan');
    });

    it('5.2 stores work info (company, job title) and automatically splits full names', () => {
      const contact = createContact({
        fullName: 'Alexander Hamilton',
        company: 'Treasury Dept',
        jobTitle: 'Secretary',
      });
      expect(contact.firstName).toBe('Alexander');
      expect(contact.lastName).toBe('Hamilton');
      expect(contact.company).toBe('Treasury Dept');
      expect(contact.jobTitle).toBe('Secretary');
    });

    it('5.3 stores, serializes, and deserializes pets array in contact record', () => {
      const contact = createContact({
        fullName: 'Pet Owner',
        pets: ['Mochi (Cat)', 'Barnaby (Golden Retriever)'],
      });
      const retrieved = getContactById(contact.id);
      expect(retrieved?.pets).toEqual(['Mochi (Cat)', 'Barnaby (Golden Retriever)']);

      updateContact(contact.id, { pets: ['Mochi (Cat)', 'Barnaby (Golden Retriever)', 'Pip (Hamster)'] });
      expect(getContactById(contact.id)?.pets.length).toBe(3);
    });

    it('5.4 manages topics checklist: addTopic, toggleTopic, deleteTopic', () => {
      const contact = createContact({ fullName: 'Topic Person' });
      const topic = addTopic(contact.id, 'Discuss startup seed round');
      expect(topic.content).toBe('Discuss startup seed round');
      expect(topic.isCompleted).toBe(false);

      const toggled = toggleTopic(topic.id, true);
      expect(toggled?.isCompleted).toBe(true);
      expect(toggled?.completedAt).not.toBeNull();

      deleteTopic(topic.id);
      expect(getContactById(contact.id)?.topics.length).toBe(0);
    });

    it('5.5 creates important dates / milestones with custom remindDaysBefore and deletes them', () => {
      const contact = createContact({ fullName: 'Milestone Contact' });
      const imp = addImportantDate({
        contactId: contact.id,
        label: 'Wedding Anniversary',
        date: '2024-06-15',
        remindDaysBefore: 14,
      });
      expect(imp.label).toBe('Wedding Anniversary');
      expect(imp.remindDaysBefore).toBe(14);

      const retrieved = getContactById(contact.id);
      expect(retrieved?.importantDates.length).toBe(1);

      deleteImportantDate(imp.id);
      expect(getContactById(contact.id)?.importantDates.length).toBe(0);
    });

    it('5.6 lists custom field templates with parsed options array', () => {
      createCustomFieldTemplate({ name: 'Field A', fieldType: 'text' });
      createCustomFieldTemplate({
        name: 'Field B',
        fieldType: 'select',
        options: ['Opt1', 'Opt2'],
      });
      const templates = listCustomFieldTemplates();
      expect(templates.length).toBe(2);
      expect(templates[0].name).toBe('Field A');
      expect(templates[1].name).toBe('Field B');
      expect(templates[1].options).toEqual(['Opt1', 'Opt2']);
    });
  });

  // =========================================================================
  // Area 6: Google Contacts Sync & Tombstones
  // =========================================================================
  describe('Area 6: Google Contacts Sync & Tombstones', () => {
    it('6.1 imports genuinely new Google contacts additively without touching existing contacts', () => {
      const local = createContact({
        fullName: 'Local User',
        phone: '+1234567890',
        notes: 'Handcrafted notes',
      });

      const syncResult = importGoogleCandidatesAdditiveOnly([
        { resourceName: 'people/g1', fullName: 'Google Contact 1', phone: '+987654321' },
      ]);
      expect(syncResult.imported).toBe(1);
      expect(syncResult.skippedExisting).toBe(0);

      const localAfter = getContactById(local.id);
      expect(localAfter?.notes).toBe('Handcrafted notes');
    });

    it('6.2 never deletes local contacts when omitted from Google sync batch', () => {
      const c = createContact({
        source: 'google',
        googleResourceName: 'people/legacy',
        fullName: 'Legacy Google Contact',
      });
      importGoogleCandidatesAdditiveOnly([
        { resourceName: 'people/newone', fullName: 'New Contact' },
      ]);

      const retrieved = getContactById(c.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.fullName).toBe('Legacy Google Contact');
    });

    it('6.3 records a tombstone when a contact with googleResourceName is deleted', () => {
      const c = createContact({
        source: 'google',
        googleResourceName: 'people/to_delete',
        fullName: 'Tombstone Target',
      });
      deleteContact(c.id);

      const tombstones = listGoogleSyncTombstones();
      expect(tombstones.some((t) => t.googleResourceName === 'people/to_delete')).toBe(true);
    });

    it('6.4 skips tombstoned Google contacts during subsequent syncs', () => {
      const c = createContact({
        source: 'google',
        googleResourceName: 'people/skip_me',
        fullName: 'To Be Skipped',
      });
      deleteContact(c.id);

      const syncResult = importGoogleCandidatesAdditiveOnly([
        { resourceName: 'people/skip_me', fullName: 'To Be Skipped Again' },
      ]);
      expect(syncResult.imported).toBe(0);
      expect(syncResult.skippedExisting).toBe(1);
    });

    it('6.5 allows unblocking a tombstone and re-importing via fullRescan: true', () => {
      const c = createContact({
        source: 'google',
        googleResourceName: 'people/unblock_me',
        fullName: 'Unblock Target',
      });
      deleteContact(c.id);

      const tombstones = listGoogleSyncTombstones();
      const targetTombstone = tombstones.find((t) => t.googleResourceName === 'people/unblock_me');
      expect(targetTombstone).toBeDefined();

      deleteGoogleSyncTombstone(targetTombstone!.id);

      const rescanResult = importGoogleCandidatesAdditiveOnly(
        [{ resourceName: 'people/unblock_me', fullName: 'Re-imported Contact' }],
        { fullRescan: true }
      );
      expect(rescanResult.imported).toBe(1);
    });

    it('6.6 skips older candidates and auto-tombstones when candidate updatedAt <= lastGoogleSyncAt', () => {
      createContact({
        source: 'google',
        googleResourceName: 'people/existing_anchor',
        fullName: 'Existing Anchor',
      });

      const syncResult = importGoogleCandidatesAdditiveOnly(
        [
          {
            resourceName: 'people/old_contact',
            fullName: 'Old Candidate',
            updatedAt: '2026-01-01T00:00:00Z',
          },
        ],
        { lastGoogleSyncAt: '2026-05-01T00:00:00Z' }
      );

      expect(syncResult.imported).toBe(0);
      expect(syncResult.skippedExisting).toBe(1);
      const tombstones = listGoogleSyncTombstones();
      expect(tombstones.some((t) => t.googleResourceName === 'people/old_contact')).toBe(true);
    });
  });

  // =========================================================================
  // Area 7: Telegram Notifications & Reminders
  // =========================================================================
  describe('Area 7: Telegram Notifications & Reminders', () => {
    it('7.1 formats international (+972) and local (054...) phone numbers into WhatsApp wa.me links', () => {
      expect(formatWhatsAppLink('+972541234567')).toBe('https://wa.me/972541234567');
      expect(formatWhatsAppLink('0541234567', '+972')).toBe('https://wa.me/972541234567');
      expect(formatWhatsAppLink(null)).toBeNull();
      expect(formatWhatsAppLink('')).toBeNull();
    });

    it('7.2 builds a rich HTML reminder card with group, status, work info, pets, relationships, and topics', () => {
      const grp = createGroup({ name: 'Close Circle', intervalDays: 14 });
      const c = createContact({
        fullName: 'Elena Rostova',
        phone: '0549999999',
        company: 'Stark Industries',
        jobTitle: 'VP Research',
        pets: ['Rocket (Raccoon)'],
        groupIds: [grp.id],
        keepInTouch: true,
      });
      addTopic(c.id, 'Ask about arc reactor design');

      const msg = buildContactReminderMessage(c.id, '+972');
      expect(msg.text).toContain('Touchpoint Reminder: Elena Rostova');
      expect(msg.text).toContain('Stark Industries');
      expect(msg.text).toContain('Rocket (Raccoon)');
      expect(msg.text).toContain('Ask about arc reactor design');
      expect(msg.text).toContain('wa.me/972549999999');
      expect(msg.keyboard).toBeDefined();
    });

    it('7.3 rejects unauthorized Telegram callback clicks when fromUserId !== ownerChatId', () => {
      const res = processTelegramCallbackData('tp:pick_method:1', '999999', '123456');
      expect(res.authorized).toBe(false);
      expect(res.action).toBe('ignored');
    });

    it('7.4 step 1 callback: pick_method returns inline keyboard with method buttons', () => {
      const res = processTelegramCallbackData('tp:pick_method:1', '123456', '123456');
      expect(res.authorized).toBe(true);
      expect(res.action).toBe('show_methods');
      expect(res.keyboard).toBeDefined();
    });

    it('7.5 step 2 callback: log touchpoint executes interaction, resets cadence, and returns confirmation', () => {
      const c = createContact({ fullName: 'Telegram Contact', keepInTouch: true });
      const res = processTelegramCallbackData(`tp:log:${c.id}:call`, '123456', '123456');
      expect(res.authorized).toBe(true);
      expect(res.action).toBe('logged');
      expect(res.confirmationText).toContain('Logged Call with Telegram Contact');
      expect(getContactById(c.id)?.lastContactedAt).not.toBeNull();
    });

    it('7.6 callback: snooze contact shifts due date forward and returns confirmation', () => {
      const c = createContact({ fullName: 'Snooze Callback', keepInTouch: true });
      const res = processTelegramCallbackData(`tp:snooze:${c.id}:7`, '123456', '123456');
      expect(res.authorized).toBe(true);
      expect(res.action).toBe('snoozed');
      expect(res.confirmationText).toContain('Snoozed Snooze Callback for 7 days');
      expect(getContactById(c.id)?.snoozedUntil).not.toBeNull();
    });
  });

  // =========================================================================
  // Area 8: Outgoing Webhooks & HMAC Verification
  // =========================================================================
  describe('Area 8: Outgoing Webhooks & HMAC Verification', () => {
    it('8.1 signs webhook payload with HMAC-SHA256 in sha256=<hex> format', () => {
      const body = JSON.stringify({ event: 'test', data: 123 });
      const secret = 'super-secret-key-123';
      const sig = signWebhookPayload(body, secret);
      expect(sig.startsWith('sha256=')).toBe(true);
      expect(sig.length).toBe(7 + 64);
    });

    it('8.2 builds structured daily_digest payload with summary counts and contact metadata', () => {
      const cOverdue = createContact({
        fullName: 'Webhook Overdue Contact',
        keepInTouch: true,
        lastContactedAt: '2026-08-01T00:00:00Z',
      });
      const refDate = new Date('2026-10-20T12:00:00Z');
      const payload = buildWebhookDigestPayload(refDate, false);

      expect(payload.event).toBe('daily_digest');
      expect(payload.summary.overdueCount).toBeGreaterThanOrEqual(1);
      expect(payload.contacts.some((c) => c.id === cOverdue.id)).toBe(true);
      expect(payload.contacts[0].fullName).toBe('Webhook Overdue Contact');
    });

    it('8.3 constructs test_webhook event payload when isTest=true', () => {
      const payload = buildWebhookDigestPayload(new Date(), true);
      expect(payload.event).toBe('test_webhook');
      expect(payload.message).toContain('Touchpoint Test Webhook:');
    });

    it('8.4 validateWebhookUrl permits valid public HTTPS URLs', () => {
      expect(() => validateWebhookUrl('https://example.com/webhook')).not.toThrow();
      expect(() => validateWebhookUrl('https://api.my-domain.org/prm-events')).not.toThrow();
    });

    it('8.5 validateWebhookUrl blocks private IPs and SSRF targets', () => {
      expect(() => validateWebhookUrl('http://127.0.0.1:8080/hook')).toThrow();
      expect(() => validateWebhookUrl('http://localhost:3000')).toThrow();
      expect(() => validateWebhookUrl('http://169.254.169.254/metadata')).toThrow();
      expect(() => validateWebhookUrl('http://192.168.1.1/hook')).toThrow();
      expect(() => validateWebhookUrl('http://10.0.0.1/hook')).toThrow();
      expect(() => validateWebhookUrl('http://172.16.0.1/hook')).toThrow();
    });

    it('8.6 webhook payload includes linked relationships and pending topics', () => {
      const c1 = createContact({ fullName: 'Person One', keepInTouch: true, lastContactedAt: '2026-08-01T00:00:00Z' });
      const c2 = createContact({ fullName: 'Person Two', keepInTouch: false });
      createRelationship({ contactAId: c1.id, contactBId: c2.id, type: 'spouse' });
      addTopic(c1.id, 'Discuss summer travel');

      const payload = buildWebhookDigestPayload(new Date('2026-10-20T12:00:00Z'));
      const item = payload.contacts.find((c) => c.id === c1.id);
      expect(item).toBeDefined();
      expect(item?.relationships.length).toBe(1);
      expect(item?.relationships[0].name).toBe('Person Two');
      expect(item?.pendingTopics).toEqual(['Discuss summer travel']);
    });
  });

  // =========================================================================
  // Area 9: Data Portability (vCard, CSV, JSON, iCal)
  // =========================================================================
  describe('Area 9: Data Portability (vCard, CSV, JSON, iCal)', () => {
    it('9.1 imports offline vCard (.vcf) cards additively', () => {
      const vcf = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        'FN:Ada Lovelace',
        'TEL;TYPE=CELL:+44123456789',
        'EMAIL:ada@lovelace.org',
        'ORG:Babbage Engine',
        'TITLE:Chief Analyst',
        'BDAY:1815-12-10',
        'END:VCARD',
      ].join('\r\n');

      const { imported } = importVCardContent(vcf);
      expect(imported).toBe(1);

      const all = listContactsWithDetails();
      expect(all.length).toBe(1);
      expect(all[0].fullName).toBe('Ada Lovelace');
      expect(all[0].company).toBe('Babbage Engine');
      expect(all[0].birthday).toBe('1815-12-10');
    });

    it('9.2 exports all contacts into a compliant vCard 3.0 string', () => {
      createContact({
        fullName: 'Grace Hopper',
        phone: '+15551234567',
        email: 'grace@navy.mil',
        company: 'US Navy',
        jobTitle: 'Rear Admiral',
      });

      const exported = exportContactsToVCard();
      expect(exported).toContain('BEGIN:VCARD');
      expect(exported).toContain('FN:Grace Hopper');
      expect(exported).toContain('EMAIL:grace@navy.mil');
      expect(exported).toContain('ORG:US Navy');
      expect(exported).toContain('END:VCARD');
    });

    it('9.3 generates private iCal (.ics) calendar feed containing due dates and birthdays', () => {
      registerOwnerAccount({
        email: 'icaluser@touchpoint.local',
        username: 'icaluser',
        password: 'password123',
      });

      createContact({
        fullName: 'Birthday Friend',
        birthday: '1995-10-25',
        keepInTouch: true,
      });

      const icalContent = generateIcalFeed(new Date('2026-10-20T12:00:00Z'));
      expect(icalContent).toContain('BEGIN:VCALENDAR');
      expect(icalContent).toContain('Birthday Friend');
      expect(icalContent).toContain('END:VCALENDAR');
    });

    it('9.4 verifies valid private icalSecretToken and rejects invalid tokens', () => {
      const { settings: s } = registerOwnerAccount({
        email: 'owner@token.test',
        username: 'ownertoken',
        password: 'password123',
      });
      expect(verifyIcalToken(s.icalSecretToken)).toBe(true);
      expect(verifyIcalToken('completely-invalid-token')).toBe(false);
    });

    it('9.5 exports complete database state into single JSON document', () => {
      const grp = createGroup({ name: 'JSON Export Circle', intervalDays: 30 });
      const c = createContact({ fullName: 'JSON Contact', groupIds: [grp.id] });
      addTopic(c.id, 'JSON Topic');

      const backup = exportFullBackupJson();
      expect(backup.version).toBe(1);
      expect(backup.contacts.length).toBe(1);
      expect(backup.groups.length).toBe(1);
      expect(backup.topics.length).toBe(1);
    });

    it('9.6 restores full database state atomically from JSON backup', () => {
      const grp = createGroup({ name: 'Restore Circle', intervalDays: 14 });
      const c = createContact({ fullName: 'Restore Contact', groupIds: [grp.id] });
      addTopic(c.id, 'Restore Topic');
      const backup = exportFullBackupJson();

      // Wipe current data
      wipeAllData();
      expect(listContactsWithDetails().length).toBe(0);

      // Restore from JSON
      const res = restoreFromBackupJson(backup);
      expect(res.restoredContacts).toBe(1);
      expect(listContactsWithDetails().length).toBe(1);
      expect(listContactsWithDetails()[0].fullName).toBe('Restore Contact');
    });
  });

  // =========================================================================
  // Area 10: Security (TOTP 2FA, Remember Me, Rate Limiting, Danger Zone)
  // =========================================================================
  describe('Area 10: Security (TOTP 2FA, Remember Me, Rate Limiting, Danger Zone)', () => {
    it('10.1 hashes passwords with scrypt and validates correct vs incorrect passwords in constant time', () => {
      const hash = hashPassword('MySecurePassword!123');
      expect(verifyPassword('MySecurePassword!123', hash)).toBe(true);
      expect(verifyPassword('WrongPassword', hash)).toBe(false);
    });

    it('10.2 generates and verifies signed HMAC session tokens with configurable TTL (1d vs 90d Remember Me)', async () => {
      const tokenStandard = await createSessionToken(
        { userId: 1, email: 'user@test.local', username: 'user1' },
        1 // 1 day standard
      );
      const verifiedStandard = await verifySessionToken(tokenStandard);
      expect(verifiedStandard?.userId).toBe(1);

      const tokenRemember = await createSessionToken(
        { userId: 1, email: 'user@test.local', username: 'user1' },
        90 // 90 days Remember Me
      );
      const verifiedRemember = await verifySessionToken(tokenRemember);
      expect(verifiedRemember?.userId).toBe(1);
      expect(verifiedRemember!.exp).toBeGreaterThan(verifiedStandard!.exp);
    });

    it('10.3 generates TOTP Base32 secret, verifies valid TOTP codes with ±1 time-step drift tolerance', async () => {
      const { secret } = await generateTotpSecret('user@test.local');
      const now = Date.now();
      const validCode = generateTotp(secret, now);
      expect(verifyTotp(secret, validCode, 1, now)).toBe(true);

      // Step drift +30s
      const driftCode = generateTotp(secret, now + 30000);
      expect(verifyTotp(secret, driftCode, 1, now)).toBe(true);

      // Invalid code
      expect(verifyTotp(secret, '000000', 1, now)).toBe(false);
    });

    it('10.4 generates 8 backup recovery codes (XXXX-XXXX format) and consumes them atomically', () => {
      const { plaintextCodes, hashedCodes } = generateBackupCodes(8);
      expect(plaintextCodes.length).toBe(8);
      expect(hashedCodes.length).toBe(8);
      expect(plaintextCodes[0]).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}$/);

      let currentHashedJson = JSON.stringify(hashedCodes);
      const codeToUse = plaintextCodes[0];

      // Use the code
      const result1 = verifyAndConsumeBackupCode(codeToUse, currentHashedJson);
      expect(result1.valid).toBe(true);
      currentHashedJson = result1.remainingHashedCodesJson;
      expect(JSON.parse(currentHashedJson).length).toBe(7);

      // Re-using the same code must fail
      const result2 = verifyAndConsumeBackupCode(codeToUse, currentHashedJson);
      expect(result2.valid).toBe(false);
    });

    it('10.5 rate limiting blocks requests after threshold attempts and isolates by IP and action', () => {
      const ip = '10.20.30.40';
      const action = 'login';
      const maxAttempts = 3;

      expect(checkRateLimit(ip, action, maxAttempts).allowed).toBe(true);
      recordFailedAttempt(ip, action);
      expect(checkRateLimit(ip, action, maxAttempts).remaining).toBe(2);

      recordFailedAttempt(ip, action);
      recordFailedAttempt(ip, action);

      const blocked = checkRateLimit(ip, action, maxAttempts);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);

      // Other IP is unaffected
      expect(checkRateLimit('10.20.30.99', action, maxAttempts).allowed).toBe(true);
    });

    it('10.6 danger zone wipeAllData wipes contacts, groups, touchpoints, topics, and resets timestamps', () => {
      createGroup({ name: 'Wipe Group', intervalDays: 30 });
      createContact({ fullName: 'Wipe Contact' });
      expect(listContactsWithDetails().length).toBe(1);

      const wipeResult = wipeAllData();
      expect(wipeResult.deleted).toBe(true);
      expect(listContactsWithDetails().length).toBe(0);
    });
  });
});
