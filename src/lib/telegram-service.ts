import { Bot, InlineKeyboard } from 'grammy';
import { getDb, getAuthDb, getUserDb, runWithUser } from '@/db';
import { settings, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getContactById, listContactsWithDetails, normalizePhone } from '@/lib/contacts-service';
import {
  logTouchpoint,
  snoozeContact,
  getRelationshipsForContact,
  ContactMethod,
} from '@/lib/touchpoints-service';
import { applySmartSpreading, calculateRelationshipHealthScore } from '@/lib/cadence';
import { formatDateByPattern } from '@/lib/formatters';
import { logger } from '@/lib/logger';

export function formatWhatsAppLink(phone: string | null | undefined, defaultCountryCode = '+972'): string | null {
  const digits = normalizePhone(phone);
  if (!digits) return null;

  let formatted = digits;
  if (formatted.startsWith('0')) {
    const cleanCode = defaultCountryCode.replace(/[^\d]/g, '');
    formatted = cleanCode + formatted.slice(1);
  } else if (formatted.startsWith('+')) {
    formatted = formatted.slice(1);
  }
  return `https://wa.me/${formatted}`;
}

/**
 * Builds the rich context message for a single contact reminder in Telegram,
 * including Work & Pets, Linked Relationships, Active Topics to Ask,
 * and Quick Action Links (WhatsApp, Call, Email).
 */
export function buildContactReminderMessage(
  contactId: number,
  defaultCountryCode = '+972',
  referenceDate: Date = new Date()
): {
  contactId: number;
  contactName: string;
  daysUntilDue?: number;
  status?: string;
  intervalDays?: number;
  text: string;
  keyboard: InlineKeyboard;
} {
  const contact = getContactById(contactId, referenceDate);
  if (!contact) {
    throw new Error(`Contact ${contactId} not found`);
  }

  const rels = getRelationshipsForContact(contactId);
  const statusLabel =
    contact.cadence.status === 'overdue'
      ? `Overdue (${contact.cadence.daysSinceContact}d since last contact)`
      : `Due Today (${contact.cadence.daysSinceContact}d since last contact)`;

  const lines: string[] = [
    `🔔 <b>Touchpoint Reminder: ${escapeHtml(contact.fullName)}</b>`,
    `(Every ${contact.cadence.effectiveIntervalDays}d) — <b>${statusLabel}</b>`,
  ];

  // Relationship Context (Feature #1)
  if (rels.length > 0) {
    const relStrings = rels.map((r) => {
      const bdayNote = r.otherContactBirthday ? ` (🎂 ${r.otherContactBirthday})` : '';
      return `${escapeHtml(r.displayLabel)}: ${escapeHtml(r.otherContactName)}${bdayNote}`;
    });
    lines.push(`👨‍👩‍👧 <b>Connections:</b> ${relStrings.join(' | ')}`);
  }

  // Active "Topics to Ask Next Time"
  const activeTopics = contact.topics.filter((t) => !t.isCompleted);
  if (activeTopics.length > 0) {
    lines.push(`\n📝 <b>Topics to ask next time:</b>`);
    for (const t of activeTopics) {
      lines.push(`• ${escapeHtml(t.content)}`);
    }
  }

  // Quick Action Links
  const quickLinks: string[] = [];
  const waUrl = formatWhatsAppLink(contact.phone, defaultCountryCode);
  if (waUrl) {
    quickLinks.push(`<a href="${waUrl}">💬 WhatsApp</a>`);
  }
  if (contact.phone) {
    quickLinks.push(`📞 ${escapeHtml(contact.phone)}`);
  }
  if (contact.email) {
    quickLinks.push(`<a href="mailto:${encodeURI(contact.email)}">✉️ Email</a>`);
  }
  if (quickLinks.length > 0) {
    lines.push(`\n${quickLinks.join('  ·  ')}`);
  }

  // Step 1 Inline Buttons: Mark Contacted or Configured Snooze Duration
  const db = getDb();
  const cfg = db.select().from(settings).get();
  const defaultSnoozeDays = cfg?.defaultSnoozeDays || 3;

  const keyboard = new InlineKeyboard()
    .text('✅ Mark Contacted', `tp:pick_method:${contact.id}`)
    .text(`💤 Snooze ${defaultSnoozeDays}d`, `tp:snooze:${contact.id}:${defaultSnoozeDays}`);

  return {
    contactId: contact.id,
    contactName: contact.fullName,
    daysUntilDue: contact.cadence.daysUntilDue,
    status: contact.cadence.status,
    intervalDays: contact.cadence.effectiveIntervalDays,
    text: lines.join('\n'),
    keyboard,
  };
}

