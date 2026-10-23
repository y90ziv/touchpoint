import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';
import { findCountryByDialOrIso } from '@/lib/geo-data';

export interface PhoneFormatResult {
  e164: string;
  international: string;
  national: string;
  isValid: boolean;
  countryIso?: string;
  dialCode?: string;
}

/**
 * Intelligently format phone numbers using libphonenumber-js with country context.
 * Automatically handles local formats (e.g. 0548366836 with Israel -> +972548366836),
 * formats with leading zeroes, national and international standards.
 */
export function formatPhoneNumber(
  rawPhone: string | null | undefined,
  countryDialOrIso?: string | null
): PhoneFormatResult {
  if (!rawPhone || !rawPhone.trim()) {
    return { e164: '', international: '', national: '', isValid: false };
  }

  const clean = rawPhone.trim();
  const country = countryDialOrIso ? findCountryByDialOrIso(countryDialOrIso) : undefined;
  const iso = (country?.iso?.toUpperCase() || 'IL') as CountryCode;
  const dialCode = country?.dialCode || '+972';

  // 1. If starts with 0 (e.g. 0548366836), replace leading 0 with dialCode
  if (clean.startsWith('0')) {
    try {
      const stripped = clean.replace(/^0+/, '');
      const withDial = `${dialCode}${stripped}`;
      const parsedWithDial = parsePhoneNumberFromString(withDial, iso);
      if (parsedWithDial) {
        return {
          e164: parsedWithDial.format('E.164'),
          international: parsedWithDial.formatInternational(),
          national: parsedWithDial.formatNational(),
          isValid: parsedWithDial.isValid(),
          countryIso: parsedWithDial.country,
          dialCode,
        };
      }
      return {
        e164: withDial,
        international: withDial,
        national: clean,
        isValid: false,
        countryIso: country?.iso,
        dialCode,
      };
    } catch {}
  }

  // 2. Direct parse using selected country ISO
  try {
    const parsed = parsePhoneNumberFromString(clean, iso);
    if (parsed && parsed.isValid()) {
      return {
        e164: parsed.format('E.164'),
        international: parsed.formatInternational(),
        national: parsed.formatNational(),
        isValid: true,
        countryIso: parsed.country,
        dialCode: `+${parsed.countryCallingCode}`,
      };
    }
  } catch {}

  // 3. If starts with dialCode without '+' (e.g. 972548366836)
  const dialDigits = dialCode.replace('+', '');
  if (clean.startsWith(dialDigits)) {
    try {
      const withPlus = `+${clean}`;
      const parsedPlus = parsePhoneNumberFromString(withPlus);
      if (parsedPlus) {
        return {
          e164: parsedPlus.format('E.164'),
          international: parsedPlus.formatInternational(),
          national: parsedPlus.formatNational(),
          isValid: parsedPlus.isValid(),
          countryIso: parsedPlus.country,
          dialCode,
        };
      }
    } catch {}
  }

  // 4. Try parsing as international if starts with '+'
  if (clean.startsWith('+')) {
    try {
      const parsedIntl = parsePhoneNumberFromString(clean);
      if (parsedIntl) {
        return {
          e164: parsedIntl.format('E.164'),
          international: parsedIntl.formatInternational(),
          national: parsedIntl.formatNational(),
          isValid: parsedIntl.isValid(),
          countryIso: parsedIntl.country,
          dialCode: `+${parsedIntl.countryCallingCode}`,
        };
      }
    } catch {}
  }

  return {
    e164: clean,
    international: clean,
    national: clean,
    isValid: false,
    countryIso: country?.iso,
    dialCode,
  };
}
