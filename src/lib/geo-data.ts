import countriesData from './countries-data.json';

export interface CountryItem {
  iso: string;
  name: string;
  dialCode: string;
  flag: string;
}

export const ALL_COUNTRIES: CountryItem[] = countriesData as CountryItem[];

// Priority countries shown at the top of the selector for quick access
export const POPULAR_COUNTRY_ISOS = [
  'IL', // Israel (+972)
  'US', // United States (+1)
  'GB', // United Kingdom (+44)
  'CA', // Canada (+1)
  'DE', // Germany (+49)
  'FR', // France (+33)
  'AU', // Australia (+61)
  'IN', // India (+91)
  'BR', // Brazil (+55)
  'IT', // Italy (+39)
  'ES', // Spain (+34)
  'NL', // Netherlands (+31)
  'CH', // Switzerland (+41)
  'JP', // Japan (+81)
  'SG', // Singapore (+65)
  'AE', // UAE (+971)
];

export const POPULAR_COUNTRIES: CountryItem[] = POPULAR_COUNTRY_ISOS
  .map((iso) => ALL_COUNTRIES.find((c) => c.iso === iso))
  .filter((c): c is CountryItem => Boolean(c));

export const COMMON_TIMEZONES = [
  'UTC',
  'Asia/Jerusalem',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Amsterdam',
  'Europe/Kyiv',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Pacific/Auckland',
  'America/Sao_Paulo',
  'Africa/Johannesburg',
];

export function getTimezoneOffsetString(timeZone: string, date: Date = new Date()): string {
  try {
    if (timeZone === 'UTC') return 'GMT+0';
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
    });
    const parts = formatter.formatToParts(date);
    const offset = parts.find((p) => p.type === 'timeZoneName')?.value;
    return offset || 'GMT+0';
  } catch {
    return 'GMT+0';
  }
}

/**
 * Normalizes user timezone input into a standard IANA timezone.
 * Resolves common names like "Israel", "Jerusalem", "IDT", "IST", "GMT+3", "UTC+3"
 * to canonical IANA timezone "Asia/Jerusalem" to guarantee accurate Daylight Saving Time (DST) tracking.
 */
export function normalizeTimezone(tzInput?: string | null): string {
  if (!tzInput || !tzInput.trim()) return 'UTC';
  const tz = tzInput.trim();

  // If already a valid IANA timezone known to Intl, use it directly
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: tz });
    if (tz.toLowerCase() === 'israel') return 'Asia/Jerusalem';
    if (tz.includes('/') || tz.toUpperCase() === 'UTC') return tz;
  } catch {
    // Fall through to normalizers
  }

  const lower = tz.toLowerCase().replace(/[\s_]+/g, ' ');

  // Common regional aliases that require canonical IANA zones for DST
  if (
    lower.includes('jerusalem') ||
    lower.includes('israel') ||
    lower.includes('tel aviv') ||
    lower === 'idt' ||
    lower === 'ist'
  ) {
    return 'Asia/Jerusalem';
  }
  if (lower.includes('london') || lower.includes('uk') || lower.includes('britain') || lower === 'bst') {
    return 'Europe/London';
  }
  if (lower.includes('berlin') || lower.includes('germany') || lower === 'cest' || lower === 'cet') {
    return 'Europe/Berlin';
  }
  if (lower.includes('paris') || lower.includes('france')) {
    return 'Europe/Paris';
  }
  if (lower.includes('new york') || lower.includes('eastern') || lower === 'edt' || lower === 'est') {
    return 'America/New_York';
  }
  if (lower.includes('los angeles') || lower.includes('pacific') || lower === 'pdt' || lower === 'pst') {
    return 'America/Los_Angeles';
  }
  if (lower.includes('chicago') || lower.includes('central') || lower === 'cdt' || lower === 'cst') {
    return 'America/Chicago';
  }

  // Handle generic offset strings like GMT+3, UTC+3, +3, GMT-5, etc.
  const offsetMatch = tz.match(/^(?:gmt|utc)?\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?$/i);
  if (offsetMatch) {
    const sign = offsetMatch[1];
    const hours = offsetMatch[2].padStart(2, '0');
    const minutes = (offsetMatch[3] || '00').padStart(2, '0');
    const formattedOffset = `${sign}${hours}:${minutes}`;
    // If user specified GMT+3 or UTC+3, map to Asia/Jerusalem so DST is respected rather than fixed offset
    if (formattedOffset === '+03:00' || formattedOffset === '+02:00') {
      return 'Asia/Jerusalem';
    }
    try {
      new Intl.DateTimeFormat(undefined, { timeZone: formattedOffset });
      return formattedOffset;
    } catch {
      // ignore
    }
  }

  return 'UTC';
}

/**
 * Resolves the effective IANA timezone. If timezone is empty or 'UTC' (default fallback),
 * infers local timezone from defaultCountryCode (e.g. +972 -> Asia/Jerusalem) or process.env.TZ.
 */
export function resolveEffectiveTimezone(
  tzInput?: string | null,
  countryCodeInput?: string | null
): string {
  if (tzInput && tzInput.trim() && tzInput.trim() !== 'UTC') {
    return normalizeTimezone(tzInput);
  }

  // If tz is explicitly 'UTC' or empty, but country code is set
  if (countryCodeInput && countryCodeInput.trim()) {
    const code = countryCodeInput.trim().replace(/[^\d+]/g, '');
    if (code === '+972' || code === '972') return 'Asia/Jerusalem';
    if (code === '+44' || code === '44') return 'Europe/London';
    if (code === '+49' || code === '49') return 'Europe/Berlin';
    if (code === '+33' || code === '33') return 'Europe/Paris';
    if (code === '+34' || code === '34') return 'Europe/Madrid';
    if (code === '+39' || code === '39') return 'Europe/Rome';
    if (code === '+31' || code === '31') return 'Europe/Amsterdam';
    if (code === '+380' || code === '380') return 'Europe/Kyiv';
    if (code === '+91' || code === '91') return 'Asia/Kolkata';
    if (code === '+81' || code === '81') return 'Asia/Tokyo';
    if (code === '+971' || code === '971') return 'Asia/Dubai';
    if (code === '+65' || code === '65') return 'Asia/Singapore';
    if (code === '+61' || code === '61') return 'Australia/Sydney';
  }

  if (typeof process !== 'undefined' && process.env?.TZ && process.env.TZ !== 'UTC') {
    return normalizeTimezone(process.env.TZ);
  }

  return 'UTC';
}

