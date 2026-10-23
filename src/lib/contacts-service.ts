import { eq, inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import {
  contacts,
  groups,
  contactGroups,
  relationships,
  topics,
  importantDates,
  customFieldTemplates,
  contactCustomFields,
  touchpoints,
  settings,
  googleSyncTombstones,
} from '@/db/schema';
import { evaluateContactCadence } from '@/lib/cadence';
import { logger } from '@/lib/logger';

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = (fullName || '').trim().split(/\s+/);
  if (parts.length <= 1) {
    return { firstName: parts[0] || '', lastName: '' };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export interface CreateContactInput {
  source?: 'google' | 'local' | 'vcard';
  googleResourceName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string;
  phone?: string | null;
  email?: string | null;
  country?: string | null;
  postalCode?: string | null;
  company?: string | null;
  jobTitle?: string | null;
  pets?: string[];
  birthday?: string | null;
  significantDate?: string | null;
  significantDateLabel?: string | null;
  keepInTouch?: boolean;
  customIntervalDays?: number | null;
  lastContactedAt?: string | null;
  notes?: string | null;
  groupIds?: number[];
  customFields?: Record<number, string>;
  importantDates?: Array<{ label: string; date: string; remindDaysBefore?: number }>;
}

export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';
  return phone.replace(/[^\d+]/g, '');
}

export function createContact(input: CreateContactInput) {
  const db = getDb();
  const now = new Date().toISOString();

  let firstName = input.firstName?.trim() || null;
  let lastName = input.lastName?.trim() || null;
  let fullName = input.fullName?.trim() || '';

  if (!fullName) {
    fullName = [firstName, lastName].filter(Boolean).join(' ');
  } else if (!firstName && !lastName) {
    const split = splitFullName(fullName);
    firstName = split.firstName || null;
    lastName = split.lastName || null;
  }

  const inserted = db
    .insert(contacts)
    .values({
      source: input.source || 'local',
      googleResourceName: input.googleResourceName || null,
      firstName,
      lastName,
      fullName: fullName || 'Unnamed Contact',
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      country: input.country?.trim() || null,
      postalCode: input.postalCode?.trim() || null,
      company: input.company?.trim() || null,
      jobTitle: input.jobTitle?.trim() || null,
      pets: JSON.stringify(input.pets || []),
      birthday: input.birthday?.trim() || null,
      significantDate: input.significantDate?.trim() || null,
      significantDateLabel: input.significantDateLabel?.trim() || null,
      keepInTouch: Boolean(input.keepInTouch),
      customIntervalDays: input.customIntervalDays ?? null,
      lastContactedAt: input.lastContactedAt || null,
      notes: input.notes?.trim() || null,
      createdAt: now,
    })
    .returning()
    .get();

  if (input.groupIds && input.groupIds.length > 0) {
    const validGids = input.groupIds
      .map((g) => Number(g))
      .filter((n) => Number.isInteger(n) && n > 0);
    for (const gid of validGids) {
      const exists = db.select({ id: groups.id }).from(groups).where(eq(groups.id, gid)).get();
      if (exists) {
        db.insert(contactGroups)
          .values({ contactId: inserted.id, groupId: gid })
          .onConflictDoNothing()
          .run();
      }
    }
  }

  if (input.customFields) {
    for (const [templateIdStr, val] of Object.entries(input.customFields)) {
      const templateId = Number(templateIdStr);
      if (val && val.trim()) {
        db.insert(contactCustomFields)
          .values({ contactId: inserted.id, templateId, value: val.trim() })
          .onConflictDoUpdate({
            target: [contactCustomFields.contactId, contactCustomFields.templateId],
            set: { value: val.trim() },
          })
          .run();
      }
    }
  }

  if (input.importantDates && input.importantDates.length > 0) {
    for (const d of input.importantDates) {
      if (d.label?.trim() && d.date?.trim()) {
        db.insert(importantDates)
          .values({
            contactId: inserted.id,
            label: d.label.trim(),
            date: d.date.trim(),
            remindDaysBefore: d.remindDaysBefore ?? 7,
            createdAt: now,
          })
          .run();
      }
    }
  }

  logger.crud('CREATE', 'contact', {
    id: inserted.id,
    fullName: inserted.fullName,
    source: inserted.source,
    keepInTouch: inserted.keepInTouch,
  });

  return getContactById(inserted.id)!;
}

export function updateContact(
  id: number,
  updates: Partial<CreateContactInput> & {
    snoozedUntil?: string | null;
    pausedUntil?: string | null;
  }
) {
  const db = getDb();
  const existing = db.select().from(contacts).where(eq(contacts.id, id)).get();
  if (!existing) {
    throw new Error(`Contact ${id} not found`);
  }

  const updatePayload: Record<string, unknown> = {};
  if (updates.firstName !== undefined) updatePayload.firstName = updates.firstName?.trim() || null;
  if (updates.lastName !== undefined) updatePayload.lastName = updates.lastName?.trim() || null;
  if (updates.fullName !== undefined) {
    updatePayload.fullName = updates.fullName.trim();
    if (updates.firstName === undefined && updates.lastName === undefined) {
      const split = splitFullName(updates.fullName);
      updatePayload.firstName = split.firstName || null;
      updatePayload.lastName = split.lastName || null;
    }
  } else if (updates.firstName !== undefined || updates.lastName !== undefined) {
    const newFn = updates.firstName !== undefined ? updates.firstName?.trim() : existing.firstName;
    const newLn = updates.lastName !== undefined ? updates.lastName?.trim() : existing.lastName;
    updatePayload.fullName = [newFn, newLn].filter(Boolean).join(' ') || existing.fullName;
  }
  if (updates.phone !== undefined) updatePayload.phone = updates.phone?.trim() || null;
  if (updates.email !== undefined) updatePayload.email = updates.email?.trim() || null;
  if (updates.country !== undefined) updatePayload.country = updates.country?.trim() || null;
  if (updates.postalCode !== undefined) updatePayload.postalCode = updates.postalCode?.trim() || null;
  if (updates.company !== undefined) updatePayload.company = updates.company?.trim() || null;
  if (updates.jobTitle !== undefined) updatePayload.jobTitle = updates.jobTitle?.trim() || null;
  if (updates.pets !== undefined) updatePayload.pets = JSON.stringify(updates.pets);
  if (updates.birthday !== undefined) updatePayload.birthday = updates.birthday?.trim() || null;
  if (updates.significantDate !== undefined)
    updatePayload.significantDate = updates.significantDate?.trim() || null;
  if (updates.significantDateLabel !== undefined)
    updatePayload.significantDateLabel = updates.significantDateLabel?.trim() || null;
  if (updates.keepInTouch !== undefined) updatePayload.keepInTouch = Boolean(updates.keepInTouch);
  if (updates.customIntervalDays !== undefined)
    updatePayload.customIntervalDays = updates.customIntervalDays;
  if (updates.lastContactedAt !== undefined)
    updatePayload.lastContactedAt = updates.lastContactedAt;
  if (updates.snoozedUntil !== undefined) updatePayload.snoozedUntil = updates.snoozedUntil;
  if (updates.pausedUntil !== undefined) updatePayload.pausedUntil = updates.pausedUntil;
  if (updates.notes !== undefined) updatePayload.notes = updates.notes?.trim() || null;

  if (Object.keys(updatePayload).length > 0) {
    db.update(contacts).set(updatePayload).where(eq(contacts.id, id)).run();
  }

  if (updates.groupIds !== undefined) {
    db.delete(contactGroups).where(eq(contactGroups.contactId, id)).run();
    const validGids = (updates.groupIds || [])
      .map((g) => Number(g))
      .filter((n) => Number.isInteger(n) && n > 0);
    for (const gid of validGids) {
      const exists = db.select({ id: groups.id }).from(groups).where(eq(groups.id, gid)).get();
      if (exists) {
        db.insert(contactGroups)
          .values({ contactId: id, groupId: gid })
          .onConflictDoNothing()
          .run();
      }
    }
  }

  if (updates.customFields !== undefined) {
    for (const [templateIdStr, val] of Object.entries(updates.customFields)) {
      const templateId = Number(templateIdStr);
      if (val && val.trim()) {
        db.insert(contactCustomFields)
          .values({ contactId: id, templateId, value: val.trim() })
          .onConflictDoUpdate({
            target: [contactCustomFields.contactId, contactCustomFields.templateId],
            set: { value: val.trim() },
          })
          .run();
      }
    }
  }

  if (updates.importantDates !== undefined) {
    db.delete(importantDates).where(eq(importantDates.contactId, id)).run();
    for (const d of updates.importantDates) {
      if (d.label?.trim() && d.date?.trim()) {
        db.insert(importantDates)
          .values({
            contactId: id,
            label: d.label.trim(),
            date: d.date.trim(),
            remindDaysBefore: d.remindDaysBefore ?? 7,
            createdAt: new Date().toISOString(),
          })
          .run();
      }
    }
  }

  logger.crud('UPDATE', 'contact', { id, updatedFields: Object.keys(updates) });
  return getContactById(id)!;
}

export function deleteContact(id: number) {
  const db = getDb();
  const existing = db
    .select({
      googleResourceName: contacts.googleResourceName,
      fullName: contacts.fullName,
    })
    .from(contacts)
    .where(eq(contacts.id, id))
    .get();
  if (existing?.googleResourceName) {
    db.insert(googleSyncTombstones)
      .values({
        googleResourceName: existing.googleResourceName,
        contactName: existing.fullName || null,
        reason: 'deleted',
        targetContactId: null,
        createdAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: [googleSyncTombstones.googleResourceName],
        set: {
          reason: 'deleted',
          contactName: existing.fullName || null,
          targetContactId: null,
          createdAt: new Date().toISOString(),
        },
      })
      .run();
  }
  db.delete(contacts).where(eq(contacts.id, id)).run();
  logger.crud('DELETE', 'contact', { id });
}

export function listContactsWithDetails(referenceDate: Date = new Date()) {
  const db = getDb();
  const allContacts = db.select().from(contacts).all();
  const allGroups = db.select().from(groups).all();
  const allLinks = db.select().from(contactGroups).all();
  const allTopics = db.select().from(topics).all();
  const allCustomValues = db.select().from(contactCustomFields).all();
  const allDates = db.select().from(importantDates).all();
  const allTouchpoints = db.select().from(touchpoints).all();
  const settingsRow = db.select().from(settings).get();
  const globalPausedUntil = settingsRow?.globalPausedUntil || null;
  const cadenceFuzziness = {
    enabled: Boolean(settingsRow?.cadenceFuzzinessEnabled),
    percent: settingsRow?.cadenceFuzzinessPercent ?? 15,
  };

  const groupMap = new Map(allGroups.map((g) => [g.id, g]));

  return allContacts.map((c) => {
    const cGroups = allLinks
      .filter((l) => l.contactId === c.id)
      .map((l) => groupMap.get(l.groupId))
      .filter((g): g is NonNullable<typeof g> => Boolean(g));

    const cadence = evaluateContactCadence(
      {
        id: c.id,
        fullName: c.fullName,
        keepInTouch: c.keepInTouch,
        customIntervalDays: c.customIntervalDays,
        lastContactedAt: c.lastContactedAt,
        snoozedUntil: c.snoozedUntil,
        pausedUntil: c.pausedUntil,
        createdAt: c.createdAt,
        groups: cGroups,
      },
      referenceDate,
      globalPausedUntil,
      cadenceFuzziness
    );

    let parsedPets: string[] = [];
    try {
      parsedPets = JSON.parse(c.pets || '[]');
    } catch {
      parsedPets = [];
    }

    const contactTopics = allTopics.filter((t) => t.contactId === c.id);
    const customFieldMap: Record<number, string> = {};
    for (const cf of allCustomValues.filter((v) => v.contactId === c.id)) {
      customFieldMap[cf.templateId] = cf.value;
    }

    const contactTouchpoints = allTouchpoints
      .filter((tp) => tp.contactId === c.id)
      .sort((a, b) => b.contactedAt.localeCompare(a.contactedAt));
    const latestTp = contactTouchpoints[0] || null;
    const fn = c.firstName || splitFullName(c.fullName).firstName;
    const ln = c.lastName !== null && c.lastName !== undefined ? c.lastName : splitFullName(c.fullName).lastName;
    const full = c.fullName || [fn, ln].filter(Boolean).join(' ');

    return {
      ...c,
      firstName: fn,
      lastName: ln,
      fullName: full,
      pets: parsedPets,
      groups: cGroups,
      topics: contactTopics,
      importantDates: allDates.filter((d) => d.contactId === c.id),
      customFields: customFieldMap,
      lastTouchpoint: latestTp
        ? {
            method: latestTp.method,
            note: latestTp.note,
            contactedAt: latestTp.contactedAt,
          }
        : null,
      cadence,
    };
  });
}

export function getContactById(id: number, referenceDate: Date = new Date()) {
  const all = listContactsWithDetails(referenceDate);
  return all.find((c) => c.id === id) || null;
}

/**
 * Bulk Operations:
 * - assign_group / remove_group
 * - set_keep_in_touch
 * - set_custom_interval
 * - delete
 */
export function executeBulkContactOperation(input: {
  contactIds: number[];
  action:
    | 'assign_group'
    | 'remove_group'
    | 'enable_keep_in_touch'
    | 'disable_keep_in_touch'
    | 'set_custom_interval'
    | 'delete';
  groupId?: number;
  customIntervalDays?: number | null;
}) {
  const db = getDb();
  const { contactIds, action } = input;
  if (!contactIds.length) return { affected: 0 };

  if (action === 'enable_keep_in_touch' || action === 'disable_keep_in_touch') {
    const val = action === 'enable_keep_in_touch';
    db.update(contacts)
      .set({ keepInTouch: val })
      .where(inArray(contacts.id, contactIds))
      .run();
  } else if (action === 'set_custom_interval') {
    db.update(contacts)
      .set({ customIntervalDays: input.customIntervalDays ?? null })
      .where(inArray(contacts.id, contactIds))
      .run();
  } else if (action === 'assign_group' && input.groupId) {
    for (const cid of contactIds) {
      db.insert(contactGroups)
        .values({ contactId: cid, groupId: input.groupId })
        .onConflictDoNothing()
        .run();
    }
  } else if (action === 'remove_group' && input.groupId) {
    for (const cid of contactIds) {
      const links = db
        .select()
        .from(contactGroups)
        .where(eq(contactGroups.contactId, cid))
        .all();
      for (const l of links) {
        if (l.groupId === input.groupId) {
          db.delete(contactGroups).where(eq(contactGroups.id, l.id)).run();
        }
      }
    }
  } else if (action === 'delete') {
    const toDelete = db
      .select({ googleResourceName: contacts.googleResourceName })
      .from(contacts)
      .where(inArray(contacts.id, contactIds))
      .all();
    const now = new Date().toISOString();
    for (const row of toDelete) {
      if (row.googleResourceName) {
        db.insert(googleSyncTombstones)
          .values({
            googleResourceName: row.googleResourceName,
            reason: 'deleted',
            targetContactId: null,
            createdAt: now,
          })
          .onConflictDoNothing()
          .run();
      }
    }
    db.delete(contacts).where(inArray(contacts.id, contactIds)).run();
  }

  logger.crud('BULK', 'contacts', {
    action,
    count: contactIds.length,
    groupId: input.groupId,
    customIntervalDays: input.customIntervalDays,
  });

  return { affected: contactIds.length };
}

/**
 * Duplicate Detection:
 * Finds pairs of contacts that share the same normalized phone number, email, or normalized name.
 */
export interface DuplicatePair {
  contactA: ReturnType<typeof listContactsWithDetails>[number];
  contactB: ReturnType<typeof listContactsWithDetails>[number];
  reasons: string[];
}

export function detectDuplicateContacts(): DuplicatePair[] {
  const all = listContactsWithDetails();
  const pairs: DuplicatePair[] = [];

  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const b = all[j];
      const reasons: string[] = [];

      const nameA = a.fullName.trim().toLowerCase();
      const nameB = b.fullName.trim().toLowerCase();
      if (nameA && nameB && nameA === nameB) {
        reasons.push('Identical name');
      }

      const phoneA = normalizePhone(a.phone);
      const phoneB = normalizePhone(b.phone);
      if (phoneA.length >= 7 && phoneB.length >= 7) {
        // Match last 7 digits to catch local vs +country_code formats (e.g. 0541234567 vs +972541234567)
        if (phoneA.slice(-7) === phoneB.slice(-7)) {
          reasons.push('Matching phone number');
        }
      }

      const emailA = a.email?.trim().toLowerCase();
      const emailB = b.email?.trim().toLowerCase();
      if (emailA && emailB && emailA === emailB) {
        reasons.push('Identical email');
      }

      if (reasons.length > 0) {
        pairs.push({ contactA: a, contactB: b, reasons });
      }
    }
  }

  return pairs;
}