/**
 * Builds Step 2 Inline Keyboard when the user taps "[✅ Mark Contacted]",
 * flipping the buttons to let them select Call, Message, In Person, or Other.
 */
export function buildMethodSelectionKeyboard(contactId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('📞 Call', `tp:log:${contactId}:call`)
    .text('💬 Message', `tp:log:${contactId}:message`)
    .row()
    .text('🤝 In Person', `tp:log:${contactId}:in_person`)
    .text('✨ Other', `tp:log:${contactId}:other`)
    .row()
    .text('↩️ Back', `tp:back:${contactId}`);
}

/**
 * Processes an inline button callback query from Telegram.
 * Strictly verifies `fromUserId === ownerChatId` before executing any action.
 */
export function processTelegramCallbackData(
  callbackData: string,
  fromUserId: string | number,
  ownerChatId: string | null | undefined,
  referenceDate: Date = new Date()
): {
  authorized: boolean;
  action: 'show_methods' | 'logged' | 'snoozed' | 'back' | 'ignored';
  confirmationText?: string;
  keyboard?: InlineKeyboard;
} {
  if (!ownerChatId || String(fromUserId) !== String(ownerChatId).trim()) {
    logger.warn('telegram.auth', 'Rejected unauthorized Telegram callback click', {
      fromUserId: String(fromUserId),
    });
    return { authorized: false, action: 'ignored' };
  }

  const parts = callbackData.split(':');
  if (parts[0] !== 'tp') {
    return { authorized: true, action: 'ignored' };
  }

  const step = parts[1];
  const contactId = Number(parts[2]);

  if (step === 'pick_method') {
    return {
      authorized: true,
      action: 'show_methods',
      keyboard: buildMethodSelectionKeyboard(contactId),
    };
  }

  if (step === 'back') {
    const built = buildContactReminderMessage(contactId, '+972', referenceDate);
    return {
      authorized: true,
      action: 'back',
      keyboard: built.keyboard,
    };
  }

  if (step === 'snooze') {
    const days = Number(parts[3] || 3);
    const updated = snoozeContact(contactId, days, referenceDate);
    return {
      authorized: true,
      action: 'snoozed',
      confirmationText: `💤 Snoozed ${updated.fullName} for ${days} days (next due ${updated.cadence.nextDueDate}).`,
    };
  }

  if (step === 'log') {
    const method = (parts[3] || 'call') as ContactMethod;
    const { contact } = logTouchpoint({
      contactId,
      method,
      contactedAt: referenceDate.toISOString(),
      sourceTrigger: 'telegram',
    });

    const methodLabels: Record<ContactMethod, string> = {
      call: 'Call',
      message: 'Message',
      in_person: 'In-Person hangout',
      other: 'Touchpoint',
    };

    return {
      authorized: true,
      action: 'logged',
      confirmationText: `✅ Logged ${methodLabels[method]} with ${contact.fullName} — Timer reset! Next due in ${contact.cadence.effectiveIntervalDays} days (${contact.cadence.nextDueDate}).`,
    };
  }

  return { authorized: true, action: 'ignored' };
}

/**
 * Builds the Daily Digest summary text and per-contact reminder payloads.
 */
