import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { setTestDb, createDatabase } from '@/db';
import {
  createContact,
  deleteContact,
  executeBulkContactOperation,
  mergeContacts,
  getContactById,
} from '@/lib/contacts-service';
import {
  listGoogleSyncTombstones,
  deleteGoogleSyncTombstone,
  deleteGoogleSyncTombstones,
} from '@/lib/google-sync';

describe('Archived Contacts & Google Sync Tombstones', () => {
  let sqlite: Database.Database;

  beforeEach(() => {
    const created = createDatabase(':memory:');
    sqlite = created.sqlite;
    setTestDb(created.db, sqlite);
  });

  afterEach(() => {
    setTestDb(null as any, null as any);
    try {
      sqlite.close();
    } catch {}
  });

  it('preserves name, phone, and email when deleting a contact with Google resource', () => {
    const contact = createContact({
      fullName: 'Sarah Connor',
      phone: '+1 555-0199',
      email: 'sarah@skynet-resistance.org',
      source: 'google',
      googleResourceName: 'people/c4235498556443569641',
    });

    expect(contact.id).toBeDefined();

    // Delete contact
    deleteContact(contact.id);

    // Verify contact was deleted from contacts table
    expect(getContactById(contact.id)).toBeNull();

    // Verify tombstone was recorded with all details
    const tombstones = listGoogleSyncTombstones();
    expect(tombstones).toHaveLength(1);
    expect(tombstones[0].googleResourceName).toBe('people/c4235498556443569641');
    expect(tombstones[0].reason).toBe('deleted');
    expect(tombstones[0].contactName).toBe('Sarah Connor');
    expect(tombstones[0].contactPhone).toBe('+1 555-0199');
    expect(tombstones[0].contactEmail).toBe('sarah@skynet-resistance.org');
  });

  it('preserves name, phone, and email during bulk deletion of Google contacts', () => {
    const c1 = createContact({
      fullName: 'John Connor',
      phone: '+1 555-0200',
      email: 'john@resistance.org',
      source: 'google',
      googleResourceName: 'people/c1111111111111111111',
    });
    const c2 = createContact({
      fullName: 'Kyle Reese',
      phone: '+1 555-0201',
      email: 'kyle@future.net',
      source: 'google',
      googleResourceName: 'people/c2222222222222222222',
    });

    // Bulk delete
    executeBulkContactOperation({ action: 'delete', contactIds: [c1.id, c2.id] });

    const tombstones = listGoogleSyncTombstones();
    expect(tombstones).toHaveLength(2);

    const johnTombstone = tombstones.find((t) => t.googleResourceName === 'people/c1111111111111111111');
    expect(johnTombstone).toBeDefined();
    expect(johnTombstone?.contactName).toBe('John Connor');
    expect(johnTombstone?.contactPhone).toBe('+1 555-0200');
    expect(johnTombstone?.contactEmail).toBe('john@resistance.org');
    expect(johnTombstone?.reason).toBe('deleted');

    const kyleTombstone = tombstones.find((t) => t.googleResourceName === 'people/c2222222222222222222');
    expect(kyleTombstone).toBeDefined();
    expect(kyleTombstone?.contactName).toBe('Kyle Reese');
    expect(kyleTombstone?.contactPhone).toBe('+1 555-0201');
    expect(kyleTombstone?.contactEmail).toBe('kyle@future.net');
  });

  it('preserves secondary contact details and sets targetContactId when merging contacts', () => {
    const primary = createContact({
      fullName: 'Primary Alexander',
      phone: '+1 555-0300',
      email: 'alex@primary.com',
      source: 'google',
      googleResourceName: 'people/primary_resource_1',
    });
    const secondary = createContact({
      fullName: 'Duplicate Alex',
      phone: '+1 555-0399',
      email: 'alex.dup@secondary.com',
      source: 'google',
      googleResourceName: 'people/secondary_resource_2',
    });

    // Merge secondary into primary
    mergeContacts(primary.id, secondary.id);

    // Verify secondary contact tombstone
    const tombstones = listGoogleSyncTombstones();
    expect(tombstones).toHaveLength(1);
    expect(tombstones[0].googleResourceName).toBe('people/secondary_resource_2');
    expect(tombstones[0].reason).toBe('merged');
    expect(tombstones[0].contactName).toBe('Duplicate Alex');
    expect(tombstones[0].contactPhone).toBe('+1 555-0399');
    expect(tombstones[0].contactEmail).toBe('alex.dup@secondary.com');
    expect(tombstones[0].targetContactId).toBe(primary.id);
    expect(tombstones[0].targetContactName).toBe('Primary Alexander');
  });

  it('supports unblocking individual tombstones and bulk unblocking', () => {
    const c1 = createContact({
      fullName: 'Contact 1',
      source: 'google',
      googleResourceName: 'people/res_1',
    });
    const c2 = createContact({
      fullName: 'Contact 2',
      source: 'google',
      googleResourceName: 'people/res_2',
    });
    const c3 = createContact({
      fullName: 'Contact 3',
      source: 'google',
      googleResourceName: 'people/res_3',
    });

    deleteContact(c1.id);
    deleteContact(c2.id);
    deleteContact(c3.id);

    let tombstones = listGoogleSyncTombstones();
    expect(tombstones).toHaveLength(3);

    // Single unblock
    const unblockedSingle = deleteGoogleSyncTombstone(tombstones[0].id);
    expect(unblockedSingle).toBe(true);

    tombstones = listGoogleSyncTombstones();
    expect(tombstones).toHaveLength(2);

    // Bulk unblock
    const unblockedBulkCount = deleteGoogleSyncTombstones(tombstones.map((t) => t.id));
    expect(unblockedBulkCount).toBe(2);

    tombstones = listGoogleSyncTombstones();
    expect(tombstones).toHaveLength(0);
  });
});
