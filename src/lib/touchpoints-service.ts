import { eq, desc, inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import {
  contacts,
  touchpoints,
  topics,
  relationships,
  importantDates,
} from '@/db/schema';
import { getContactById, listContactsWithDetails } from '@/lib/contacts-service';
import { logger } from '@/lib/logger';

export type ContactMethod = 'call' | 'message' | 'in_person' | 'other';

export type RelationshipType =
  | 'spouse'
  | 'parent_child'
  | 'child_of'
  | 'family'
  | 'sibling'
  | 'friend'
  | 'coworker'
  | 'introduced_by';

/**
 * Logs a touchpoint (Call, Message, In Person, Other), resets the contact's
 * rolling timer (`lastContactedAt`) and clears any active snooze, and optionally
 * marks specified "Topics to Ask" items as completed.
 */
export function logTouchpoint(input: {
  contactId: number;
  method: ContactMethod;
  note?: string | null;
  contactedAt?: string;
  completedTopicIds?: number[];
  sourceTrigger?: 'web' | 'telegram';
}) {
  const db = getDb();
  const now = new Date().toISOString();
  const contactedAt = input.contactedAt || now;

  const existing = db
    .select()
    .from(contacts)
    .where(eq(contacts.id, input.contactId))
    .get();
  if (!existing) {
    throw new Error(`Contact ${input.contactId} not found`);
  }

  const inserted = db
    .insert(touchpoints)
    .values({
      contactId: input.contactId,
      method: input.method,
      note: input.note?.trim() || null,
      contactedAt,
      createdAt: now,
    })
    .returning()
    .get();

  // Update contact's lastContactedAt and clear snoozedUntil
  db.update(contacts)
    .set({
      lastContactedAt: contactedAt,
      snoozedUntil: null,
    })
    .where(eq(contacts.id, input.contactId))
    .run();

  if (input.completedTopicIds && input.completedTopicIds.length > 0) {
    db.update(topics)
      .set({ isCompleted: true, completedAt: now })
      .where(inArray(topics.id, input.completedTopicIds))
      .run();
  }

  const updatedContact = getContactById(input.contactId, new Date(contactedAt))!;

  db.update(contacts)
    .set({ nextDueAt: updatedContact.cadence.nextDueDate })
    .where(eq(contacts.id, input.contactId))
    .run();

  logger.crud('CREATE', 'touchpoint', {
    id: inserted.id,
    contactId: input.contactId,
    contactName: existing.fullName,
    method: input.method,
    sourceTrigger: input.sourceTrigger || 'web',
    nextDueDate: updatedContact.cadence.nextDueDate,
  });

  return {
    touchpoint: inserted,
    contact: getContactById(input.contactId, new Date(contactedAt))!,
  };
}

export function snoozeContact(contactId: number, days: number, referenceDate: Date = new Date()) {
  const db = getDb();
  const snoozeDate = new Date(referenceDate.getTime() + days * 24 * 60 * 60 * 1000);
  const snoozedUntil = snoozeDate.toISOString();

  db.update(contacts)
    .set({ snoozedUntil })
    .where(eq(contacts.id, contactId))
    .run();

  logger.crud('UPDATE', 'contact_snooze', { contactId, days, snoozedUntil });
  return getContactById(contactId, referenceDate)!;
}

export function listTouchpointsForContact(contactId: number) {
  const db = getDb();
  return db
    .select()
    .from(touchpoints)
    .where(eq(touchpoints.contactId, contactId))
    .orderBy(desc(touchpoints.contactedAt))
    .all();
}

export function deleteTouchpoint(id: number) {
  const db = getDb();
  const existing = db.select().from(touchpoints).where(eq(touchpoints.id, id)).get();
  if (!existing) {
    throw new Error(`Touchpoint ${id} not found`);
  }

  const contactId = existing.contactId;
  db.delete(touchpoints).where(eq(touchpoints.id, id)).run();

  // Find latest remaining touchpoint for this contact
  const latestRemaining = db
    .select()
    .from(touchpoints)
    .where(eq(touchpoints.contactId, contactId))
    .orderBy(desc(touchpoints.contactedAt))
    .limit(1)
    .get();

  const newLastContacted = latestRemaining ? latestRemaining.contactedAt : null;

  db.update(contacts)
    .set({ lastContactedAt: newLastContacted })
    .where(eq(contacts.id, contactId))
    .run();

  const updatedContact = getContactById(contactId)!;
  db.update(contacts)
    .set({ nextDueAt: updatedContact.cadence.nextDueDate })
    .where(eq(contacts.id, contactId))
    .run();

  logger.crud('DELETE', 'touchpoint', { id, contactId, newLastContacted });

  return {
    success: true,
    contact: getContactById(contactId)!,
    remainingTouchpoints: listTouchpointsForContact(contactId),
  };
}

export function updateTouchpoint(
  id: number,
  updates: { method?: ContactMethod; note?: string | null; contactedAt?: string }
) {
  const db = getDb();
  const existing = db.select().from(touchpoints).where(eq(touchpoints.id, id)).get();
  if (!existing) {
    throw new Error(`Touchpoint ${id} not found`);
  }

  const contactId = existing.contactId;
  const updatePayload: Record<string, unknown> = {};
  if (updates.method !== undefined) updatePayload.method = updates.method;
  if (updates.note !== undefined) updatePayload.note = updates.note?.trim() || null;
  if (updates.contactedAt !== undefined) updatePayload.contactedAt = updates.contactedAt;

  if (Object.keys(updatePayload).length > 0) {
    db.update(touchpoints).set(updatePayload).where(eq(touchpoints.id, id)).run();
  }

  const latestRemaining = db
    .select()
    .from(touchpoints)
    .where(eq(touchpoints.contactId, contactId))
    .orderBy(desc(touchpoints.contactedAt))
    .limit(1)
    .get();

  const newLastContacted = latestRemaining ? latestRemaining.contactedAt : null;
  db.update(contacts)
    .set({ lastContactedAt: newLastContacted })
    .where(eq(contacts.id, contactId))
    .run();

  const updatedContact = getContactById(contactId)!;
  db.update(contacts)
    .set({ nextDueAt: updatedContact.cadence.nextDueDate })
    .where(eq(contacts.id, contactId))
    .run();

  logger.crud('UPDATE', 'touchpoint', { id, contactId, updates });

  return {
    touchpoint: db.select().from(touchpoints).where(eq(touchpoints.id, id)).get(),
    contact: getContactById(contactId)!,
    remainingTouchpoints: listTouchpointsForContact(contactId),
  };
}

/**
 * Topics ("To Ask Next Time" Checklist)
 */
export function addTopic(contactId: number, content: string) {
  const db = getDb();
  const inserted = db
    .insert(topics)
    .values({
      contactId,
      content: content.trim(),
      isCompleted: false,
      createdAt: new Date().toISOString(),
    })
    .returning()
    .get();

  logger.crud('CREATE', 'topic', { id: inserted.id, contactId });
  return inserted;
}

export function toggleTopic(topicId: number, isCompleted: boolean) {
  const db = getDb();
  const completedAt = isCompleted ? new Date().toISOString() : null;
  db.update(topics)
    .set({ isCompleted, completedAt })
    .where(eq(topics.id, topicId))
    .run();

  logger.crud('UPDATE', 'topic', { id: topicId, isCompleted });
  return db.select().from(topics).where(eq(topics.id, topicId)).get();
}

export function deleteTopic(topicId: number) {
  const db = getDb();
  db.delete(topics).where(eq(topics.id, topicId)).run();
  logger.crud('DELETE', 'topic', { id: topicId });
}

/**
 * Important Dates (Anniversaries, Kids' Birthdays, etc.)
 */
export function addImportantDate(input: {
  contactId: number;
  label: string;
  date: string;
  remindDaysBefore?: number;
}) {
  const db = getDb();
  const inserted = db
    .insert(importantDates)
    .values({
      contactId: input.contactId,
      label: input.label.trim(),
      date: input.date.trim(),
      remindDaysBefore: input.remindDaysBefore ?? 7,
      createdAt: new Date().toISOString(),
    })
    .returning()
    .get();

  logger.crud('CREATE', 'important_date', {
    id: inserted.id,
    contactId: input.contactId,
    label: inserted.label,
  });
  return inserted;
}

export function deleteImportantDate(id: number) {
  const db = getDb();
  db.delete(importantDates).where(eq(importantDates.id, id)).run();
  logger.crud('DELETE', 'important_date', { id });
}

/**
 * Relationships & Network Map Graph Data
 */
export function createRelationship(input: {
  contactAId: number;
  contactBId: number;
  type: RelationshipType;
  notes?: string | null;
}) {
  if (input.contactAId === input.contactBId) {
    throw new Error('Cannot link a contact to itself');
  }
  const db = getDb();
  const inserted = db
    .insert(relationships)
    .values({
      contactAId: input.contactAId,
      contactBId: input.contactBId,
      type: input.type,
      notes: input.notes?.trim() || null,
      createdAt: new Date().toISOString(),
    })
    .returning()
    .get();

  logger.crud('CREATE', 'relationship', {
    id: inserted.id,
    contactAId: input.contactAId,
    contactBId: input.contactBId,
    type: input.type,
  });
  return inserted;
}

export function deleteRelationship(id: number) {
  const db = getDb();
  db.delete(relationships).where(eq(relationships.id, id)).run();
  logger.crud('DELETE', 'relationship', { id });
}

export function getRelationshipsForContact(contactId: number) {
  const db = getDb();
  const allRels = db.select().from(relationships).all();
  const allContacts = db.select().from(contacts).all();
  const contactMap = new Map(allContacts.map((c) => [c.id, c]));

  return allRels
    .filter((r) => r.contactAId === contactId || r.contactBId === contactId)
    .map((r) => {
      const isSource = r.contactAId === contactId;
      const otherId = isSource ? r.contactBId : r.contactAId;
      const other = contactMap.get(otherId);
      let displayLabel = r.type.replace('_', ' ');
      if (r.type === 'parent_child') {
        displayLabel = isSource ? 'Child' : 'Parent';
      } else if (r.type === 'child_of') {
        displayLabel = isSource ? 'Parent' : 'Child';
      } else if (r.type === 'family') {
        displayLabel = 'Family';
      } else if (r.type === 'spouse') {
        displayLabel = 'Spouse / Partner';
      } else if (r.type === 'introduced_by') {
        displayLabel = isSource ? 'Introduced by' : 'Introduced';
      } else {
        displayLabel = displayLabel.charAt(0).toUpperCase() + displayLabel.slice(1);
      }

      return {
        id: r.id,
        type: r.type,
        displayLabel,
        otherContactId: otherId,
        otherContactName: other?.fullName || 'Unknown',
        otherContactBirthday: other?.birthday || null,
        notes: r.notes,
      };
    });
}

export function buildRelationshipNetworkGraph(trackedOnly = false, referenceDate: Date = new Date()) {
  const db = getDb();
  const detailedContacts = listContactsWithDetails(referenceDate);
  const allRels = db.select().from(relationships).all();

  const linkedIds = new Set<number>();
  allRels.forEach((r) => {
    linkedIds.add(r.contactAId);
    linkedIds.add(r.contactBId);
  });

  const nodes = detailedContacts
    .filter((c) => (trackedOnly ? c.keepInTouch : c.keepInTouch || linkedIds.has(c.id)))
    .map((c) => ({
      id: c.id,
      fullName: c.fullName,
      keepInTouch: c.keepInTouch,
      groups: c.groups.map((g) => ({ id: g.id, name: g.name, color: g.color })),
      status: c.cadence.status,
      progressPercent: c.cadence.progressPercent,
      daysSinceContact: c.cadence.daysSinceContact,
      effectiveIntervalDays: c.cadence.effectiveIntervalDays,
    }));

  const nodeIdSet = new Set(nodes.map((n) => n.id));
  const edges = allRels
    .filter((r) => nodeIdSet.has(r.contactAId) && nodeIdSet.has(r.contactBId))
    .map((r) => ({
      id: r.id,
      source: r.contactAId,
      target: r.contactBId,
      type: r.type,
      notes: r.notes,
    }));

  return { nodes, edges };
}
