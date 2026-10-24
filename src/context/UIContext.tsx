'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import {
  NavigationTab,
  SearchFilterTab,
  SettingsState,
  SystemServices,
  GoogleTombstoneItem,
  SnapshotItem,
} from '@/types/touchpoint';

export interface UIContextValue {
  // Navigation & Shell
  activeTab: NavigationTab;
  setActiveTab: React.Dispatch<React.SetStateAction<NavigationTab>>;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Search & Global Filter
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  searchFilterTab: SearchFilterTab;
  setSearchFilterTab: React.Dispatch<React.SetStateAction<SearchFilterTab>>;
  searchFilterGroup: number | null;
  setSearchFilterGroup: React.Dispatch<React.SetStateAction<number | null>>;
  showQuickSearchModal: boolean;
  setShowQuickSearchModal: React.Dispatch<React.SetStateAction<boolean>>;

  // Vacation / Global Cadence Pause
  showPauseModal: boolean;
  setShowPauseModal: React.Dispatch<React.SetStateAction<boolean>>;
  pauseCustomDate: string;
  setPauseCustomDate: React.Dispatch<React.SetStateAction<string>>;

  // Dashboard Customization
  showDashboardCustomizer: boolean;
  setShowDashboardCustomizer: React.Dispatch<React.SetStateAction<boolean>>;
  dashboardWidgets: Record<string, boolean>;
  setDashboardWidgets: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;

  // Accordion Expanders
  openHelpSection: number | null;
  setOpenHelpSection: React.Dispatch<React.SetStateAction<number | null>>;
  openSettingsSection: number | null;
  setOpenSettingsSection: React.Dispatch<React.SetStateAction<number | null>>;

  // Feedback Notifications
  statusToast: string | null;
  setStatusToast: React.Dispatch<React.SetStateAction<string | null>>;
  notify: (msg: string) => void;

  // Settings & System Services
  settingsState: SettingsState;
  setSettingsState: React.Dispatch<React.SetStateAction<SettingsState>>;
  systemServices: SystemServices;
  setSystemServices: React.Dispatch<React.SetStateAction<SystemServices>>;

  // Google Sync & Tombstones
  googleTombstones: GoogleTombstoneItem[];
  setGoogleTombstones: React.Dispatch<React.SetStateAction<GoogleTombstoneItem[]>>;
  showTombstoneManager: boolean;
  setShowTombstoneManager: React.Dispatch<React.SetStateAction<boolean>>;
  syncFullRescan: boolean;
  setSyncFullRescan: React.Dispatch<React.SetStateAction<boolean>>;
  syncLoading: boolean;
  setSyncLoading: React.Dispatch<React.SetStateAction<boolean>>;

  // Database Backups & Danger Zone
  snapshots: SnapshotItem[];
  setSnapshots: React.Dispatch<React.SetStateAction<SnapshotItem[]>>;
  deleteConfirmText: string;
  setDeleteConfirmText: React.Dispatch<React.SetStateAction<string>>;
  showDeleteModal: boolean;
  setShowDeleteModal: React.Dispatch<React.SetStateAction<boolean>>;

  // Operations
  loadSettings: () => Promise<void>;
  saveSettings: (newSettings: Partial<SettingsState>) => Promise<boolean>;
  loadGoogleTombstones: () => Promise<void>;
  unblockTombstone: (id: number) => Promise<boolean>;
  unblockTombstones: (ids: number[]) => Promise<boolean>;
  clearAllDeletedTombstones: () => Promise<boolean>;
  runGoogleSync: (fullRescan?: boolean) => Promise<boolean>;
  loadSnapshots: () => Promise<void>;
  createSnapshot: () => Promise<boolean>;
  cleanAllSnapshots: () => Promise<boolean>;
  wipeAllData: () => Promise<boolean>;
}

export const UIContext = createContext<UIContextValue | null>(null);

const DEFAULT_SETTINGS_STATE: SettingsState = {
  timezone: 'UTC',
  dateFormat: 'YYYY-MM-DD',
  defaultCountryCode: '+1',
  dailyDigestTime: '09:00',
  firstDayOfWeek: 0,
  maxDailyDue: 3,
  birthdayDaysAdvance: 7,
  googleSyncInterval: 'manual',
  googleCalendarPushEnabled: false,
  googleCalendarId: 'primary',
  googleCalendarAutoPush: 'manual',
  googleCalendarPushDay: 0,
  googleCalendarPushTime: '08:00',
  googleCalendarPushAdvanceDays: 7,
  logLevel: 'info',
  icalSecretToken: '',
  snapshotScheduleMode: 'scheduled',
  snapshotIntervalUnit: 'days',
  snapshotIntervalValue: 1,
  lastSnapshotAt: null,
  dashboardWidgets: {
    healthStrip: true,
    overdueDue: true,
    birthdays: true,
    upcomingCalls: true,
    recentTalked: true,
    scheduledLater: true,
  },
};

