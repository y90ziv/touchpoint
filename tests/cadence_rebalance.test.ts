import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, setTestDb, closeAllDbs } from '@/db';
import { applySmartSpreading, EvaluatedContactCadence } from '@/lib/cadence';
import { createContact, rebalanceContactSchedule, listContactsWithDetails, getContactById } from '@/lib/contacts-service';
import { buildContactReminderMessage, processTelegramCallbackData } from '@/lib/telegram-service';

describe('Cadence Strict Daily Cap & Schedule Rebalance', () => {
  beforeEach(() => {
    const { db, sqlite } = createDatabase(':memory:');
    setTestDb(db, sqlite);
  });

  afterEach(() => {
    closeAllDbs();
  });

  it('caps total surfaced contacts (overdue + due_today) when strictCap is true', () => {
    const evaluated: EvaluatedContactCadence[] = [
      { contactId: 1, effectiveIntervalDays: 30, daysSinceContact: 40, daysUntilDue: -10, nextDueDate: '2026-11-03', progressPercent: 100, status: 'overdue' },
      { contactId: 2, effectiveIntervalDays: 30, daysSinceContact: 35, daysUntilDue: -5, nextDueDate: '2026-11-08', progressPercent: 100, status: 'overdue' },
      { contactId: 3, effectiveIntervalDays: 30, daysSinceContact: 32, daysUntilDue: -2, nextDueDate: '2026-11-11', progressPercent: 100, status: 'overdue' },
      { contactId: 4, effectiveIntervalDays: 30, daysSinceContact: 31, daysUntilDue: -1, nextDueDate: '2026-11-12', progressPercent: 100, status: 'overdue' },
      { contactId: 5, effectiveIntervalDays: 30, daysSinceContact: 30, daysUntilDue: 0, nextDueDate: '2026-11-13', progressPercent: 100, status: 'due_today' },
    ];

    const standard = applySmartSpreading(evaluated, 3);
    expect(standard.surfacedToday.length).toBe(4);

    const strict = applySmartSpreading(evaluated, 3, { strictCap: true });
    expect(strict.surfacedToday.map((c) => c.contactId)).toEqual([1, 2, 3]);
    expect(strict.deferredToTomorrow.map((c) => c.contactId)).toEqual([4, 5]);
  });

  it('rebalanceContactSchedule evenly staggers uncontacted contacts across their interval', () => {
    const refDate = new Date('2026-11-13T00:00:00Z');
    for (let i = 1; i <= 30; i++) {
      createContact({
        fullName: `Contact ${i}`,
        keepInTouch: true,
        customIntervalDays: 15,
      });
    }

    const res = rebalanceContactSchedule({ onlyUncontacted: true, referenceDate: refDate });
    expect(res.rebalancedCount).toBe(30);
    expect(res.maxPerDay).toBe(2);

    const all = listContactsWithDetails(refDate);
    const dueDates = new Set(all.map((c) => c.cadence.nextDueDate));
    expect(dueDates.size).toBe(15);
  });

  it('Telegram Skip button defers contact by effectiveIntervalDays without logging a touchpoint', () => {
    const refDate = new Date('2026-11-13T00:00:00Z');
    const contact = createContact({
      fullName: 'Skip Target',
      keepInTouch: true,
      customIntervalDays: 30,
    });

    const reminder = buildContactReminderMessage(contact.id, '+972', refDate);
    const allButtons = reminder.keyboard.inline_keyboard.flat();
    const skipBtn = allButtons.find((b) => 'callback_data' in b && b.callback_data === `tp:skip:${contact.id}`);
    expect(skipBtn).toBeDefined();
    expect(skipBtn?.text).toContain('Skip (30d)');

    const res = processTelegramCallbackData(`tp:skip:${contact.id}`, '12345', '12345', refDate);
    expect(res.authorized).toBe(true);
    expect(res.action).toBe('skipped');
    expect(res.confirmationText).toContain('2026-12-13');

    const updated = getContactById(contact.id, refDate)!;
    expect(updated.lastContactedAt).toBeNull();
    expect(updated.cadence.nextDueDate).toBe('2026-12-13');
  });
});