/**
 * Contact Merger:
 * Merges `secondaryId` into `primaryId`, combining groups, relationships, topics,
 * important dates, custom fields, and touchpoint history, then deletes `secondaryId`.
 * Records any merged Google `resourceName` in `google_sync_tombstones` so future
 * Google Contacts imports never re-import the merged duplicate.
 */
export function mergeContacts(
  primaryId: number,
  secondaryId: number,
  fieldOverrides?: Partial<{
    fullName: string;
    phone: string | null;
    email: string | null;
    company: string | null;
    jobTitle: string | null;
    birthday: string | null;
    notes: string | null;
  }>
) {
  if (primaryId === secondaryId) {
    throw new Error('Cannot merge a contact with itself');
  }

  const db = getDb();
  const primary = getContactById(primaryId);
  const secondary = getContactById(secondaryId);

  if (!primary || !secondary) {
    throw new Error('Both primary and secondary contacts must exist');
  }

  // Combine pets uniquely
  const combinedPets = Array.from(new Set([...primary.pets, ...secondary.pets]));

  // Keep most recent lastContactedAt
  let latestContactedAt = primary.lastContactedAt;
  if (
    secondary.lastContactedAt &&
    (!latestContactedAt || secondary.lastContactedAt > latestContactedAt)
  ) {
    latestContactedAt = secondary.lastContactedAt;
  }

  const keptResourceName = primary.googleResourceName || secondary.googleResourceName || null;

  // Clear secondary's googleResourceName first so unique index never collides if primary adopts it,
  // and record a tombstone if secondary had a distinct Google resourceName that was merged away.
  if (secondary.googleResourceName) {
    db.update(contacts)
      .set({ googleResourceName: null })
      .where(eq(contacts.id, secondaryId))
      .run();

    if (secondary.googleResourceName !== keptResourceName) {
      db.insert(googleSyncTombstones)
        .values({
          googleResourceName: secondary.googleResourceName,
          reason: 'merged',
          contactName: secondary.fullName || null,
          targetContactId: primaryId,
          createdAt: new Date().toISOString(),
        })
        .onConflictDoNothing()
        .run();
    }
  }

  // Re-point any previous tombstones that referenced secondaryId to primaryId
  db.update(googleSyncTombstones)
    .set({ targetContactId: primaryId })
    .where(eq(googleSyncTombstones.targetContactId, secondaryId))
    .run();

  db.update(contacts)
    .set({
      fullName: fieldOverrides?.fullName ?? primary.fullName,
      phone: fieldOverrides?.phone !== undefined ? fieldOverrides.phone : (primary.phone || secondary.phone),
      email: fieldOverrides?.email !== undefined ? fieldOverrides.email : (primary.email || secondary.email),
      company:
        fieldOverrides?.company !== undefined ? fieldOverrides.company : (primary.company || secondary.company),
      jobTitle:
        fieldOverrides?.jobTitle !== undefined ? fieldOverrides.jobTitle : (primary.jobTitle || secondary.jobTitle),
      birthday:
        fieldOverrides?.birthday !== undefined ? fieldOverrides.birthday : (primary.birthday || secondary.birthday),
      notes:
        fieldOverrides?.notes !== undefined
          ? fieldOverrides.notes
          : [primary.notes, secondary.notes].filter(Boolean).join('\n\n') || null,
      pets: JSON.stringify(combinedPets),
      keepInTouch: primary.keepInTouch || secondary.keepInTouch,
      customIntervalDays: primary.customIntervalDays ?? secondary.customIntervalDays,
      googleResourceName: keptResourceName,
      lastContactedAt: latestContactedAt,
    })
    .where(eq(contacts.id, primaryId))
    .run();

  // Re-assign groups
  const secGroups = db
    .select()
    .from(contactGroups)
    .where(eq(contactGroups.contactId, secondaryId))
    .all();
  for (const sg of secGroups) {
    db.insert(contactGroups)
      .values({ contactId: primaryId, groupId: sg.groupId })
      .onConflictDoNothing()
      .run();
  }

  // Re-assign topics, important dates, touchpoints
  db.update(topics).set({ contactId: primaryId }).where(eq(topics.contactId, secondaryId)).run();
  db.update(importantDates)
    .set({ contactId: primaryId })
    .where(eq(importantDates.contactId, secondaryId))
    .run();
  db.update(touchpoints)
    .set({ contactId: primaryId })
    .where(eq(touchpoints.contactId, secondaryId))
    .run();

  // Re-assign relationships
  db.update(relationships)
    .set({ contactAId: primaryId })
    .where(eq(relationships.contactAId, secondaryId))
    .run();
  db.update(relationships)
    .set({ contactBId: primaryId })
    .where(eq(relationships.contactBId, secondaryId))
    .run();

  // Re-assign custom fields if missing on primary
  const secCustom = db
    .select()
    .from(contactCustomFields)
    .where(eq(contactCustomFields.contactId, secondaryId))
    .all();
  for (const cf of secCustom) {
    db.insert(contactCustomFields)
      .values({ contactId: primaryId, templateId: cf.templateId, value: cf.value })
      .onConflictDoNothing()
      .run();
  }

  // Delete secondary contact
  db.delete(contacts).where(eq(contacts.id, secondaryId)).run();

  logger.crud('MERGE', 'contacts', { primaryId, secondaryId });
  return getContactById(primaryId)!;
}