export function UIProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilterTab, setSearchFilterTab] = useState<SearchFilterTab>('all');
  const [searchFilterGroup, setSearchFilterGroup] = useState<number | null>(null);
  const [showQuickSearchModal, setShowQuickSearchModal] = useState(false);

  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseCustomDate, setPauseCustomDate] = useState('');

  const [showDashboardCustomizer, setShowDashboardCustomizer] = useState(false);
  const [dashboardWidgets, setDashboardWidgets] = useState<Record<string, boolean>>({
    healthStrip: true,
    overdueDue: true,
    birthdays: true,
    upcomingCalls: true,
    recentTalked: true,
    scheduledLater: true,
  });

  useEffect(() => {
    try {
      const savedWidgets = localStorage.getItem('touchpoint_dashboard_widgets');
      if (savedWidgets) {
        const parsed = JSON.parse(savedWidgets);
        if (typeof parsed === 'object' && parsed !== null) {
          setDashboardWidgets((prev) => ({ ...prev, ...parsed }));
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  const [openHelpSection, setOpenHelpSection] = useState<number | null>(null);
  const [openSettingsSection, setOpenSettingsSection] = useState<number | null>(null);

  const [statusToast, setStatusToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const notify = useCallback((msg: string) => {
    setStatusToast(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setStatusToast(null);
    }, 3500);
  }, []);

  const [settingsState, setSettingsState] = useState<SettingsState>(DEFAULT_SETTINGS_STATE);
  const [systemServices, setSystemServices] = useState<SystemServices>({
    scheduler: 'running',
    telegramBot: 'idle',
  });

  const [googleTombstones, setGoogleTombstones] = useState<GoogleTombstoneItem[]>([]);
  const [showTombstoneManager, setShowTombstoneManager] = useState(false);
  const [syncFullRescan, setSyncFullRescan] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);

  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        const s = data.settings || data;
        setSettingsState((prev) => ({ ...prev, ...s }));
      }
    } catch {
      // Handled gracefully
    }
  }, []);

  const saveSettings = useCallback(
    async (newSettings: Partial<SettingsState>): Promise<boolean> => {
      try {
        const merged = { ...settingsState, ...newSettings };
        const res = await fetch('/api/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newSettings),
        });
        if (res.ok) {
          setSettingsState(merged);
          notify('Settings saved successfully');
          return true;
        }
      } catch {
        notify('Failed to save settings');
      }
      return false;
    },
    [settingsState, notify]
  );

  const loadGoogleTombstones = useCallback(async () => {
    try {
      const res = await fetch('/api/google?mode=tombstones');
      if (res.ok) {
        const data = await res.json();
        setGoogleTombstones(data.tombstones || []);
      }
    } catch {
      // Handled gracefully
    }
  }, []);

  const unblockTombstone = useCallback(
    async (id: number): Promise<boolean> => {
      try {
        const res = await fetch('/api/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'unblock_tombstone', tombstoneId: id }),
        });
        if (res.ok) {
          await loadGoogleTombstones();
          notify('Contact unblocked from Google sync. Click "Sync New Contacts Now" to re-import it.');
          return true;
        }
      } catch {
        // Handled gracefully
      }
      return false;
    },
    [loadGoogleTombstones, notify]
  );

  const unblockTombstones = useCallback(
    async (ids: number[]): Promise<boolean> => {
      if (ids.length === 0) return false;
      try {
        const res = await fetch('/api/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'bulk_unblock_tombstones', tombstoneIds: ids }),
        });
        if (res.ok) {
          await loadGoogleTombstones();
          notify(`Unblocked ${ids.length} contacts from Google sync.`);
          return true;
        }
      } catch {
        // Handled gracefully
      }
      return false;
    },
    [loadGoogleTombstones, notify]
  );

  const clearAllDeletedTombstones = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_deleted_tombstones' }),
      });
      if (res.ok) {
        await loadGoogleTombstones();
        notify('All deleted contacts unblocked from Google sync.');
        return true;
      }
    } catch {
      notify('Failed to unblock deleted tombstones.');
    }
    return false;
  }, [loadGoogleTombstones, notify]);

  const runGoogleSync = useCallback(
    async (fullRescan: boolean = false): Promise<boolean> => {
      setSyncLoading(true);
      try {
        const currentRedirect =
          typeof window !== 'undefined'
            ? `${window.location.origin}/api/google`.replace('0.0.0.0', 'localhost')
            : 'http://localhost:3000/api/google';
        const res = await fetch('/api/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sync',
            fullRescan,
            redirect_uri: currentRedirect,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          await loadGoogleTombstones();
          notify(
            `Synced: ${data.imported ?? 0} new imported, ${data.skippedExisting ?? 0} existing or blocked skipped.${fullRescan ? ' (Full Re-scan)' : ''}`
          );
          return true;
        }
      } catch {
        notify('Google sync encountered an error');
      } finally {
        setSyncLoading(false);
      }
      return false;
    },
    [loadGoogleTombstones, notify]
  );

  const loadSnapshots = useCallback(async () => {
    try {
      const res = await fetch('/api/backup/snapshots');
      if (res.ok) {
        const data = await res.json();
        setSnapshots(data.snapshots || []);
      }
    } catch {
      // Handled gracefully
    }
  }, []);

  const createSnapshot = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/backup/snapshots', { method: 'POST' });
      if (res.ok) {
        await loadSnapshots();
        notify('Backup snapshot created successfully');
        return true;
      }
    } catch {
      notify('Failed to create backup snapshot');
    }
    return false;
  }, [loadSnapshots, notify]);

  const cleanAllSnapshots = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/backup/snapshots', { method: 'DELETE' });
      if (res.ok) {
        await loadSnapshots();
        notify('All snapshots permanently deleted');
        return true;
      }
    } catch {
      notify('Failed to clean snapshots');
    }
    return false;
  }, [loadSnapshots, notify]);

  const wipeAllData = useCallback(async (): Promise<boolean> => {
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      notify('You must type DELETE to confirm data destruction');
      return false;
    }
    try {
      const res = await fetch('/api/backup', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'DELETE' }),
      });
      if (res.ok) {
        notify('All user data permanently deleted');
        setShowDeleteModal(false);
        setDeleteConfirmText('');
        return true;
      }
    } catch {
      notify('Failed to wipe database');
    }
    return false;
  }, [deleteConfirmText, notify]);

  const value = useMemo<UIContextValue>(
    () => ({
      activeTab,
      setActiveTab,
      mobileMenuOpen,
      setMobileMenuOpen,
      searchQuery,
      setSearchQuery,
      searchFilterTab,
      setSearchFilterTab,
      searchFilterGroup,
      setSearchFilterGroup,
      showQuickSearchModal,
      setShowQuickSearchModal,
      showPauseModal,
      setShowPauseModal,
      pauseCustomDate,
      setPauseCustomDate,
      showDashboardCustomizer,
      setShowDashboardCustomizer,
      dashboardWidgets,
      setDashboardWidgets,
      openHelpSection,
      setOpenHelpSection,
      openSettingsSection,
      setOpenSettingsSection,
      statusToast,
      setStatusToast,
      notify,
      settingsState,
      setSettingsState,
      systemServices,
      setSystemServices,
      googleTombstones,
      setGoogleTombstones,
      showTombstoneManager,
      setShowTombstoneManager,
      syncFullRescan,
      setSyncFullRescan,
      syncLoading,
      setSyncLoading,
      snapshots,
      setSnapshots,
      deleteConfirmText,
      setDeleteConfirmText,
      showDeleteModal,
      setShowDeleteModal,
      loadSettings,
      saveSettings,
      loadGoogleTombstones,
      unblockTombstone,
      unblockTombstones,
      clearAllDeletedTombstones,
      runGoogleSync,
      loadSnapshots,
      createSnapshot,
      cleanAllSnapshots,
      wipeAllData,
    }),
    [
      activeTab,
      mobileMenuOpen,
      searchQuery,
      searchFilterTab,
      searchFilterGroup,
      showQuickSearchModal,
      showPauseModal,
      pauseCustomDate,
      showDashboardCustomizer,
      dashboardWidgets,
      openHelpSection,
      openSettingsSection,
      statusToast,
      notify,
      settingsState,
      systemServices,
      googleTombstones,
      showTombstoneManager,
      syncFullRescan,
      syncLoading,
      snapshots,
      deleteConfirmText,
      showDeleteModal,
      loadSettings,
      saveSettings,
      loadGoogleTombstones,
      unblockTombstone,
      unblockTombstones,
      clearAllDeletedTombstones,
      runGoogleSync,
      loadSnapshots,
      createSnapshot,
      cleanAllSnapshots,
      wipeAllData,
    ]
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI(): UIContextValue {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
}
