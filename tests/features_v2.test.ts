import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/db/schema';
import { setTestDb } from '@/db';
import {
  checkRateLimit,
  recordFailedAttempt,
  clearAllRateLimits,
  resetRateLimit,
} from '@/lib/rate-limiter';
import {
  generateTotpSecret,
  generateTotp,
  verifyTotp,
  generateBackupCodes,
  hashCode,
  verifyAndConsumeBackupCode,
} from '@/lib/totp';
import {
  initFtsTable,
  indexContactInFts,
  searchContactsFts,
} from '@/lib/search-service';
import {
  createDatabaseSnapshot,
  listDatabaseSnapshots,
  enforceBackupRetention,
} from '@/lib/backup-rotator';
import { getDormantContacts, getSerendipitySuggestion } from '@/lib/serendipity';
import path from 'path';
import fs from 'fs';
import os from 'os';

describe('Advanced Features V2 Test Suite', () => {
  describe('1. Rate Limiting', () => {
    beforeEach(() => {
      clearAllRateLimits();
    });

    it('allows requests within threshold and blocks requests over threshold', () => {
      const ip = '192.168.1.50';
      const action = 'login';
      const maxAttempts = 3;
      const windowMs = 5000;

      // 1st attempt: 0 failed records
      const res1 = checkRateLimit(ip, action, maxAttempts, windowMs);
      expect(res1.allowed).toBe(true);
      expect(res1.remaining).toBe(3);
      recordFailedAttempt(ip, action);

      // 2nd attempt: 1 failed record
      const res2 = checkRateLimit(ip, action, maxAttempts, windowMs);
      expect(res2.allowed).toBe(true);
      expect(res2.remaining).toBe(2);
      recordFailedAttempt(ip, action);

      // 3rd attempt: 2 failed records
      const res3 = checkRateLimit(ip, action, maxAttempts, windowMs);
      expect(res3.allowed).toBe(true);
      expect(res3.remaining).toBe(1);
      recordFailedAttempt(ip, action);

      // 4th attempt: 3 failed records, limit hit
      const res4 = checkRateLimit(ip, action, maxAttempts, windowMs);
      expect(res4.allowed).toBe(false);
      expect(res4.remaining).toBe(0);
      expect(res4.retryAfterSeconds).toBeGreaterThanOrEqual(1);

      // Resetting on successful login clears the lockout
      resetRateLimit(ip, action);
      const res5 = checkRateLimit(ip, action, maxAttempts, windowMs);
      expect(res5.allowed).toBe(true);
      expect(res5.remaining).toBe(3);
    });

    it('isolates different client IPs', () => {
      const action = 'login';
      recordFailedAttempt('client-A', action);
      recordFailedAttempt('client-A', action);

      const resA = checkRateLimit('client-A', action, 2, 5000);
      expect(resA.allowed).toBe(false);

      const resB = checkRateLimit('client-B', action, 2, 5000);
      expect(resB.allowed).toBe(true);
      expect(resB.remaining).toBe(2);
    });
  });

  describe('2. Two-Factor Authentication (TOTP & Backup Codes)', () => {
    it('generates valid RFC 6238 secret, otpauth URL, and QR code', async () => {
      const { secret, otpauthUrl, qrDataUrl } = await generateTotpSecret('alice@example.com');
      expect(secret).toBeDefined();
      expect(secret.length).toBeGreaterThanOrEqual(16);
      expect(otpauthUrl).toContain('otpauth://totp/Touchpoint:alice%40example.com');
      expect(otpauthUrl).toContain(`secret=${secret}`);
      expect(qrDataUrl).toMatch(/^data:image\/png;base64,/);
    });

    it('verifies valid TOTP codes across ±1 time window step', async () => {
      const { secret } = await generateTotpSecret('bob@example.com');
      const now = Date.now();
      const codeNow = generateTotp(secret, now);

      expect(codeNow).toHaveLength(6);
      expect(verifyTotp(secret, codeNow, 1, now)).toBe(true);

      // Valid in past window step (-30s)
      const codePast = generateTotp(secret, now - 30_000);
      expect(verifyTotp(secret, codePast, 1, now)).toBe(true);

      // Valid in future window step (+30s)
      const codeFuture = generateTotp(secret, now + 30_000);
      expect(verifyTotp(secret, codeFuture, 1, now)).toBe(true);

      // Rejects invalid code
      expect(verifyTotp(secret, '000000', 1, now)).toBe(false);
    });

    it('generates, hashes, and consumes one-time backup codes', () => {
      const { plaintextCodes, hashedCodes } = generateBackupCodes(5);
      expect(plaintextCodes).toHaveLength(5);
      expect(hashedCodes).toHaveLength(5);

      plaintextCodes.forEach((code) => {
        expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      });

      const jsonString = JSON.stringify(hashedCodes);

      // Verify and consume first code
      const result1 = verifyAndConsumeBackupCode(plaintextCodes[0], jsonString);
      expect(result1.valid).toBe(true);

      const remainingParsed = JSON.parse(result1.remainingHashedCodesJson);
      expect(remainingParsed).toHaveLength(4);

      // Second attempt with same code fails
      const result2 = verifyAndConsumeBackupCode(plaintextCodes[0], result1.remainingHashedCodesJson);
      expect(result2.valid).toBe(false);

      // Wrong code fails
      const result3 = verifyAndConsumeBackupCode('XXXX-YYYY', result1.remainingHashedCodesJson);
      expect(result3.valid).toBe(false);
    });
  });

  describe('3. SQLite FTS5 Full-Text Search', () => {
    let sqlite: Database.Database;

    beforeEach(() => {
      sqlite = new Database(':memory:');
      sqlite.pragma('foreign_keys = ON');

      sqlite.exec(`
        CREATE TABLE contacts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source TEXT NOT NULL DEFAULT 'local',
          google_resource_name TEXT,
          first_name TEXT,
          last_name TEXT,
          full_name TEXT NOT NULL,
          phone TEXT,
          email TEXT,
          company TEXT,
          job_title TEXT,
          pets TEXT NOT NULL DEFAULT '[]',
          country TEXT,
          postal_code TEXT,
          birthday TEXT,
          significant_date TEXT,
          significant_date_label TEXT,
          keep_in_touch INTEGER NOT NULL DEFAULT 0,
          custom_interval_days INTEGER,
          last_contacted_at TEXT,
          next_due_at TEXT,
          snoozed_until TEXT,
          paused_until TEXT,
          notes TEXT,
          created_at TEXT NOT NULL
        );
        CREATE TABLE groups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          color TEXT NOT NULL DEFAULT '#e85d3a',
          interval_days INTEGER NOT NULL DEFAULT 30,
          paused_until TEXT,
          created_at TEXT NOT NULL
        );
        CREATE TABLE contact_groups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
          group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE
        );
        CREATE TABLE topics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          is_completed INTEGER NOT NULL DEFAULT 0,
          completed_at TEXT,
          created_at TEXT NOT NULL
        );
        CREATE TABLE touchpoints (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
          contacted_at TEXT NOT NULL,
          method TEXT NOT NULL DEFAULT 'call',
          note TEXT,
          created_at TEXT NOT NULL
        );
      `);

      const drizzleDb = drizzle(sqlite, { schema });
      setTestDb(drizzleDb, sqlite);
      initFtsTable();
    });

    afterEach(() => {
      setTestDb(null as any, null as any);
      sqlite.close();
    });

    it('indexes contacts and searches across name, notes, topics, and touchpoints', () => {
      // Insert contact 1: Sarah Connor
      sqlite.prepare(`
        INSERT INTO contacts (id, full_name, company, job_title, notes, created_at)
        VALUES (1, 'Sarah Connor', 'Cyberdyne Systems', 'Security Director', 'Expert in defense protocols', '2026-01-01')
      `).run();

      sqlite.prepare(`
        INSERT INTO topics (contact_id, content, created_at)
        VALUES (1, 'Discuss temporal displacement equipment', '2026-01-02')
      `).run();

      sqlite.prepare(`
        INSERT INTO touchpoints (contact_id, contacted_at, note, created_at)
        VALUES (1, '2026-01-10', 'Coffee catch-up regarding Los Angeles shelter bunker', '2026-01-10')
      `).run();

      // Insert contact 2: John Smith
      sqlite.prepare(`
        INSERT INTO contacts (id, full_name, company, job_title, notes, created_at)
        VALUES (2, 'John Smith', 'Acme Corporation', 'Lead Architect', 'General construction contractor', '2026-01-01')
      `).run();

      // Index both contacts
      indexContactInFts(1);
      indexContactInFts(2);

      // Search by name
      const resName = searchContactsFts('Sarah');
      expect(resName.length).toBeGreaterThanOrEqual(1);
      expect(resName[0].contactId).toBe(1);
      expect(resName[0].matchField).toBe('name');

      // Search by topic
      const resTopic = searchContactsFts('displacement');
      expect(resTopic.length).toBeGreaterThanOrEqual(1);
      expect(resTopic[0].contactId).toBe(1);
      expect(resTopic[0].matchField).toBe('topic');

      // Search by touchpoint note
      const resTouchpoint = searchContactsFts('bunker');
      expect(resTouchpoint.length).toBeGreaterThanOrEqual(1);
      expect(resTouchpoint[0].contactId).toBe(1);
      expect(resTouchpoint[0].matchField).toBe('touchpoint');

      // Search by company
      const resCompany = searchContactsFts('Acme');
      expect(resCompany.length).toBeGreaterThanOrEqual(1);
      expect(resCompany[0].contactId).toBe(2);
    });
  });

  describe('4. Dormant Contact / Serendipity Engine', () => {
    let sqlite: Database.Database;

    beforeEach(() => {
      sqlite = new Database(':memory:');
      sqlite.pragma('foreign_keys = ON');

      sqlite.exec(`
        CREATE TABLE settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          owner_user_id INTEGER,
          theme_mode TEXT NOT NULL DEFAULT 'dark',
          theme_preset TEXT NOT NULL DEFAULT 'studio',
          timezone TEXT NOT NULL DEFAULT 'UTC',
          date_format TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
          default_country_code TEXT NOT NULL DEFAULT '+972',
          log_level TEXT NOT NULL DEFAULT 'info',
          telegram_bot_token TEXT,
          telegram_chat_id TEXT,
          telegram_binding_token TEXT,
          daily_digest_enabled INTEGER NOT NULL DEFAULT 1,
          daily_digest_time TEXT NOT NULL DEFAULT '09:00',
          skip_empty_digest INTEGER NOT NULL DEFAULT 1,
          weekly_summary_enabled INTEGER NOT NULL DEFAULT 1,
          weekly_summary_day INTEGER NOT NULL DEFAULT 0,
          weekly_summary_time TEXT NOT NULL DEFAULT '10:00',
          first_day_of_week INTEGER NOT NULL DEFAULT 0,
          birthday_days_advance INTEGER NOT NULL DEFAULT 7,
          max_daily_due INTEGER NOT NULL DEFAULT 3,
          global_paused_until TEXT,
          ical_secret_token TEXT NOT NULL DEFAULT 'secret',
          google_client_id TEXT,
          google_client_secret TEXT,
          google_refresh_token TEXT,
          google_sync_interval TEXT NOT NULL DEFAULT 'manual',
          skip_google_email_only INTEGER NOT NULL DEFAULT 0,
          last_google_sync_at TEXT,
          google_calendar_push_enabled INTEGER NOT NULL DEFAULT 0,
          google_calendar_id TEXT NOT NULL DEFAULT 'primary',
          google_calendar_auto_push TEXT NOT NULL DEFAULT 'manual',
          google_calendar_push_day INTEGER NOT NULL DEFAULT 0,
          google_calendar_push_time TEXT NOT NULL DEFAULT '08:00',
          google_calendar_push_advance_days INTEGER NOT NULL DEFAULT 7,
          last_google_calendar_push_at TEXT,
          webhook_enabled INTEGER NOT NULL DEFAULT 0,
          webhook_url TEXT,
          webhook_secret TEXT,
          cadence_fuzziness_enabled INTEGER NOT NULL DEFAULT 0,
          cadence_fuzziness_percent INTEGER NOT NULL DEFAULT 15,
          snapshot_schedule_mode TEXT NOT NULL DEFAULT 'scheduled',
          snapshot_interval_unit TEXT NOT NULL DEFAULT 'days',
          snapshot_interval_value INTEGER NOT NULL DEFAULT 1,
          last_snapshot_at TEXT,
          last_telegram_digest_date TEXT
        );
        CREATE TABLE contacts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source TEXT NOT NULL DEFAULT 'local',
          google_resource_name TEXT,
          first_name TEXT,
          last_name TEXT,
          full_name TEXT NOT NULL,
          phone TEXT,
          email TEXT,
          company TEXT,
          job_title TEXT,
          pets TEXT NOT NULL DEFAULT '[]',
          country TEXT,
          postal_code TEXT,
          birthday TEXT,
          significant_date TEXT,
          significant_date_label TEXT,
          keep_in_touch INTEGER NOT NULL DEFAULT 0,
          custom_interval_days INTEGER,
          last_contacted_at TEXT,
          next_due_at TEXT,
          snoozed_until TEXT,
          paused_until TEXT,
          notes TEXT,
          created_at TEXT NOT NULL
        );
        CREATE TABLE groups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          color TEXT NOT NULL DEFAULT '#e85d3a',
          interval_days INTEGER NOT NULL DEFAULT 30,
          paused_until TEXT,
          created_at TEXT NOT NULL
        );
        CREATE TABLE contact_groups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
          group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE
        );
        CREATE TABLE topics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          is_completed INTEGER NOT NULL DEFAULT 0,
          completed_at TEXT,
          created_at TEXT NOT NULL
        );
        CREATE TABLE touchpoints (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
          contacted_at TEXT NOT NULL,
          method TEXT NOT NULL DEFAULT 'call',
          note TEXT,
          created_at TEXT NOT NULL
        );
        CREATE TABLE relationships (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          contact_a_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
          contact_b_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          notes TEXT,
          created_at TEXT NOT NULL
        );
        CREATE TABLE important_dates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
          label TEXT NOT NULL,
          date TEXT NOT NULL,
          remind_days_before INTEGER NOT NULL DEFAULT 7,
          created_at TEXT NOT NULL
        );
        CREATE TABLE custom_field_templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          field_type TEXT NOT NULL DEFAULT 'text',
          options TEXT NOT NULL DEFAULT '[]',
          sort_order INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE contact_custom_fields (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
          template_id INTEGER NOT NULL REFERENCES custom_field_templates(id) ON DELETE CASCADE,
          value TEXT NOT NULL,
          UNIQUE(contact_id, template_id)
        );
      `);

      const drizzleDb = drizzle(sqlite, { schema });
      setTestDb(drizzleDb, sqlite);
    });

    afterEach(() => {
      setTestDb(null as any, null as any);
      sqlite.close();
    });

    it('identifies dormant contacts and generates shuffle suggestions', () => {
      // 1. Active contact (contacted yesterday)
      sqlite.prepare(`
        INSERT INTO contacts (id, full_name, company, last_contacted_at, created_at)
        VALUES (1, 'Active Alice', 'Acme', datetime('now', '-1 day'), '2026-01-01')
      `).run();

      // 2. Dormant contact (contacted 200 days ago)
      sqlite.prepare(`
        INSERT INTO contacts (id, full_name, company, last_contacted_at, created_at)
        VALUES (2, 'Dormant Bob', 'Globex', datetime('now', '-200 days'), '2026-01-01')
      `).run();

      // 3. Never contacted contact
      sqlite.prepare(`
        INSERT INTO contacts (id, full_name, company, last_contacted_at, created_at)
        VALUES (3, 'Charlie New', 'Initech', NULL, '2026-01-01')
      `).run();

      const dormant = getDormantContacts(90);
      expect(dormant).toHaveLength(2);

      const dormantIds = dormant.map((d) => d.contactId);
      expect(dormantIds).toContain(2);
      expect(dormantIds).toContain(3);
      expect(dormantIds).not.toContain(1);

      const { suggestion, totalDormantCount } = getSerendipitySuggestion(0, 90);
      expect(totalDormantCount).toBe(2);
      expect(suggestion).toBeDefined();
      expect([2, 3]).toContain(suggestion?.contactId);
    });
  });

  describe('5. Automated SQLite Backup Rotator', () => {
    let tempDir: string;
    let originalDbPath: string | undefined;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'touchpoint-test-backup-'));
      const testDbPath = path.join(tempDir, 'touchpoint.db');

      const testDb = new Database(testDbPath);
      testDb.exec('CREATE TABLE test_data (id INTEGER PRIMARY KEY, note TEXT);');
      testDb.prepare('INSERT INTO test_data (note) VALUES (?)').run('Sample note 1');

      const drizzleDb = drizzle(testDb, { schema });
      setTestDb(drizzleDb, testDb);
      originalDbPath = process.env.DATABASE_PATH;
      process.env.DATABASE_PATH = testDbPath;
    });

    afterEach(() => {
      setTestDb(null as any, null as any);
      if (originalDbPath !== undefined) {
        process.env.DATABASE_PATH = originalDbPath;
      } else {
        delete process.env.DATABASE_PATH;
      }
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('creates online snapshot using VACUUM INTO and verifies snapshot integrity', () => {
      const snap = createDatabaseSnapshot('daily', 1);
      expect(snap.filename).toContain('user1-daily-');
      expect(snap.sizeBytes).toBeGreaterThan(0);

      const list = listDatabaseSnapshots();
      expect(list.length).toBeGreaterThanOrEqual(1);
      expect(list.some((s) => s.filename === snap.filename)).toBe(true);

      const backupDir = path.join(tempDir, 'backups');
      const snapDb = new Database(path.join(backupDir, snap.filename), { readonly: true });
      const row = snapDb.prepare('SELECT note FROM test_data WHERE id = 1').get() as { note: string };
      expect(row.note).toBe('Sample note 1');
      snapDb.close();
    });

    it('enforces backup retention policy', () => {
      const backupDir = path.join(tempDir, 'backups');
      fs.mkdirSync(backupDir, { recursive: true });

      // Create 10 fake daily backups
      for (let i = 1; i <= 10; i++) {
        const day = String(i).padStart(2, '0');
        const filename = `user1-daily-2026-10-${day}.db`;
        fs.writeFileSync(path.join(backupDir, filename), 'dummy db data');
      }

      const listBefore = listDatabaseSnapshots();
      expect(listBefore.filter((s) => s.type === 'daily')).toHaveLength(10);

      // Enforce retention (keeps 7 daily)
      const res = enforceBackupRetention(1);
      expect(res.removedCount).toBe(3); // 10 - 7 = 3

      const listAfter = listDatabaseSnapshots();
      expect(listAfter.filter((s) => s.type === 'daily')).toHaveLength(7);
    });
  });
});
