import ical from 'ical-generator';
import { getDb, getAuthDb, getUserDb } from '@/db';
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
  users,
} from '@/db/schema';
import { listContactsWithDetails, splitFullName } from '@/lib/contacts-service';
import { logger } from '@/lib/logger';

/**
 * Generates a private iCal (.ics) calendar feed containing:
 * - Upcoming due dates for active "Keep in Touch" contacts
 * - Birthdays
 * - Custom Important Dates
 */
export function generateIcalFeed(referenceDate: Date = new Date()): string {
  const cal = ical({
    name: 'Touchpoint — Contact Reminders & Dates',
    prodId: { company: 'Touchpoint', product: 'SelfHosted-PRM' },
  });

  const allContacts = listContactsWithDetails(referenceDate);
  const currentYear = referenceDate.getUTCFullYear();

  for (const c of allContacts) {
    if (c.keepInTouch && c.cadence.status !== 'paused' && c.cadence.nextDueDate) {
      const dueDate = new Date(`${c.cadence.nextDueDate}T09:00:00Z`);
      cal.createEvent({
        start: dueDate,
        allDay: true,
        summary: `📞 Reach out to ${c.fullName}`,
        description: `Touchpoint cadence reminder (${c.cadence.effectiveIntervalDays}d interval).`,
      });
    }

    if (c.birthday) {
      const parts = c.birthday.split('-');
      const month = Number(parts.length === 3 ? parts[1] : parts[0]);
      const day = Number(parts.length === 3 ? parts[2] : parts[1]);
      if (month && day) {
        const bdayDate = new Date(Date.UTC(currentYear, month - 1, day, 9, 0, 0));
        cal.createEvent({
          start: bdayDate,
          allDay: true,
          summary: `🎂 ${c.fullName}'s Birthday`,
          description: `Birthday reminder from Touchpoint.`,
        });
      }
    }

    for (const imp of c.importantDates) {
      const parts = imp.date.split('-');
      const month = Number(parts.length === 3 ? parts[1] : parts[0]);
      const day = Number(parts.length === 3 ? parts[2] : parts[1]);
      if (month && day) {
        const impDate = new Date(Date.UTC(currentYear, month - 1, day, 9, 0, 0));
        cal.createEvent({
          start: impDate,
          allDay: true,
          summary: `📅 ${c.fullName}: ${imp.label}`,
          description: `Important date from Touchpoint.`,
        });
      }
    }
  }

  return cal.toString();
}

/**
 * Offline vCard (.vcf) Parser & Importer (Additive)
 */
export function importVCardContent(vcfText: string): { imported: number } {
  const db = getDb();
  const blocks = vcfText.split(/BEGIN:VCARD/i).slice(1);
  let imported = 0;
  const now = new Date().toISOString();

  for (const rawBlock of blocks) {
    const block = rawBlock.split(/END:VCARD/i)[0] || '';
    const lines = block.split(/\r?\n/);

    let fullName = '';
    let phone: string | null = null;
    let email: string | null = null;
    let company: string | null = null;
    let jobTitle: string | null = null;
    let birthday: string | null = null;

    for (const line of lines) {
      if (/^FN[;:]/i.test(line)) {
        fullName = line.split(':').slice(1).join(':').trim();
      } else if (/^TEL[;:]/i.test(line) && !phone) {
        phone = line.split(':').slice(1).join(':').trim();
      } else if (/^EMAIL[;:]/i.test(line) && !email) {
        email = line.split(':').slice(1).join(':').trim();
      } else if (/^ORG[;:]/i.test(line)) {
        company = line.split(':').slice(1).join(':').replace(/;/g, ' ').trim();
      } else if (/^TITLE[;:]/i.test(line)) {
        jobTitle = line.split(':').slice(1).join(':').trim();
      } else if (/^BDAY[;:]/i.test(line)) {
        birthday = line.split(':').slice(1).join(':').trim();
      }
    }

    if (!fullName) continue;

    const { firstName, lastName } = splitFullName(fullName);
    db.insert(contacts)
      .values({
        source: 'vcard',
        firstName: firstName || null,
        lastName: lastName || null,
        fullName,
        phone,
        email,
        company,
        jobTitle,
        pets: '[]',
        birthday,
        keepInTouch: false,
        createdAt: now,
      })
      .run();
    imported++;
  }

  logger.crud('CREATE', 'vcard_import', { imported });
  return { imported };
}

