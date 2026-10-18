export interface GroupCadenceInfo {
  id: number;
  name: string;
  intervalDays: number;
  pausedUntil?: string | null;
}

export interface ContactCadenceInput {
  id: number;
  fullName: string;
  keepInTouch: boolean;
  customIntervalDays?: number | null;
  lastContactedAt?: string | null;
  snoozedUntil?: string | null;
  pausedUntil?: string | null;
  createdAt: string;
  groups: GroupCadenceInfo[];
}

export type CadenceStatus = 'overdue' | 'due_today' | 'due_soon' | 'on_track' | 'paused' | 'untracked';

export interface EvaluatedContactCadence {
  contactId: number;
  effectiveIntervalDays: number;
  daysSinceContact: number;
  daysUntilDue: number;
  nextDueDate: string; // YYYY-MM-DD
  progressPercent: number; // 0 to 100
  status: CadenceStatus;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function toStartOfDayUTC(dateStrOrDate: string | Date): Date {
  const d = typeof dateStrOrDate === 'string' ? new Date(dateStrOrDate) : dateStrOrDate;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function formatDateYYYYMMDD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Calculates the effective reminder interval in days:
 * 1. Per-contact custom override takes priority.
 * 2. Otherwise, shortest interval among assigned active groups.
 * 3. Fallback default is 30 days.
 */
export function calculateEffectiveIntervalDays(
  customIntervalDays: number | null | undefined,
  groups: GroupCadenceInfo[],
  referenceDate: Date = new Date()
): number {
  if (customIntervalDays && customIntervalDays > 0) {
    return customIntervalDays;
  }

  const refDay = toStartOfDayUTC(referenceDate);
  const activeGroups = groups.filter((g) => {
    if (!g.pausedUntil) return true;
    return toStartOfDayUTC(g.pausedUntil) <= refDay;
  });

  const candidateGroups = activeGroups.length > 0 ? activeGroups : groups;
  const groupsWithCadence = candidateGroups.filter((g) => g.intervalDays && g.intervalDays > 0);
  if (groupsWithCadence.length > 0) {
    return Math.min(...groupsWithCadence.map((g) => g.intervalDays));
  }

  return 30;
}

export interface CadenceFuzzinessConfig {
  enabled: boolean;
  percent?: number;
}

export function computeFuzzyJitter(seed: string, maxJitterDays: number): number {
  if (maxJitterDays <= 0) return 0;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const span = maxJitterDays * 2 + 1;
  return (Math.abs(hash) % span) - maxJitterDays;
}

/**
 * Evaluates a contact's cadence status, progress ring percentage, and next due date.
 */
export function evaluateContactCadence(
  contact: ContactCadenceInput,
  referenceDate: Date = new Date(),
  globalPausedUntil?: string | null,
  fuzziness?: CadenceFuzzinessConfig
): EvaluatedContactCadence {
  const refDay = toStartOfDayUTC(referenceDate);
  const effectiveIntervalDays = calculateEffectiveIntervalDays(
    contact.customIntervalDays,
    contact.groups,
    referenceDate
  );

  const anchorDateStr = contact.lastContactedAt || contact.createdAt;
  const anchorDay = toStartOfDayUTC(anchorDateStr);

  const daysSinceContact = Math.max(
    0,
    Math.floor((refDay.getTime() - anchorDay.getTime()) / MS_PER_DAY)
  );

  let intervalDaysWithFuzziness = effectiveIntervalDays;
  if (fuzziness?.enabled && effectiveIntervalDays >= 4) {
    const pct = Math.max(5, Math.min(50, fuzziness.percent ?? 15));
    const maxJitter = Math.max(1, Math.round(effectiveIntervalDays * (pct / 100)));
    const seed = `${contact.id}-${anchorDateStr}`;
    const jitter = computeFuzzyJitter(seed, maxJitter);
    intervalDaysWithFuzziness = Math.max(1, effectiveIntervalDays + jitter);
  }

  let rawNextDue = new Date(anchorDay.getTime() + intervalDaysWithFuzziness * MS_PER_DAY);

  if (contact.snoozedUntil) {
    const snoozeDay = toStartOfDayUTC(contact.snoozedUntil);
    if (snoozeDay > rawNextDue) {
      rawNextDue = snoozeDay;
    }
  }

  const daysUntilDue = Math.floor((rawNextDue.getTime() - refDay.getTime()) / MS_PER_DAY);
  const effectiveElapsed = Math.max(0, intervalDaysWithFuzziness - Math.max(0, daysUntilDue));
  const progressPercent =
    daysUntilDue <= 0
      ? 100
      : Math.min(100, Math.max(0, Math.round((effectiveElapsed / intervalDaysWithFuzziness) * 100)));

  if (!contact.keepInTouch) {
    return {
      contactId: contact.id,
      effectiveIntervalDays,
      daysSinceContact,
      daysUntilDue,
      nextDueDate: formatDateYYYYMMDD(rawNextDue),
      progressPercent,
      status: 'untracked',
    };
  }

  // Check global, contact-level, or all-group pause
  const isGlobalPaused =
    globalPausedUntil && toStartOfDayUTC(globalPausedUntil) > refDay;
  const isContactPaused =
    contact.pausedUntil && toStartOfDayUTC(contact.pausedUntil) > refDay;
  const areAllGroupsPaused =
    contact.groups.length > 0 &&
    contact.groups.every((g) => g.pausedUntil && toStartOfDayUTC(g.pausedUntil) > refDay);

  if (isGlobalPaused || isContactPaused || areAllGroupsPaused) {
    return {
      contactId: contact.id,
      effectiveIntervalDays,
      daysSinceContact,
      daysUntilDue,
      nextDueDate: formatDateYYYYMMDD(rawNextDue),
      progressPercent,
      status: 'paused',
    };
  }

  let status: CadenceStatus = 'on_track';
  if (daysUntilDue < 0) {
    status = 'overdue';
  } else if (daysUntilDue === 0) {
    status = 'due_today';
  } else if (daysUntilDue <= 3 || progressPercent >= 80) {
    status = 'due_soon';
  }

  return {
    contactId: contact.id,
    effectiveIntervalDays,
    daysSinceContact,
    daysUntilDue,
    nextDueDate: formatDateYYYYMMDD(rawNextDue),
    progressPercent,
    status,
  };
}

/**
 * Smart Spreading:
 * - Overdue contacts ALWAYS show.
 * - Limits how many "due_today" contacts are surfaced on the same day up to `maxDailyDue`
 *   (counting overdue contacts towards the daily load or capping additional due_today items).
 */
export function applySmartSpreading(
  evaluated: EvaluatedContactCadence[],
  maxDailyDue: number
): {
  surfacedToday: EvaluatedContactCadence[];
  deferredToTomorrow: EvaluatedContactCadence[];
} {
  const overdue = evaluated
    .filter((c) => c.status === 'overdue')
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue); // most overdue first

  const dueToday = evaluated
    .filter((c) => c.status === 'due_today')
    .sort((a, b) => b.daysSinceContact - a.daysSinceContact);

  const remainingSlots = Math.max(0, maxDailyDue - overdue.length);
  const acceptedDueToday = dueToday.slice(0, remainingSlots);
  const deferredToTomorrow = dueToday.slice(remainingSlots);

  return {
    surfacedToday: [...overdue, ...acceptedDueToday],
    deferredToTomorrow,
  };
}

/**
 * Relationship Health Score (%):
 * Percentage of active tracked contacts that are not overdue.
 */
export function calculateRelationshipHealthScore(evaluated: EvaluatedContactCadence[]): {
  scorePercent: number;
  onTrackCount: number;
  totalTrackedCount: number;
  overdueCount: number;
} {
  const active = evaluated.filter((c) => c.status !== 'untracked' && c.status !== 'paused');
  const totalTrackedCount = active.length;
  if (totalTrackedCount === 0) {
    return { scorePercent: 100, onTrackCount: 0, totalTrackedCount: 0, overdueCount: 0 };
  }

  const overdueCount = active.filter((c) => c.status === 'overdue').length;
  const onTrackCount = totalTrackedCount - overdueCount;
  const scorePercent = Math.round((onTrackCount / totalTrackedCount) * 100);

  return {
    scorePercent,
    onTrackCount,
    totalTrackedCount,
    overdueCount,
  };
}
