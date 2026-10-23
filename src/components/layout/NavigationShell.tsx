'use client';

import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Network,
  Calendar as CalendarIcon,
  Settings as SettingsIcon,
  BookOpen,
  Sun,
  Moon,
  Menu,
  X,
  Search,
  Plus,
  Palmtree,
  GitMerge,
  LogOut,
  PlayCircle,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { NavigationTab } from '@/types/touchpoint';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useUI } from '@/context/UIContext';
import { useContacts } from '@/context/ContactsContext';
import { useGroups } from '@/context/GroupsContext';

export interface NavigationShellProps {
  children: React.ReactNode;
  activeTab?: NavigationTab;
  onTabChange?: (tab: NavigationTab) => void;
  // Modals & Action Triggers
  onOpenQuickSearch?: () => void;
  onOpenNewContact?: () => void;
  onOpenLogTouchpoint?: () => void;
  onOpenPauseModal?: () => void;
  onResumeCadence?: () => void;
  onOpenMergeModal?: () => void;
}

/**
 * NavigationShell: Unified application layout container
 * Conforms to Hallmark Surface Ladder (Ground -> Well -> Card) and Emil Kowalski tactile interactions.
 */
export function NavigationShell({
  children,
  activeTab: propActiveTab,
  onTabChange,
  onOpenQuickSearch,
  onOpenNewContact,
  onOpenLogTouchpoint,
  onOpenPauseModal,
  onResumeCadence,
  onOpenMergeModal,
}: NavigationShellProps) {
  const ui = useUI();
  const auth = useAuth();
  const theme = useTheme();
  const contactsCtx = useContacts();
  const groupsCtx = useGroups();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  // Load persisted collapse state on mount
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('touchpoint_sidebar_collapsed');
      if (saved !== null) {
        setSidebarCollapsed(saved === 'true');
      }
    }
  }, []);

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('touchpoint_sidebar_collapsed', String(next));
        } catch {}
      }
      return next;
    });
  };

  // Keyboard shortcut: [ or ⌘B / Ctrl+B to toggle sidebar
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === '[' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) ||
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b')
      ) {
        e.preventDefault();
        toggleSidebarCollapse();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Active tab state
  const currentTab = propActiveTab ?? ui.activeTab;
  const handleSelectTab = (tab: NavigationTab) => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      ui.setActiveTab(tab);
    }
    setMobileMenuOpen(false);
  };

  // User & Theme
  const currentUser = auth.currentUser;
  const authDisabled = auth.authDisabled;
  const themeMode = theme.themeMode;
  const handleToggleTheme = () => {
    theme.setThemeMode(themeMode === 'dark' ? 'light' : 'dark');
  };

  // Contacts & Metrics
  const contacts = contactsCtx.contacts;
  const groups = groupsCtx.groups;
  const duplicates = contactsCtx.duplicates;
  const attentionCount = contacts.filter(
    (c) => c.keepInTouch && ['overdue', 'due_today'].includes(c.cadence?.status)
  ).length;

  // Derived Health
  const trackedContacts = contacts.filter((c) => c.keepInTouch);
  const onTrackCount = trackedContacts.filter(
    (c) => c.cadence?.status === 'on_track' || c.cadence?.status === 'due_soon'
  ).length;
  const healthPercent =
    trackedContacts.length > 0
      ? Math.round((onTrackCount / trackedContacts.length) * 100)
      : 100;

  // Vacation / Pause Mode
  const isGlobalPaused = Boolean(
    ui.settingsState.globalPausedUntil &&
      new Date(ui.settingsState.globalPausedUntil).getTime() > Date.now()
  );
  const remainingPauseDays = isGlobalPaused
    ? Math.max(
        1,
        Math.ceil(
          (new Date(ui.settingsState.globalPausedUntil!).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 0;

  // Service telemetry
  const isTelegramConfigured = Boolean(
    ui.settingsState.telegramChatId &&
      (ui.settingsState.telegramBotToken || ui.settingsState.hasTelegramBotToken)
  );
  const isWebhookConfigured = Boolean(
    ui.settingsState.webhookEnabled && ui.settingsState.webhookUrl
  );
  const isGoogleConnected = Boolean(
    ui.settingsState.googleRefreshToken || ui.settingsState.hasGoogleRefreshToken
  );
  const isSchedulerRunning = ui.systemServices.scheduler === 'running';
  const isTelegramBotRunning =
    ui.systemServices.telegramBot === 'running' || (isTelegramConfigured && isSchedulerRunning);

  // Modal Triggers
  const triggerQuickSearch = () => {
    if (onOpenQuickSearch) {
      onOpenQuickSearch();
    } else {
      ui.setShowQuickSearchModal(true);
    }
  };

  const triggerNewContact = () => {
    if (onOpenNewContact) {
      onOpenNewContact();
    } else {
      contactsCtx.setShowNewContactModal(true);
    }
  };

  const triggerLogTouchpoint = () => {
    if (onOpenLogTouchpoint) {
      onOpenLogTouchpoint();
    } else if (contacts.length > 0) {
      contactsCtx.openContactDrawer(contacts[0]);
    }
  };

  const triggerPauseModal = () => {
    if (onOpenPauseModal) {
      onOpenPauseModal();
    } else {
      ui.setShowPauseModal(true);
    }
  };

  const triggerResumeCadence = () => {
    if (onResumeCadence) {
      onResumeCadence();
    } else {
      ui.saveSettings({ globalPausedUntil: null });
      ui.notify('Cadence resumed for all contacts.');
    }
  };

  const triggerMergeModal = () => {
    if (onOpenMergeModal) {
      onOpenMergeModal();
    } else {
      contactsCtx.setShowMergeModal(true);
    }
  };

  const renderSidebarContent = (isMobile = false) => {
    const isRadarRail = theme.designVariant === 'radar' && !isMobile;
    const isSwiss = theme.designVariant === 'swiss';
    const isStudio = theme.designVariant === 'studio';

    if (isRadarRail) {
      if (sidebarCollapsed) {
        return (
          <div className="flex flex-col justify-between h-full items-center py-2 space-y-4 w-full">
            <div className="flex flex-col items-center space-y-4">
              {/* Radar Rail Brand Logo */}
              <div className="relative w-9 h-9 rounded-xl bg-well border border-border flex items-center justify-center shrink-0">
                <img
                  src="/logo.png"
                  alt="Touchpoint Logo"
                  className="w-5 h-5 object-contain"
                />
                <span
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary ring-2 ring-background"
                  title="Cadence Radar Active"
                />
              </div>

              {/* Quick Expand Button */}
              <button
                type="button"
                onClick={toggleSidebarCollapse}
                title="Expand sidebar ([)"
                aria-label="Expand sidebar ([)"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-well motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PanelLeftOpen className="w-4 h-4" aria-hidden="true" />
              </button>

              <div className="w-8 border-t border-border my-0.5" />

              {/* Radar Rail Primary Nav */}
              <nav className="flex flex-col items-center space-y-1.5" aria-label="Workspace Navigation">
                {[
                  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: attentionCount, urgent: attentionCount > 0 },
                  { id: 'contacts', label: 'Contacts', icon: Users, badge: contacts.length },
                  { id: 'groups', label: 'Groups', icon: FolderKanban, badge: groups.length },
                  { id: 'map', label: 'Relationships', icon: Network },
                  { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectTab(item.id as NavigationTab)}
                      title={item.label}
                      aria-label={item.label}
                      className={`relative w-10 h-10 rounded-xl flex items-center justify-center motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                        isActive
                          ? 'bg-primary text-primary-fg shadow-sm'
                          : 'text-muted hover:text-foreground hover:bg-well'
                      }`}
                    >
                      <Icon className="w-4 h-4" aria-hidden="true" />
                      {item.badge !== undefined && item.badge > 0 && (
                        <span
                          className={`absolute -top-1 -right-1 text-[9px] px-1 py-0.2 rounded-full font-bold tabular-nums ${
                            item.urgent ? 'bg-overdue text-white' : 'bg-well border border-border text-foreground'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              <div className="w-8 border-t border-border my-1" />

              {/* Radar Rail System Nav */}
              <nav className="flex flex-col items-center space-y-1.5" aria-label="System Navigation">
                {[
                  { id: 'settings', label: 'Settings', icon: SettingsIcon },
                  { id: 'help', label: 'Help & Guide', icon: BookOpen },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectTab(item.id as NavigationTab)}
                      title={item.label}
                      aria-label={item.label}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                        isActive
                          ? 'bg-primary text-primary-fg'
                          : 'text-muted hover:text-foreground hover:bg-well'
                      }`}
                    >
                      <Icon className="w-4 h-4" aria-hidden="true" />
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Radar Rail Footer Services Dots, Theme Toggle & User Initials */}
            <div className="flex flex-col items-center space-y-2">
              <button
                type="button"
                onClick={() => handleSelectTab('settings')}
                title={`Channels & Services:\n• Scheduler: ${isSchedulerRunning ? 'Running' : 'Inactive'}\n• Telegram Bot: ${isTelegramConfigured ? (isTelegramBotRunning ? 'Running' : 'Configured') : 'Not connected'}\n• Webhook: ${isWebhookConfigured ? 'Configured' : 'Not configured'}\n• Google Sync: ${isGoogleConnected ? 'Connected' : 'Not connected'}`}
                aria-label="Channels & Services Status"
                className="w-8 h-8 rounded-xl bg-well border border-border hover:border-primary/50 flex items-center justify-center motion-safe:transition-colors motion-safe:duration-160 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary"
              >
                <div className="grid grid-cols-2 gap-1 p-0.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSchedulerRunning ? 'bg-success' : 'bg-muted/30'
                    }`}
                  />
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isTelegramConfigured ? 'bg-success' : 'bg-muted/30'
                    }`}
                  />
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isWebhookConfigured ? 'bg-success' : 'bg-muted/30'
                    }`}
                  />
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isGoogleConnected ? 'bg-success' : 'bg-muted/30'
                    }`}
                  />
                </div>
              </button>

              <button
                type="button"
                onClick={handleToggleTheme}
                title="Toggle Light or Dark Appearance"
                aria-label="Toggle Light or Dark Appearance"
                className="w-9 h-9 rounded-xl border border-border bg-well hover:bg-card-hover text-foreground flex items-center justify-center motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {themeMode === 'dark' ? (
                  <Sun className="w-3.5 h-3.5 text-warning" aria-hidden="true" />
                ) : (
                  <Moon className="w-3.5 h-3.5 text-foreground" aria-hidden="true" />
                )}
              </button>
              <div className="w-8 h-8 rounded-full bg-well border border-border flex items-center justify-center text-[11px] font-bold text-foreground">
                {currentUser?.username?.slice(0, 2).toUpperCase() || 'TP'}
              </div>
            </div>
          </div>
        );
      }

      // Expanded Radar Sidebar
      return (
        <div className="flex flex-col justify-between h-full space-y-4 w-full">
          <div className="space-y-4">
            {/* Header: Brand + Collapse Button */}
            <div className="flex items-center justify-between pb-2.5 border-b border-border">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative w-8 h-8 rounded-lg bg-well border border-border flex items-center justify-center shrink-0">
                  <img
                    src="/logo.png"
                    alt="Touchpoint Logo"
                    className="w-5 h-5 object-contain"
                  />
                  <span
                    className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary ring-2 ring-background"
                    title="Cadence Radar Active"
                  />
                </div>
                <div className="min-w-0">
                  <div className="font-extrabold text-base tracking-tight text-foreground leading-tight truncate">
                    Touchpoint
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleSidebarCollapse}
                title="Collapse sidebar ([)"
                aria-label="Collapse sidebar ([)"
                className="w-7 h-7 rounded-lg border border-border bg-well hover:bg-card-hover text-muted hover:text-foreground flex items-center justify-center motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                <PanelLeftClose className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            {/* Workspace Navigation */}
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-muted px-2 mb-1.5">
                Workspace
              </div>
              <nav className="flex flex-col space-y-1" aria-label="Workspace Navigation">
                {[
                  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: attentionCount, urgent: attentionCount > 0 },
                  { id: 'contacts', label: 'Contacts', icon: Users, badge: contacts.length },
                  { id: 'groups', label: 'Groups', icon: FolderKanban, badge: groups.length },
                  { id: 'map', label: 'Relationships', icon: Network },
                  { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectTab(item.id as NavigationTab)}
                      title={item.label}
                      aria-label={item.label}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                        isActive
                          ? 'bg-primary text-primary-fg shadow-sm'
                          : 'text-muted hover:text-foreground hover:bg-well'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold tabular-nums shrink-0 ${
                            item.urgent
                              ? 'bg-overdue text-white'
                              : isActive
                              ? 'bg-primary-fg/20 text-primary-fg'
                              : 'bg-well border border-border text-foreground'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* System Navigation */}
            <div className="space-y-1 pt-2 border-t border-border">
              <div className="text-[11px] font-semibold text-muted px-2 mb-1.5">
                Preferences
              </div>
              <nav className="flex flex-col space-y-1" aria-label="System Navigation">
                {[
                  { id: 'settings', label: 'Settings', icon: SettingsIcon },
                  { id: 'help', label: 'Help & Guide', icon: BookOpen },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectTab(item.id as NavigationTab)}
                      title={item.label}
                      aria-label={item.label}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                        isActive
                          ? 'bg-primary text-primary-fg shadow-sm'
                          : 'text-muted hover:text-foreground hover:bg-well'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span className="truncate">{item.label}</span>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          <div className="space-y-3">
            {/* Channels & Services Telemetry Badges */}
            <div className="pt-2 border-t border-border space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-muted px-1">
                <span>Services &amp; Channels</span>
                <button
                  type="button"
                  onClick={() => handleSelectTab('settings')}
                  className="text-[10px] text-primary hover:underline font-normal lowercase focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                >
                  manage
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px] px-1">
                <div
                  className="flex items-center gap-1.5 truncate"
                  title={
                    isTelegramConfigured
                      ? `Telegram Bot active${isTelegramBotRunning ? ' (running)' : ''}`
                      : 'Telegram not connected'
                  }
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      isTelegramConfigured ? 'bg-success shadow-xs shadow-success/40' : 'bg-muted/40'
                    }`}
                  />
                  <span
                    className={`truncate ${
                      isTelegramConfigured ? 'text-foreground font-medium' : 'text-muted'
                    }`}
                  >
                    Telegram
                  </span>
                </div>
                <div
                  className="flex items-center gap-1.5 truncate"
                  title={isWebhookConfigured ? 'Webhook active' : 'Webhook not configured'}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      isWebhookConfigured ? 'bg-success shadow-xs shadow-success/40' : 'bg-muted/40'
                    }`}
                  />
                  <span
                    className={`truncate ${
                      isWebhookConfigured ? 'text-foreground font-medium' : 'text-muted'
                    }`}
                  >
                    Webhook
                  </span>
                </div>
                <div
                  className="flex items-center gap-1.5 truncate"
                  title={
                    isGoogleConnected
                      ? 'Google Contacts connected'
                      : 'Google Contacts not connected'
                  }
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      isGoogleConnected ? 'bg-success shadow-xs shadow-success/40' : 'bg-muted/40'
                    }`}
                  />
                  <span
                    className={`truncate ${
                      isGoogleConnected ? 'text-foreground font-medium' : 'text-muted'
                    }`}
                  >
                    Google Sync
                  </span>
                </div>
                <div
                  className="flex items-center gap-1.5 truncate"
                  title={
                    isSchedulerRunning
                      ? `Scheduler running${isTelegramBotRunning ? ' + bot poller' : ''}`
                      : 'Scheduler inactive'
                  }
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      isSchedulerRunning ? 'bg-success shadow-xs shadow-success/40' : 'bg-muted/40'
                    }`}
                  />
                  <span
                    className={`truncate ${
                      isSchedulerRunning ? 'text-foreground font-medium' : 'text-muted'
                    }`}
                  >
                    Scheduler
                  </span>
                </div>
              </div>
            </div>

            {/* Footer User & Theme Bar */}
            <div className="pt-2 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full bg-well border border-border flex items-center justify-center text-[10px] font-bold text-foreground shrink-0">
                  {currentUser?.username?.slice(0, 2).toUpperCase() || 'TP'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate leading-tight">
                    {currentUser?.username || 'Owner'}
                  </p>
                  <p className="text-[10px] text-muted truncate leading-tight">
                    {authDisabled ? 'Local Mode' : 'Admin'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleTheme}
                title="Toggle Light or Dark Appearance"
                aria-label="Toggle Light or Dark Appearance"
                className="w-7 h-7 rounded-lg border border-border bg-well hover:bg-card-hover text-foreground flex items-center justify-center motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {themeMode === 'dark' ? (
                  <Sun className="w-3.5 h-3.5 text-warning" aria-hidden="true" />
                ) : (
                  <Moon className="w-3.5 h-3.5 text-foreground" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
    <div className="flex flex-col justify-between h-full space-y-4">
      <div className="space-y-5">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-2 pb-3.5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="relative w-8 h-8 rounded-lg bg-well border border-border flex items-center justify-center shrink-0">
              <img
                src="/logo.png"
                alt="Touchpoint Logo"
                className="w-5 h-5 object-contain"
              />
              <span
                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-overdue ring-2 ring-background"
                title="Cadence Engine Active"
              />
            </div>
            <div>
              <div className="font-bold text-[15px] tracking-tight text-foreground leading-tight">
                {isSwiss ? 'TOUCHPOINT' : 'Touchpoint'}
              </div>
              <div className="text-[11px] font-medium text-muted leading-tight">
                {isSwiss ? 'SBB CHRONOMETER' : isStudio ? 'Personal Studio' : 'Cadence PRM'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleToggleTheme}
              title="Toggle Appearance"
              aria-label="Toggle Light or Dark Appearance"
              className="min-h-[28px] min-w-[28px] p-1.5 rounded-lg border border-border bg-well hover:bg-card-hover text-foreground flex items-center justify-center motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {themeMode === 'dark' ? (
                <Sun className="w-4 h-4 text-warning" aria-hidden="true" />
              ) : (
                <Moon className="w-4 h-4 text-foreground" aria-hidden="true" />
              )}
            </button>
            {isMobile && (
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation drawer"
                className="min-h-[28px] min-w-[28px] p-1.5 rounded-lg border border-border bg-well hover:bg-card-hover text-foreground flex items-center justify-center motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Primary Workspace Navigation */}
        <div className="space-y-1">
          <div className="px-2.5 pb-1 text-[11px] font-semibold text-muted">
            {isSwiss ? '00 / WORKSPACE' : 'Workspace'}
          </div>
          <nav className="space-y-0.5 text-[13px]" aria-label="Workspace Navigation">
            {[
              {
                id: 'dashboard',
                label: isSwiss ? '01 Overview' : 'Dashboard',
                icon: LayoutDashboard,
                badge: attentionCount,
                urgent: attentionCount > 0,
              },
              {
                id: 'contacts',
                label: isSwiss ? '02 Contacts' : isStudio ? 'People Circle' : 'Contacts',
                icon: Users,
                badge: contacts.length,
              },
              {
                id: 'groups',
                label: isSwiss ? '03 Groups' : isStudio ? 'Relationship Circles' : 'Groups',
                icon: FolderKanban,
                badge: groups.length,
              },
              { id: 'map', label: isSwiss ? '04 Network Map' : 'Relationships', icon: Network },
              {
                id: 'calendar',
                label: isSwiss ? '05 Schedule' : 'Calendar & Schedule',
                icon: CalendarIcon,
              },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectTab(item.id as NavigationTab)}
                  className={`w-full min-h-[34px] flex items-center justify-between px-2.5 py-1.5 ${isStudio ? 'rounded-2xl' : 'rounded-lg'} text-left motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                    isActive
                      ? 'bg-well text-foreground font-semibold border-l-[3px] border-primary'
                      : 'text-muted hover:text-foreground hover:bg-well/60 font-medium'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-primary' : 'text-muted'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`text-[11px] px-1.5 py-0.5 rounded-md font-semibold tabular-nums ${
                        item.urgent
                          ? 'bg-overdue text-white'
                          : isActive
                          ? 'bg-primary/20 text-foreground'
                          : 'bg-well text-muted'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Secondary System Navigation */}
        <div className="space-y-1 pt-3 border-t border-border">
          <div className="px-2.5 pb-1 text-[11px] font-semibold text-muted">
            {isSwiss ? '00 / SYSTEM' : 'System'}
          </div>
          <nav className="space-y-0.5 text-[13px]" aria-label="System Navigation">
            {[
              { id: 'settings', label: isSwiss ? '06 Settings' : 'Settings', icon: SettingsIcon },
              { id: 'help', label: isSwiss ? '07 Reference' : 'Help & Guide', icon: BookOpen },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectTab(item.id as NavigationTab)}
                  className={`w-full min-h-[34px] flex items-center justify-between px-2.5 py-1.5 ${isStudio ? 'rounded-2xl' : 'rounded-lg'} text-left motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                    isActive
                      ? 'bg-well text-foreground font-semibold border-l-[3px] border-primary'
                      : 'text-muted hover:text-foreground hover:bg-well/60 font-medium'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon
                      className={`w-4 h-4 ${
                        isActive ? 'text-primary' : 'text-muted'
                      }`}
                      aria-hidden="true"
                    />
                    <span>{item.label}</span>
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom Network Cadence Status Readout & Integration Telemetry */}
      <div className="space-y-2 pt-3 border-t border-border">
        <div className="rounded-lg bg-well border border-border p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-foreground flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  healthPercent >= 80
                    ? 'bg-success'
                    : healthPercent >= 50
                    ? 'bg-warning'
                    : 'bg-overdue'
                }`}
              />
              Network Health
            </span>
            <span className="text-[12px] font-bold text-foreground tabular-nums">
              {healthPercent}%
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-background overflow-hidden">
            <div
              className={`h-full rounded-full transition-transform duration-300 origin-left ${
                healthPercent >= 80
                  ? 'bg-success'
                  : healthPercent >= 50
                  ? 'bg-warning'
                  : 'bg-overdue'
              }`}
              style={{ transform: `scaleX(${Math.max(4, Math.min(100, healthPercent)) / 100})` }}
            />
          </div>
          <p className="text-[11px] text-muted leading-snug tabular-nums">
            {onTrackCount} of {trackedContacts.length} on schedule
          </p>

          {/* Channels & Services Telemetry Badges */}
          <div className="pt-2 border-t border-border/70 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold text-muted">
              <span>Channels &amp; Services</span>
              <button
                type="button"
                onClick={() => handleSelectTab('settings')}
                className="text-[10px] text-primary hover:underline font-normal focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                manage
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
              <div
                className="flex items-center gap-1.5 truncate"
                title={isTelegramConfigured ? 'Telegram Bot active' : 'Telegram not connected'}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    isTelegramConfigured ? 'bg-success' : 'bg-muted/40'
                  }`}
                />
                <span className={`truncate ${isTelegramConfigured ? 'text-foreground font-medium' : 'text-muted'}`}>
                  Telegram
                </span>
              </div>
              <div
                className="flex items-center gap-1.5 truncate"
                title={isWebhookConfigured ? 'Webhook active' : 'Webhook not configured'}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    isWebhookConfigured ? 'bg-success' : 'bg-muted/40'
                  }`}
                />
                <span className={`truncate ${isWebhookConfigured ? 'text-foreground font-medium' : 'text-muted'}`}>
                  Webhook
                </span>
              </div>
              <div
                className="flex items-center gap-1.5 truncate"
                title={isGoogleConnected ? 'Google Contacts connected' : 'Google Contacts not connected'}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    isGoogleConnected ? 'bg-success' : 'bg-muted/40'
                  }`}
                />
                <span className={`truncate ${isGoogleConnected ? 'text-foreground font-medium' : 'text-muted'}`}>
                  Google Sync
                </span>
              </div>
              <div
                className="flex items-center gap-1.5 truncate"
                title={isSchedulerRunning ? 'Scheduler active' : 'Scheduler inactive'}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    isSchedulerRunning ? 'bg-success' : 'bg-muted/40'
                  }`}
                />
                <span className={`truncate ${isSchedulerRunning ? 'text-foreground font-medium' : 'text-muted'}`}>
                  Scheduler
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-background text-foreground">
      {/* Desktop Sidebar Navigation */}
      <aside
        className={`hidden md:flex ${
          theme.designVariant === 'radar'
            ? sidebarCollapsed
              ? 'w-16 p-2 items-center'
              : 'w-60 p-3'
            : 'w-64 p-4'
        } h-full overflow-y-auto bg-background border-r border-border flex-col justify-between shrink-0 select-none`}
      >
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile Off-canvas Slide-over Drawer & Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 md:hidden animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] h-full overflow-y-auto bg-background border-r border-border flex flex-col justify-between p-4 select-none transition-transform duration-200 ease-in-out md:hidden ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Mobile Navigation Drawer"
      >
        {renderSidebarContent(true)}
      </aside>

      {/* Main Content Shell */}
      <main className="flex-1 h-full flex flex-col overflow-hidden bg-background">
        {ui.statusToast && (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-20 md:bottom-5 right-5 z-50 bg-foreground text-background border border-border px-4 py-2.5 rounded-xl text-[13px] font-medium flex items-center gap-2.5"
          >
            <span className="w-2 h-2 rounded-full bg-success" />
            {ui.statusToast}
          </div>
        )}

        {/* Sticky Top Header */}
        <header className="h-14 px-3 sm:px-6 border-b border-border bg-background flex items-center justify-between gap-2 sm:gap-4 shrink-0 z-20">
          {/* Left: Mobile Menu Trigger + Global Search */}
          <div className="flex items-center gap-2 min-w-0 flex-1 sm:max-w-md">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open Navigation Menu"
              className="min-h-[34px] min-w-[34px] p-2 rounded-lg border border-border bg-well hover:bg-card-hover text-foreground flex items-center justify-center md:hidden shrink-0 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Menu className="w-4 h-4" aria-hidden="true" />
            </button>

            {/* Desktop Global Search Field Trigger */}
            <button
              type="button"
              onClick={triggerQuickSearch}
              className="hidden sm:flex flex-1 min-h-[34px] bg-well hover:bg-card-hover border border-border px-3 py-1.5 rounded-lg items-center justify-between text-[13px] text-muted cursor-pointer motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-w-0"
            >
              <span className="flex items-center gap-2 min-w-0">
                <Search className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {ui.searchQuery
                    ? `Filtered by "${ui.searchQuery}"`
                    : 'Search Contacts, Companies, or Notes…'}
                </span>
              </span>
              <kbd className="px-1.5 py-0.5 rounded bg-background border border-border text-[11px] font-mono font-medium text-muted shrink-0 ml-2">
                ⌘K
              </kbd>
            </button>

            {/* Mobile Search Button */}
            <button
              type="button"
              onClick={triggerQuickSearch}
              aria-label="Search contacts"
              className="sm:hidden min-h-[34px] min-w-[34px] p-2 rounded-lg border border-border bg-well hover:bg-card-hover text-muted hover:text-foreground flex items-center justify-center shrink-0 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Search className="w-4 h-4" aria-hidden="true" />
            </button>

            {/* Mobile Filter Query Indicator */}
            {ui.searchQuery && (
              <span className="sm:hidden text-xs font-semibold text-primary truncate max-w-[120px]">
                &quot;{ui.searchQuery}&quot;
              </span>
            )}
          </div>

          {/* Right: Toolbar Actions & Triggers */}
          <div className="flex items-center gap-1.5 sm:gap-2 text-[13px] shrink-0">
            {/* Vacation Mode Trigger */}
            <button
              type="button"
              onClick={triggerPauseModal}
              className={`min-h-[32px] px-2.5 sm:px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                isGlobalPaused
                  ? 'bg-warning/15 border-warning/40 text-foreground'
                  : 'bg-well border-border text-foreground hover:bg-card-hover'
              }`}
              title={isGlobalPaused ? `Paused (${remainingPauseDays}d remaining)` : 'Vacation Mode'}
            >
              <Palmtree className="w-3.5 h-3.5 text-warning shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">
                {isGlobalPaused ? `Paused (${remainingPauseDays}d)` : 'Vacation Mode…'}
              </span>
              {isGlobalPaused && (
                <span className="sm:hidden text-[11px] font-bold">
                  {remainingPauseDays}d
                </span>
              )}
            </button>

            {/* Duplicate Merger Trigger */}
            {duplicates.length > 0 && (
              <button
                type="button"
                onClick={triggerMergeModal}
                className="min-h-[32px] px-2.5 sm:px-3.5 py-1.5 rounded-lg bg-warning/15 border border-warning/40 text-foreground font-medium flex items-center gap-1.5 hover:bg-warning/25 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                title={`Review potential duplicate contacts (${duplicates.length})`}
              >
                <GitMerge className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">
                  Merge Duplicates ({duplicates.length})…
                </span>
                <span className="sm:hidden text-[11px] font-bold">
                  {duplicates.length}
                </span>
              </button>
            )}

            {/* Log Touchpoint Quick Action Trigger */}
            <button
              type="button"
              onClick={triggerLogTouchpoint}
              className="hidden lg:flex min-h-[32px] px-3 py-1.5 rounded-lg border border-border bg-well hover:bg-card-hover text-foreground font-medium items-center gap-1.5 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Log Touchpoint"
            >
              <MessageSquarePlus className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
              <span>Log Touchpoint…</span>
            </button>

            {/* + Contact Trigger */}
            <button
              type="button"
              onClick={triggerNewContact}
              className="min-h-[32px] px-2.5 sm:px-3.5 py-1.5 rounded-lg bg-primary hover:opacity-95 text-primary-fg font-semibold flex items-center gap-1.5 shadow-xs motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              title="New Contact"
            >
              <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">New Contact…</span>
            </button>

            {/* Operator Profile */}
            <div className="flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2.5 border-l border-border">
              <div className="w-7 h-7 rounded-full bg-well border border-border text-foreground flex items-center justify-center font-semibold text-[11px] shrink-0">
                {(currentUser?.username || 'OP').slice(0, 2).toUpperCase()}
              </div>
              <div className="hidden lg:block leading-tight">
                <div className="font-semibold text-foreground text-[12px]">
                  {currentUser?.username || 'Workspace Owner'}
                </div>
              </div>
              {!authDisabled && currentUser && (
                <button
                  type="button"
                  onClick={auth.handleLogout}
                  title="Sign Out"
                  aria-label="Sign Out"
                  className="min-h-[28px] min-w-[28px] p-1.5 rounded-lg hover:bg-card-hover text-muted hover:text-overdue flex items-center justify-center motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <LogOut className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Workspace Content Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-8 space-y-4 sm:space-y-6 pb-24 md:pb-8 touch-scroll">
          {/* Global Vacation / Pause Mode Banner */}
          {isGlobalPaused && (
            <div className="bg-warning/10 border border-warning/35 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in duration-200">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-xl bg-warning/20 text-warning shrink-0">
                  <Palmtree className="w-5 h-5" aria-hidden="true" />
                </span>
                <div>
                  <div className="font-semibold text-foreground text-sm flex items-center gap-2">
                    <span>Vacation / Cadence Pause Active</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-warning/20 border border-warning/40 text-foreground font-medium">
                      {remainingPauseDays} {remainingPauseDays === 1 ? 'day' : 'days'} remaining
                    </span>
                  </div>
                  <div className="text-muted mt-0.5">
                    All cadence reminders, overdue flags, and daily notification digests are paused
                    until <strong className="text-foreground">{ui.settingsState.globalPausedUntil}</strong>.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={triggerResumeCadence}
                  className="px-3.5 py-1.5 rounded-xl bg-success text-primary-fg font-semibold flex items-center gap-1.5 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PlayCircle className="w-3.5 h-3.5" aria-hidden="true" /> Resume Cadence Now
                </button>
                <button
                  type="button"
                  onClick={triggerPauseModal}
                  className="px-3 py-1.5 rounded-xl bg-well border border-border text-foreground hover:bg-card-hover font-medium motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Adjust Duration…
                </button>
              </div>
            </div>
          )}

          {/* Active Surface Content */}
          {children}
        </div>
      </main>

      {/* iOS Floating Bottom Tab Bar for Mobile */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 inset-x-0 z-30 bg-background border-t border-border flex items-center justify-around px-2 py-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
      >
        {[
          {
            id: 'dashboard',
            label: 'Dashboard',
            icon: LayoutDashboard,
            badge: attentionCount,
            urgent: attentionCount > 0,
          },
          {
            id: 'contacts',
            label: 'Contacts',
            icon: Users,
            badge: contacts.length,
          },
          {
            id: 'groups',
            label: 'Groups',
            icon: FolderKanban,
            badge: groups.length,
          },
          {
            id: 'calendar',
            label: 'Calendar',
            icon: CalendarIcon,
          },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectTab(item.id as NavigationTab)}
              className={`relative flex flex-col items-center justify-center min-w-[54px] py-1 px-1 rounded-lg motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                isActive ? 'text-primary font-semibold' : 'text-muted hover:text-foreground'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-muted'}`} aria-hidden="true" />
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`absolute -top-1 -right-2.5 text-[9px] px-1 py-0.2 rounded-full font-bold tabular-nums ${
                      item.urgent ? 'bg-primary text-white' : 'bg-well text-foreground'
                    }`}
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center min-w-[54px] py-1 px-1 rounded-lg text-muted hover:text-foreground motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Menu className="w-5 h-5 text-muted" aria-hidden="true" />
          <span className="text-[10px] mt-0.5 tracking-tight">More</span>
        </button>
      </nav>
    </div>
  );
}
