import fs from 'fs';
import path from 'path';
import { getSqlite, getAuthDb } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

const BACKUP_DIR_NAME = 'backups';

export interface SnapshotMetadata {
  filename: string;
  sizeBytes: number;
  createdAt: string;
  type: 'daily' | 'weekly' | 'monthly' | 'manual';
  userId?: number;
  username?: string;
}

export function getSafeUsernameForUser(userId: number): string {
  try {
    const authDb = getAuthDb();
    const userRow = authDb.select().from(users).where(eq(users.id, userId)).get();
    if (userRow?.username) {
      const clean = userRow.username.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      if (clean) return clean;
    }
  } catch {
    // ignore
  }
  return `user${userId}`;
}

export function isSnapshotOwnedByUser(filename: string, userId: number): boolean {
  if (filename.startsWith(`u${userId}_`) || filename.startsWith(`user${userId}-`)) {
    return true;
  }
  const userTag = getSafeUsernameForUser(userId);
  if (filename.startsWith(`${userTag}-`)) {
    return true;
  }
  // If legacy file has no user prefix and userId is 1 (the initial primary user), treat as owned by user 1
  if (userId === 1 && !filename.match(/^(?:u\d+_|user\d+-)/)) {
    return true;
  }
  return false;
}

function getBackupsDirectory(): string {
  const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'touchpoint.db');
  const dir = path.join(path.dirname(dbPath), BACKUP_DIR_NAME);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getFormattedDate(d = new Date()): { dateStr: string; weekStr: string; monthStr: string } {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;
  const monthStr = `${yyyy}-${mm}`;

  const startOfYear = new Date(yyyy, 0, 1);
  const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
  const weekStr = `${yyyy}-W${String(weekNum).padStart(2, '0')}`;

  return { dateStr, weekStr, monthStr };
}

/**
 * Creates an atomic point-in-time snapshot using SQLite's native VACUUM INTO.
 * Filename format includes userId and clean username: u{userId}_{username}-{type}-{dateStr}.db
 */
export function createDatabaseSnapshot(
  type: 'daily' | 'weekly' | 'monthly' | 'manual' = 'daily',
  userId: number = 1
): SnapshotMetadata {
  const backupDir = getBackupsDirectory();
  const now = new Date();
  const { dateStr, weekStr, monthStr } = getFormattedDate(now);
  const userTag = getSafeUsernameForUser(userId);

  let prefix = `u${userId}_${userTag}-snapshot`;
  if (type === 'daily') prefix = `u${userId}_${userTag}-daily-${dateStr}`;
  else if (type === 'weekly') prefix = `u${userId}_${userTag}-weekly-${weekStr}`;
  else if (type === 'monthly') prefix = `u${userId}_${userTag}-monthly-${monthStr}`;
  else prefix = `u${userId}_${userTag}-manual-${dateStr}-${Date.now().toString().slice(-6)}`;

  const filename = `${prefix}.db`;
  const destPath = path.join(backupDir, filename);

  // If a file with the same name exists (e.g. daily rerun), remove it first before VACUUM INTO
  if (fs.existsSync(destPath)) {
    try {
      fs.unlinkSync(destPath);
    } catch {
      // ignore
    }
  }

  const sqlite = getSqlite(userId);
  sqlite.exec(`VACUUM INTO '${destPath.replace(/'/g, "''")}'`);

  const stat = fs.statSync(destPath);
  const metadata: SnapshotMetadata = {
    filename,
    sizeBytes: stat.size,
    createdAt: stat.birthtime.toISOString(),
    type,
    userId,
    username: userTag,
  };

  logger.info('backup.snapshot', `Created database snapshot: ${filename} (${stat.size} bytes)`, {
    userId,
    filename,
    sizeBytes: stat.size,
  });

  return metadata;
}

/**
 * Lists all available backup snapshots in the backups directory.
 * If userId is provided, filters to snapshots owned by that user.
 */
