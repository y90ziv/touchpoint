import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, setTestDb } from '@/db';
import { createContact, createGroup } from '@/lib/contacts-service';
import {
  logTouchpoint,
  snoozeContact,
  listTouchpointsForContact,
  addTopic,
  createRelationship,
  getRelationshipsForContact,
  buildRelationshipNetworkGraph,
} from '@/lib/touchpoints-service';

describe('Phase 3: Touchpoints, Topics Checklist & Interactive Relationship Map', () => {
  beforeEach(() => {
    const { db, sqlite } = createDatabase(':memory:');
    setTestDb(db, sqlite);
  });

  it('logs a touchpoint, resets the contact cadence timer, and ticks off selected topics', () => {
    const group = createGroup({ name: 'Workplace 1', intervalDays: 30 });
    const contact = createContact({
      fullName: 'Dan Cohen',
      keepInTouch: true,
      lastContactedAt: '2026-09-01T10:00:00Z',
      groupIds: [group.id],
    });

    const t1 = addTopic(contact.id, 'Ask about kitchen renovation');
    const t2 = addTopic(contact.id, 'Ask about trip to Japan');

    const logDate = '2026-10-16T12:00:00Z';
    const result = logTouchpoint({
      contactId: contact.id,
      method: 'call',
      note: 'Spoke for 25 mins, kitchen is done!',
      contactedAt: logDate,
      completedTopicIds: [t1.id],
    });

    expect(result.touchpoint.method).toBe('call');
    expect(result.contact.cadence.daysSinceContact).toBe(0);
    expect(result.contact.cadence.status).toBe('on_track');
    expect(result.contact.cadence.nextDueDate).toBe('2026-11-15');

    const completedTopic = result.contact.topics.find((t) => t.id === t1.id);
    const activeTopic = result.contact.topics.find((t) => t.id === t2.id);
    expect(completedTopic?.isCompleted).toBe(true);
    expect(activeTopic?.isCompleted).toBe(false);

    const history = listTouchpointsForContact(contact.id);
    expect(history.length).toBe(1);
    expect(history[0].note).toContain('kitchen is done');
  });

  it('snoozes an overdue contact and shifts their next due date forward', () => {
    const refDate = new Date('2026-10-16T12:00:00Z');
    const group = createGroup({ name: 'Family', intervalDays: 7 });
    const contact = createContact({
      fullName: 'Mom',
      keepInTouch: true,
      lastContactedAt: '2026-10-01T10:00:00Z',
      groupIds: [group.id],
    });

    const snoozed = snoozeContact(contact.id, 5, refDate);
    expect(snoozed.cadence.daysUntilDue).toBe(5);
    expect(snoozed.cadence.status).toBe('on_track');

    const snoozedSoon = snoozeContact(contact.id, 2, refDate);
    expect(snoozedSoon.cadence.daysUntilDue).toBe(2);
    expect(snoozedSoon.cadence.status).toBe('due_soon');
  });

  it('links contacts via directional/bidirectional relationships and builds the network graph', () => {
    const dan = createContact({ fullName: 'Dan Cohen', keepInTouch: true });
    const sarah = createContact({ fullName: 'Sarah Cohen', keepInTouch: false });
    const leo = createContact({
      fullName: 'Leo Cohen',
      birthday: '2021-10-21',
      keepInTouch: false,
    });
    const unlinkedStranger = createContact({ fullName: 'Random Unlinked', keepInTouch: false });

    createRelationship({
      contactAId: dan.id,
      contactBId: sarah.id,
      type: 'spouse',
    });
    createRelationship({
      contactAId: dan.id,
      contactBId: leo.id,
      type: 'parent_child',
    });

    const danRels = getRelationshipsForContact(dan.id);
    expect(danRels.length).toBe(2);
    expect(danRels.map((r) => `${r.displayLabel}: ${r.otherContactName}`)).toEqual([
      'Spouse / Partner: Sarah Cohen',
      'Child: Leo Cohen',
    ]);

    const leoRels = getRelationshipsForContact(leo.id);
    expect(leoRels[0].displayLabel).toBe('Parent');
    expect(leoRels[0].otherContactName).toBe('Dan Cohen');

    // Full linked graph includes tracked contacts + anyone linked to them, excluding unlinked untracked
    const fullGraph = buildRelationshipNetworkGraph(false);
    expect(fullGraph.nodes.map((n) => n.fullName)).toEqual([
      'Dan Cohen',
      'Sarah Cohen',
      'Leo Cohen',
    ]);
    expect(fullGraph.nodes.some((n) => n.id === unlinkedStranger.id)).toBe(false);
    expect(fullGraph.edges.length).toBe(2);

    // Tracked-only graph filters to keepInTouch === true
    const trackedGraph = buildRelationshipNetworkGraph(true);
    expect(trackedGraph.nodes.map((n) => n.fullName)).toEqual(['Dan Cohen']);
  });
});
