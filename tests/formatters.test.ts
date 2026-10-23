import { describe, it, expect } from 'vitest';
import {
  normalizeDateInput,
  cleanPhoneForDial,
  parseLocalDate,
  formatLocalDate,
  formatDateByPattern,
  formatRelativeTime,
} from '../src/lib/formatters';

describe('formatters utility library', () => {
  describe('normalizeDateInput', () => {
    it('returns empty string for empty, null, or undefined values', () => {
      expect(normalizeDateInput('')).toBe('');
      expect(normalizeDateInput('   ')).toBe('');
      expect(normalizeDateInput(null)).toBe('');
      expect(normalizeDateInput(undefined)).toBe('');
    });

    it('preserves valid ISO YYYY-MM-DD dates', () => {
      expect(normalizeDateInput('2026-10-23')).toBe('2026-10-23');
      expect(normalizeDateInput('1990-01-05')).toBe('1990-01-05');
    });

    it('normalizes YYYY/MM/DD dates to YYYY-MM-DD', () => {
      expect(normalizeDateInput('2026/10/23')).toBe('2026-10-23');
      expect(normalizeDateInput('2024/02/29')).toBe('2024-02-29');
    });

    it('normalizes European DD-MM-YYYY or DD.MM.YYYY dates where day > 12', () => {
      expect(normalizeDateInput('25-12-2025')).toBe('2025-12-25');
      expect(normalizeDateInput('31/01/2026')).toBe('2026-01-31');
      expect(normalizeDateInput('15.08.2024')).toBe('2024-08-15');
    });

    it('normalizes MM-DD-YYYY or other standard 3-part dates', () => {
      expect(normalizeDateInput('04/10/2026')).toBe('2026-04-10');
    });

    it('returns null for unparseable garbage strings', () => {
      expect(normalizeDateInput('not-a-date')).toBeNull();
      expect(normalizeDateInput('123-abc')).toBeNull();
    });
  });

  describe('cleanPhoneForDial', () => {
    it('strips spaces, dashes, and parens while retaining plus prefix and digits', () => {
      expect(cleanPhoneForDial('+1 (555) 234-5678')).toBe('+15552345678');
      expect(cleanPhoneForDial('050-123-4567')).toBe('0501234567');
      expect(cleanPhoneForDial('+44 20 7946 0912')).toBe('+442079460912');
    });

    it('returns empty string on null or undefined or empty', () => {
      expect(cleanPhoneForDial(null)).toBe('');
      expect(cleanPhoneForDial(undefined)).toBe('');
      expect(cleanPhoneForDial('')).toBe('');
    });
  });

  describe('parseLocalDate', () => {
    it('returns null for empty, null, or undefined values', () => {
      expect(parseLocalDate(null)).toBeNull();
      expect(parseLocalDate(undefined)).toBeNull();
      expect(parseLocalDate('')).toBeNull();
      expect(parseLocalDate('   ')).toBeNull();
    });

    it('correctly constructs a Date matching the local year, month, and day', () => {
      const dt = parseLocalDate('2026-10-23');
      expect(dt).not.toBeNull();
      expect(dt?.getFullYear()).toBe(2026);
      expect(dt?.getMonth()).toBe(9); // 0-indexed October
      expect(dt?.getDate()).toBe(23);
    });

    it('correctly parses dates formatted with slashes', () => {
      const dt = parseLocalDate('2025/12/31');
      expect(dt).not.toBeNull();
      expect(dt?.getFullYear()).toBe(2025);
      expect(dt?.getMonth()).toBe(11);
      expect(dt?.getDate()).toBe(31);
    });

    it('returns null for completely invalid date strings', () => {
      expect(parseLocalDate('invalid-date')).toBeNull();
    });
  });

  describe('formatLocalDate', () => {
    it('formats Date object to YYYY-MM-DD with zero-padding', () => {
      const dt = new Date(2026, 3, 5); // April 5, 2026
      expect(formatLocalDate(dt)).toBe('2026-04-05');
    });

    it('returns empty string for null, undefined, or invalid Date', () => {
      expect(formatLocalDate(null)).toBe('');
      expect(formatLocalDate(undefined)).toBe('');
      expect(formatLocalDate(new Date('invalid'))).toBe('');
    });
  });

  describe('formatDateByPattern', () => {
    const testDate = new Date(2026, 9, 23); // Oct 23, 2026

    it('supports YYYY-MM-DD pattern', () => {
      expect(formatDateByPattern(testDate, 'YYYY-MM-DD')).toBe('2026-10-23');
      expect(formatDateByPattern('2026-10-23', 'YYYY-MM-DD')).toBe('2026-10-23');
    });

    it('supports DD/MM/YYYY pattern', () => {
      expect(formatDateByPattern(testDate, 'DD/MM/YYYY')).toBe('23/10/2026');
      expect(formatDateByPattern('2026-10-23', 'DD/MM/YYYY')).toBe('23/10/2026');
    });

    it('supports MM/DD/YYYY pattern', () => {
      expect(formatDateByPattern(testDate, 'MM/DD/YYYY')).toBe('10/23/2026');
      expect(formatDateByPattern('2026-10-23', 'MM/DD/YYYY')).toBe('10/23/2026');
    });

    it('supports DD-MM-YYYY pattern', () => {
      expect(formatDateByPattern(testDate, 'DD-MM-YYYY')).toBe('23-10-2026');
    });

    it('supports YYYY/MM/DD pattern', () => {
      expect(formatDateByPattern(testDate, 'YYYY/MM/DD')).toBe('2026/10/23');
    });

    it('supports DD.MM.YYYY pattern', () => {
      expect(formatDateByPattern(testDate, 'DD.MM.YYYY')).toBe('23.10.2026');
    });

    it('returns empty string for falsy input', () => {
      expect(formatDateByPattern(null)).toBe('');
      expect(formatDateByPattern(undefined)).toBe('');
      expect(formatDateByPattern('')).toBe('');
    });
  });

  describe('formatRelativeTime', () => {
    const baseDate = new Date(2026, 9, 23, 12, 0, 0); // Oct 23, 2026

    it('handles numeric day counts', () => {
      expect(formatRelativeTime(0)).toBe('Today');
      expect(formatRelativeTime(1)).toBe('Yesterday');
      expect(formatRelativeTime(4)).toBe('4 days ago');
      expect(formatRelativeTime(14)).toBe('2 weeks ago');
      expect(formatRelativeTime(60)).toBe('2 months ago');
      expect(formatRelativeTime(400)).toBe('1 year ago');
    });

    it('handles short mode for numeric day counts', () => {
      expect(formatRelativeTime(0, { short: true })).toBe('Today');
      expect(formatRelativeTime(1, { short: true })).toBe('Yesterday');
      expect(formatRelativeTime(5, { short: true })).toBe('5d ago');
      expect(formatRelativeTime(-3, { short: true })).toBe('in 3d');
    });

    it('handles string date inputs with deterministic baseDate', () => {
      expect(formatRelativeTime('2026-10-23', { baseDate })).toBe('Today');
      expect(formatRelativeTime('2026-10-22', { baseDate })).toBe('Yesterday');
      expect(formatRelativeTime('2026-10-19', { baseDate })).toBe('4 days ago');
      expect(formatRelativeTime('2026-10-24', { baseDate })).toBe('Tomorrow');
      expect(formatRelativeTime('2026-10-27', { baseDate })).toBe('in 4 days');
    });

    it('handles Date object inputs with deterministic baseDate', () => {
      const yesterday = new Date(2026, 9, 22);
      expect(formatRelativeTime(yesterday, { baseDate })).toBe('Yesterday');
    });

    it('returns empty string for null, undefined, or empty values', () => {
      expect(formatRelativeTime(null)).toBe('');
      expect(formatRelativeTime(undefined)).toBe('');
      expect(formatRelativeTime('')).toBe('');
    });
  });
});
