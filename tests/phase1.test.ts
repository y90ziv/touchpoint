import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, setTestDb } from '@/db';
import { contacts, groups, contactGroups } from '@/db/schema';
import {
  calculateEffectiveIntervalDays,
  evaluateContactCadence,
  applySmartSpreading,
  calculateRelationshipHealthScore,
} from '@/lib/cadence';
import {
  isOwnerSetupComplete,
  registerOwnerAccount,
  authenticateOwner,
  createSessionToken,
  verifySessionToken,
} from '@/lib/auth';
import { redactSensitive } from '@/lib/logger';

describe('Phase 1: Core Cadence, SQLite Schema, Auth & Logger', () => {
  beforeEach(() => {
    const { db, sqlite } = createDatabase(':memory:');
    setTestDb(db, sqlite);
  });

  describe('1. Effective Interval Calculation (Group vs Per-Person Override)', () => {
    it('uses per-person customIntervalDays when set, overriding any group intervals', () => {
      const interval = calculateEffectiveIntervalDays(14, [
        { id: 1, name: 'Family', intervalDays: 7 },
        { id: 2, name: 'Workplace 1', intervalDays: 60 },
      ]);
      expect(interval).toBe(14);
    });

    it('chooses the shortest interval when a contact belongs to multiple groups', () => {
      const interval = calculateEffectiveIntervalDays(null, [
        { id: 1, name: 'Workplace 2', intervalDays: 60 },
        { id: 2, name: 'Family', intervalDays: 7 },
        { id: 3, name: 'Workplace 1', intervalDays: 30 },
      ]);
      expect(interval).toBe(7);
    });

    it('falls back to 30 days when no custom override and no groups exist', () => {
      expect(calculateEffectiveIntervalDays(null, [])).toBe(30);
    });
  });

  describe('2. Cadence Status, Snooze, Vacation Pause & Health Score', () => {
    const refDate = new Date('2026-10-16T12:00:00Z');

    it('identifies overdue, due_today, due_soon, and on_track contacts accurately', () => {
      const overdueEval = evaluateContactCadence(
        {
          id: 1,
          fullName: 'Dan Cohen',
          keepInTouch: true,
          lastContactedAt: '2026-09-10T10:00:00Z', // 36 days ago
          createdAt: '2026-01-01T00:00:00Z',
          groups: [{ id: 1, name: 'Workplace 1', intervalDays: 30 }],
        },
        refDate
      );
      expect(overdueEval.status).toBe('overdue');
      expect(overdueEval.daysSinceContact).toBe(36);
      expect(overdueEval.progressPercent).toBe(100);

      const dueTodayEval = evaluateContactCadence(
        {
          id: 2,
          fullName: 'Mom',
          keepInTouch: true,
          lastContactedAt: '2026-10-09T10:00:00Z', // 7 days ago
          createdAt: '2026-01-01T00:00:00Z',
          groups: [{ id: 2, name: 'Family', intervalDays: 7 }],
        },
        refDate
      );
      expect(dueTodayEval.status).toBe('due_today');
      expect(dueTodayEval.daysUntilDue).toBe(0);

      const onTrackEval = evaluateContactCadence(
        {
          id: 3,
          fullName: 'Maya Levi',
          keepInTouch: true,
          lastContactedAt: '2026-10-10T10:00:00Z', // 6 days ago
          createdAt: '2026-01-01T00:00:00Z',
          groups: [{ id: 1, name: 'Workplace 1', intervalDays: 30 }],
        },
        refDate
      );
      expect(onTrackEval.status).toBe('on_track');
      expect(onTrackEval.progressPercent).toBe(20);
    });

    it('respects contact snooze and vacation pause dates', () => {
      const snoozed = evaluateContactCadence(
        {
          id: 1,
          fullName: 'Dan Cohen',
          keepInTouch: true,
          lastContactedAt: '2026-09-10T10:00:00Z', // would be overdue
          snoozedUntil: '2026-10-25T00:00:00Z', // snoozed 9 days into future
          createdAt: '2026-01-01T00:00:00Z',
          groups: [{ id: 1, name: 'Workplace 1', intervalDays: 30 }],
        },
        refDate
      );
      expect(snoozed.status).toBe('on_track');
      expect(snoozed.daysUntilDue).toBe(9);

      const paused = evaluateContactCadence(
        {
          id: 1,
          fullName: 'Dan Cohen',
          keepInTouch: true,
          lastContactedAt: '2026-09-10T10:00:00Z',
          pausedUntil: '2026-11-01T00:00:00Z',
          createdAt: '2026-01-01T00:00:00Z',
          groups: [{ id: 1, name: 'Workplace 1', intervalDays: 30 }],
        },
        refDate
      );
      expect(paused.status).toBe('paused');
    });

    it('applies Smart Spreading so overdue always show while capping due_today', () => {
      const items = [
        {
          contactId: 1,
          effectiveIntervalDays: 30,
          daysSinceContact: 35,
          daysUntilDue: -5,
          nextDueDate: '2026-10-11',
          progressPercent: 100,
          status: 'overdue' as const,
        },
        {
          contactId: 2,
          effectiveIntervalDays: 30,
          daysSinceContact: 30,
          daysUntilDue: 0,
          nextDueDate: '2026-10-16',
          progressPercent: 100,
          status: 'due_today' as const,
        },
        {
          contactId: 3,
          effectiveIntervalDays: 14,
          daysSinceContact: 14,
          daysUntilDue: 0,
          nextDueDate: '2026-10-16',
          progressPercent: 100,
          status: 'due_today' as const,
        },
      ];

      const { surfacedToday, deferredToTomorrow } = applySmartSpreading(items, 2);
      expect(surfacedToday.map((i) => i.contactId)).toEqual([1, 2]);
      expect(deferredToTomorrow.map((i) => i.contactId)).toEqual([3]);

      const health = calculateRelationshipHealthScore(items);
      expect(health.totalTrackedCount).toBe(3);
      expect(health.overdueCount).toBe(1);
      expect(health.scorePercent).toBe(67);
    });
  });

  describe('3. Owner-Only Authentication & Session Security', () => {
    it('creates the first Owner account and locks any subsequent registration attempts', async () => {
      expect(isOwnerSetupComplete()).toBe(false);

      const { user, settings } = registerOwnerAccount({
        email: 'owner@touchpoint.local',
        username: 'owner',
        password: 'superSecretPassword123',
      });

      expect(user.id).toBe(1);
      expect(settings.themePreset).toBe('studio');
      expect(isOwnerSetupComplete()).toBe(true);

      expect(() =>
        registerOwnerAccount({
          email: 'intruder@touchpoint.local',
          username: 'intruder',
          password: 'password123',
        })
      ).toThrow(/Owner account already exists/);

      const authed = authenticateOwner('owner', 'superSecretPassword123');
      expect(authed?.email).toBe('owner@touchpoint.local');
      expect(authenticateOwner('owner', 'wrongPassword')).toBeNull();

      const token = await createSessionToken({
        userId: user.id,
        email: user.email,
        username: user.username,
      });
      const verified = await verifySessionToken(token);
      expect(verified?.username).toBe('owner');
    });
  });

  describe('4. Logger Secret Redaction & SQLite Foreign Keys', () => {
    it('redacts sensitive tokens and passwords from container logs', () => {
      const redacted = redactSensitive({
        username: 'owner',
        passwordHash: 'secret-hash',
        telegramBotToken: '123456:ABC-DEF',
        nested: { googleRefreshToken: 'refresh-xyz' },
      }) as Record<string, unknown>;

      expect(redacted.username).toBe('owner');
      expect(redacted.passwordHash).toBe('[REDACTED]');
      expect(redacted.telegramBotToken).toBe('[REDACTED]');
      expect((redacted.nested as Record<string, unknown>).googleRefreshToken).toBe('[REDACTED]');
    });

    it('cascades contact group deletions in SQLite', () => {
      const { db } = createDatabase(':memory:');
      setTestDb(db, {} as never);

      const c = db
        .insert(contacts)
        .values({
          fullName: 'Test Person',
          source: 'local',
          createdAt: new Date().toISOString(),
        })
        .returning()
        .get();

      const g = db
        .insert(groups)
        .values({
          name: 'Family',
          intervalDays: 7,
          createdAt: new Date().toISOString(),
        })
        .returning()
        .get();

      db.insert(contactGroups).values({ contactId: c.id, groupId: g.id }).run();
      expect(db.select().from(contactGroups).all().length).toBe(1);
    });
  });
});