export function buildDailyDigestPayloads(referenceDate: Date = new Date()) {
  const db = getDb();
  const cfg = db.select().from(settings).get();
  const maxDailyDue = cfg?.maxDailyDue ?? 3;
  const defaultCountryCode = cfg?.defaultCountryCode || '+972';

  const allContacts = listContactsWithDetails(referenceDate);
  const evaluations = allContacts.map((c) => c.cadence);

  const { surfacedToday, deferredToTomorrow } = applySmartSpreading(evaluations, maxDailyDue);

  // Deduplicate surfaced contacts by ID and normalized name to prevent duplicate notifications
  const contactNameById = new Map<number, string>(allContacts.map((c) => [c.id, c.fullName]));
  const seenContactIds = new Set<number>();
  const seenContactNames = new Set<string>();
  const uniqueSurfacedToday: typeof surfacedToday = [];

  for (const item of surfacedToday) {
    if (seenContactIds.has(item.contactId)) continue;
    seenContactIds.add(item.contactId);

    const rawName = contactNameById.get(item.contactId) || '';
    const normName = rawName.trim().toLowerCase();
    if (normName && seenContactNames.has(normName)) continue;
    if (normName) seenContactNames.add(normName);

    uniqueSurfacedToday.push(item);
  }

  const reminders = uniqueSurfacedToday.map((evalItem) =>
    buildContactReminderMessage(evalItem.contactId, defaultCountryCode, referenceDate)
  );

  // Check upcoming birthdays within birthdayDaysAdvance
  const advanceDays = cfg?.birthdayDaysAdvance ?? 7;
  const upcomingBirthdays = findUpcomingBirthdays(allContacts, referenceDate, advanceDays);

  const summaryText = buildMorningBriefingSummaryText(reminders, upcomingBirthdays, referenceDate);

  return {
    summaryText,
    reminders,
    upcomingBirthdays,
    deferredCount: deferredToTomorrow.length,
    skipEmpty: cfg?.skipEmptyDigest ?? true,
  };
}

export function buildMorningBriefingSummaryText(
  reminders: Array<{ contactName: string; daysUntilDue?: number; status?: string; intervalDays?: number }>,
  upcomingBirthdays: Array<{ contactName: string; date: string; daysAway: number; label: string }>,
  referenceDate: Date = new Date()
): string {
  const dateFormatted = referenceDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const lines: string[] = [
    `🌅 <b>Touchpoint Morning Briefing</b>`,
    `📅 <i>${dateFormatted}</i>`,
    `━━━━━━━━━━━━━━━━━━━━`,
  ];

  if (reminders.length > 0) {
    lines.push(`⚡ <b>${reminders.length} Relationship${reminders.length === 1 ? '' : 's'} Due Today:</b>`);
    for (const r of reminders) {
      const isOverdue = (r.daysUntilDue ?? 0) < 0;
      const statusIcon = isOverdue ? '🔴' : '🟡';
      const cadenceNote = isOverdue
        ? `-${Math.abs(r.daysUntilDue ?? 0)}d overdue`
        : 'Due today';
      const ruleNote = r.intervalDays ? ` (Every ${r.intervalDays}d)` : '';
      lines.push(`${statusIcon} <b>${escapeHtml(r.contactName)}</b> — ${cadenceNote}${ruleNote}`);
    }
  } else {
    lines.push(`🎉 <b>All caught up!</b> No pending cadence outreach required today.`);
  }

  if (upcomingBirthdays.length > 0) {
    lines.push(``);
    lines.push(`🎂 <b>Upcoming Celebrations:</b>`);
    for (const b of upcomingBirthdays) {
      const dayLabel = b.daysAway === 0 ? '🎉 <b>Today!</b>' : `in ${b.daysAway}d (${b.date})`;
      lines.push(`• <b>${escapeHtml(b.contactName)}</b> — ${escapeHtml(b.label)}: ${dayLabel}`);
    }
  }

  if (reminders.length > 0) {
    lines.push(``);
    lines.push(`<i>Action cards with 1-tap WhatsApp and logging below 👇</i>`);
  }

  return lines.join('\n');
}

export function findUpcomingBirthdays(
  allContacts: ReturnType<typeof listContactsWithDetails>,
  referenceDate: Date,
  advanceDays: number
): Array<{ contactName: string; date: string; daysAway: number; label: string }> {
  const results: Array<{ contactName: string; date: string; daysAway: number; label: string }> = [];
  const refYear = referenceDate.getUTCFullYear();
  const refStart = Date.UTC(refYear, referenceDate.getUTCMonth(), referenceDate.getUTCDate());

  const checkDate = (contactName: string, rawDate: string, label: string) => {
    const parts = rawDate.split('-');
    const month = Number(parts.length === 3 ? parts[1] : parts[0]);
    const day = Number(parts.length === 3 ? parts[2] : parts[1]);
    if (!month || !day) return;

    let target = Date.UTC(refYear, month - 1, day);
    if (target < refStart) {
      target = Date.UTC(refYear + 1, month - 1, day);
    }
    const diffDays = Math.round((target - refStart) / (24 * 60 * 60 * 1000));
    if (diffDays >= 0 && diffDays <= advanceDays) {
      results.push({ contactName, date: rawDate, daysAway: diffDays, label });
    }
  };

  for (const c of allContacts) {
    if (c.birthday) {
      checkDate(c.fullName, c.birthday, 'Birthday');
    }
    for (const imp of c.importantDates) {
      checkDate(c.fullName, imp.date, imp.label);
    }
  }

  return results.sort((a, b) => a.daysAway - b.daysAway);
}

