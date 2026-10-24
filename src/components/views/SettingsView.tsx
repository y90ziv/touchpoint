'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  Bell,
  Send,
  RefreshCw,
  GitMerge,
  Download,
  AlertTriangle,
  Trash2,
  BookOpen,
  Sun,
  Snowflake,
  Check,
  Link2,
  Archive,
  Phone,
  Mail,
  ArrowRight,
} from 'lucide-react';
import { CRON_PRESETS, GoogleTombstoneItem, SnapshotItem, ThemePreset } from '@/types/touchpoint';
import { useUI } from '@/context/UIContext';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useContacts } from '@/context/ContactsContext';
import { useGroups } from '@/context/GroupsContext';
import { TimezoneSelect } from '@/components/TimezoneSelect';
import { CountryCodeSelect } from '@/components/CountryCodeSelect';
import { getTimezoneDetails, normalizeTimezone } from '@/lib/geo-data';

export interface SettingsViewProps {
  onOpenHelpGuide?: (sectionIndex?: number) => void;
  onStart2faSetup?: () => void;
  onShow2faDisableModal?: () => void;
  onRefreshAllData?: () => Promise<void>;
}

export function SettingsView({
  onOpenHelpGuide,
  onStart2faSetup,
  onShow2faDisableModal,
  onRefreshAllData,
}: SettingsViewProps) {
  const ui = useUI();
  const auth = useAuth();
  const theme = useTheme();
  const contactsCtx = useContacts();
  const groupsCtx = useGroups();

  const settingsState = ui.settingsState;
  const setSettingsState = ui.setSettingsState;
  const openSection = ui.openSettingsSection;
  const setOpenSection = ui.setOpenSettingsSection;
  const googleTombstones = ui.googleTombstones;
  const showTombstoneManager = ui.showTombstoneManager;
  const setShowTombstoneManager = ui.setShowTombstoneManager;
  const syncFullRescan = ui.syncFullRescan;
  const setSyncFullRescan = ui.setSyncFullRescan;
  const syncLoading = ui.syncLoading;
  const setSyncLoading = ui.setSyncLoading;
  const snapshots = ui.snapshots;
  const deleteConfirmText = ui.deleteConfirmText;
  const setDeleteConfirmText = ui.setDeleteConfirmText;

  const currentUser = auth.currentUser;
  const themePreset = theme.themePreset;
  const themeMode = theme.themeMode;

  const notify = ui.notify;

  const refreshData = async () => {
    if (onRefreshAllData) {
      await onRefreshAllData();
    } else {
      await Promise.all([
        contactsCtx.loadContacts(),
        groupsCtx.loadGroups(),
        ui.loadSettings(),
        ui.loadGoogleTombstones(),
        ui.loadSnapshots(),
      ]);
    }
  };

  const handleSaveAllSettings = async () => {
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timezone: settingsState.timezone,
        dateFormat: settingsState.dateFormat || 'YYYY-MM-DD',
        defaultCountryCode: settingsState.defaultCountryCode,
        firstDayOfWeek: Number(settingsState.firstDayOfWeek ?? 0),
        birthdayDaysAdvance: Number(settingsState.birthdayDaysAdvance || 7),
        maxDailyDue: Number(settingsState.maxDailyDue || 3),
        cadenceFuzzinessEnabled: Boolean(settingsState.cadenceFuzzinessEnabled),
        cadenceFuzzinessPercent: Number(settingsState.cadenceFuzzinessPercent || 15),
        logLevel: settingsState.logLevel || 'info',
        telegramBotToken: settingsState.telegramBotToken || null,
        telegramChatId: settingsState.telegramChatId || null,
        webhookEnabled: Boolean(settingsState.webhookEnabled),
        webhookUrl: settingsState.webhookUrl || null,
        webhookSecret: settingsState.webhookSecret || null,
        googleClientId: settingsState.googleClientId || null,
        googleClientSecret: settingsState.googleClientSecret || null,
        googleRefreshToken: settingsState.googleRefreshToken || null,
        googleSyncInterval: settingsState.googleSyncInterval || 'manual',
        skipGoogleEmailOnly: Boolean(settingsState.skipGoogleEmailOnly),
        googleCalendarPushEnabled: Boolean(settingsState.googleCalendarPushEnabled),
        googleCalendarId: settingsState.googleCalendarId || 'primary',
        googleCalendarAutoPush: settingsState.googleCalendarAutoPush || 'manual',
        googleCalendarPushDay: Number(settingsState.googleCalendarPushDay ?? 0),
        googleCalendarPushTime: settingsState.googleCalendarPushTime || '08:00',
        googleCalendarPushAdvanceDays: Number(settingsState.googleCalendarPushAdvanceDays ?? 7),
        snapshotScheduleMode: settingsState.snapshotScheduleMode || 'scheduled',
        snapshotIntervalUnit: settingsState.snapshotIntervalUnit || 'days',
        snapshotIntervalValue: Number(settingsState.snapshotIntervalValue || 1),
      }),
    });
    if (res.ok) {
      await refreshData();
      notify('All settings saved successfully.');
    } else {
      notify('Failed to save settings');
    }
  };

  const handleStart2fa = () => {
    if (onStart2faSetup) {
      onStart2faSetup();
    } else {
      auth.start2faSetup();
    }
  };

  const handleDisable2fa = () => {
    if (onShow2faDisableModal) {
      onShow2faDisableModal();
    } else {
      auth.setShow2faDisableModal(true);
    }
  };

  const handleRunGoogleSync = async (forceFull?: boolean) => {
    const isFull = forceFull ?? syncFullRescan;
    setSyncLoading(true);
    try {
      const currentRedirect = `${window.location.origin}/api/google`.replace(
        '0.0.0.0',
        'localhost'
      );
      const res = await fetch('/api/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync',
          fullRescan: isFull,
          redirect_uri: currentRedirect,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await refreshData();
        notify(
          `Synced: ${data.imported} new imported, ${data.skippedExisting} existing or blocked skipped.${isFull ? ' (Full Re-scan)' : ''}`
        );
      } else {
        notify(data.error || 'Sync failed');
      }
    } catch {
      notify('Sync request failed');
    } finally {
      setSyncLoading(false);
    }
  };

  const handleClearDeletedTombstones = async () => {
    if (!window.confirm('Unblock all deleted Google contacts so they can be re-imported?')) {
      return;
    }
    try {
      const res = await fetch('/api/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_deleted_tombstones' }),
      });
      if (res.ok) {
        await ui.loadGoogleTombstones();
        notify('Unblocked deleted Google contacts.');
      } else {
        notify('Failed to clear deleted tombstones');
      }
    } catch {
      notify('Failed to clear deleted tombstones');
    }
  };

  const handleUnblockTombstone = async (id: number) => {
    const success = await ui.unblockTombstone(id);
    if (success) {
      notify('Unblocked Google contact.');
    } else {
      notify('Failed to unblock tombstone');
    }
  };

  const [showCleanSnapshotsWarning, setShowCleanSnapshotsWarning] = useState(false);
  const [cleaningSnapshots, setCleaningSnapshots] = useState(false);

  const handleCreateSnapshot = async () => {
    const success = await ui.createSnapshot();
    if (success) {
      notify('Point-in-time database snapshot created successfully.');
    } else {
      notify('Failed to create snapshot');
    }
  };

  const handleCleanAllSnapshots = async () => {
    setCleaningSnapshots(true);
    try {
      const success = await ui.cleanAllSnapshots();
      if (success) {
        setShowCleanSnapshotsWarning(false);
      }
    } finally {
      setCleaningSnapshots(false);
    }
  };

  const handleWipeAllData = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    const success = await ui.wipeAllData();
    if (success) {
      setDeleteConfirmText('');
      await refreshData();
      notify('All contacts, groups, and activity have been permanently deleted.');
    } else {
      notify('Failed to delete data');
    }
  };

  const handleGoToHelp = (sectionIndex: number) => {
    if (onOpenHelpGuide) {
      onOpenHelpGuide(sectionIndex);
    } else {
      ui.setOpenHelpSection(sectionIndex);
      ui.setActiveTab('help');
    }
  };

  return (
    <div className="space-y-4 max-w-3xl text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
        <div>
          <h1 className="text-xl font-bold">Settings</h1>
          <p className="text-xs text-muted">
            Click any module below to expand and edit (expanding one collapses the others)
          </p>
        </div>
        <button
          type="button"
          onClick={handleSaveAllSettings}
          className="px-3.5 py-2 rounded-xl bg-primary text-primary-fg font-semibold flex items-center gap-1.5 shadow-xs text-xs hover:opacity-90 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Save All Settings</span>
        </button>
      </div>

      {/* Section 1: Appearance, Regional Preferences & Cadence Limits */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpenSection((prev) => (prev === 1 ? null : 1))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setOpenSection((prev) => (prev === 1 ? null : 1));
            }
          }}
          className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-well cursor-pointer select-none motion-safe:transition-colors motion-safe:duration-160 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          <span className="text-sm font-bold text-foreground">
            1. Appearance, Regional Preferences &amp; Cadence Limits
          </span>
          <span className="text-muted text-sm font-mono">
            {openSection === 1 ? '▾' : '▸'}
          </span>
        </div>

        {openSection === 1 && (
          <div className="px-5 pb-5 pt-1 space-y-4 border-t border-border">
            <div className="flex flex-wrap gap-2.5 pt-2">
              {[
                { id: 'sbb', label: 'SBB Dispatch', color: '#d92b2b' },
                { id: 'leadflow', label: 'Electric Cobalt', color: '#2b7fff' },
                { id: 'studio', label: 'Warm Studio', color: '#e85d3a' },
                { id: 'nordic', label: 'Nordic Pine', color: '#10b981' },
                { id: 'midnight', label: 'Midnight Indigo', color: '#6366f1' },
                { id: 'kyoto', label: 'Kyoto Ink', color: '#d97706' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => theme.applyTheme(t.id as ThemePreset, themeMode)}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-semibold text-left flex items-center gap-2.5 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 shrink-0 ${
                    themePreset === t.id
                      ? 'border-primary bg-primary/15 text-primary shadow-sm'
                      : 'border-border hover:border-border/80 bg-well text-foreground'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0 ring-1 ring-background"
                    style={{ background: t.color }}
                  />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            <div className="space-y-4 pt-3 border-t border-border">
              <TimezoneSelect
                id="settings-timezone"
                label="Timezone"
                value={settingsState.timezone || 'UTC'}
                onChange={(tz) => setSettingsState({ ...settingsState, timezone: tz })}
              />
              <CountryCodeSelect
                id="settings-country-code"
                label="Default Country Code"
                value={settingsState.defaultCountryCode || '+1'}
                onChange={(code) =>
                  setSettingsState({ ...settingsState, defaultCountryCode: code })
                }
              />
            </div>

            {/* Regional Settings - 1 per row */}
            <div className="space-y-4 pt-3 border-t border-border">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Date Display Format
                </label>
                <select
                  value={settingsState.dateFormat || 'YYYY-MM-DD'}
                  onChange={(e) =>
                    setSettingsState({
                      ...settingsState,
                      dateFormat: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground font-medium text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-10-17)</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 17/10/2026)</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 10/17/2026)</option>
                  <option value="DD-MM-YYYY">DD-MM-YYYY (e.g. 17-10-2026)</option>
                  <option value="YYYY/MM/DD">YYYY/MM/DD (e.g. 2026/10/17)</option>
                  <option value="DD.MM.YYYY">DD.MM.YYYY (e.g. 17.10.2026)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  First Day of the Week (Default: Sunday)
                </label>
                <select
                  value={Number(settingsState.firstDayOfWeek ?? 0)}
                  onChange={(e) =>
                    setSettingsState({
                      ...settingsState,
                      firstDayOfWeek: Number(e.target.value),
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground font-medium text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value={0}>Sunday (Default)</option>
                  <option value={1}>Monday</option>
                  <option value={6}>Saturday</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Incoming Birthdays Window (Days)
                </label>
                <select
                  value={Number(settingsState.birthdayDaysAdvance || 7)}
                  onChange={(e) =>
                    setSettingsState({
                      ...settingsState,
                      birthdayDaysAdvance: Number(e.target.value),
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground font-medium text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value={7}>Upcoming Week (7 days)</option>
                  <option value={14}>Next 2 Weeks (14 days)</option>
                  <option value={30}>Next Month (30 days)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Daily Due Cap (Smart Spreading)
                </label>
                <select
                  value={Number(settingsState.maxDailyDue || 3)}
                  onChange={(e) =>
                    setSettingsState({
                      ...settingsState,
                      maxDailyDue: Number(e.target.value),
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground font-medium text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value={2}>Max 2 per day</option>
                  <option value={3}>Max 3 per day (Default)</option>
                  <option value={5}>Max 5 per day</option>
                  <option value={10}>Max 10 per day</option>
                </select>
              </div>

              <div className="p-3.5 rounded-xl bg-well border border-border flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5 max-w-lg">
                  <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <span>Interval Fuzziness (Natural Variance)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                      Anti-Rigid
                    </span>
                  </div>
                  <p className="text-[11px] text-muted">
                    Vary reminder intervals naturally (e.g. ±15% variance: 14 days becomes 11 to 17 days) so touchpoints do not feel robotic.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {Boolean(settingsState.cadenceFuzzinessEnabled) && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-muted text-[11px]">Variance:</span>
                      <select
                        value={Number(settingsState.cadenceFuzzinessPercent || 15)}
                        onChange={(e) =>
                          setSettingsState({
                            ...settingsState,
                            cadenceFuzzinessPercent: Number(e.target.value),
                          })
                        }
                        className="px-2 py-1 rounded bg-background border border-border text-foreground text-xs"
                      >
                        <option value={10}>±10%</option>
                        <option value={15}>±15% (Recommended)</option>
                        <option value={20}>±20%</option>
                        <option value={25}>±25%</option>
                      </select>
                    </div>
                  )}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={Boolean(settingsState.cadenceFuzzinessEnabled)}
                    aria-label="Toggle interval fuzziness"
                    onClick={() =>
                      setSettingsState({
                        ...settingsState,
                        cadenceFuzzinessEnabled: !settingsState.cadenceFuzzinessEnabled,
                      })
                    }
                    className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
                      settingsState.cadenceFuzzinessEnabled
                        ? 'bg-primary justify-end'
                        : 'bg-muted/30 justify-start'
                    }`}
                  >
                    <div className="bg-white w-4 h-4 rounded-full shadow-md motion-safe:transition-transform motion-safe:duration-160" />
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={async () => {
                  await fetch('/api/settings', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      timezone: settingsState.timezone || 'UTC',
                      defaultCountryCode: settingsState.defaultCountryCode || '+1',
                      dateFormat: settingsState.dateFormat || 'YYYY-MM-DD',
                      firstDayOfWeek: Number(settingsState.firstDayOfWeek ?? 0),
                      birthdayDaysAdvance: Number(settingsState.birthdayDaysAdvance || 7),
                      maxDailyDue: Number(settingsState.maxDailyDue || 3),
                      cadenceFuzzinessEnabled: Boolean(settingsState.cadenceFuzzinessEnabled),
                      cadenceFuzzinessPercent: Number(settingsState.cadenceFuzzinessPercent || 15),
                      dailyDigestTime: settingsState.dailyDigestTime || '09:00',
                    }),
                  });
                  await refreshData();
                  notify('Saved Appearance, Regional & Cadence Settings.');
                }}
                className="px-3.5 py-2 rounded-lg bg-primary text-primary-fg font-semibold motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 whitespace-nowrap"
              >
                <span>Save Appearance Settings</span>
              </button>
            </div>

            {/* Two-Factor Authentication (2FA) */}
            <div className="pt-3 border-t border-border">
              <div className="p-4 rounded-xl bg-well border border-border flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground text-sm">Two-Factor Authentication (2FA / TOTP)</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border flex items-center gap-1 ${
                        currentUser?.totpEnabled
                          ? 'bg-success/15 border-success/40 text-success'
                          : 'bg-background border-border text-muted'
                      }`}
                    >
                      {currentUser?.totpEnabled && <Check className="w-3 h-3 text-success" />}
                      <span>{currentUser?.totpEnabled ? 'Enabled' : 'Disabled'}</span>
                    </span>
                  </div>
                  <p className="text-muted text-xs mt-0.5">
                    Protect your Touchpoint account with an authenticator app (Google Authenticator, 1Password, Bitwarden).
                  </p>
                </div>

                <div>
                  {currentUser?.totpEnabled ? (
                    <button
                      type="button"
                      onClick={handleDisable2fa}
                      className="px-3 py-1.5 rounded-lg border border-overdue/40 text-overdue hover:bg-overdue/10 font-medium motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 whitespace-nowrap"
                    >
                      <span>Disable 2FA</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStart2fa}
                      className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-fg font-semibold hover:opacity-95 shadow-xs motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 whitespace-nowrap"
                    >
                      <span>Enable 2FA…</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Notification Channels: Telegram Bot & Outgoing Webhook */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpenSection((prev) => (prev === 2 ? null : 2))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setOpenSection((prev) => (prev === 2 ? null : 2));
            }
          }}
          className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-well cursor-pointer select-none motion-safe:transition-colors motion-safe:duration-160 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">
              2. Notification Channels: Telegram Bot &amp; Outgoing Webhook
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                settingsState.telegramBotToken || settingsState.webhookEnabled
                  ? 'bg-success/15 border-success/50 text-success'
                  : 'bg-background border-border text-muted'
              }`}
            >
              {settingsState.telegramBotToken && settingsState.webhookEnabled
                ? 'Telegram & Webhook Active'
                : settingsState.telegramBotToken
                ? 'Telegram Active'
                : settingsState.webhookEnabled
                ? 'Webhook Active'
                : 'Optional'}
            </span>
          </div>
          <span className="text-muted text-sm font-mono">
            {openSection === 2 ? '▾' : '▸'}
          </span>
        </div>

        {openSection === 2 && (
          <div className="px-5 pb-5 pt-2 space-y-4 border-t border-border">
            <p className="text-muted">
              Configure Telegram, an Outgoing Webhook (n8n, Home Assistant, Slack, Discord,
              ntfy, or custom endpoint), or both simultaneously.
            </p>

            {/* Daily Notification Schedule & Local Timezone */}
            {(() => {
              const tzInfo = getTimezoneDetails(settingsState.timezone, settingsState.defaultCountryCode);
              const browserTz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : '';
              const isUsingBrowserTz = browserTz && normalizeTimezone(settingsState.timezone) === normalizeTimezone(browserTz);

              return (
                <div className="bg-background border border-border rounded-xl p-4 sm:p-5 space-y-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Bell className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm text-foreground">
                          Daily Notification Schedule &amp; Local Timezone
                        </h4>
                        <p className="text-xs text-muted">
                          Controls when daily cadence reminders and birthday alerts are dispatched.
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${
                        settingsState.dailyDigestEnabled !== false
                          ? 'bg-success/15 border-success/50 text-success'
                          : 'bg-well border-border text-muted'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          settingsState.dailyDigestEnabled !== false
                            ? 'bg-success'
                            : 'bg-muted'
                        }`}
                      />
                      <span>{settingsState.dailyDigestEnabled !== false ? 'Active' : 'Paused'}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-muted mb-1.5">
                        Daily Notification Time (Local Time)
                      </label>
                      <input
                        type="time"
                        value={settingsState.dailyDigestTime || '09:00'}
                        onChange={(e) =>
                          setSettingsState({ ...settingsState, dailyDigestTime: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-lg bg-well border border-border text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      <p className="text-[11px] text-muted mt-1">
                        Touchpoint evaluates due contacts and dispatches your digest at this exact local hour:minute.
                      </p>
                    </div>

                    <div>
                      <TimezoneSelect
                        id="notif-sched-timezone"
                        label="Local Timezone"
                        value={settingsState.timezone || 'Asia/Jerusalem'}
                        onChange={(tz) =>
                          setSettingsState({ ...settingsState, timezone: tz })
                        }
                      />
                      {browserTz && !isUsingBrowserTz && (
                        <button
                          type="button"
                          onClick={() =>
                            setSettingsState({ ...settingsState, timezone: browserTz })
                          }
                          className="text-[11px] font-semibold text-primary hover:underline mt-1.5 inline-flex items-center gap-1 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 whitespace-nowrap"
                        >
                          <span>Use browser timezone</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Real-time Timezone & Daylight Saving Time status info */}
                  <div className="p-3 rounded-lg bg-well border border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">
                          {tzInfo.timezone}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-background border border-border text-foreground">
                          {tzInfo.offsetString} ({tzInfo.timeZoneName})
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-medium border flex items-center gap-1 ${
                            tzInfo.isDST
                              ? 'bg-warning/15 border-warning/40 text-warning'
                              : 'bg-info/15 border-info/40 text-info'
                          }`}
                        >
                          {tzInfo.isDST ? (
                            <Sun className="w-3 h-3 text-warning" />
                          ) : (
                            <Snowflake className="w-3 h-3 text-info" />
                          )}
                          <span>{tzInfo.isDST ? 'Daylight Saving Time Active' : 'Standard Time Active'}</span>
                        </span>
                      </div>
                      <p className="text-muted text-[11px]">
                        Current local time: <strong className="text-foreground font-mono">{tzInfo.currentLocalTime}</strong>. Automatic Daylight Saving Time adjustments are applied year-round.
                      </p>
                    </div>
                    <div className="shrink-0 text-right sm:text-right">
                      <span className="text-[11px] text-muted block">Scheduled trigger:</span>
                      <span className="font-semibold text-primary text-xs">
                        Daily at {settingsState.dailyDigestTime || '09:00'} ({tzInfo.offsetString})
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={settingsState.dailyDigestEnabled !== false}
                        onChange={(e) =>
                          setSettingsState({
                            ...settingsState,
                            dailyDigestEnabled: e.target.checked,
                          })
                        }
                        className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                      />
                      <span>Enable Daily Digest (uncheck to pause all scheduled alerts)</span>
                    </label>

                    <button
                      type="button"
                      onClick={async () => {
                        await fetch('/api/settings', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            dailyDigestEnabled: settingsState.dailyDigestEnabled !== false,
                            dailyDigestTime: settingsState.dailyDigestTime || '09:00',
                            timezone: settingsState.timezone,
                            skipEmptyDigest: settingsState.skipEmptyDigest !== false,
                          }),
                        });
                        await refreshData();
                        notify(
                          `Saved Daily Notification Schedule (${settingsState.dailyDigestTime || '09:00'} ${settingsState.timezone}).`
                        );
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-fg font-semibold text-xs motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out hover:opacity-90 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 whitespace-nowrap"
                    >
                      <span>Save Schedule</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Channel A: Telegram Bot */}
            <div className="bg-background border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-foreground">
                  Channel A: Telegram Bot (Outbound Long-Polling)
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full font-semibold border flex items-center gap-1.5 ${
                    settingsState.telegramBotToken && settingsState.telegramChatId
                      ? 'bg-success/15 border-success/50 text-success'
                      : 'bg-well border-border text-muted'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      settingsState.telegramBotToken && settingsState.telegramChatId
                        ? 'bg-success'
                        : 'bg-muted'
                    }`}
                  />
                  <span>
                    {settingsState.telegramBotToken && settingsState.telegramChatId
                      ? 'Configured'
                      : 'Optional'}
                  </span>
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted mb-1">Bot Token (from @BotFather)</label>
                  <input
                    type="password"
                    value={settingsState.telegramBotToken || ''}
                    onChange={(e) =>
                      setSettingsState({ ...settingsState, telegramBotToken: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-well border border-border"
                  />
                </div>
                <div>
                  <label className="block text-muted mb-1">Owner Chat ID</label>
                  <input
                    value={settingsState.telegramChatId || ''}
                    onChange={(e) =>
                      setSettingsState({ ...settingsState, telegramChatId: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-well border border-border"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    await fetch('/api/settings', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        telegramBotToken: settingsState.telegramBotToken,
                        telegramChatId: settingsState.telegramChatId,
                      }),
                    });
                    const res = await fetch('/api/telegram', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        action: 'start_poller',
                        botToken: settingsState.telegramBotToken,
                        chatId: settingsState.telegramChatId,
                      }),
                    });
                    const data = await res.json().catch(() => ({}));
                    notify(
                      res.ok
                        ? 'Saved and started Telegram Long-Polling.'
                        : data.error || 'Failed to start Telegram Long-Polling'
                    );
                  }}
                  className="px-3 py-2 rounded-lg bg-primary text-primary-fg font-semibold motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 whitespace-nowrap"
                >
                  <span>Save &amp; Start Poller</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await fetch('/api/telegram', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        action: 'test_message',
                        botToken: settingsState.telegramBotToken,
                        chatId: settingsState.telegramChatId,
                      }),
                    });
                    const data = await res.json().catch(() => ({}));
                    notify(
                      res.ok
                        ? 'Test Telegram message sent.'
                        : data.error || 'Failed to send test message'
                    );
                  }}
                  className="px-3 py-2 rounded-lg bg-well border border-border flex items-center gap-1.5 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Test Message</span>
                </button>
              </div>

              {settingsState.telegramBindingToken && (
                <div className="p-3 rounded-xl bg-well border border-primary/30 space-y-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-primary" />
                      <span>Telegram Deep Link Binding</span>
                      <span className="text-[10px] px-2 py-0.2 rounded-full bg-primary/20 text-primary border border-primary/30 font-medium">
                        Multi-User
                      </span>
                    </span>
                    <span className="text-[10px] text-muted">Auto-binds your Chat ID</span>
                  </div>
                  <p className="text-[11px] text-muted">
                    Open or share this personal deep link to link your Telegram account to Touchpoint automatically without manually finding your Chat ID:
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      type="text"
                      value={`https://t.me/Touchpoint_Bot?start=bind_${settingsState.telegramBindingToken}`}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-[11px] font-mono text-muted select-all"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`https://t.me/Touchpoint_Bot?start=bind_${settingsState.telegramBindingToken}`);
                        notify('Telegram binding link copied to clipboard.');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-background hover:bg-well border border-border text-foreground font-medium text-xs shrink-0 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 whitespace-nowrap"
                    >
                      <span>Copy Link</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Channel B: Outgoing Webhook */}
            <div className="bg-background border border-border rounded-lg p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-foreground">
                    Channel B: Outgoing Webhook (HTTP POST JSON)
                  </div>
                  <p className="text-muted mt-0.5">
                    Sends structured JSON payloads of due/overdue contacts to your custom URL.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(settingsState.webhookEnabled)}
                  aria-label="Toggle outgoing webhook"
                  onClick={async () => {
                    const nextVal = !settingsState.webhookEnabled;
                    setSettingsState({ ...settingsState, webhookEnabled: nextVal });
                    await fetch('/api/settings', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ webhookEnabled: nextVal }),
                    });
                    notify(
                      nextVal ? 'Outgoing Webhook enabled.' : 'Outgoing Webhook disabled.'
                    );
                  }}
                  className={`px-3 py-1.5 rounded-full font-semibold border flex items-center gap-2.5 motion-safe:transition-colors motion-safe:duration-160 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 whitespace-nowrap ${
                    settingsState.webhookEnabled
                      ? 'bg-success/15 border-success/50 text-success'
                      : 'bg-overdue/10 border-overdue/30 text-overdue hover:border-overdue/50'
                  }`}
                >
                  <span
                    className={`w-8 h-4 rounded-full p-0.5 flex items-center motion-safe:transition-colors motion-safe:duration-160 ${
                      settingsState.webhookEnabled ? 'bg-success' : 'bg-overdue/60'
                    }`}
                  >
                    <span
                      className={`w-3 h-3 rounded-full bg-white shadow motion-safe:transition-transform motion-safe:duration-160 ${
                        settingsState.webhookEnabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </span>
                  <span>
                    {settingsState.webhookEnabled ? 'Enabled' : 'Disabled (Default)'}
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted mb-1">
                    Webhook Target URL (POST endpoint)
                  </label>
                  <input
                    value={settingsState.webhookUrl || ''}
                    onChange={(e) =>
                      setSettingsState({ ...settingsState, webhookUrl: e.target.value })
                    }
                    placeholder="https://your-webhook.example.com/hook"
                    className="w-full px-3 py-2 rounded-lg bg-well border border-border font-mono"
                  />
                </div>
                <div>
                  <label className="block text-muted mb-1">
                    Signing Secret (Optional HMAC-SHA256 in X-Touchpoint-Signature)
                  </label>
                  <input
                    type="password"
                    value={settingsState.webhookSecret || ''}
                    onChange={(e) =>
                      setSettingsState({ ...settingsState, webhookSecret: e.target.value })
                    }
                    placeholder="Optional secret for verifying webhook authenticity"
                    className="w-full px-3 py-2 rounded-lg bg-well border border-border"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    await fetch('/api/settings', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        webhookEnabled: Boolean(settingsState.webhookEnabled),
                        webhookUrl: settingsState.webhookUrl || null,
                        webhookSecret: settingsState.webhookSecret || null,
                      }),
                    });
                    notify('Saved Outgoing Webhook settings.');
                  }}
                  className="px-3 py-2 rounded-lg bg-primary text-primary-fg font-semibold motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 whitespace-nowrap"
                >
                  <span>Save Settings</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await fetch('/api/settings', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        webhookUrl: settingsState.webhookUrl || null,
                        webhookSecret: settingsState.webhookSecret || null,
                      }),
                    });
                    const res = await fetch('/api/webhook', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'test_webhook' }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      notify(
                        `Test Webhook delivered (HTTP ${data.status}, ${data.contactsCount} contacts included).`
                      );
                    } else {
                      notify(data.error || 'Failed to send test webhook');
                    }
                  }}
                  className="px-3 py-2 rounded-lg bg-well border border-border flex items-center gap-1.5 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Test Webhook</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Section 3: Google Contacts Integration & Calendar Push */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpenSection((prev) => (prev === 3 ? null : 3))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setOpenSection((prev) => (prev === 3 ? null : 3));
            }
          }}
          className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-well cursor-pointer select-none motion-safe:transition-colors motion-safe:duration-160 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">
              3. Google Contacts Integration (Strict Additive-Only Sync)
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full font-semibold border text-[11px] flex items-center gap-1.5 ${
                settingsState.googleRefreshToken
                  ? 'bg-success/15 border-success/50 text-success'
                  : 'bg-background border-border text-muted'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  settingsState.googleRefreshToken ? 'bg-success' : 'bg-muted'
                }`}
              />
              <span>{settingsState.googleRefreshToken ? 'Connected' : 'Not Connected'}</span>
            </span>
          </div>
          <span className="text-muted text-sm font-mono">
            {openSection === 3 ? '▾' : '▸'}
          </span>
        </div>

        {openSection === 3 && (
          <div className="px-5 pb-5 pt-2 space-y-3 border-t border-border">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-muted">
                Pulls only NEW contacts from Google. Never overwrites existing contacts or deletes
                local Touchpoint contacts.
              </p>
              <button
                type="button"
                onClick={() => handleGoToHelp(1)}
                className="text-primary hover:underline font-medium flex items-center gap-1 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 whitespace-nowrap"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>See Step-by-Step Guide</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-muted mb-1">Google OAuth Client ID</label>
                <input
                  value={settingsState.googleClientId || ''}
                  onChange={(e) =>
                    setSettingsState({ ...settingsState, googleClientId: e.target.value })
                  }
                  placeholder="xxx.apps.googleusercontent.com"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border"
                />
              </div>
              <div>
                <label className="block text-muted mb-1">Google OAuth Client Secret</label>
                <input
                  type="password"
                  value={settingsState.googleClientSecret || ''}
                  onChange={(e) =>
                    setSettingsState({
                      ...settingsState,
                      googleClientSecret: e.target.value,
                    })
                  }
                  placeholder="GOCSPX-..."
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border"
                />
              </div>
            </div>

            <div>
              <label className="block text-muted mb-1">
                Google OAuth Refresh Token (Auto-filled on Authorize, or paste from OAuth Playground)
              </label>
              <input
                type="password"
                value={settingsState.googleRefreshToken || ''}
                onChange={(e) =>
                  setSettingsState({
                    ...settingsState,
                    googleRefreshToken: e.target.value,
                  })
                }
                placeholder="1//04..."
                className="w-full px-3 py-2 rounded-lg bg-background border border-border font-mono"
              />
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <label className="block text-muted">
                  Auto-Sync Cron Expression (or pick a quick preset below)
                </label>
                <a
                  href="https://crontab.guru/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  crontab.guru helper
                </a>
              </div>
              <input
                value={settingsState.googleSyncInterval || 'manual'}
                onChange={(e) =>
                  setSettingsState({
                    ...settingsState,
                    googleSyncInterval: e.target.value,
                  })
                }
                placeholder="e.g. 0 3 * * * (Daily 03:00) or manual"
                className="w-full px-3 py-2 rounded-lg bg-background border border-border font-mono"
              />
              <div className="flex flex-wrap gap-1.5">
                {CRON_PRESETS.map((preset) => (
                  <button
                    key={preset.expr}
                    type="button"
                    onClick={() =>
                      setSettingsState({ ...settingsState, googleSyncInterval: preset.expr })
                    }
                    className={`px-2.5 py-1 rounded border text-xs motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 whitespace-nowrap ${
                      settingsState.googleSyncInterval === preset.expr
                        ? 'border-primary bg-primary text-primary-fg font-medium'
                        : 'border-border bg-background text-muted hover:text-foreground'
                    }`}
                  >
                    <span>{preset.label} ({preset.expr})</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-background border border-border flex flex-wrap items-center justify-between gap-2 text-xs">
              <div>
                <span className="text-muted">Authorized Redirect URI to paste in Google Cloud: </span>
                <code className="font-mono text-foreground font-semibold">
                  {typeof window !== 'undefined'
                    ? `${window.location.origin}/api/google`.replace('0.0.0.0', 'localhost')
                    : 'http://localhost:3000/api/google'}
                </code>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    const uri = `${window.location.origin}/api/google`.replace(
                      '0.0.0.0',
                      'localhost'
                    );
                    navigator.clipboard.writeText(uri);
                    notify('Copied redirect URI to clipboard.');
                  }
                }}
                className="px-2.5 py-1 rounded bg-well border border-border hover:bg-well text-muted hover:text-foreground text-[11px] font-medium motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 whitespace-nowrap"
              >
                <span>Copy URI</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={async () => {
                  await fetch('/api/settings', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      googleClientId: settingsState.googleClientId,
                      googleClientSecret: settingsState.googleClientSecret,
                      googleRefreshToken: settingsState.googleRefreshToken,
                      googleSyncInterval: settingsState.googleSyncInterval,
                    }),
                  });
                  notify('Saved Google credentials and cron settings.');
                }}
                className="px-3 py-2 rounded-lg bg-primary text-primary-fg font-semibold motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 whitespace-nowrap"
              >
                <span>Save Settings</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  await fetch('/api/settings', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      googleClientId: settingsState.googleClientId,
                      googleClientSecret: settingsState.googleClientSecret,
                    }),
                  });
                  const currentRedirect = `${window.location.origin}/api/google`.replace(
                    '0.0.0.0',
                    'localhost'
                  );
                  const res = await fetch(
                    `/api/google?redirect_uri=${encodeURIComponent(currentRedirect)}`
                  );
                  const data = await res.json();
                  if (res.ok && data.authUrl) {
                    window.location.href = data.authUrl;
                  } else {
                    notify(data.error || 'Save Client ID & Secret first before authorizing');
                  }
                }}
                className="px-3 py-2 rounded-lg bg-background border border-border font-medium motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 whitespace-nowrap"
              >
                <span>Authorize with Google</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  const currentRedirect = `${window.location.origin}/api/google`.replace(
                    '0.0.0.0',
                    'localhost'
                  );
                  const res = await fetch('/api/google', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'test_connection',
                      redirect_uri: currentRedirect,
                    }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    notify(
                      `Google Connection Verified (${data.totalGoogleContactsSampled} contacts found).`
                    );
                  } else {
                    notify(data.error || 'Google connection test failed');
                  }
                }}
                className="px-3 py-2 rounded-lg bg-background border border-border flex items-center gap-1.5 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 whitespace-nowrap"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Test Connection</span>
              </button>
              <button
                type="button"
                disabled={syncLoading}
                onClick={() => handleRunGoogleSync()}
                className="px-3 py-2 rounded-lg bg-background border border-border flex items-center gap-1.5 hover:bg-well font-medium disabled:opacity-50 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 whitespace-nowrap"
                title="Import genuinely new contacts from Google (additive only)"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncLoading ? 'animate-spin' : ''}`} />
                <span>Sync Contacts Now</span>
              </button>
            </div>

            {/* Re-import Blocklist & Tombstones Manager */}
            <div className="pt-3 border-t border-border space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                    <GitMerge className="w-3.5 h-3.5 text-primary" />
                    <span>Google Sync Blocklist &amp; Re-import Manager</span>
                    <span className="px-2 py-0.5 rounded-full bg-background border border-border text-[11px] text-muted">
                      <span className="font-mono">{googleTombstones.length}</span> blocked
                    </span>
                  </div>
                  <p className="text-[11px] text-muted mt-0.5">
                    When you delete or merge a Google contact, it is recorded here so Google Sync never re-imports it unexpectedly.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => ui.setActiveTab('archived')}
                    className="px-2.5 py-1.5 rounded-lg bg-well hover:bg-card-hover border border-border text-[11px] font-semibold text-primary hover:text-primary flex items-center gap-1.5 motion-safe:transition-colors motion-safe:duration-160 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary whitespace-nowrap"
                    title="Open full Archived Contacts screen with search and multi-select"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Open Archived Contacts</span>
                    <ArrowRight className="w-3 h-3 text-muted" />
                  </button>
                  {googleTombstones.some((t) => t.reason === 'deleted') && (
                    <button
                      type="button"
                      onClick={handleClearDeletedTombstones}
                      className="px-2.5 py-1.5 rounded-lg border border-border text-[11px] font-medium hover:bg-well text-foreground motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 whitespace-nowrap"
                      title="Unblock all deleted Google contacts so they can be re-imported"
                    >
                      <span>Unblock All Deleted</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowTombstoneManager((prev) => !prev)}
                    className="px-2.5 py-1.5 rounded-lg bg-background border border-border text-[11px] font-semibold text-foreground hover:bg-well flex items-center gap-1 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 whitespace-nowrap"
                  >
                    <span>{showTombstoneManager ? 'Hide Quick List' : 'Quick Preview…'}</span>
                  </button>
                </div>
              </div>

              {/* Sync Options: Full Re-scan Checkbox */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-background border border-border text-[11px]">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={syncFullRescan}
                    onChange={(e) => setSyncFullRescan(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-0"
                  />
                  <span className="font-medium text-foreground">
                    Full Re-scan on Next Sync
                  </span>
                  <span className="text-muted hidden sm:inline">
                    (Bypasses sync timestamp cutoffs to check all Google contacts)
                  </span>
                </label>
                <button
                  type="button"
                  disabled={syncLoading}
                  onClick={() => handleRunGoogleSync(true)}
                  className="px-2.5 py-1 rounded bg-well hover:bg-well border border-border text-foreground font-semibold flex items-center gap-1.5 disabled:opacity-50 text-[11px] motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 whitespace-nowrap"
                  title="Force a full scan across your entire Google Contacts list"
                >
                  <RefreshCw className={`w-3 h-3 ${syncLoading ? 'animate-spin' : ''}`} />
                  <span>Force Full Re-sync</span>
                </button>
              </div>

              {/* Expandable Tombstone List */}
              {showTombstoneManager && (
                <div className="p-3 rounded-xl bg-background border border-border space-y-2 animate-in fade-in duration-150">
                  {googleTombstones.length === 0 ? (
                    <p className="text-[12px] text-muted py-2 text-center">
                      No Google contacts are currently blocked. Deleted or merged contacts will appear here.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin pr-1">
                      {googleTombstones.map((t) => (
                        <div
                          key={t.id}
                          className="p-2.5 rounded-lg bg-well border border-border flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-foreground truncate">
                                {t.contactName || 'Unnamed Contact'}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  t.reason === 'deleted'
                                    ? 'bg-overdue/15 text-overdue border border-overdue/30'
                                    : 'bg-primary/15 text-primary border border-primary/30'
                                }`}
                              >
                                {t.reason === 'deleted' ? 'Deleted' : 'Merged'}
                              </span>
                              {t.targetContactName && (
                                <span className="text-muted text-[11px] truncate">
                                  into {t.targetContactName}
                                </span>
                              )}
                            </div>
                            {(t.contactPhone || t.contactEmail) && (
                              <div className="flex items-center gap-3 text-[11px] text-muted mt-0.5 flex-wrap">
                                {t.contactPhone && (
                                  <span className="flex items-center gap-1 font-mono">
                                    <Phone className="w-3 h-3 text-muted shrink-0" />
                                    {t.contactPhone}
                                  </span>
                                )}
                                {t.contactEmail && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="w-3 h-3 text-muted shrink-0" />
                                    {t.contactEmail}
                                  </span>
                                )}
                              </div>
                            )}
                            <div className="text-muted text-[10px] mt-0.5 truncate">
                              Google ID: <span className="font-mono">{t.googleResourceName}</span> · Blocked {new Date(t.createdAt).toLocaleDateString()}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleUnblockTombstone(t.id)}
                            className="px-2.5 py-1 rounded-md bg-background hover:bg-well border border-border text-[11px] font-medium text-foreground hover:text-primary shrink-0 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 whitespace-nowrap"
                            title="Unblock this contact so it can be re-imported from Google"
                          >
                            <span>Unblock</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Section 4: Container Logging, vCard (.vcf) & Full Backup */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpenSection((prev) => (prev === 4 ? null : 4))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setOpenSection((prev) => (prev === 4 ? null : 4));
            }
          }}
          className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-well cursor-pointer select-none motion-safe:transition-colors motion-safe:duration-160 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          <span className="text-sm font-bold text-foreground">
            4. Container Logging, vCard (.vcf) &amp; Full Backup
          </span>
          <span className="text-muted text-sm font-mono">
            {openSection === 4 ? '▾' : '▸'}
          </span>
        </div>

        {openSection === 4 && (
          <div className="px-5 pb-5 pt-3 space-y-4 border-t border-border">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-muted">Container Log Level:</span>
                <select
                  value={settingsState.logLevel || 'info'}
                  onChange={async (e) => {
                    const level = e.target.value;
                    setSettingsState({ ...settingsState, logLevel: level });
                    await fetch('/api/settings', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ logLevel: level }),
                    });
                    notify(`Container log level set to ${level}.`);
                  }}
                  className="px-3 py-1.5 rounded bg-background border border-border"
                >
                  <option value="debug">debug</option>
                  <option value="info">info</option>
                  <option value="warn">warn</option>
                  <option value="error">error</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="/api/backup?format=json"
                  download="touchpoint-backup.json"
                  className="px-3 py-2 rounded-lg bg-background border border-border flex items-center gap-1.5 hover:bg-well motion-safe:transition-colors motion-safe:duration-160 whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export JSON Backup</span>
                </a>
                <a
                  href="/api/backup?format=vcf"
                  download="touchpoint-contacts.vcf"
                  className="px-3 py-2 rounded-lg bg-background border border-border flex items-center gap-1.5 hover:bg-well motion-safe:transition-colors motion-safe:duration-160 whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export .vcf</span>
                </a>
              </div>
            </div>

            {/* Automated Database Snapshots (Rolling Retention) */}
            <div className="pt-3 border-t border-border space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-foreground">
                    Point-in-Time SQLite Database Snapshots
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    Atomic, zero-downtime snapshots created using SQLite native VACUUM INTO. Retains 7 daily, 4 weekly, 3 monthly.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCleanSnapshotsWarning(true)}
                    disabled={snapshots.length === 0 || cleaningSnapshots}
                    className="px-3 py-1.5 rounded-lg border border-overdue/40 bg-overdue/10 text-overdue hover:bg-overdue/20 font-semibold flex items-center gap-1.5 text-xs motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-overdue focus-visible:outline-offset-2 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                    title="Clean all point-in-time database snapshots"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clean all snapshots</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateSnapshot}
                    className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-fg font-semibold flex items-center gap-1.5 shadow-xs hover:opacity-95 text-xs motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Create Snapshot</span>
                  </button>
                </div>
              </div>

              {/* Snapshot Cadence & Mode Configuration */}
              <div className="p-3 bg-well/50 border border-border rounded-lg space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <span className="text-xs font-semibold text-foreground">Snapshot Automation</span>
                    <p className="text-[11px] text-muted">Choose whether to run automated snapshots or only take them on demand.</p>
                  </div>
                  <div className="flex items-center gap-1.5 p-1 bg-background border border-border rounded-lg self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setSettingsState({ ...settingsState, snapshotScheduleMode: 'scheduled' })}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                        (settingsState.snapshotScheduleMode ?? 'scheduled') === 'scheduled'
                          ? 'bg-primary text-primary-fg shadow-xs font-semibold'
                          : 'text-muted hover:text-foreground'
                      }`}
                    >
                      Scheduled
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettingsState({ ...settingsState, snapshotScheduleMode: 'manual' })}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                        settingsState.snapshotScheduleMode === 'manual'
                          ? 'bg-primary text-primary-fg shadow-xs font-semibold'
                          : 'text-muted hover:text-foreground'
                      }`}
                    >
                      On-Demand Only
                    </button>
                  </div>
                </div>

                {(settingsState.snapshotScheduleMode ?? 'scheduled') === 'scheduled' && (
                  <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/60">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-foreground font-medium">Take automated snapshot every:</span>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={settingsState.snapshotIntervalValue ?? 1}
                        onChange={(e) =>
                          setSettingsState({
                            ...settingsState,
                            snapshotIntervalValue: Math.max(1, parseInt(e.target.value, 10) || 1),
                          })
                        }
                        className="w-16 px-2.5 py-1 text-xs font-mono bg-background border border-border rounded-md text-foreground focus:outline-hidden focus:border-primary text-center"
                      />
                      <select
                        value={settingsState.snapshotIntervalUnit ?? 'days'}
                        onChange={(e) =>
                          setSettingsState({
                            ...settingsState,
                            snapshotIntervalUnit: e.target.value as 'days' | 'weeks' | 'months',
                          })
                        }
                        className="px-2.5 py-1 text-xs bg-background border border-border rounded-md text-foreground focus:outline-hidden focus:border-primary"
                      >
                        <option value="days">Day(s)</option>
                        <option value="weeks">Week(s)</option>
                        <option value="months">Month(s)</option>
                      </select>
                    </div>
                    <span className="text-[11px] text-muted">
                      (Runs at 03:00 local time · Last taken: {settingsState.lastSnapshotAt ? new Date(settingsState.lastSnapshotAt).toLocaleDateString() : 'Never'})
                    </span>
                  </div>
                )}
                {settingsState.snapshotScheduleMode === 'manual' && (
                  <p className="text-[11px] text-muted italic pt-1 border-t border-border/60">
                    Automated snapshots are disabled. Snapshots will only be generated when you click &quot;Create Snapshot&quot;.
                  </p>
                )}
              </div>

              <div className="border border-border rounded-lg overflow-hidden bg-background">
                {snapshots.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted">
                    No snapshot files created yet. Click &quot;Create Snapshot&quot; to generate an instant point-in-time backup.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-well text-muted text-[10px]">
                        <th className="p-2.5 font-medium">Snapshot File</th>
                        <th className="p-2.5 font-medium">Type</th>
                        <th className="p-2.5 font-medium">Size</th>
                        <th className="p-2.5 font-medium">Created At</th>
                        <th className="p-2.5 font-medium text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {snapshots.map((snap: SnapshotItem) => (
                        <tr key={snap.filename} className="hover:bg-well motion-safe:transition-colors motion-safe:duration-160">
                          <td className="p-2.5 font-mono text-foreground font-medium">{snap.filename}</td>
                          <td className="p-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              snap.type === 'daily'
                                ? 'bg-info/10 border-info/30 text-info'
                                : snap.type === 'weekly'
                                ? 'bg-primary/10 border-primary/30 text-primary'
                                : snap.type === 'monthly'
                                ? 'bg-success/10 border-success/30 text-success'
                                : 'bg-muted/10 border-muted/30 text-muted'
                            }`}>
                              {snap.type}
                            </span>
                          </td>
                          <td className="p-2.5 text-muted">
                            {Math.round((snap.sizeBytes ?? 0) / 1024)} KB
                          </td>
                          <td className="p-2.5 text-muted font-mono">
                            {new Date(snap.createdAt).toLocaleString()}
                          </td>
                          <td className="p-2.5 text-right">
                            <a
                              href={`/api/backup/snapshots/${encodeURIComponent(snap.filename)}`}
                              download={snap.filename}
                              className="px-2.5 py-1 rounded bg-well border border-border hover:bg-well text-primary font-medium text-[11px] inline-flex items-center gap-1 motion-safe:transition-colors motion-safe:duration-160 whitespace-nowrap"
                            >
                              <Download className="w-3 h-3" />
                              <span>Download</span>
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Section 5: Danger Zone: Factory Reset / Delete All Data */}
      <div className="bg-card border border-overdue/40 rounded-xl overflow-hidden">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpenSection((prev) => (prev === 5 ? null : 5))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setOpenSection((prev) => (prev === 5 ? null : 5));
            }
          }}
          className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-overdue/5 cursor-pointer select-none motion-safe:transition-colors motion-safe:duration-160 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          <div className="flex items-center gap-2 text-overdue">
            <AlertTriangle className="w-4 h-4 text-overdue" />
            <span className="text-sm font-bold">
              5. Danger Zone: Factory Reset / Delete All Data
            </span>
          </div>
          <span className="text-muted text-sm font-mono">
            {openSection === 5 ? '▾' : '▸'}
          </span>
        </div>

        {openSection === 5 && (
          <div className="px-5 pb-5 pt-3 space-y-4 border-t border-overdue/20 text-xs">
            <div className="p-3.5 rounded-lg bg-overdue/10 border border-overdue/30 text-foreground space-y-2">
              <div className="font-semibold text-overdue flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-overdue" />
                <span>Permanent Data Destruction Warning</span>
              </div>
              <p className="text-muted">
                This action will permanently delete all contacts, touchpoint interaction histories, conversation topics, group circles, and relationship links from SQLite. This action cannot be undone.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-muted">
                To proceed, type <code className="text-overdue bg-well px-1 py-0.5 rounded font-mono">DELETE</code> in the box below to re-authorize:
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="px-3 py-2 rounded-lg bg-background border border-overdue/40 text-foreground font-mono text-xs w-64 focus:outline-none focus:border-overdue"
                />
                <button
                  type="button"
                  disabled={deleteConfirmText !== 'DELETE'}
                  onClick={handleWipeAllData}
                  className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-1.5 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 whitespace-nowrap ${
                    deleteConfirmText === 'DELETE'
                      ? 'bg-overdue hover:opacity-90 text-white cursor-pointer shadow-md'
                      : 'bg-background border border-border text-muted cursor-not-allowed opacity-50'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete All Data</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Warning confirmation dialog for cleaning all snapshots */}
      {showCleanSnapshotsWarning && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clean-snapshots-title"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => {
            if (!cleaningSnapshots) setShowCleanSnapshotsWarning(false);
          }}
        >
          <div
            className="bg-card border border-border rounded-xl shadow-xl max-w-md w-full p-5 space-y-4 text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-overdue/10 border border-overdue/20 flex items-center justify-center shrink-0 text-overdue">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 id="clean-snapshots-title" className="text-base font-bold text-foreground">
                  Clean All Database Snapshots?
                </h3>
                <p className="text-xs text-muted leading-relaxed">
                  Are you sure you want to permanently delete all <strong className="text-foreground">{snapshots.length}</strong> point-in-time SQLite snapshot file{snapshots.length === 1 ? '' : 's'} from disk?
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-overdue/10 border border-overdue/20 text-xs text-foreground space-y-1">
              <p className="font-semibold text-overdue flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>This action cannot be undone.</span>
              </p>
              <p className="text-muted text-[11px]">
                All daily, weekly, and monthly SQLite snapshots created with native VACUUM INTO will be permanently deleted from local disk storage.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowCleanSnapshotsWarning(false)}
                disabled={cleaningSnapshots}
                className="px-3.5 py-1.5 rounded-lg border border-border bg-well hover:bg-card-hover text-foreground font-semibold text-xs motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCleanAllSnapshots}
                disabled={cleaningSnapshots}
                className="px-4 py-1.5 rounded-lg bg-overdue hover:bg-overdue/90 text-white font-semibold text-xs flex items-center gap-1.5 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-overdue focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{cleaningSnapshots ? 'Cleaning…' : 'Delete All Snapshots'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
