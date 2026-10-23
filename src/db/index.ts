import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';
import { logger } from '@/lib/logger';

const SCHEMA_SQL = `
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

CREATE TABLE IF NOT EXISTS google_sync_tombstones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  google_resource_name TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL DEFAULT 'merged',
  contact_name TEXT,
  target_contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);
`;

import { AsyncLocalStorage } from 'async_hooks';
import { logContext } from '@/lib/logger';
import crypto from 'crypto';

export const userContext = new AsyncLocalStorage<{ userId: number; requestId?: string }>();

export function runWithUser<T>(userId: number, fn: () => T, requestId?: string): T {
  const existingLogCtx = logContext.getStore();
  const resolvedRequestId = requestId || existingLogCtx?.requestId || crypto.randomUUID();
  return logContext.run({ requestId: resolvedRequestId, userId }, () =>
    userContext.run({ userId, requestId: resolvedRequestId }, fn)
  );
}

let dbInstance: BetterSQLite3Database<typeof schema> | null = null;
let sqliteConn: Database.Database | null = null;
const userDbCache = new Map<number, { db: BetterSQLite3Database<typeof schema>; sqlite: Database.Database }>();

export function createDatabase(dbPath?: string): {
  db: BetterSQLite3Database<typeof schema>;
  sqlite: Database.Database;
} {
  const resolvedPath =
    dbPath || process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'touchpoint.db');

  if (resolvedPath !== ':memory:') {
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const sqlite = new Database(resolvedPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('busy_timeout = 5000');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(SCHEMA_SQL);

  // Safe additive column migrations for existing SQLite files
  const existingCols = (
    sqlite.pragma('table_info(settings)') as Array<{ name: string }>
  ).map((c) => c.name);
  const migrations: Array<[string, string]> = [
    ['google_calendar_push_enabled', 'INTEGER NOT NULL DEFAULT 0'],
    ['google_calendar_id', "TEXT NOT NULL DEFAULT 'primary'"],
    ['webhook_enabled', 'INTEGER NOT NULL DEFAULT 0'],
    ['webhook_url', 'TEXT'],
    ['webhook_secret', 'TEXT'],
    ['first_day_of_week', 'INTEGER NOT NULL DEFAULT 0'],
    ['telegram_binding_token', 'TEXT'],
    ['cadence_fuzziness_enabled', 'INTEGER NOT NULL DEFAULT 0'],
    ['cadence_fuzziness_percent', 'INTEGER NOT NULL DEFAULT 15'],
    ['google_calendar_auto_push', "TEXT NOT NULL DEFAULT 'manual'"],
    ['google_calendar_push_day', 'INTEGER NOT NULL DEFAULT 0'],
    ['google_calendar_push_time', "TEXT NOT NULL DEFAULT '08:00'"],
    ['google_calendar_push_advance_days', 'INTEGER NOT NULL DEFAULT 7'],
    ['last_google_calendar_push_at', 'TEXT'],
  ];
  for (const [col, def] of migrations) {
    if (!existingCols.includes(col)) {
      sqlite.exec(`ALTER TABLE settings ADD COLUMN ${col} ${def}`);
    }
  }

  const existingUserCols = (
    sqlite.pragma('table_info(users)') as Array<{ name: string }>
  ).map((c) => c.name);
  const userMigrations: Array<[string, string]> = [
    ['totp_secret', 'TEXT'],
    ['totp_enabled', 'INTEGER NOT NULL DEFAULT 0'],
    ['totp_backup_codes', 'TEXT'],
  ];
  for (const [col, def] of userMigrations) {
    if (!existingUserCols.includes(col)) {
      sqlite.exec(`ALTER TABLE users ADD COLUMN ${col} ${def}`);
    }
  }

  const existingContactCols = (
    sqlite.pragma('table_info(contacts)') as Array<{ name: string }>
  ).map((c) => c.name);
  if (!existingContactCols.includes('first_name')) {
    sqlite.exec('ALTER TABLE contacts ADD COLUMN first_name TEXT');
  }
  if (!existingContactCols.includes('last_name')) {
    sqlite.exec('ALTER TABLE contacts ADD COLUMN last_name TEXT');
  }
  if (!existingContactCols.includes('significant_date')) {
    sqlite.exec('ALTER TABLE contacts ADD COLUMN significant_date TEXT');
  }
  if (!existingContactCols.includes('significant_date_label')) {
    sqlite.exec('ALTER TABLE contacts ADD COLUMN significant_date_label TEXT');
  }
  if (!existingContactCols.includes('country')) {
    sqlite.exec('ALTER TABLE contacts ADD COLUMN country TEXT');
  }
  if (!existingContactCols.includes('postal_code')) {
    sqlite.exec('ALTER TABLE contacts ADD COLUMN postal_code TEXT');
  }

  const existingTombstoneCols = (
    sqlite.pragma('table_info(google_sync_tombstones)') as Array<{ name: string }>
  ).map((c) => c.name);
  if (!existingTombstoneCols.includes('contact_name')) {
    sqlite.exec('ALTER TABLE google_sync_tombstones ADD COLUMN contact_name TEXT');
  }

  const db = drizzle(sqlite, { schema });
  logger.info('db.init', `Initialized SQLite database at ${resolvedPath}`);
  return { db, sqlite };
}

/**
 * Returns the primary authentication database instance (holding central users table)
 */
export function getAuthDb(): BetterSQLite3Database<typeof schema> {
  if (dbInstance) {
    return dbInstance;
  }
  return getUserDb(1).db;
}

/**
 * Returns the isolated database instance for a specific user ID.
 * User 1 uses the primary database (preserving all existing data),
 * while additional users (userId > 1) receive their own dedicated SQLite file.
 */
export function getUserDb(userId: number): {
  db: BetterSQLite3Database<typeof schema>;
  sqlite: Database.Database;
} {
  if (dbInstance && sqliteConn) {
    return { db: dbInstance, sqlite: sqliteConn };
  }

  const safeUserId = Number(userId) || 1;
  if (userDbCache.has(safeUserId)) {
    return userDbCache.get(safeUserId)!;
  }

  let targetPath: string;
  if (safeUserId <= 1) {
    targetPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'touchpoint.db');
  } else {
    const baseDir = path.dirname(
      process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'touchpoint.db')
    );
    targetPath = path.join(baseDir, 'users', `user_${safeUserId}.db`);
  }

  const created = createDatabase(targetPath);
  userDbCache.set(safeUserId, created);
  return created;
}

