import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { createDatabase, setTestDb, getDb, runWithUser } from '@/db';
import * as schema from '@/db/schema';
import { settings, contacts, groups, contactGroups } from '@/db/schema';
import { createContact, createGroup, listContactsWithDetails } from '@/lib/contacts-service';
import {
  exportFullBackupJson,
  restoreFromBackupJson,
  importSqliteDatabase,
  wipeAllData,
} from '@/lib/portability-service';
import { POST, GET } from '@/app/api/backup/route';
import { PATCH, GET as getSettings } from '@/app/api/settings/route';
import { UIProvider, useUI, TouchpointProvider } from '@/context';
import { SettingsView } from '@/components/views/SettingsView';

describe('Features V3: ?tab= on mount, Daily Notification Custom Time, and SQLite .db Import', () => {
  let tempFiles: string[] = [];

  beforeEach(() => {
    const { db, sqlite } = createDatabase(':memory:');
    setTestDb(db, sqlite);
  });

  afterEach(() => {
    for (const f of tempFiles) {
      if (fs.existsSync(f)) {
        try {
          fs.unlinkSync(f);
        } catch {
          // ignore
        }
      }
    }
    tempFiles = [];
    if (typeof window !== 'undefined') {
      delete (window as any).location;
    }
  });

  // =========================================================================
  // 1. Frontend ?tab= Support on Mount
  // =========================================================================
  describe('Frontend ?tab= on mount', () => {
    it('initializes activeTab to settings when window.location.search has ?tab=settings', () => {
      let capturedTab = '';
      function Probe() {
        const ui = useUI();
        capturedTab = ui.activeTab;
        return <div>{ui.activeTab}</div>;
      }

      // Mock window.location
      (global as any).window = {
        location: {
          search: '?tab=settings',
          pathname: '/',
          origin: 'http://localhost:3000',
        },
        addEventListener: () => {},
        removeEventListener: () => {},
      };

      renderToString(
        <UIProvider>
          <Probe />
        </UIProvider>
      );

      expect(capturedTab).toBe('settings');
    });

    it('initializes activeTab to contacts when ?tab=contacts', () => {
      let capturedTab = '';
      function Probe() {
        const ui = useUI();
        capturedTab = ui.activeTab;
        return <div>{ui.activeTab}</div>;
      }

      (global as any).window = {
        location: {
          search: '?tab=contacts',
          pathname: '/',
          origin: 'http://localhost:3000',
        },
        addEventListener: () => {},
        removeEventListener: () => {},
      };

      renderToString(
        <UIProvider>
          <Probe />
        </UIProvider>
      );

      expect(capturedTab).toBe('contacts');
    });

    it('falls back to dashboard when ?tab= is missing or invalid', () => {
      let capturedTab = '';
      function Probe() {
        const ui = useUI();
        capturedTab = ui.activeTab;
        return <div>{ui.activeTab}</div>;
      }

      (global as any).window = {
        location: {
          search: '?tab=unknown_nonexistent_tab',
          pathname: '/',
          origin: 'http://localhost:3000',
        },
        addEventListener: () => {},
        removeEventListener: () => {},
      };

      renderToString(
        <UIProvider>
          <Probe />
        </UIProvider>
      );

      expect(capturedTab).toBe('dashboard');
    });
  });

  // =========================================================================
  // 2. Custom Time Configuration for Daily Notification Schedule
  // =========================================================================
  describe('Custom Time Configuration for Daily Notification Schedule', () => {
    it('persists custom dailyDigestTime (e.g. 14:35) via settings PATCH API', async () => {
      const patchReq = new Request('http://localhost:3000/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-touchpoint-user-id': '1' },
        body: JSON.stringify({
          dailyDigestEnabled: true,
          dailyDigestTime: '14:35',
          timezone: 'America/New_York',
        }),
      });

      const patchRes = await PATCH(patchReq);
      expect(patchRes.status).toBe(200);
      const data = await patchRes.json();
      expect(data.settings.dailyDigestTime).toBe('14:35');
      expect(data.settings.timezone).toBe('America/New_York');

      const getReq = new Request('http://localhost:3000/api/settings', {
        headers: { 'x-touchpoint-user-id': '1' },
      });
      const getRes = await getSettings(getReq);
      const fetched = await getRes.json();
      expect(fetched.settings.dailyDigestTime).toBe('14:35');
    });

    it('renders custom daily briefing time and preset buttons in SettingsView when Section 2 is open', () => {
      const html = renderToString(
        <TouchpointProvider initialOpenSettingsSection={2}>
          <SettingsView />
        </TouchpointProvider>
      );

      // Verify the Daily Notification Schedule section header and elements
      expect(html).toContain('Daily Notification Schedule');
      expect(html).toContain('Daily Morning Briefing Time (Local Time)');
      expect(html).toContain('id="daily-digest-time"');
      expect(html).toContain('type="time"');
      expect(html).toContain('Presets:');
      expect(html).toContain('07:00 Early');
      expect(html).toContain('08:00 Morning');
      expect(html).toContain('09:00 Default');
      expect(html).toContain('10:00 Late');
      expect(html).toContain('Custom');
    });
  });

  // =========================================================================
  // 3. Settings in Full Backups & SQLite .db File Import
  // =========================================================================
  describe('Full Backup Settings Inclusion & SQLite .db File Import', () => {
    it('includes settings in exportFullBackupJson and restores settings via restoreFromBackupJson', async () => {
      // Configure specific non-default settings
      const db = getDb();
      const existing = db.select().from(settings).get();
      if (existing) {
        db.update(settings)
          .set({
            dailyDigestTime: '06:45',
            timezone: 'Asia/Tokyo',
            dateFormat: 'YYYY-MM-DD',
            maxDailyDue: 5,
          })
          .where(eq(settings.id, existing.id))
          .run();
      } else {
        db.insert(settings)
          .values({
            dailyDigestTime: '06:45',
            timezone: 'Asia/Tokyo',
            dateFormat: 'YYYY-MM-DD',
            maxDailyDue: 5,
            icalSecretToken: 'tok_test',
          })
          .run();
      }

      createGroup({ name: 'Backup Test Group', intervalDays: 14 });
      createContact({ fullName: 'Test Backup Contact' });

      // Export full backup
      const backup = exportFullBackupJson();
      expect(backup.settings).toBeDefined();
      expect(backup.settings.length).toBe(1);
      expect(backup.settings[0].dailyDigestTime).toBe('06:45');
      expect(backup.settings[0].timezone).toBe('Asia/Tokyo');
      expect(backup.settings[0].dateFormat).toBe('YYYY-MM-DD');

      // Wipe data and change settings to defaults
      wipeAllData();
      const currentBeforeRestore = db.select().from(settings).get();
      db.update(settings)
        .set({ dailyDigestTime: '09:00', timezone: 'UTC' })
        .where(eq(settings.id, currentBeforeRestore!.id))
        .run();

      expect(listContactsWithDetails().length).toBe(0);
      expect(db.select().from(settings).get()?.dailyDigestTime).toBe('09:00');

      // Restore
      const restoreRes = restoreFromBackupJson(backup);
      expect(restoreRes.restoredContacts).toBe(1);

      // Verify restored settings
      const restoredSettings = db.select().from(settings).get();
      expect(restoredSettings?.dailyDigestTime).toBe('06:45');
      expect(restoredSettings?.timezone).toBe('Asia/Tokyo');
      expect(restoredSettings?.dateFormat).toBe('YYYY-MM-DD');
      expect(listContactsWithDetails()[0].fullName).toBe('Test Backup Contact');
    });

    it('imports an SQLite .db file from filesystem path', () => {
      // 1. Create a standalone SQLite DB file with some contacts and settings
      const tempDbPath = path.join(os.tmpdir(), `test_source_${Date.now()}.db`);
      tempFiles.push(tempDbPath);

      const sourceSqlite = new Database(tempDbPath);
      sourceSqlite.exec(`
        CREATE TABLE contacts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source TEXT NOT NULL DEFAULT 'local',
          full_name TEXT NOT NULL,
          first_name TEXT,
          last_name TEXT,
          keep_in_touch INTEGER NOT NULL DEFAULT 1,
          custom_interval_days INTEGER,
          archived INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE groups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          color TEXT NOT NULL DEFAULT '#e85d3a',
          interval_days INTEGER NOT NULL DEFAULT 30,
          created_at TEXT NOT NULL
        );
        CREATE TABLE settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timezone TEXT NOT NULL DEFAULT 'Europe/Paris',
          daily_digest_time TEXT NOT NULL DEFAULT '08:15',
          date_format TEXT NOT NULL DEFAULT 'DD.MM.YYYY',
          ical_secret_token TEXT NOT NULL DEFAULT 'tok_123'
        );
        INSERT INTO contacts (id, full_name, created_at, updated_at) VALUES (1, 'Pierre Dupont', '2026-10-01', '2026-10-01');
        INSERT INTO groups (id, name, created_at) VALUES (1, 'Paris Circle', '2026-10-01');
        INSERT INTO settings (id, timezone, daily_digest_time, date_format, ical_secret_token) VALUES (1, 'Europe/Paris', '08:15', 'DD.MM.YYYY', 'tok_123');
      `);
      sourceSqlite.close();

      // Wipe current DB
      wipeAllData();
      expect(listContactsWithDetails().length).toBe(0);

      // Import SQLite database file
      const result = importSqliteDatabase(tempDbPath);
      expect(result.restoredContacts).toBe(1);
      expect(result.importedTables).toContain('contacts');
      expect(result.importedTables).toContain('groups');
      expect(result.importedTables).toContain('settings');

      // Verify restored data
      const contactsAfter = listContactsWithDetails();
      expect(contactsAfter.length).toBe(1);
      expect(contactsAfter[0].fullName).toBe('Pierre Dupont');

      const db = getDb();
      const currentCfg = db.select().from(settings).get();
      expect(currentCfg?.timezone).toBe('Europe/Paris');
      expect(currentCfg?.dailyDigestTime).toBe('08:15');
    });

    it('imports an SQLite .db from a binary Buffer', () => {
      const tempDbPath = path.join(os.tmpdir(), `test_buf_${Date.now()}.db`);
      tempFiles.push(tempDbPath);

      const sourceSqlite = new Database(tempDbPath);
      sourceSqlite.exec(`
        CREATE TABLE contacts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source TEXT NOT NULL DEFAULT 'local',
          full_name TEXT NOT NULL,
          keep_in_touch INTEGER NOT NULL DEFAULT 1,
          archived INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        INSERT INTO contacts (id, full_name, created_at, updated_at) VALUES (1, 'Buffer Contact', '2026-10-01', '2026-10-01');
      `);
      sourceSqlite.close();

      const buffer = fs.readFileSync(tempDbPath);

      wipeAllData();
      expect(listContactsWithDetails().length).toBe(0);

      const result = importSqliteDatabase(buffer);
      expect(result.restoredContacts).toBe(1);

      const contactsAfter = listContactsWithDetails();
      expect(contactsAfter.length).toBe(1);
      expect(contactsAfter[0].fullName).toBe('Buffer Contact');
    });

    it('rejects invalid or non-SQLite files cleanly', () => {
      const invalidBuffer = Buffer.from('This is not a SQLite database file at all');
      expect(() => importSqliteDatabase(invalidBuffer)).toThrow(
        'Invalid SQLite database file: header does not match SQLite format 3'
      );
    });

    it('handles multipart/form-data .db file upload in POST /api/backup', async () => {
      const tempDbPath = path.join(os.tmpdir(), `test_upload_${Date.now()}.db`);
      tempFiles.push(tempDbPath);

      const sourceSqlite = new Database(tempDbPath);
      sourceSqlite.exec(`
        CREATE TABLE contacts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source TEXT NOT NULL DEFAULT 'local',
          full_name TEXT NOT NULL,
          keep_in_touch INTEGER NOT NULL DEFAULT 1,
          archived INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        INSERT INTO contacts (id, full_name, created_at, updated_at) VALUES (1, 'Uploaded Multipart Contact', '2026-10-01', '2026-10-01');
      `);
      sourceSqlite.close();

      const buffer = fs.readFileSync(tempDbPath);
      const file = new File([buffer], 'touchpoint-snapshot.db', { type: 'application/x-sqlite3' });

      const formData = new FormData();
      formData.append('file', file);

      const req = new Request('http://localhost:3000/api/backup', {
        method: 'POST',
        headers: { 'x-touchpoint-user-id': '1' },
        body: formData,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.restoredContacts).toBe(1);

      const all = listContactsWithDetails();
      expect(all.length).toBe(1);
      expect(all[0].fullName).toBe('Uploaded Multipart Contact');
    });

    it('handles JSON base64 sqlite payload in POST /api/backup', async () => {
      const tempDbPath = path.join(os.tmpdir(), `test_json_b64_${Date.now()}.db`);
      tempFiles.push(tempDbPath);

      const sourceSqlite = new Database(tempDbPath);
      sourceSqlite.exec(`
        CREATE TABLE contacts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source TEXT NOT NULL DEFAULT 'local',
          full_name TEXT NOT NULL,
          keep_in_touch INTEGER NOT NULL DEFAULT 1,
          archived INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        INSERT INTO contacts (id, full_name, created_at, updated_at) VALUES (1, 'Base64 Contact', '2026-10-01', '2026-10-01');
      `);
      sourceSqlite.close();

      const buffer = fs.readFileSync(tempDbPath);
      const base64Data = buffer.toString('base64');

      const req = new Request('http://localhost:3000/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-touchpoint-user-id': '1' },
        body: JSON.stringify({ type: 'sqlite', data: base64Data }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.restoredContacts).toBe(1);

      const all = listContactsWithDetails();
      expect(all.length).toBe(1);
      expect(all[0].fullName).toBe('Base64 Contact');
    });
  });
});
