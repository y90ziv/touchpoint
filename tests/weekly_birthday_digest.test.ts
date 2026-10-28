import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { setTestDb, createDatabase } from '@/db';
import {
  findUpcomingWeekCelebrations,
  buildWeeklyBirthdayDigestPayload,
} from '@/lib/telegram-service';
import { runWeeklyBirthdayDigestForUser } from '@/lib/scheduler';

describe('Centralized Weekly Birthday & Milestone Briefing', () => {
  let sqlite: Database.Database;

  beforeEach(() => {
    const created = createDatabase(':memory:');
    sqlite = created.sqlite;
    setTestDb(created.db, sqlite);
  });

  afterEach(() => {
    setTestDb(null as any, null as any);
    try {
      sqlite.close();
    } catch {}
  });

  it('accurately resolves upcoming week (Sunday to Saturday inclusive) from a Saturday trigger', () => {
    // Saturday Oct 24, 2026
    const saturday = new Date(2026, 9, 24, 19, 0, 0);

    const contactsList: any[] = [
      // 1. Sunday Oct 25 (Day +1) - Birthday with year
      {
        id: 1,
        fullName: 'Sunday Sarah',
        birthday: '1992-10-25',
        importantDates: [],
        groups: [],
        topics: [],
        cadence: { status: 'on_track', daysUntilDue: 10, daysSinceContact: 5 },
      },
      // 2. Wednesday Oct 28 (Day +4) - Birthday with partial MM-DD
      {
        id: 2,
        fullName: 'Wednesday Wendy',
        birthday: '10-28',
        importantDates: [],
        groups: [],
        topics: [],
        cadence: { status: 'on_track', daysUntilDue: 10, daysSinceContact: 5 },
      },
      // 3. Next Saturday Oct 31 (Day +7) - Significant milestone date (Anniversary)
      {
        id: 3,
        fullName: 'Saturday Sam',
        significantDate: '2016-10-31',
        significantDateLabel: 'Wedding Anniversary',
        importantDates: [],
        groups: [],
        topics: [],
        cadence: { status: 'on_track', daysUntilDue: 10, daysSinceContact: 5 },
      },
      // 4. Outside week: Sunday Nov 1 (Day +8) - Should NOT be included
      {
        id: 4,
        fullName: 'NextWeek Noah',
        birthday: '1995-11-01',
        importantDates: [],
        groups: [],
        topics: [],
        cadence: { status: 'on_track', daysUntilDue: 10, daysSinceContact: 5 },
      },
      // 5. Outside week: Today Saturday Oct 24 - Already passed/today, not in upcoming week
      {
        id: 5,
        fullName: 'Today Tom',
        birthday: '1990-10-24',
        importantDates: [],
        groups: [],
        topics: [],
        cadence: { status: 'on_track', daysUntilDue: 10, daysSinceContact: 5 },
      },
    ];

    const result = findUpcomingWeekCelebrations(
      contactsList,
      saturday,
      'DD/MM/YYYY',
      6
    );

    expect(result.celebrations).toHaveLength(3);

    // Week boundaries formatted with user's DD/MM/YYYY pattern
    expect(result.weekStartFormatted).toBe('25/10/2026');
    expect(result.weekEndFormatted).toBe('31/10/2026');

    // 1st celebration: Sunday Sarah
    expect(result.celebrations[0].contactName).toBe('Sunday Sarah');
    expect(result.celebrations[0].type).toBe('birthday');
    expect(result.celebrations[0].turningAge).toBe(34); // 2026 - 1992
    expect(result.celebrations[0].formattedDate).toBe('25/10/2026');
    expect(result.celebrations[0].weekdayName).toBe('Sunday');

    // 2nd celebration: Wednesday Wendy (no birth year)
    expect(result.celebrations[1].contactName).toBe('Wednesday Wendy');
    expect(result.celebrations[1].type).toBe('birthday');
    expect(result.celebrations[1].turningAge).toBeNull();
    expect(result.celebrations[1].formattedDate).toBe('28/10/2026');
    expect(result.celebrations[1].weekdayName).toBe('Wednesday');

    // 3rd celebration: Saturday Sam (Milestone anniversary)
    expect(result.celebrations[2].contactName).toBe('Saturday Sam');
    expect(result.celebrations[2].type).toBe('milestone');
    expect(result.celebrations[2].label).toBe('Wedding Anniversary');
    expect(result.celebrations[2].turningAge).toBe(10); // 10 years married
    expect(result.celebrations[2].formattedDate).toBe('31/10/2026');
    expect(result.celebrations[2].weekdayName).toBe('Saturday');
  });

  it('respects different user display date formats (MM/DD/YYYY and YYYY-MM-DD)', () => {
    const saturday = new Date(2026, 9, 24, 19, 0, 0);
    const contactsList: any[] = [
      {
        id: 1,
        fullName: 'Alex Vance',
        birthday: '1994-10-27',
        importantDates: [],
        groups: [],
        topics: [],
        cadence: { status: 'on_track', daysUntilDue: 10, daysSinceContact: 5 },
      },
    ];

    // MM/DD/YYYY
    const usResult = findUpcomingWeekCelebrations(contactsList, saturday, 'MM/DD/YYYY', 6);
    expect(usResult.weekStartFormatted).toBe('10/25/2026');
    expect(usResult.celebrations[0].formattedDate).toBe('10/27/2026');

    // YYYY-MM-DD
    const isoResult = findUpcomingWeekCelebrations(contactsList, saturday, 'YYYY-MM-DD', 6);
    expect(isoResult.weekStartFormatted).toBe('2026-10-25');
    expect(isoResult.celebrations[0].formattedDate).toBe('2026-10-27');
  });

  it('correctly handles year-end transitions (Dec into Jan)', () => {
    // Saturday Dec 26, 2026
    const endOfYearSaturday = new Date(2026, 11, 26, 19, 0, 0);

    const contactsList: any[] = [
      {
        id: 1,
        fullName: 'New Year Noel',
        birthday: '2000-01-01', // Jan 1st
        importantDates: [],
        groups: [],
        topics: [],
        cadence: { status: 'on_track', daysUntilDue: 10, daysSinceContact: 5 },
      },
    ];

    const result = findUpcomingWeekCelebrations(contactsList, endOfYearSaturday, 'DD/MM/YYYY', 6);
    expect(result.weekStartFormatted).toBe('27/12/2026');
    expect(result.weekEndFormatted).toBe('02/01/2027');

    expect(result.celebrations).toHaveLength(1);
    expect(result.celebrations[0].contactName).toBe('New Year Noel');
    expect(result.celebrations[0].formattedDate).toBe('01/01/2027');
    expect(result.celebrations[0].turningAge).toBe(27); // 2027 - 2000
  });

  it('generates the explicit polite message when there are no celebrations in the upcoming week', () => {
    sqlite.prepare(`
      UPDATE settings
      SET date_format = 'DD/MM/YYYY', birthday_digest_day = 6, birthday_digest_time = '19:00'
      WHERE id = 1
    `).run();

    // No contacts in DB
    const saturday = new Date(2026, 9, 24, 19, 0, 0);
    const payload = buildWeeklyBirthdayDigestPayload(saturday, 'DD/MM/YYYY', '+972', 6);

    expect(payload.celebrations).toHaveLength(0);
    expect(payload.summaryText).toContain('Weekly Birthday &amp; Milestone Briefing');
    expect(payload.summaryText).toContain('All quiet this week!');
    expect(payload.summaryText).toContain('No birthdays or important dates recorded in your network for the upcoming week (Sun 25/10/2026 – Sat 31/10/2026)');
  });

  it('builds rich HTML summary with days, turning age, and WhatsApp links when celebrations exist', () => {
    sqlite.prepare(`
      UPDATE settings
      SET date_format = 'DD/MM/YYYY', birthday_digest_day = 6, birthday_digest_time = '19:00', default_country_code = '+972'
      WHERE id = 1
    `).run();

    sqlite.prepare(`
      INSERT INTO contacts (id, full_name, phone, birthday, created_at)
      VALUES (1, 'Arthur Dent', '0541234567', '1982-10-26', '2026-01-01')
    `).run();

    const saturday = new Date(2026, 9, 24, 19, 0, 0);
    const payload = buildWeeklyBirthdayDigestPayload(saturday, 'DD/MM/YYYY', '+972', 6);

    expect(payload.celebrations).toHaveLength(1);
    expect(payload.summaryText).toContain('Arthur Dent');
    expect(payload.summaryText).toContain('Turning 44');
    expect(payload.summaryText).toContain('Monday, 26/10/2026');
    expect(payload.keyboard).toBeDefined();
  });

  it('enforces deduplication so the weekly briefing is never sent twice on the same day', async () => {
    sqlite.prepare(`
      INSERT OR IGNORE INTO users (id, email, username, password_hash, created_at)
      VALUES (1, 'user@test.com', 'user', 'hash', '2026-01-01')
    `).run();

    sqlite.prepare(`
      INSERT OR REPLACE INTO settings (id, owner_user_id, date_format, telegram_bot_token, telegram_chat_id, birthday_digest_enabled, last_birthday_digest_date, ical_secret_token)
      VALUES (1, 1, 'DD/MM/YYYY', 'fake_token', '123456', 1, '2026-10-24', 'test-token')
    `).run();

    const saturday = new Date(2026, 9, 24, 19, 0, 0);
    // When lastBirthdayDigestDate is already today's date ('2026-10-24'), it should bail early
    await runWeeklyBirthdayDigestForUser(1, saturday);

    const row = sqlite.prepare('SELECT last_birthday_digest_date FROM settings WHERE id = 1').get() as any;
    expect(row?.last_birthday_digest_date).toBe('2026-10-24');
  });
});