export interface UpcomingCelebration {
  contactId: number;
  contactName: string;
  type: 'birthday' | 'milestone';
  label: string;
  rawDate: string;
  occurrenceDate: Date;
  formattedDate: string;
  weekdayName: string;
  daysAway: number;
  turningAge: number | null;
  phone?: string | null;
  email?: string | null;
}

/**
 * Resolves all birthdays and milestones occurring in the upcoming calendar week (Sunday -> Saturday inclusive).
 * When called on Saturday, the upcoming week is tomorrow Sunday (+1) through next Saturday (+7).
 * Uses user's configured settings dateFormat for display.
 */
export function findUpcomingWeekCelebrations(
  allContacts: ReturnType<typeof listContactsWithDetails>,
  referenceDate: Date = new Date(),
  dateFormat: string = 'YYYY-MM-DD',
  targetDayOfWeek: number = 6
): {
  celebrations: UpcomingCelebration[];
  weekStart: Date;
  weekEnd: Date;
  weekStartFormatted: string;
  weekEndFormatted: string;
} {
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();
  const refDay = referenceDate.getDate();
  const currentDayOfWeek = referenceDate.getDay(); // 0 = Sun ... 6 = Sat

  // Distance to upcoming Sunday
  let daysToSunday = (7 - currentDayOfWeek) % 7;
  if (daysToSunday === 0 && currentDayOfWeek !== 0) {
    daysToSunday = 7;
  }
  if (currentDayOfWeek === 6) {
    daysToSunday = 1;
  }

  const weekStart = new Date(refYear, refMonth, refDay + daysToSunday);
  const weekEnd = new Date(refYear, refMonth, refDay + daysToSunday + 6);

  const weekStartFormatted = formatDateByPattern(weekStart, dateFormat);
  const weekEndFormatted = formatDateByPattern(weekEnd, dateFormat);

  // Generate lookup for the 7 dates in the window
  const windowDates: Array<{ date: Date; month: number; day: number; daysAway: number }> = [];
  for (let offset = 0; offset < 7; offset++) {
    const d = new Date(refYear, refMonth, refDay + daysToSunday + offset);
    windowDates.push({
      date: d,
      month: d.getMonth() + 1,
      day: d.getDate(),
      daysAway: daysToSunday + offset,
    });
  }

  const celebrations: UpcomingCelebration[] = [];

  const parseDateParts = (raw: string): { year: number | null; month: number; day: number } | null => {
    const parts = raw.trim().split('-').map(Number);
    if (parts.length < 2 || parts.some(isNaN)) return null;
    const hasYear = parts.length === 3 && parts[0] > 1900;
    return {
      year: hasYear ? parts[0] : null,
      month: hasYear ? parts[1] : parts[0],
      day: hasYear ? parts[2] : parts[1],
    };
  };

  for (const c of allContacts) {
    // 1. Birthday
    if (c.birthday) {
      const parsed = parseDateParts(c.birthday);
      if (parsed) {
        for (const w of windowDates) {
          if (w.month === parsed.month && w.day === parsed.day) {
            const turningAge = parsed.year ? w.date.getFullYear() - parsed.year : null;
            celebrations.push({
              contactId: c.id,
              contactName: c.fullName,
              type: 'birthday',
              label: 'Birthday',
              rawDate: c.birthday,
              occurrenceDate: w.date,
              formattedDate: formatDateByPattern(w.date, dateFormat),
              weekdayName: w.date.toLocaleDateString('en-US', { weekday: 'long' }),
              daysAway: w.daysAway,
              turningAge,
              phone: c.phone,
              email: c.email,
            });
          }
        }
      }
    }

    // 2. Significant Date
    if (c.significantDate) {
      const parsed = parseDateParts(c.significantDate);
      if (parsed) {
        for (const w of windowDates) {
          if (w.month === parsed.month && w.day === parsed.day) {
            const turningAge = parsed.year ? w.date.getFullYear() - parsed.year : null;
            celebrations.push({
              contactId: c.id,
              contactName: c.fullName,
              type: 'milestone',
              label: c.significantDateLabel || 'Anniversary',
              rawDate: c.significantDate,
              occurrenceDate: w.date,
              formattedDate: formatDateByPattern(w.date, dateFormat),
              weekdayName: w.date.toLocaleDateString('en-US', { weekday: 'long' }),
              daysAway: w.daysAway,
              turningAge,
              phone: c.phone,
              email: c.email,
            });
          }
        }
      }
    }

    // 3. Important Dates
    if (c.importantDates && c.importantDates.length > 0) {
      for (const imp of c.importantDates) {
        const parsed = parseDateParts(imp.date);
        if (parsed) {
          for (const w of windowDates) {
            if (w.month === parsed.month && w.day === parsed.day) {
              const turningAge = parsed.year ? w.date.getFullYear() - parsed.year : null;
              celebrations.push({
                contactId: c.id,
                contactName: c.fullName,
                type: 'milestone',
                label: imp.label || 'Special Occasion',
                rawDate: imp.date,
                occurrenceDate: w.date,
                formattedDate: formatDateByPattern(w.date, dateFormat),
                weekdayName: w.date.toLocaleDateString('en-US', { weekday: 'long' }),
                daysAway: w.daysAway,
                turningAge,
                phone: c.phone,
                email: c.email,
              });
            }
          }
        }
      }
    }
  }

  celebrations.sort((a, b) => {
    const diff = a.occurrenceDate.getTime() - b.occurrenceDate.getTime();
    if (diff !== 0) return diff;
    return a.contactName.localeCompare(b.contactName);
  });

  return {
    celebrations,
    weekStart,
    weekEnd,
    weekStartFormatted,
    weekEndFormatted,
  };
}