export function exportContactsToVCard(): string {
  const all = listContactsWithDetails();
  const cards = all.map((c) => {
    const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${c.fullName}`];
    if (c.phone) lines.push(`TEL;TYPE=CELL:${c.phone}`);
    if (c.email) lines.push(`EMAIL:${c.email}`);
    if (c.company) lines.push(`ORG:${c.company}`);
    if (c.jobTitle) lines.push(`TITLE:${c.jobTitle}`);
    if (c.birthday) lines.push(`BDAY:${c.birthday}`);
    lines.push('END:VCARD');
    return lines.join('\r\n');
  });
  return cards.join('\r\n');
}

/**
 * Single-File Full JSON Backup Export & Restore
 */
export function exportFullBackupJson() {
  const db = getDb();
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    contacts: db.select().from(contacts).all(),
    groups: db.select().from(groups).all(),
    contactGroups: db.select().from(contactGroups).all(),
    relationships: db.select().from(relationships).all(),
    topics: db.select().from(topics).all(),
    importantDates: db.select().from(importantDates).all(),
    customFieldTemplates: db.select().from(customFieldTemplates).all(),
    contactCustomFields: db.select().from(contactCustomFields).all(),
    touchpoints: db.select().from(touchpoints).all(),
  };

  logger.info('backup.export', 'Exported full Touchpoint JSON backup', {
    contacts: payload.contacts.length,
    groups: payload.groups.length,
    touchpoints: payload.touchpoints.length,
  });

  return payload;
}

export function restoreFromBackupJson(payload: ReturnType<typeof exportFullBackupJson>) {
  const db = getDb();

  db.delete(contactCustomFields).run();
  db.delete(customFieldTemplates).run();
  db.delete(touchpoints).run();
  db.delete(importantDates).run();
  db.delete(topics).run();
  db.delete(relationships).run();
  db.delete(contactGroups).run();
  db.delete(groups).run();
  db.delete(contacts).run();

  if (payload.contacts?.length) db.insert(contacts).values(payload.contacts).run();
  if (payload.groups?.length) db.insert(groups).values(payload.groups).run();
  if (payload.contactGroups?.length) db.insert(contactGroups).values(payload.contactGroups).run();
  if (payload.relationships?.length) db.insert(relationships).values(payload.relationships).run();
  if (payload.topics?.length) db.insert(topics).values(payload.topics).run();
  if (payload.importantDates?.length) db.insert(importantDates).values(payload.importantDates).run();
  if (payload.customFieldTemplates?.length)
    db.insert(customFieldTemplates).values(payload.customFieldTemplates).run();
  if (payload.contactCustomFields?.length)
    db.insert(contactCustomFields).values(payload.contactCustomFields).run();
  if (payload.touchpoints?.length) db.insert(touchpoints).values(payload.touchpoints).run();

  logger.info('backup.restore', 'Restored Touchpoint database from JSON backup', {
    contacts: payload.contacts?.length || 0,
  });

  return { restoredContacts: payload.contacts?.length || 0 };
}

export function findUserIdByIcalToken(token: string): number | null {
  if (!token) return null;
  const db1 = getDb();
  const cfg1 = db1.select().from(settings).get();
  if (cfg1 && cfg1.icalSecretToken === token) {
    return cfg1.ownerUserId || 1;
  }

  try {
    const authDb = getAuthDb();
    const allUsers = authDb.select().from(users).all();
    for (const u of allUsers) {
      const uDb = getUserDb(u.id).db;
      const uCfg = uDb.select().from(settings).get();
      if (uCfg && uCfg.icalSecretToken === token) {
        return u.id;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

export function verifyIcalToken(token: string): boolean {
  return findUserIdByIcalToken(token) !== null;
}

export function wipeAllData(): { deleted: boolean } {
  const db = getDb();
  db.delete(contactCustomFields).run();
  db.delete(customFieldTemplates).run();
  db.delete(touchpoints).run();
  db.delete(importantDates).run();
  db.delete(topics).run();
  db.delete(relationships).run();
  db.delete(contactGroups).run();
  db.delete(contacts).run();
  db.delete(groups).run();
  logger.warn('data.wipe', 'All contacts, groups, touchpoints, topics, and relationships permanently deleted');
  return { deleted: true };
}
