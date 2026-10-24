import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { shouldRunSnapshotRotation, runScheduledBackupRotation } from '@/lib/backup-rotator';
import { runDailyDigestForUser, stopBackgroundServices } from '@/lib/scheduler';
import { getDb, setTestDb, createDatabase, closeAllDbs } from '@/db';
import { settings } from '@/db/schema';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/db/schema';
import { eq } from 'drizzle-orm';

describe('Configurable Snapshot Cadence & Digest Deduplication', () => {
  describe('shouldRunSnapshotRotation unit tests', () => {
    it('returns false when mode is manual (on-demand only)', () => {
      const now = new Date('2026-10-24T03:00:00Z');
      expect(shouldRunSnapshotRotation(null, 'manual', 'days', 1, now)).toBe(false);
      expect(shouldRunSnapshotRotation('2026-01-01T00:00:00Z', 'manual', 'weeks', 1, now)).toBe(false);
    });

    it('returns true when lastSnapshotAt is null/undefined in scheduled mode', () => {
      const now = new Date('2026-10-24T03:00:00Z');
      expect(shouldRunSnapshotRotation(null, 'scheduled', 'days', 1, now)).toBe(true);
      expect(shouldRunSnapshotRotation(undefined, 'scheduled', 'weeks', 2, now)).toBe(true);
    });

    it('handles days interval correctly', () => {
      const last = '2026-10-20T03:00:00Z';
      // 2 days later: should be false for 3 days
      expect(shouldRunSnapshotRotation(last, 'scheduled', 'days', 3, new Date('2026-10-22T03:00:00Z'))).toBe(false);
      // 3 days later: should be true for 3 days
      expect(shouldRunSnapshotRotation(last, 'scheduled', 'days', 3, new Date('2026-10-23T03:00:00Z'))).toBe(true);
      // 5 days later: should be true for 3 days
      expect(shouldRunSnapshotRotation(last, 'scheduled', 'days', 3, new Date('2026-10-25T03:00:00Z'))).toBe(true);
    });

    it('handles weeks interval correctly', () => {
      const last = '2026-10-01T03:00:00Z';
      // 6 days later: should be false for 1 week
      expect(shouldRunSnapshotRotation(last, 'scheduled', 'weeks', 1, new Date('2026-10-07T03:00:00Z'))).toBe(false);
      // 7 days later: should be true for 1 week
      expect(shouldRunSnapshotRotation(last, 'scheduled', 'weeks', 1, new Date('2026-10-08T03:00:00Z'))).toBe(true);
      // 13 days later: should be false for 2 weeks
      expect(shouldRunSnapshotRotation(last, 'scheduled', 'weeks', 2, new Date('2026-10-14T03:00:00Z'))).toBe(false);
      // 14 days later: should be true for 2 weeks
      expect(shouldRunSnapshotRotation(last, 'scheduled', 'weeks', 2, new Date('2026-10-15T03:00:00Z'))).toBe(true);
    });

    it('handles months interval correctly', () => {
      const last = '2026-08-15T03:00:00Z';
      // 1 month later (2026-09-15): should be true for 1 month
      expect(shouldRunSnapshotRotation(last, 'scheduled', 'months', 1, new Date('2026-09-15T03:00:00Z'))).toBe(true);
      // 2026-09-14: should be false for 1 month
      expect(shouldRunSnapshotRotation(last, 'scheduled', 'months', 1, new Date('2026-09-14T03:00:00Z'))).toBe(false);
      // 2026-10-15: should be true for 2 months
      expect(shouldRunSnapshotRotation(last, 'scheduled', 'months', 2, new Date('2026-10-15T03:00:00Z'))).toBe(true);
      // 2026-10-01: should be false for 2 months
      expect(shouldRunSnapshotRotation(last, 'scheduled', 'months', 2, new Date('2026-10-01T03:00:00Z'))).toBe(false);
    });
  });

  describe('Database snapshot rotation execution', () => {
    beforeEach(() => {
      const { db, sqlite } = createDatabase(':memory:');
      setTestDb(db, sqlite);
      db.insert(schema.users).values({
        id: 1,
        email: 'owner@example.com',
        username: 'owner',
        passwordHash: 'hash',
        createdAt: '2026-01-01T00:00:00Z',
      }).run();
    });

    afterEach(() => {
      closeAllDbs();
    });

    it('skips scheduled snapshot when snapshot_schedule_mode is manual', () => {
      const db = getDb(1);
      db.insert(settings).values({
        id: 1,
        ownerUserId: 1,
        icalSecretToken: 'test-token',
        snapshotScheduleMode: 'manual',
        snapshotIntervalUnit: 'weeks',
        snapshotIntervalValue: 1,
      }).run();

      runScheduledBackupRotation(1, new Date('2026-10-24T03:00:00Z'));
      const row = db.select().from(settings).where(eq(settings.id, 1)).get();
      // lastSnapshotAt should NOT be set because rotation was skipped
      expect(row?.lastSnapshotAt).toBeNull();
    });

    it('executes and updates lastSnapshotAt when interval elapses', () => {
      const db = getDb(1);
      db.insert(settings).values({
        id: 1,
        ownerUserId: 1,
        icalSecretToken: 'test-token',
        snapshotScheduleMode: 'scheduled',
        snapshotIntervalUnit: 'weeks',
        snapshotIntervalValue: 1,
        lastSnapshotAt: '2026-10-01T03:00:00Z',
      }).run();

      const runDate = new Date('2026-10-15T03:00:00Z');
      runScheduledBackupRotation(1, runDate);
      const row = db.select().from(settings).where(eq(settings.id, 1)).get();
      expect(row?.lastSnapshotAt).toBe(runDate.toISOString());
    });
  });

  describe('Daily digest database guard deduplication', () => {
    beforeEach(() => {
      const { db, sqlite } = createDatabase(':memory:');
      setTestDb(db, sqlite);
      db.insert(schema.users).values({
        id: 1,
        email: 'owner@example.com',
        username: 'owner',
        passwordHash: 'hash',
        createdAt: '2026-01-01T00:00:00Z',
      }).run();
      stopBackgroundServices();
    });

    afterEach(() => {
      closeAllDbs();
    });

    it('skips dispatching if database records that today was already dispatched', async () => {
      const db = getDb(1);
      const today = '2026-10-24';
      db.insert(settings).values({
        id: 1,
        ownerUserId: 1,
        icalSecretToken: 'test-token',
        telegramBotToken: 'mock-bot-token',
        telegramChatId: '12345678',
        dailyDigestEnabled: true,
        lastTelegramDigestDate: today, // Already sent today!
      }).run();

      // Reset in-memory cache to simulate fresh server/healthcheck process
      stopBackgroundServices();

      await runDailyDigestForUser(1, new Date('2026-10-24T09:00:00Z'));
      const row = db.select().from(settings).where(eq(settings.id, 1)).get();
      expect(row?.lastTelegramDigestDate).toBe(today);
    });
  });
});