/**
 * Groups & Custom Field Templates Management
 */
export function listGroups() {
  const db = getDb();
  const allGroups = db.select().from(groups).all();
  const allLinks = db.select().from(contactGroups).all();

  return allGroups.map((g) => ({
    ...g,
    memberCount: allLinks.filter((l) => l.groupId === g.id).length,
  }));
}

export function createGroup(input: {
  name: string;
  color?: string;
  intervalDays: number;
  pausedUntil?: string | null;
}) {
  const db = getDb();
  const inserted = db
    .insert(groups)
    .values({
      name: input.name.trim(),
      color: input.color || '#e85d3a',
      intervalDays: input.intervalDays,
      pausedUntil: input.pausedUntil || null,
      createdAt: new Date().toISOString(),
    })
    .returning()
    .get();

  logger.crud('CREATE', 'group', { id: inserted.id, name: inserted.name, intervalDays: inserted.intervalDays });
  return inserted;
}

export function updateGroup(
  id: number,
  updates: Partial<{ name: string; color: string; intervalDays: number; pausedUntil: string | null }>
) {
  const db = getDb();
  db.update(groups).set(updates).where(eq(groups.id, id)).run();
  logger.crud('UPDATE', 'group', { id, updates });
  return db.select().from(groups).where(eq(groups.id, id)).get();
}

export function deleteGroup(id: number) {
  const db = getDb();
  db.delete(groups).where(eq(groups.id, id)).run();
  logger.crud('DELETE', 'group', { id });
}

export function listCustomFieldTemplates() {
  const db = getDb();
  return db
    .select()
    .from(customFieldTemplates)
    .all()
    .map((t) => ({
      ...t,
      options: JSON.parse(t.options || '[]') as string[],
    }));
}

export function createCustomFieldTemplate(input: {
  name: string;
  fieldType: 'text' | 'date' | 'select' | 'url';
  options?: string[];
}) {
  const db = getDb();
  const inserted = db
    .insert(customFieldTemplates)
    .values({
      name: input.name.trim(),
      fieldType: input.fieldType,
      options: JSON.stringify(input.options || []),
      sortOrder: 0,
    })
    .returning()
    .get();

  logger.crud('CREATE', 'custom_field_template', { id: inserted.id, name: inserted.name });
  return inserted;
}
