import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/db/schema';
import { setTestDb, getUserDb, runWithUser, getDb } from '@/db';
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  isAuthDisabled,
  isRegistrationAllowed,
  registerUserAccount,
  authenticateUser,
  getAuthenticatedUser,
} from '@/lib/auth';
import { validateWebhookUrl } from '@/lib/webhook-service';
import { createContact, listContactsWithDetails } from '@/lib/contacts-service';
import path from 'path';
import fs from 'fs';

describe('Security & Multi-Tenancy Features', () => {
  let sqlite: Database.Database;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        totp_secret TEXT,
        totp_enabled INTEGER NOT NULL DEFAULT 0,
        totp_backup_codes TEXT
      );
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
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
        ical_secret_token TEXT NOT NULL,
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
        cadence_fuzziness_percent INTEGER NOT NULL DEFAULT 15
      );
      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL DEFAULT 'local',
        google_resource_name TEXT UNIQUE,
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
      CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL DEFAULT '#e85d3a',
        interval_days INTEGER NOT NULL DEFAULT 30,
        paused_until TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS contact_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
        group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        UNIQUE(contact_id, group_id)
      );
      CREATE TABLE IF NOT EXISTS relationships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_a_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
        contact_b_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS topics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        is_completed INTEGER NOT NULL DEFAULT 0,
        completed_at TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS important_dates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        date TEXT NOT NULL,
        remind_days_before INTEGER NOT NULL DEFAULT 7,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS custom_field_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        field_type TEXT NOT NULL DEFAULT 'text',
        options TEXT NOT NULL DEFAULT '[]',
        sort_order INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS contact_custom_fields (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
        template_id INTEGER NOT NULL REFERENCES custom_field_templates(id) ON DELETE CASCADE,
        value TEXT NOT NULL,
        UNIQUE(contact_id, template_id)
      );
      CREATE TABLE IF NOT EXISTS touchpoints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
        contacted_at TEXT NOT NULL,
        method TEXT NOT NULL DEFAULT 'call',
        note TEXT,
        created_at TEXT NOT NULL
      );
    `);
    const db = drizzle(sqlite, { schema });
    setTestDb(db, sqlite);
  });

  afterEach(() => {
    delete process.env.AUTH_DISABLED;
    delete process.env.DISABLE_AUTH;
    delete process.env.ALLOW_SIGNUPS;
    delete process.env.ALLOW_REGISTRATION;
  });

  it('supports Remember Me with extended token expiry', async () => {
    const payload = { userId: 1, email: 'user@test.com', username: 'user' };

    // Standard session: 1 day
    const tokenStandard = await createSessionToken(payload, 1);
    const verifiedStandard = await verifySessionToken(tokenStandard);
    expect(verifiedStandard).not.toBeNull();
    expect(verifiedStandard?.userId).toBe(1);
    // Standard exp is roughly 1 day ahead (allow +- 5s tolerance)
    const oneDayMs = 24 * 60 * 60 * 1000;
    expect(verifiedStandard!.exp - Date.now()).toBeGreaterThan(oneDayMs - 5000);
    expect(verifiedStandard!.exp - Date.now()).toBeLessThan(oneDayMs + 5000);

    // Remember Me: 90 days
    const tokenRemembered = await createSessionToken(payload, 90);
    const verifiedRemembered = await verifySessionToken(tokenRemembered);
    expect(verifiedRemembered).not.toBeNull();
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    expect(verifiedRemembered!.exp - Date.now()).toBeGreaterThan(ninetyDaysMs - 5000);
  });

  it('respects AUTH_DISABLED env variable to bypass authentication', async () => {
    expect(isAuthDisabled()).toBe(false);

    process.env.AUTH_DISABLED = 'true';
    expect(isAuthDisabled()).toBe(true);

    // getAuthenticatedUser returns default admin user when auth is disabled
    const user = await getAuthenticatedUser();
    expect(user).not.toBeNull();
    expect(user?.userId).toBe(1);
    expect(user?.username).toBe('admin');
  });

  it('locks signups after first user unless ALLOW_SIGNUPS=true is enabled', () => {
    // 0 users -> registration allowed
    expect(isRegistrationAllowed()).toBe(true);

    // Register User 1
    registerUserAccount({
      email: 'owner@test.com',
      username: 'owner',
      password: 'password123',
    });

    // 1 user exists -> registration now locked by default
    expect(isRegistrationAllowed()).toBe(false);
    expect(() =>
      registerUserAccount({
        email: 'user2@test.com',
        username: 'user2',
        password: 'password123',
      })
    ).toThrow(/Registration is locked/);

    // Enable ALLOW_SIGNUPS=true
    process.env.ALLOW_SIGNUPS = 'true';
    expect(isRegistrationAllowed()).toBe(true);

    // Now User 2 can register
    const user2 = registerUserAccount({
      email: 'user2@test.com',
      username: 'user2',
      password: 'password123',
    });
    expect(user2.user.id).toBe(2);
    expect(user2.user.email).toBe('user2@test.com');
  });

  it('validates webhook URLs and blocks private/SSRF targets', () => {
    // Valid public URL
    expect(() => validateWebhookUrl('https://hooks.slack.com/services/123')).not.toThrow();
    expect(() => validateWebhookUrl('https://api.example.com/webhook')).not.toThrow();

    // Invalid scheme
    expect(() => validateWebhookUrl('ftp://example.com')).toThrow(/protocol/);
    expect(() => validateWebhookUrl('file:///etc/passwd')).toThrow(/protocol/);

    // Blocked internal & private targets
    expect(() => validateWebhookUrl('http://localhost:3000')).toThrow(/Disallowed target/);
    expect(() => validateWebhookUrl('http://127.0.0.1:8080')).toThrow(/Disallowed target/);
    expect(() => validateWebhookUrl('http://169.254.169.254/latest/meta-data')).toThrow(
      /Disallowed target/
    );
    expect(() => validateWebhookUrl('http://192.168.1.1/admin')).toThrow(/Disallowed target/);
    expect(() => validateWebhookUrl('http://10.0.0.1/status')).toThrow(/Disallowed target/);
  });

  it('segregates user data completely across different users via runWithUser', () => {
    // User 1 creates contact "Alice"
    runWithUser(1, () => {
      createContact({ fullName: 'Alice (User 1 Contact)' });
      const c1 = listContactsWithDetails();
      expect(c1.some((c) => c.fullName.includes('Alice'))).toBe(true);
    });

    // User 2 context: verify isolation
    runWithUser(2, () => {
      createContact({ fullName: 'Bob (User 2 Contact)' });
      const c2 = listContactsWithDetails();
      expect(c2.some((c) => c.fullName.includes('Bob'))).toBe(true);
    });
  });
});
