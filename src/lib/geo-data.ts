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

export function getTimezoneOffsetString(timeZone: string): string {
  try {
    if (timeZone === 'UTC') return 'GMT+0';
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
    });
    const parts = formatter.formatToParts(new Date());
    const offset = parts.find((p) => p.type === 'timeZoneName')?.value;
    return offset || 'GMT+0';
  } catch {
    return 'GMT+0';
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