/**
 * Formats the Weekly Birthday & Milestone Briefing for Telegram dispatch.
 */
export function buildWeeklyBirthdayDigestPayload(
  referenceDate: Date = new Date(),
  dateFormat: string = 'YYYY-MM-DD',
  defaultCountryCode: string = '+972',
  targetDayOfWeek: number = 6
): {
  summaryText: string;
  celebrations: UpcomingCelebration[];
  keyboard?: InlineKeyboard;
} {
  const allContacts = listContactsWithDetails(referenceDate);
  const {
    celebrations,
    weekStartFormatted,
    weekEndFormatted,
  } = findUpcomingWeekCelebrations(allContacts, referenceDate, dateFormat, targetDayOfWeek);

  const lines: string[] = [
    `🎂 <b>Weekly Birthday &amp; Milestone Briefing</b>`,
    `📅 <i>Upcoming Week: Sun ${weekStartFormatted} – Sat ${weekEndFormatted}</i>`,
    `━━━━━━━━━━━━━━━━━━━━`,
  ];

  if (celebrations.length === 0) {
    lines.push(
      `🎉 <b>All quiet this week!</b> No birthdays or important dates recorded in your network for the upcoming week (Sun ${weekStartFormatted} – Sat ${weekEndFormatted}).`
    );
    return {
      summaryText: lines.join('\n'),
      celebrations: [],
    };
  }

  // Group by date / weekday
  const groupedByDay = new Map<string, UpcomingCelebration[]>();
  for (const c of celebrations) {
    const key = `${c.weekdayName}, ${c.formattedDate}`;
    if (!groupedByDay.has(key)) {
      groupedByDay.set(key, []);
    }
    groupedByDay.get(key)!.push(c);
  }

  for (const [dayHeader, items] of groupedByDay.entries()) {
    lines.push(``);
    lines.push(`🗓️ <b>${dayHeader}:</b>`);
    for (const item of items) {
      const ageStr = item.turningAge ? ` (Turning ${item.turningAge})` : '';
      const icon = item.type === 'birthday' ? '🎂' : '💍';
      lines.push(`• <b>${escapeHtml(item.contactName)}</b> — ${icon} ${escapeHtml(item.label)}${ageStr}`);
    }
  }

  lines.push(``);
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push(
    `<i>${celebrations.length} celebration${celebrations.length === 1 ? '' : 's'} to prepare for this week!</i>`
  );

  const keyboard = new InlineKeyboard();
  const actionable = celebrations.filter((c) => Boolean(c.phone));
  const seenIds = new Set<number>();
  let buttonsAdded = 0;

  for (const item of actionable) {
    if (seenIds.has(item.contactId)) continue;
    seenIds.add(item.contactId);

    const waLink = formatWhatsAppLink(item.phone, defaultCountryCode);
    if (waLink && buttonsAdded < 4) {
      keyboard.url(`💬 ${item.contactName.split(' ')[0]} (WhatsApp)`, waLink);
      buttonsAdded++;
      if (buttonsAdded % 2 === 0) {
        keyboard.row();
      }
    }
  }

  return {
    summaryText: lines.join('\n'),
    celebrations,
    keyboard: buttonsAdded > 0 ? keyboard : undefined,
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Outbound Long-Polling Telegram Bot Manager (Cloudflare & NAT friendly)
 */
interface GlobalTelegramState {
  activeBot: Bot | null;
  lastDetectedChatId: { chatId: string; username?: string; firstName?: string } | null;
}

const tgGlobal = globalThis as unknown as { __touchpoint_telegram__?: GlobalTelegramState };
if (!tgGlobal.__touchpoint_telegram__) {
  tgGlobal.__touchpoint_telegram__ = {
    activeBot: null,
    lastDetectedChatId: null,
  };
}
const tgState = tgGlobal.__touchpoint_telegram__;

export function getLastDetectedTelegramChat() {
  return tgState.lastDetectedChatId;
}

export function isTelegramBotRunning(): boolean {
  return tgState.activeBot !== null && Boolean(tgState.activeBot.isInited());
}

export async function stopTelegramBot(): Promise<void> {
  if (tgState.activeBot) {
    try {
      await tgState.activeBot.stop();
    } catch {
      // ignore stop error
    }
    tgState.activeBot = null;
  }
}

export function findUserByTelegramBindingToken(token: string): { user: typeof users.$inferSelect; settingsRow: typeof settings.$inferSelect } | null {
  if (!token) return null;
  const authDb = getAuthDb();
  const allUsers = authDb.select().from(users).all();
  for (const u of allUsers) {
    const uDb = getUserDb(u.id).db;
    const cfg = uDb.select().from(settings).get();
    if (cfg && cfg.telegramBindingToken === token) {
      return { user: u, settingsRow: cfg };
    }
  }
  return null;
}

export function findUserIdByTelegramChatId(chatId: string): number | null {
  if (!chatId) return null;
  const authDb = getAuthDb();
  const allUsers = authDb.select().from(users).all();
  for (const u of allUsers) {
    const uDb = getUserDb(u.id).db;
    const cfg = uDb.select().from(settings).get();
    if (cfg && cfg.telegramChatId === chatId) {
      return u.id;
    }
  }
  return null;
}

export async function startTelegramLongPolling(token: string) {
  if (tgState.activeBot) {
    try {
      await tgState.activeBot.stop();
    } catch {
      // ignore stop error
    }
    tgState.activeBot = null;
  }

  const bot = new Bot(token);

  bot.command('start', async (ctx) => {
    const chatId = String(ctx.chat.id);
    const text = ctx.message?.text || '';
    const match = text.match(/^\/start\s+bind_([a-zA-Z0-9_-]+)/);

    // Deep linking account binding (/start bind_<token>)
    if (match && match[1]) {
      const bindingToken = match[1];
      const matchResult = findUserByTelegramBindingToken(bindingToken);
      if (matchResult) {
        const { user, settingsRow } = matchResult;
        const uDb = getUserDb(user.id).db;
        uDb.update(settings).set({ telegramChatId: chatId }).where(eq(settings.id, settingsRow.id)).run();
        logger.info('telegram.bind', `Successfully bound Telegram chat ${chatId} to user ${user.username} (ID: ${user.id}) via deep link`);
        await ctx.reply(
          `🎉 <b>Touchpoint Linked!</b>\n\nWelcome, <b>${user.username}</b>! Your Telegram account has been connected to your Touchpoint account.\n\nYou will receive your daily touchpoint reminders right here and can mark interactions with 1-click buttons!`,
          { parse_mode: 'HTML' }
        );
        return;
      } else {
        await ctx.reply('⚠️ Invalid or expired binding link. Please generate a new connection link from your Touchpoint Settings dashboard.');
        return;
      }
    }

    tgState.lastDetectedChatId = {
      chatId,
      username: ctx.from?.username,
      firstName: ctx.from?.first_name,
    };

    logger.info('telegram.setup', 'Received /start command from Telegram user', {
      chatId,
      username: ctx.from?.username,
    });

    await ctx.reply(
      `👋 Connected to Touchpoint!\nYour Chat ID is: <code>${chatId}</code>\n\nTo link automatically, click the <b>"Connect Telegram Bot"</b> link in your Touchpoint Settings, or manually save this Chat ID in your settings dashboard.`,
      { parse_mode: 'HTML' }
    );
  });

  // /due command: Instantly returns reminders for contacts due today or overdue
  bot.command('due', async (ctx) => {
    const fromId = String(ctx.from?.id);
    const resolvedUserId = findUserIdByTelegramChatId(fromId) || 1;
    await runWithUser(resolvedUserId, async () => {
      const digest = buildDailyDigestPayloads();
      if (digest.reminders.length === 0) {
        await ctx.reply('🎉 <b>Touchpoint:</b> All caught up! No contacts are currently due today.', {
          parse_mode: 'HTML',
        });
        return;
      }
      for (const r of digest.reminders) {
        await ctx.reply(r.text, { parse_mode: 'HTML', reply_markup: r.keyboard });
      }
    });
  });

  // /status command: Relationship cadence health & statistics
  bot.command('status', async (ctx) => {
    const fromId = String(ctx.from?.id);
    const resolvedUserId = findUserIdByTelegramChatId(fromId) || 1;
    await runWithUser(resolvedUserId, async () => {
      const allContacts = listContactsWithDetails();
      const evaluations = allContacts.map((c) => c.cadence);
      const health = calculateRelationshipHealthScore(evaluations);
      const overdueCount = evaluations.filter((c) => c.status === 'overdue').length;
      const dueTodayCount = evaluations.filter((c) => c.status === 'due_today').length;

      await ctx.reply(
        `📊 <b>Touchpoint Cadence Status:</b>\n\n` +
        `• <b>Network Health:</b> ${health.scorePercent}%\n` +
        `• <b>On Track:</b> ${health.onTrackCount} of ${health.totalTrackedCount}\n` +
        `• <b>Overdue:</b> ${overdueCount}\n` +
        `• <b>Due Today:</b> ${dueTodayCount}\n\n` +
        `Send /due to view interactive reminder cards for contacts needing attention.`,
        { parse_mode: 'HTML' }
      );
    });
  });

  // /help command
  bot.command('help', async (ctx) => {
    await ctx.reply(
      `🤖 <b>Touchpoint Telegram Bot Commands:</b>\n\n` +
      `• /due — View contacts currently due or overdue\n` +
      `• /status — Relationship health score & overview\n` +
      `• /help — View available bot commands\n\n` +
      `You can also tap the 1-click inline buttons on any reminder to log calls, messages, or snooze 3d!`,
      { parse_mode: 'HTML' }
    );
  });

  bot.on('callback_query:data', async (ctx) => {
    const fromId = String(ctx.from.id);
    const resolvedUserId = findUserIdByTelegramChatId(fromId) || 1;

    await runWithUser(resolvedUserId, async () => {
      const db = getDb(resolvedUserId);
      const cfg = db.select().from(settings).get();
      const result = processTelegramCallbackData(
        ctx.callbackQuery.data,
        ctx.from.id,
        cfg?.telegramChatId
      );

      if (!result.authorized) {
        await ctx.answerCallbackQuery({ text: 'Unauthorized user.', show_alert: true });
        return;
      }

      if (result.action === 'show_methods' || result.action === 'back') {
        await ctx.editMessageReplyMarkup({ reply_markup: result.keyboard });
        await ctx.answerCallbackQuery();
      } else if (result.action === 'logged' || result.action === 'snoozed') {
        const originalText = ctx.callbackQuery.message?.text || '';
        await ctx.editMessageText(`${originalText}\n\n${result.confirmationText}`, {
          reply_markup: undefined,
        });
        await ctx.answerCallbackQuery({ text: result.confirmationText });
      } else {
        await ctx.answerCallbackQuery();
      }
    });
  });

  bot.start({
    onStart: (botInfo) => {
      logger.info(
        'telegram.poller',
        `Outbound long-polling started for @${botInfo.username} (no inbound ports required)`
      );
    },
  });

  tgState.activeBot = bot;
  return bot;
}
