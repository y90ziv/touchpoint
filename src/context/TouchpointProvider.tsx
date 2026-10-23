'use client';

import React, { useEffect, useCallback, ReactNode } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { ThemeProvider, useTheme } from './ThemeContext';
import { UIProvider, useUI } from './UIContext';
import { GroupsProvider, useGroups } from './GroupsContext';
import { ContactsProvider, useContacts } from './ContactsContext';
import { TouchpointsProvider, useTouchpoints } from './TouchpointsContext';
import { ThemePreset, ThemeMode } from '@/types/touchpoint';
import { guessCountryDialCode } from '@/lib/geo-data';

export interface TouchpointProviderProps {
  children: ReactNode;
}

/**
 * Client-side data bootstrapper & keyboard listener inside TouchpointProvider.
 * Note: useEffect only runs in the browser, preserving 100% SSR purity for renderToString tests.
 */
function TouchpointEffects({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const theme = useTheme();
  const ui = useUI();
  const groups = useGroups();
  const contacts = useContacts();
  const touchpoints = useTouchpoints();

  const bootstrapAll = useCallback(async () => {
    try {
      const meRes = await fetch('/api/auth/me');
      if (!meRes.ok) return;
      const meData = await meRes.json();
      auth.setSetupComplete(meData.setupComplete ?? true);
      auth.setAuthDisabled(Boolean(meData.authDisabled));
      auth.setAllowSignups(Boolean(meData.allowSignups));

      if (meData.authDisabled || meData.user) {
        auth.setCurrentUser(
          meData.user || { id: 1, email: 'admin@localhost', username: 'admin' }
        );
      } else {
        auth.setCurrentUser(null);
        auth.setAuthMode(!meData.setupComplete ? 'signup' : 'login');
        return;
      }

      const [cRes, gRes, dRes, rRes, sRes, hRes] = await Promise.all([
        fetch('/api/contacts'),
        fetch('/api/groups'),
        fetch('/api/contacts?mode=duplicates'),
        fetch('/api/relationships'),
        fetch('/api/settings'),
        fetch('/api/health').catch(() => null),
      ]);

      const [cData, gData, dData, rData, sData, hData] = await Promise.all([
        cRes.ok ? cRes.json() : { contacts: [] },
        gRes.ok ? gRes.json() : { groups: [] },
        dRes.ok ? dRes.json() : { duplicates: [] },
        rRes.ok ? rRes.json() : { nodes: [], edges: [] },
        sRes.ok ? sRes.json() : { settings: null },
        hRes && hRes.ok ? hRes.json().catch(() => null) : Promise.resolve(null),
      ]);

      if (hData?.services) {
        ui.setSystemServices(hData.services);
      }
      if (cData.contacts) {
        contacts.setContacts(cData.contacts);
      }
      if (gData.groups) {
        groups.setGroups(gData.groups);
      }
      if (dData.duplicates) {
        contacts.setDuplicates(dData.duplicates);
      }
      if (rData?.nodes) {
        touchpoints.setGraph(rData);
      }
      if (sData?.settings) {
        const s = sData.settings;
        if (
          typeof window !== 'undefined' &&
          (s.timezone === 'UTC' || !s.timezone) &&
          typeof Intl !== 'undefined'
        ) {
          try {
            const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (detectedTz && detectedTz !== 'UTC') {
              s.timezone = detectedTz;
              fetch('/api/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ timezone: detectedTz }),
              }).catch(() => {});
            }
          } catch {}
        }
        ui.setSettingsState((prev) => ({ ...prev, ...s }));

        const storedPreset =
          typeof window !== 'undefined'
            ? (localStorage.getItem('touchpoint_theme_preset') as ThemePreset | null)
            : null;
        const storedMode =
          typeof window !== 'undefined'
            ? (localStorage.getItem('touchpoint_theme_mode') as ThemeMode | null)
            : null;

        const preset: ThemePreset = storedPreset || (s.themePreset as ThemePreset) || 'sbb';
        const mode: ThemeMode = storedMode || (s.themeMode === 'dark' ? 'dark' : 'light');
        theme.setThemePreset(preset);
        theme.setThemeMode(mode);
      }

      fetch('/api/backup/snapshots')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.snapshots) ui.setSnapshots(data.snapshots);
        })
        .catch(() => {});

      fetch('/api/google?mode=tombstones')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.tombstones) ui.setGoogleTombstones(data.tombstones);
        })
        .catch(() => {});
    } catch {
      // Handled gracefully
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bootstrapAll();
  }, [bootstrapAll]);

  // Reload data when user logs in or completes setup
  useEffect(() => {
    if (auth.currentUser && contacts.contacts.length === 0) {
      Promise.all([
        contacts.loadContacts(),
        groups.loadGroups(),
        contacts.loadDuplicates(),
        touchpoints.loadGraph(),
        ui.loadSettings(),
        ui.loadSnapshots(),
        ui.loadGoogleTombstones(),
      ]).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.currentUser?.id]);

  // Auto-load touchpoint history when contact drawer opens
  useEffect(() => {
    if (!contacts.activeContactDrawer?.id) {
      touchpoints.setDrawerTouchpoints([]);
      return;
    }
    touchpoints.loadTouchpoints(contacts.activeContactDrawer.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts.activeContactDrawer?.id]);

  // Auto-detect browser timezone for setup form
  useEffect(() => {
    try {
      if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
        const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (detectedTz) {
          const detectedCountry = guessCountryDialCode(detectedTz);
          auth.setSetupForm((prev) => {
            if (prev.timezone === 'UTC' || !prev.timezone) {
              return {
                ...prev,
                timezone: detectedTz,
                defaultCountryCode: detectedCountry || prev.defaultCountryCode,
              };
            }
            return prev;
          });
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global Keyboard Shortcuts (⌘K & Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        ui.setShowQuickSearchModal((prev) => !prev);
      } else if (e.key === 'Escape') {
        if (contacts.editingContact) {
          contacts.setEditingContact(null);
          return;
        }
        if (contacts.activeContactDrawer) {
          contacts.setActiveContactDrawer(null);
          return;
        }
        if (groups.selectedGroupDetails) {
          groups.setSelectedGroupDetails(null);
          return;
        }
        ui.setShowQuickSearchModal(false);
        ui.setShowPauseModal(false);
        contacts.setShowColumnsPopover(false);
        ui.setShowDashboardCustomizer(false);
        contacts.setShowNewContactModal(false);
        contacts.setShowMergeModal(false);
        ui.setShowDeleteModal(false);
        auth.setShow2faSetupModal(false);
        auth.setShow2faDisableModal(false);
        ui.setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    contacts.editingContact,
    contacts.activeContactDrawer,
    groups.selectedGroupDetails,
  ]);

  return <>{children}</>;
}

/**
 * Root Touchpoint PRM domain provider composing all context hierarchies:
 * Auth -> Theme -> UI -> Groups -> Contacts -> Touchpoints
 */
export function TouchpointProvider({ children }: TouchpointProviderProps) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <UIProvider>
          <GroupsProvider>
            <ContactsProvider>
              <TouchpointsProvider>
                <TouchpointEffects>{children}</TouchpointEffects>
              </TouchpointsProvider>
            </ContactsProvider>
          </GroupsProvider>
        </UIProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
