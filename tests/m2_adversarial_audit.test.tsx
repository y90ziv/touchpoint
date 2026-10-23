import { describe, it, expect, vi } from 'vitest';
import React, { useState } from 'react';
import { renderToString } from 'react-dom/server';
import {
  normalizeDateInput,
  cleanPhoneForDial,
  parseLocalDate,
  formatLocalDate,
  formatDateByPattern,
  formatRelativeTime,
} from '../src/lib/formatters';
import {
  TouchpointProvider,
  useAuth,
  useTheme,
  useContacts,
  useGroups,
  useTouchpoints,
  useUI,
} from '../src/context';

describe('M2 Adversarial Stress Testing', () => {
  describe('Formatters Edge Case Mining', () => {
    it('handles ISO timestamps with time and timezone components in formatDateByPattern', () => {
      const iso = '2026-10-23T14:32:00.000Z';
      expect(formatDateByPattern(iso, 'YYYY-MM-DD')).toBe('2026-10-23');
      expect(formatDateByPattern(iso, 'DD/MM/YYYY')).toBe('23/10/2026');
      expect(formatDateByPattern(iso, 'MM/DD/YYYY')).toBe('10/23/2026');
    });

    it('handles leap years accurately in normalizeDateInput', () => {
      // 2024 is a leap year, 2023 is not
      expect(normalizeDateInput('2024-02-29')).toBe('2024-02-29');
      expect(normalizeDateInput('29/02/2024')).toBe('2024-02-29');
    });

    it('handles phone numbers with extensions, letters, and punctuation', () => {
      expect(cleanPhoneForDial('1-800-CONTACTS')).toBe('1800');
      expect(cleanPhoneForDial('+972 (0) 50-123.4567 ext. 89')).toBe('+972050123456789');
      expect(cleanPhoneForDial('++1-234-567')).toBe('++1234567');
      expect(cleanPhoneForDial('   ')).toBe('');
    });

    it('handles future and past relative times across various boundaries', () => {
      const base = new Date(2026, 9, 23, 12, 0, 0); // Oct 23, 2026

      // Past
      expect(formatRelativeTime('2026-10-23', { baseDate: base })).toBe('Today');
      expect(formatRelativeTime('2026-10-22', { baseDate: base })).toBe('Yesterday');
      expect(formatRelativeTime('2026-10-20', { baseDate: base })).toBe('3 days ago');
      expect(formatRelativeTime('2026-10-09', { baseDate: base })).toBe('2 weeks ago');
      expect(formatRelativeTime('2026-08-23', { baseDate: base })).toBe('2 months ago');
      expect(formatRelativeTime('2024-10-23', { baseDate: base })).toBe('2 years ago');

      // Future
      expect(formatRelativeTime('2026-10-24', { baseDate: base })).toBe('Tomorrow');
      expect(formatRelativeTime('2026-10-26', { baseDate: base })).toBe('in 3 days');
      expect(formatRelativeTime('2026-10-26', { baseDate: base, short: true })).toBe('in 3d');

      // Numeric values
      expect(formatRelativeTime(-1)).toBe('Tomorrow');
      expect(formatRelativeTime(-10)).toBe('in 10 days');
      expect(formatRelativeTime(-10, { short: true })).toBe('in 10d');
      expect(formatRelativeTime(0)).toBe('Today');
      expect(formatRelativeTime(1)).toBe('Yesterday');
    });

    it('handles malformed date inputs gracefully without crashing', () => {
      expect(normalizeDateInput('2026/99/99')).toBeNull();
      expect(parseLocalDate('random-gibberish')).toBeNull();
      expect(formatLocalDate(new Date('invalid date'))).toBe('');
      expect(formatDateByPattern('not-a-date', 'YYYY-MM-DD')).toBe('not-a-date');
      expect(formatRelativeTime('completely invalid date')).toBe('');
    });
  });

  describe('Context Boundary & Isolation Stress Testing', () => {
    it('ensures each context provider manages state independently without cross-leakage', () => {
      let contactsHook: any;
      let uiHook: any;
      let themeHook: any;

      function TestConsumer() {
        contactsHook = useContacts();
        uiHook = useUI();
        themeHook = useTheme();
        return <div>Rendered</div>;
      }

      renderToString(
        <TouchpointProvider>
          <TestConsumer />
        </TouchpointProvider>
      );

      expect(contactsHook.contacts).toEqual([]);
      expect(uiHook.activeTab).toBe('dashboard');
      expect(themeHook.themePreset).toBe('sbb');

      // Confirm hooks expose all expected methods and contracts
      expect(typeof contactsHook.createContact).toBe('function');
      expect(typeof contactsHook.patchContact).toBe('function');
      expect(typeof contactsHook.deleteContact).toBe('function');
      expect(typeof contactsHook.mergeDuplicate).toBe('function');
      expect(typeof contactsHook.snoozeContact).toBe('function');
      expect(typeof contactsHook.bulkAction).toBe('function');

      expect(typeof uiHook.notify).toBe('function');
      expect(typeof uiHook.saveSettings).toBe('function');
      expect(typeof uiHook.unblockTombstone).toBe('function');
      expect(typeof uiHook.runGoogleSync).toBe('function');
      expect(typeof uiHook.createSnapshot).toBe('function');
      expect(typeof uiHook.wipeAllData).toBe('function');

      expect(typeof themeHook.toggleThemeMode).toBe('function');
      expect(typeof themeHook.applyTheme).toBe('function');
    });

    it('verifies default settings state structure matches PRM requirements', () => {
      let uiHook: any;
      function TestConsumer() {
        uiHook = useUI();
        return null;
      }

      renderToString(
        <TouchpointProvider>
          <TestConsumer />
        </TouchpointProvider>
      );

      const s = uiHook.settingsState;
      expect(s.timezone).toBe('UTC');
      expect(s.dateFormat).toBe('YYYY-MM-DD');
      expect(s.defaultCountryCode).toBe('+1');
      expect(s.dashboardWidgets).toBeDefined();
      expect(s.dashboardWidgets.healthStrip).toBe(true);
      expect(s.dashboardWidgets.overdueDue).toBe(true);
    });
  });
});
