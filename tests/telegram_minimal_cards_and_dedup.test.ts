import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDatabase, setTestDb, closeAllDbs, getDb } from '@/db';
import * as schema from '@/db/schema';
import { settings } from '@/db/schema';
import { createContact, createGroup } from '@/lib/contacts-service';
import { addTopic, createRelationship } from '@/lib/touchpoints-service';
import { buildContactReminderMessage } from '@/lib/telegram-service';
import { runDailyDigestForUser, stopBackgroundServices } from '@/lib/scheduler';
import { POST } from '@/app/api/telegram/route';

const sendMessageMock = vi.fn().mockResolvedValue({ message_id: 123 });

vi.mock('grammy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('grammy')>();
  class MockBot {
    api = {
      sendMessage: sendMessageMock,
    };
    command = vi.fn();
    on = vi.fn();
    start = vi.fn();
    stop = vi.fn();
    isInited = vi.fn().mockReturnValue(false);
  }
  return {
    ...actual,
    Bot: MockBot,
  };
});

describe('Minimal Telegram Contact Cards & Duplicate Header Removal', () => {
  beforeEach(() => {
    sendMessageMock.mockClear();
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

  describe('Minimal contact reminder cards in telegram-service', () => {
    it('omits group and work/life data while retaining cadence status, connections, topics, and actions', () => {
      const grp = createGroup({ name: 'Inner Circle', intervalDays: 14 });
      const spouse = createContact({ fullName: 'Pepper Potts', keepInTouch: false });
      const contact = createContact({
        fullName: 'Tony Stark',
        phone: '+972-50-123-4567',
        email: 'tony@stark.com',
        company: 'Stark Industries',
        jobTitle: 'Chief Visionary',
        pets: ['Dum-E (Robot)', 'U (Robot)'],
        groupIds: [grp.id],
        keepInTouch: true,
        lastContactedAt: '2026-09-01T00:00:00Z', // overdue
      });

      createRelationship({
        contactAId: contact.id,
        contactBId: spouse.id,
        type: 'spouse',
      });
      addTopic(contact.id, 'Discuss clean energy grid');

      const refDate = new Date('2026-10-25T10:00:00Z');
      const card = buildContactReminderMessage(contact.id, '+972', refDate);

      // Must have header and cadence status
      expect(card.text).toContain('🔔 <b>Touchpoint Reminder: Tony Stark</b>');
      expect(card.text).toContain('(Every 14d) — <b>Overdue');

      // Must NOT contain group data
      expect(card.text).not.toContain('Group:');
      expect(card.text).not.toContain('Inner Circle');

      // Must NOT contain work or pet data
      expect(card.text).not.toContain('Work & Life:');
      expect(card.text).not.toContain('Stark Industries');
      expect(card.text).not.toContain('Chief Visionary');
      expect(card.text).not.toContain('Dum-E');
      expect(card.text).not.toContain('🐾');

      // Must retain connections, topics, and action links
      expect(card.text).toContain('Connections:');
      expect(card.text).toContain('Pepper Potts');
      expect(card.text).toContain('Topics to ask next time:');
      expect(card.text).toContain('Discuss clean energy grid');
      expect(card.text).toContain('wa.me/972501234567');
      expect(card.text).toContain('tony@stark.com');
      expect(card.keyboard).toBeDefined();
    });
  });

  describe('Duplicate Touchpoint Morning Briefing header removal in scheduler.ts', () => {
    it('omits summary header when sending reminders, dispatching only individual contact cards', async () => {
      const db = getDb(1);
      db.insert(settings).values({
        id: 1,
        ownerUserId: 1,
        icalSecretToken: 'test-token',
        telegramBotToken: 'mock-bot-token',
        telegramChatId: '12345678',
        dailyDigestEnabled: true,
        maxDailyDue: 3,
        skipEmptyDigest: false,
      }).run();

      createContact({
        fullName: 'Due Contact 1',
        phone: '0541111111',
        keepInTouch: true,
        customIntervalDays: 7,
        lastContactedAt: '2026-10-01T00:00:00Z', // overdue
      });

      const refDate = new Date('2026-10-25T09:00:00Z');
      await runDailyDigestForUser(1, refDate);

      // Exactly 1 reminder sent (the contact card)
      expect(sendMessageMock).toHaveBeenCalledTimes(1);
      const sentText = sendMessageMock.mock.calls[0][1];
      expect(sentText).toContain('Touchpoint Reminder: Due Contact 1');
      expect(sentText).not.toContain('Touchpoint Morning Briefing');
    });

    it('sends summary text when there are 0 reminders and skipEmpty is false', async () => {
      const db = getDb(1);
      db.insert(settings).values({
        id: 1,
        ownerUserId: 1,
        icalSecretToken: 'test-token',
        telegramBotToken: 'mock-bot-token',
        telegramChatId: '12345678',
        dailyDigestEnabled: true,
        skipEmptyDigest: false,
      }).run();

      const refDate = new Date('2026-10-25T09:00:00Z');
      await runDailyDigestForUser(1, refDate);

      // 0 reminders, so summaryText is sent
      expect(sendMessageMock).toHaveBeenCalledTimes(1);
      const sentText = sendMessageMock.mock.calls[0][1];
      expect(sentText).toContain('Touchpoint Morning Briefing');
      expect(sentText).toContain('All caught up!');
    });
  });

  describe('Duplicate Touchpoint Morning Briefing header removal in /api/telegram route', () => {
    it('omits summary header when sending reminders via send_digest_now', async () => {
      const db = getDb(1);
      db.insert(settings).values({
        id: 1,
        ownerUserId: 1,
        icalSecretToken: 'test-token',
        telegramBotToken: 'mock-bot-token',
        telegramChatId: '12345678',
      }).run();

      createContact({
        fullName: 'Due Contact API',
        phone: '0542222222',
        keepInTouch: true,
        customIntervalDays: 7,
        lastContactedAt: '2026-10-01T00:00:00Z',
      });

      const req = new Request('http://localhost:3000/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_digest_now' }),
      });

      const res = await POST(req);
      const json = await res.json();

      expect(json.sentCount).toBe(1);
      expect(sendMessageMock).toHaveBeenCalledTimes(1);
      const sentText = sendMessageMock.mock.calls[0][1];
      expect(sentText).toContain('Touchpoint Reminder: Due Contact API');
      expect(sentText).not.toContain('Touchpoint Morning Briefing');
    });

    it('sends summary text when 0 reminders exist via send_digest_now', async () => {
      const db = getDb(1);
      db.insert(settings).values({
        id: 1,
        ownerUserId: 1,
        icalSecretToken: 'test-token',
        telegramBotToken: 'mock-bot-token',
        telegramChatId: '12345678',
      }).run();

      const req = new Request('http://localhost:3000/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_digest_now' }),
      });

      const res = await POST(req);
      const json = await res.json();

      expect(json.sentCount).toBe(0);
      expect(json.message).toBe('All caught up today!');
      expect(sendMessageMock).toHaveBeenCalledTimes(1);
      const sentText = sendMessageMock.mock.calls[0][1];
      expect(sentText).toContain('Touchpoint Morning Briefing');
      expect(sentText).toContain('All caught up!');
    });
  });
});