export interface TimezoneDetails {
  timezone: string;
  offsetString: string;
  isDST: boolean;
  timeZoneName: string;
  currentLocalTime: string;
}

export function getTimezoneDetails(
  tzInput?: string | null,
  countryCode?: string | null,
  checkDate: Date = new Date()
): TimezoneDetails {
  const timezone = resolveEffectiveTimezone(tzInput, countryCode);
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      timeZoneName: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(checkDate);
    const tzName = parts.find((p) => p.type === 'timeZoneName')?.value || '';
    const offsetStr = getTimezoneOffsetString(timezone, checkDate);

    const hh = parts.find((p) => p.type === 'hour')?.value || '00';
    const mm = parts.find((p) => p.type === 'minute')?.value || '00';

    const getOffsetMinutes = (d: Date) => {
      const p = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'shortOffset',
      }).formatToParts(d);
      const str = p.find((item) => item.type === 'timeZoneName')?.value || 'GMT+0';
      const m = str.match(/GMT([+-])(\d+)(?::(\d+))?/);
      if (!m) return 0;
      const sign = m[1] === '-' ? -1 : 1;
      const hours = parseInt(m[2], 10);
      const mins = m[3] ? parseInt(m[3], 10) : 0;
      return sign * (hours * 60 + mins);
    };

    const currentOffsetMin = getOffsetMinutes(checkDate);
    const janOffsetMin = getOffsetMinutes(new Date(Date.UTC(checkDate.getUTCFullYear(), 0, 15, 12, 0, 0)));
    const julOffsetMin = getOffsetMinutes(new Date(Date.UTC(checkDate.getUTCFullYear(), 6, 15, 12, 0, 0)));
    const standardOffsetMin = Math.min(janOffsetMin, julOffsetMin);
    const isDST = currentOffsetMin > standardOffsetMin;

    return {
      timezone,
      offsetString: offsetStr,
      isDST,
      timeZoneName: tzName,
      currentLocalTime: `${hh}:${mm}`,
    };
  } catch {
    return {
      timezone: 'UTC',
      offsetString: 'GMT+0',
      isDST: false,
      timeZoneName: 'UTC',
      currentLocalTime: '00:00',
    };
  }
}

export function getAllTimezones(): string[] {
  try {
    const supported = typeof Intl !== 'undefined' && Intl.supportedValuesOf
      ? Intl.supportedValuesOf('timeZone')
      : [];
    const set = new Set<string>(['UTC', ...COMMON_TIMEZONES, ...supported]);
    return Array.from(set).sort((a, b) => {
      if (a === 'UTC') return -1;
      if (b === 'UTC') return 1;
      return a.localeCompare(b);
    });
  } catch {
    return ['UTC', ...COMMON_TIMEZONES];
  }
}

/**
 * Intelligent heuristic to guess user's default phone country calling code
 * from their detected browser timezone.
 */
export function guessCountryDialCode(timezone?: string): string {
  const tz = timezone || (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : '');
  if (!tz) return '+1';

  if (tz.includes('Jerusalem') || tz.includes('Tel_Aviv')) return '+972';
  if (tz.includes('London')) return '+44';
  if (tz.includes('Berlin')) return '+49';
  if (tz.includes('Paris')) return '+33';
  if (tz.includes('Madrid')) return '+34';
  if (tz.includes('Rome')) return '+39';
  if (tz.includes('Amsterdam')) return '+31';
  if (tz.includes('Zurich')) return '+41';
  if (tz.includes('Kyiv')) return '+380';
  if (tz.includes('Kolkata') || tz.includes('Calcutta')) return '+91';
  if (tz.includes('Tokyo')) return '+81';
  if (tz.includes('Dubai')) return '+971';
  if (tz.includes('Singapore')) return '+65';
  if (tz.includes('Sydney') || tz.includes('Melbourne') || tz.includes('Brisbane')) return '+61';
  if (tz.includes('Auckland')) return '+64';
  if (tz.includes('Sao_Paulo')) return '+55';
  if (tz.includes('Johannesburg')) return '+27';
  if (tz.startsWith('America/')) return '+1';

  return '+1';
}

/**
 * Find country item by dial code (e.g. '+972') or ISO code (e.g. 'IL')
 */
export function findCountryByDialOrIso(query: string): CountryItem | undefined {
  if (!query) return undefined;
  const clean = query.trim();
  // Try exact match on ISO
  const byIso = ALL_COUNTRIES.find((c) => c.iso.toUpperCase() === clean.toUpperCase());
  if (byIso) return byIso;
  // Try match on dialCode (with +)
  const formattedDial = clean.startsWith('+') ? clean : `+${clean}`;
  // Prefer popular countries if multiple share same code (e.g. +1 -> US before CA)
  const popularMatch = POPULAR_COUNTRIES.find((c) => c.dialCode === formattedDial);
  if (popularMatch) return popularMatch;
  return ALL_COUNTRIES.find((c) => c.dialCode === formattedDial);
}