export function getDb(userId?: number): BetterSQLite3Database<typeof schema> {
  if (dbInstance) {
    return dbInstance;
  }
  const effectiveUserId = userId ?? userContext.getStore()?.userId ?? 1;
  return getUserDb(effectiveUserId).db;
}

export function getSqlite(userId?: number): Database.Database {
  if (sqliteConn) {
    return sqliteConn;
  }
  const effectiveUserId = userId ?? userContext.getStore()?.userId ?? 1;
  return getUserDb(effectiveUserId).sqlite;
}

export function setTestDb(db: BetterSQLite3Database<typeof schema>, sqlite: Database.Database) {
  dbInstance = db;
  sqliteConn = sqlite;
  userDbCache.clear();
}

/**
 * Closes all active SQLite database connections cleanly.
 * Useful for graceful shutdown handlers and integration test tear-down.
 */
export function closeAllDbs(): void {
  if (sqliteConn) {
    try {
      sqliteConn.close();
    } catch {
      // ignore
    }
    sqliteConn = null;
  }
  for (const [userId, entry] of userDbCache.entries()) {
    try {
      entry.sqlite.close();
    } catch {
      // ignore
    }
  }
  userDbCache.clear();
  dbInstance = null;
  logger.info('db.shutdown', 'All SQLite database connections closed cleanly');
}


