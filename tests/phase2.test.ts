import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, setTestDb } from '@/db';
import { touchpoints, topics } from '@/db/schema';
import {
  createContact,
  updateContact,
  listContactsWithDetails,
  createGroup,
  executeBulkContactOperation,
  detectDuplicateContacts,
  mergeContacts,
  createCustomFieldTemplate,
  listCustomFieldTemplates,
} from '@/lib/contacts-service';

describe('Phase 2: Contacts CRUD, Work/Pets, Custom Fields, Bulk Ops & Duplicate Merger', () => {
  beforeEach(() => {
    const { db, sqlite } = createDatabase(':memory:');
    setTestDb(db, sqlite);
  });

  it('creates and updates contacts with Work, Pets, and Custom Field Templates', () => {
    const cityTemplate = createCustomFieldTemplate({
      name: 'City',
      fieldType: 'text',
    });

    const familyGroup = createGroup({
      name: 'Family',
      color: '#10b981',
      intervalDays: 7,
    });

    const created = createContact({
      fullName: 'Dan Cohen',
      phone: '+972-54-1234567',
      email: 'dan@example.com',
      company: 'Acme Corp',
      jobTitle: 'Staff Engineer',
      pets: ['Barnaby (Golden Retriever)'],
      keepInTouch: true,
      groupIds: [familyGroup.id],
      customFields: {
        [cityTemplate.id]: 'Tel Aviv',
      },
    });

    expect(created.company).toBe('Acme Corp');
    expect(created.jobTitle).toBe('Staff Engineer');
    expect(created.pets).toEqual(['Barnaby (Golden Retriever)']);
    expect(created.groups.map((g) => g.name)).toEqual(['Family']);
    expect(created.customFields[cityTemplate.id]).toBe('Tel Aviv');
    expect(created.cadence.effectiveIntervalDays).toBe(7);

    const updated = updateContact(created.id, {
      customIntervalDays: 14,
      pets: ['Barnaby (Golden Retriever)', 'Miso (Cat)'],
    });
    expect(updated.cadence.effectiveIntervalDays).toBe(14);
    expect(updated.pets.length).toBe(2);
    expect(listCustomFieldTemplates().length).toBe(1);
  });

  it('executes Bulk Operations across selected contacts', () => {
    const workplaceGroup = createGroup({
      name: 'Workplace 1',
      intervalDays: 30,
    });

    const c1 = createContact({ fullName: 'Person One', keepInTouch: false });
    const c2 = createContact({ fullName: 'Person Two', keepInTouch: false });

    executeBulkContactOperation({
      contactIds: [c1.id, c2.id],
      action: 'enable_keep_in_touch',
    });

    executeBulkContactOperation({
      contactIds: [c1.id, c2.id],
      action: 'assign_group',
      groupId: workplaceGroup.id,
    });

    const all = listContactsWithDetails();
    expect(all.every((c) => c.keepInTouch)).toBe(true);
    expect(all.every((c) => c.groups.some((g) => g.name === 'Workplace 1'))).toBe(true);
  });

  it('detects duplicates (even across local 054 vs +97254 formats) and merges all history cleanly', () => {
    const { db } = createDatabase(':memory:');
    setTestDb(db, {} as never);

    const g1 = createGroup({ name: 'Family', intervalDays: 7 });
    const g2 = createGroup({ name: 'Workplace 1', intervalDays: 30 });

    const googleContact = createContact({
      source: 'google',
      googleResourceName: 'people/c12345',
      fullName: 'Dan Cohen',
      phone: '+972-54-123-4567',
      email: 'dan@acme.io',
      company: 'Acme',
      groupIds: [g1.id],
    });

    const localContact = createContact({
      source: 'local',
      fullName: 'Danny Cohen',
      phone: '054-1234567',
      pets: ['Barnaby'],
      keepInTouch: true,
      notes: 'Met at the Berlin conference',
      groupIds: [g2.id],
    });

    // Add a topic and touchpoint to secondary localContact
    db.insert(topics)
      .values({
        contactId: localContact.id,
        content: 'Ask about kitchen remodel',
        isCompleted: false,
        createdAt: new Date().toISOString(),
      })
      .run();

    db.insert(touchpoints)
      .values({
        contactId: localContact.id,
        contactedAt: '2026-10-10T10:00:00Z',
        method: 'call',
        note: 'Great catch-up call',
        createdAt: new Date().toISOString(),
      })
      .run();

    const duplicates = detectDuplicateContacts();
    expect(duplicates.length).toBe(1);
    expect(duplicates[0].reasons).toContain('Matching phone number');

    const merged = mergeContacts(googleContact.id, localContact.id);
    expect(merged.fullName).toBe('Dan Cohen');
    expect(merged.keepInTouch).toBe(true);
    expect(merged.pets).toEqual(['Barnaby']);
    expect(merged.groups.length).toBe(2);
    expect(merged.topics.length).toBe(1);
    expect(merged.topics[0].content).toBe('Ask about kitchen remodel');
    expect(listContactsWithDetails().length).toBe(1);
  });
});