export function listDatabaseSnapshots(userId?: number): SnapshotMetadata[] {
  const backupDir = getBackupsDirectory();
  if (!fs.existsSync(backupDir)) return [];

  const files = fs.readdirSync(backupDir).filter((f) => f.endsWith('.db'));
  const snapshots: SnapshotMetadata[] = [];

  for (const f of files) {
    if (userId !== undefined && !isSnapshotOwnedByUser(f, userId)) {
      continue;
    }

    try {
      const fullPath = path.join(backupDir, f);
      const stat = fs.statSync(fullPath);
      let type: SnapshotMetadata['type'] = 'manual';
      if (f.includes('-daily-')) type = 'daily';
      else if (f.includes('-weekly-')) type = 'weekly';
      else if (f.includes('-monthly-')) type = 'monthly';

      let fileUserId: number | undefined = userId;
      let fileUsername: string | undefined;

      const uMatch = f.match(/^u(\d+)_([a-zA-Z0-9_-]+?)-(?:daily|weekly|monthly|manual|snapshot)/);
      if (uMatch) {
        fileUserId = parseInt(uMatch[1], 10);
        fileUsername = uMatch[2];
      } else {
        const legacyMatch = f.match(/^user(\d+)-(?:daily|weekly|monthly|manual|snapshot)/);
        if (legacyMatch) {
          fileUserId = parseInt(legacyMatch[1], 10);
          fileUsername = `user${fileUserId}`;
        }
      }

      snapshots.push({
        filename: f,
        sizeBytes: stat.size,
        createdAt: stat.mtime.toISOString(),
        type,
        userId: fileUserId,
        username: fileUsername,
      });
    } catch {
      // ignore unreadable files
    }
  }

  // Sort latest first
  snapshots.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return snapshots;
}

/**
 * Enforces backup rotation retention rules:
 * - Keeps last 7 daily snapshots
 * - Keeps last 4 weekly snapshots
 * - Keeps last 3 monthly snapshots
 * - Keeps last 5 manual snapshots
 */
export function enforceBackupRetention(userId: number = 1): { removedCount: number } {
  const backupDir = getBackupsDirectory();
  const allSnapshots = listDatabaseSnapshots(userId);

  const dailies = allSnapshots.filter((s) => s.type === 'daily');
  const weeklies = allSnapshots.filter((s) => s.type === 'weekly');
  const monthlies = allSnapshots.filter((s) => s.type === 'monthly');
  const manuals = allSnapshots.filter((s) => s.type === 'manual');

  const toRemove: SnapshotMetadata[] = [
    ...dailies.slice(7),
    ...weeklies.slice(4),
    ...monthlies.slice(3),
    ...manuals.slice(5),
  ];

  let removedCount = 0;
  for (const s of toRemove) {
    try {
      const fullPath = path.join(backupDir, s.filename);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        removedCount++;
      }
    } catch (err) {
      logger.warn('backup.cleanup', `Failed to delete old snapshot ${s.filename}`, { error: String(err) });
    }
  }

  if (removedCount > 0) {
    logger.info('backup.cleanup', `Cleaned up ${removedCount} expired backup snapshots for user ${userId}`);
  }

  return { removedCount };
}

/**
 * Permanently deletes all database snapshots for the user.
 */
export function deleteAllSnapshots(userId: number = 1): { deletedCount: number } {
  const backupDir = getBackupsDirectory();
  const allSnapshots = listDatabaseSnapshots(userId);
  let deletedCount = 0;
  for (const s of allSnapshots) {
    try {
      const fullPath = path.join(backupDir, s.filename);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        deletedCount++;
      }
    } catch (err) {
      logger.warn('backup.cleanup', `Failed to delete snapshot ${s.filename}`, { error: String(err) });
    }
  }

  logger.info('backup.cleanup', `Deleted all ${deletedCount} snapshots for user ${userId}`);
  return { deletedCount };
}

/**
 * Executes a scheduled rotation pass (creates daily snapshot and applies retention).
 */
export function runScheduledBackupRotation(userId: number = 1) {
  try {
    const now = new Date();
    // On Sundays, also tag as weekly
    const isSunday = now.getDay() === 0;
    // On 1st of month, also tag as monthly
    const isFirstOfMonth = now.getDate() === 1;

    createDatabaseSnapshot('daily', userId);
    if (isSunday) createDatabaseSnapshot('weekly', userId);
    if (isFirstOfMonth) createDatabaseSnapshot('monthly', userId);

    enforceBackupRetention(userId);
  } catch (err) {
    logger.error('backup.rotation', 'Failed during scheduled backup rotation', err);
  }
}
