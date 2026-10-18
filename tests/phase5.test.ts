import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, setTestDb } from '@/db';
import { registerOwnerAccount } from '@/lib/auth';
import { createContact, createGroup, listContactsWithDetails } from '@/lib/contacts-service';
import { addImportantDate, addTopic, logTouchpoint } from '@/lib/touchpoints-service';
import {
  generateIcalFeed,
  importVCardContent,
  exportContactsToVCard,
  exportFullBackupJson,
  restoreFromBackupJson,
  verifyIcalToken,
} from '@/lib/portability-service';

describe('Phase 5: iCal Feed, vCard (.vcf) Import/Export & Full JSON Backup/Restore', () => {
  beforeEach(() => {
    const { db, sqlite } = createDatabase(':memory:');
    setTestDb(db, sqlite);
  });

  it('imports and exports vCard (.vcf) contacts offline', () => {
    const sampleVcf = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:Maya Levi',
      'TEL;TYPE=CELL:+972549876543',
      'EMAIL:maya@wix.com',
      'ORG:Wix',
      'TITLE:Staff Engineer',
      'BDAY:1993-08-22',
      'END:VCARD',
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:Amit Katz',
      'TEL;TYPE=CELL:0521112233',
      'END:VCARD',
    ].join('\r\n');

    const { imported } = importVCardContent(sampleVcf);
    expect(imported).toBe(2);

    const all = listContactsWithDetails();
    expect(all.length).toBe(2);
    expect(all[0].source).toBe('vcard');
    expect(all[0].company).toBe('Wix');
    expect(all[0].jobTitle).toBe('Staff Engineer');

    const exportedVcf = exportContactsToVCard();
    expect(exportedVcf).toContain('FN:Maya Levi');
    expect(exportedVcf).toContain('ORG:Wix');
    expect(exportedVcf).toContain('FN:Amit Katz');
  });

  it('generates a private iCal (.ics) feed with due dates, birthdays, and important dates', () => {
    const { settings } = registerOwnerAccount({
      email: 'owner@touchpoint.local',
      username: 'owner',
      password: 'password123',
    });

    expect(verifyIcalToken(settings.icalSecretToken)).toBe(true);
    expect(verifyIcalToken('wrong-token')).toBe(false);

    const c = createContact({
      fullName: 'Dan Cohen',
      birthday: '1990-10-25',
      keepInTouch: true,
      customIntervalDays: 30,
      lastContactedAt: '2026-10-01T10:00:00Z',
    });

    addImportantDate({
      contactId: c.id,
      label: 'Wedding Anniversary',
      date: '11-12',
    });

    const ics = generateIcalFeed(new Date('2026-10-16T12:00:00Z'));
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('Reach out to Dan Cohen');
    expect(ics).toContain("Dan Cohen's Birthday");
    expect(ics).toContain('Dan Cohen: Wedding Anniversary');
  });

  it('exports a full JSON backup and restores all contacts, groups, topics, and touchpoints', () => {
    const group = createGroup({ name: 'Family', intervalDays: 7 });
    const contact = createContact({
      fullName: 'Mom',
      keepInTouch: true,
      pets: ['Miso (Cat)'],
      groupIds: [group.id],
    });
    addTopic(contact.id, 'Ask about holiday plans');
    logTouchpoint({
      contactId: contact.id,
      method: 'call',
      note: 'Weekly catch-up',
    });

    const backup = exportFullBackupJson();
    expect(backup.contacts.length).toBe(1);
    expect(backup.groups.length).toBe(1);
    expect(backup.topics.length).toBe(1);
    expect(backup.touchpoints.length).toBe(1);

    // Wipe database by initializing a fresh in-memory DB and restoring
    const { db: freshDb, sqlite: freshSqlite } = createDatabase(':memory:');
    setTestDb(freshDb, freshSqlite);
    expect(listContactsWithDetails().length).toBe(0);

    const restored = restoreFromBackupJson(backup);
    expect(restored.restoredContacts).toBe(1);

    const afterRestore = listContactsWithDetails();
    expect(afterRestore.length).toBe(1);
    expect(afterRestore[0].fullName).toBe('Mom');
    expect(afterRestore[0].pets).toEqual(['Miso (Cat)']);
    expect(afterRestore[0].groups[0].name).toBe('Family');
    expect(afterRestore[0].topics[0].content).toBe('Ask about holiday plans');
  });
});
