/**
 * Pure Utility Formatting Functions
 * Extracted from Touchpoint core application shell.
 */

/**
 * Normalizes user-typed date inputs from various international formats into standard YYYY-MM-DD.
 */
export function normalizeDateInput(val: string | null | undefined): string | null {
  if (!val) return '';
  const trimmed = val.trim();
  if (!trimmed) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return trimmed;
  }
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(trimmed)) {
    const norm = trimmed.replace(/\//g, '-');
    const d = new Date(norm);
    if (!isNaN(d.getTime())) return norm;
  }
  const parts = trimmed.split(/[/.-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      const y = parts[0];
      const m = parts[1].padStart(2, '0');
      const d = parts[2].padStart(2, '0');
      const norm = `${y}-${m}-${d}`;
      if (!isNaN(new Date(norm).getTime())) return norm;
    } else if (parts[2].length === 4) {
      const y = parts[2];
      const p1 = Number(parts[0]);
      const p2 = Number(parts[1]);
      if (p1 > 12 && p2 <= 12) {
        const norm = `${y}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
        if (!isNaN(new Date(norm).getTime())) return norm;
      } else {
        const norm = `${y}-${String(parts[0]).padStart(2, '0')}-${String(parts[1]).padStart(2, '0')}`;
        if (!isNaN(new Date(norm).getTime())) return norm;
      }
    }
  }
  return null;
}

/**
 * Strips formatting characters from phone numbers, retaining only leading plus and digits.
 */
export function cleanPhoneForDial(phone: string | null | undefined): string {
  if (!phone) return '';
  return phone.replace(/[^\d+]/g, '');
}

/**
 * Timezone-safe local date parser avoiding UTC midnight shift issues.
 */
export function parseLocalDate(val: string | null | undefined): Date | null {
  if (!val || !val.trim()) return null;
  const norm = normalizeDateInput(val) || val.trim();
  const parts = norm.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      const dt = new Date(y, m, d);
      return isNaN(dt.getTime()) ? null : dt;
    }
  }
  const dt = new Date(val);
  return isNaN(dt.getTime()) ? null : dt;
}

/**
 * Formats a Date object to standard YYYY-MM-DD string.
 */
export function formatLocalDate(d: Date | null | undefined): string {
  if (!d || isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Formats a date value (string or Date) according to user's preferred display pattern.
 */
export function formatDateByPattern(
  val: string | Date | null | undefined,
  pattern: string = 'YYYY-MM-DD'
): string {
  if (!val) return '';
  let y = 0,
    m = 0,
    d = 0;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    y = val.getFullYear();
    m = val.getMonth() + 1;
    d = val.getDate();
  } else if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const parts = trimmed.slice(0, 10).split('-');
      y = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10);
      d = parseInt(parts[2], 10);
    } else {
      const parsed = parseLocalDate(trimmed);
      if (!parsed) return trimmed;
      y = parsed.getFullYear();
      m = parsed.getMonth() + 1;
      d = parsed.getDate();
    }
  }

  if (!y || !m || !d || isNaN(y) || isNaN(m) || isNaN(d)) {
    return typeof val === 'string' ? val : '';
  }

  const yyyy = String(y);
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');

  switch (pattern) {
    case 'DD/MM/YYYY':
      return `${dd}/${mm}/${yyyy}`;
    case 'MM/DD/YYYY':
      return `${mm}/${dd}/${yyyy}`;
    case 'DD-MM-YYYY':
      return `${dd}-${mm}-${yyyy}`;
    case 'YYYY/MM/DD':
      return `${yyyy}/${mm}/${dd}`;
    case 'DD.MM.YYYY':
      return `${dd}.${mm}.${yyyy}`;
    case 'YYYY-MM-DD':
    default:
      return `${yyyy}-${mm}-${dd}`;
  }
}

/**
 * Formats a date, days number, or ISO date string into a human-friendly relative time string.
 * Examples: 'Today', 'Yesterday', '3 days ago', '2 weeks ago', '3 months ago', '1 year ago'.
 * Supports options for short notation (e.g. '3d ago') and deterministic testing via baseDate.
 */
export function formatRelativeTime(
  val: string | Date | number | null | undefined,
  options?: { short?: boolean; baseDate?: Date }
): string {
  if (val === null || val === undefined || val === '') return '';

  let diffDays: number;

  if (typeof val === 'number') {
    diffDays = Math.round(val);
  } else {
    let dateObj: Date | null = null;
    if (val instanceof Date) {
      dateObj = isNaN(val.getTime()) ? null : val;
    } else if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed) return '';
      dateObj = parseLocalDate(trimmed);
      if (!dateObj || isNaN(dateObj.getTime())) {
        const fallback = new Date(trimmed);
        dateObj = isNaN(fallback.getTime()) ? null : fallback;
      }
    }

    if (!dateObj) return '';

    const base = options?.baseDate || new Date();
    const today = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    const target = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    const diffMs = today.getTime() - target.getTime();
    diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  }

  if (isNaN(diffDays)) return '';

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays === -1) return 'Tomorrow';
  if (diffDays < -1) {
    const daysFuture = Math.abs(diffDays);
    return options?.short ? `in ${daysFuture}d` : `in ${daysFuture} days`;
  }

  if (options?.short) {
    return `${diffDays}d ago`;
  }

  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }

  const weeks = Math.floor(diffDays / 7);
  if (diffDays < 30) {
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  }

  const months = Math.floor(diffDays / 30);
  if (diffDays < 365) {
    return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  }

  const years = Math.floor(diffDays / 365);
  return `${years} ${years === 1 ? 'year' : 'years'} ago`;
}
