import fs from 'fs';
import path from 'path';
import { getSqlite } from '@/db';
import { logger } from '@/lib/logger';

const BACKUP_DIR_NAME = 'backups';

export interface SnapshotMetadata {
  filename: string;
  sizeBytes: number;
  createdAt: string;
  type: 'daily' | 'weekly' | 'monthly' | 'manual';
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
 */
export function createDatabaseSnapshot(
  type: 'daily' | 'weekly' | 'monthly' | 'manual' = 'daily',
  userId: number = 1
): SnapshotMetadata {
  const backupDir = getBackupsDirectory();
  const now = new Date();
  const { dateStr, weekStr, monthStr } = getFormattedDate(now);

  let prefix = `user${userId}-snapshot`;
  if (type === 'daily') prefix = `user${userId}-daily-${dateStr}`;
  else if (type === 'weekly') prefix = `user${userId}-weekly-${weekStr}`;
  else if (type === 'monthly') prefix = `user${userId}-monthly-${monthStr}`;
  else prefix = `user${userId}-manual-${dateStr}-${Date.now().toString().slice(-6)}`;

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
 */
export function listDatabaseSnapshots(): SnapshotMetadata[] {
  const backupDir = getBackupsDirectory();
  if (!fs.existsSync(backupDir)) return [];

  const files = fs.readdirSync(backupDir).filter((f) => f.endsWith('.db'));
  const snapshots: SnapshotMetadata[] = [];

  for (const f of files) {
    try {
      const fullPath = path.join(backupDir, f);
      const stat = fs.statSync(fullPath);
      let type: SnapshotMetadata['type'] = 'manual';
      if (f.includes('-daily-')) type = 'daily';
      else if (f.includes('-weekly-')) type = 'weekly';
      else if (f.includes('-monthly-')) type = 'monthly';

      snapshots.push({
        filename: f,
        sizeBytes: stat.size,
        createdAt: stat.mtime.toISOString(),
        type,
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
  const allSnapshots = listDatabaseSnapshots().filter((s) => s.filename.startsWith(`user${userId}-`));

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
