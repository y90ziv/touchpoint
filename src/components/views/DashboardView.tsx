'use client';

import React from 'react';
import {
  Users,
  Phone,
  UserCheck,
  Heart,
  SlidersHorizontal,
  Plus,
  MessageSquare,
  Clock,
  Cake,
  Shuffle,
  X,
  ArrowUp,
  Sparkles,
} from 'lucide-react';
import { ContactItem, NavigationTab } from '@/types/touchpoint';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import { useContacts } from '@/context/ContactsContext';
import { useTouchpoints } from '@/context/TouchpointsContext';
import { useTheme } from '@/context/ThemeContext';
import { RadarDashboard } from './dashboard/RadarDashboard';
import { SwissDashboard } from './dashboard/SwissDashboard';
import { StudioDashboard } from './dashboard/StudioDashboard';
import { ProgressRingAvatar } from '@/components/ProgressRingAvatar';
import { calculateRelationshipHealthScore, applySmartSpreading } from '@/lib/cadence';
import { formatDateByPattern } from '@/lib/formatters';

export interface DashboardViewProps {
  onOpenContact?: (contact: ContactItem) => void;
  onOpenNewContact?: () => void;
  onNavigateToTab?: (tab: NavigationTab) => void;
}

export function DashboardView({
  onOpenContact,
  onOpenNewContact,
  onNavigateToTab,
}: DashboardViewProps) {
  const auth = useAuth();
  const ui = useUI();
  const contactsCtx = useContacts();
  const touchpointsCtx = useTouchpoints();

  const contacts = contactsCtx.contacts;
  const currentUser = auth.currentUser;
  const settingsState = ui.settingsState;
  const dashboardWidgets = ui.dashboardWidgets;
  const showDashboardCustomizer = ui.showDashboardCustomizer;

  const navigateTab = (tab: NavigationTab) => {
    if (onNavigateToTab) {
      onNavigateToTab(tab);
    } else {
      ui.setActiveTab(tab);
    }
  };

  const handleOpenContact = (contact: ContactItem) => {
    if (onOpenContact) {
      onOpenContact(contact);
    } else {
      contactsCtx.openContactDrawer(contact);
    }
  };

  const handleOpenNewContact = () => {
    if (onOpenNewContact) {
      onOpenNewContact();
    } else {
      contactsCtx.setShowNewContactModal(true);
    }
  };

  const toggleDashboardWidget = (key: string) => {
    ui.setDashboardWidgets((prev) => ({
      ...prev,
      [key]: prev[key] === false ? true : false,
    }));
  };

  // Computations
  const evaluations = contacts.map((c) => c.cadence);
  const health = calculateRelationshipHealthScore(evaluations);
  const { surfacedToday } = applySmartSpreading(
    evaluations,
    Number(settingsState.maxDailyDue || 3)
  );
  const surfacedIds = new Set(surfacedToday.map((s) => s.contactId));
  const attentionContacts = contacts.filter((c) => surfacedIds.has(c.id));

  const upcomingWeekContacts = contacts
    .filter(
      (c) =>
        c.keepInTouch &&
        !surfacedIds.has(c.id) &&
        c.cadence.status !== 'paused' &&
        c.cadence.status !== 'untracked' &&
        c.cadence.daysUntilDue >= 0 &&
        c.cadence.daysUntilDue <= 7
    )
    .sort((a, b) => a.cadence.daysUntilDue - b.cadence.daysUntilDue);

  const onTrackContacts = contacts.filter(
    (c) =>
      c.keepInTouch &&
      !surfacedIds.has(c.id) &&
      c.cadence.status !== 'untracked' &&
      c.cadence.daysUntilDue > 7
  );

  const recent30DaysContacts = contacts
    .filter(
      (c) =>
        Boolean(c.lastContactedAt) &&
        c.cadence.daysSinceContact >= 0 &&
        c.cadence.daysSinceContact <= 30
    )
    .sort(
      (a, b) =>
        new Date(b.lastContactedAt || 0).getTime() - new Date(a.lastContactedAt || 0).getTime()
    );

  const firstDayOfWeek = Number(settingsState.firstDayOfWeek ?? 0);
  const weekDayNames = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  const birthdayWindowDays = Number(settingsState.birthdayDaysAdvance || 7);
  const nowDate = new Date();
  const todayMidnight = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());

  const upcomingBirthdays = contacts
    .map((c) => {
      if (!c.birthday) return null;
      const parts = c.birthday.trim().split('-').map(Number);
      if (parts.length < 2 || parts.some((n) => Number.isNaN(n))) return null;
      const hasYear = parts.length === 3 && parts[0] > 1900;
      const birthYear = hasYear ? parts[0] : null;
      const month = hasYear ? parts[1] : parts[0];
      const day = hasYear ? parts[2] : parts[1];
      if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) return null;

      let nextBday = new Date(todayMidnight.getFullYear(), month - 1, day);
      if (nextBday < todayMidnight) {
        nextBday = new Date(todayMidnight.getFullYear() + 1, month - 1, day);
      }
      const daysUntil = Math.round(
        (nextBday.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntil < 0 || daysUntil > birthdayWindowDays) return null;

      const turningAge = birthYear ? nextBday.getFullYear() - birthYear : null;
      const weekdayStr = nextBday.toLocaleDateString('en-US', { weekday: 'short' });
      const formattedDate = `${weekdayStr}, ${formatDateByPattern(nextBday, settingsState.dateFormat)}`;

      return {
        contact: c,
        daysUntil,
        turningAge,
        formattedDate,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const handleQuickLog = async (contactId: number, method: string, note?: string) => {
    const success = await touchpointsCtx.logTouchpoint(contactId, method, note);
    if (success) {
      ui.notify(`Logged ${method} touchpoint.`);
      await contactsCtx.loadContacts();
    }
  };

  const handleSnooze = async (contactId: number, days: number) => {
    const success = await contactsCtx.snoozeContact(contactId, days);
    if (success) {
      ui.notify(`Snoozed cadence by ${days} days.`);
      await contactsCtx.loadContacts();
    }
  };

  const theme = useTheme();

  if (theme.designVariant === 'radar') {
    return (
      <RadarDashboard
        contacts={contacts}
        attentionContacts={attentionContacts}
        upcomingWeekContacts={upcomingWeekContacts}
        onTrackContacts={onTrackContacts}
        recent30DaysContacts={recent30DaysContacts}
        health={health}
        onOpenContact={handleOpenContact}
        onOpenNewContact={handleOpenNewContact}
        onNavigateToTab={navigateTab}
      />
    );
  }

  if (theme.designVariant === 'swiss') {
    return (
      <SwissDashboard
        contacts={contacts}
        attentionContacts={attentionContacts}
        upcomingWeekContacts={upcomingWeekContacts}
        onTrackContacts={onTrackContacts}
        health={health}
        onOpenContact={handleOpenContact}
        onOpenNewContact={handleOpenNewContact}
        onNavigateToTab={navigateTab}
      />
    );
  }

  if (theme.designVariant === 'studio') {
    return (
      <StudioDashboard
        contacts={contacts}
        attentionContacts={attentionContacts}
        upcomingWeekContacts={upcomingWeekContacts}
        onTrackContacts={onTrackContacts}
        recent30DaysContacts={recent30DaysContacts}
        health={health}
        onOpenContact={handleOpenContact}
        onOpenNewContact={handleOpenNewContact}
        onNavigateToTab={navigateTab}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Hero & Action Controls */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-semibold text-primary flex items-center gap-1.5">
            <span>Welcome back, {currentUser?.username || 'there'}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Network overview for today
          </h1>
          <p className="text-xs text-muted">
            Track relationships, cadences, and touchpoints · Week starts on{' '}
            <button
              type="button"
              onClick={() => navigateTab('settings')}
              className="text-primary hover:underline font-medium focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {weekDayNames[firstDayOfWeek] || 'Sunday'}
            </button>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <button
            type="button"
            onClick={() => ui.setShowDashboardCustomizer((prev) => !prev)}
            className="px-3.5 py-2 rounded-xl bg-well hover:bg-card-hover border border-border font-medium flex items-center gap-2 text-muted hover:text-foreground motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
            <span>Customize Widgets</span>
          </button>
          <button
            type="button"
            onClick={handleOpenNewContact}
            className="px-4 py-2 rounded-xl bg-primary hover:opacity-95 text-primary-fg font-semibold flex items-center gap-1.5 shadow-xs motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" aria-hidden="true" /> Add Contact
          </button>
        </div>
      </div>

      {/* Dashboard Customizer Panel */}
      {showDashboardCustomizer && (
        <div className="bg-card border border-primary/40 rounded-2xl p-5 space-y-3 text-xs shadow-xs animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="font-semibold text-foreground flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-primary" aria-hidden="true" />
              <span>Customize Dashboard Widgets</span>
            </div>
            <button
              type="button"
              onClick={() => ui.setShowDashboardCustomizer(false)}
              aria-label="Close widget customizer"
              className="text-muted hover:text-foreground text-xs p-1 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
          <p className="text-muted">
            Choose which widgets to display on your dashboard. Preferences are saved automatically.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
            {[
              { id: 'healthStrip', label: '1. Executive KPI Cards & Cadence Pipeline' },
              { id: 'overdueDue', label: '2. Overdue & Due Today' },
              { id: 'birthdays', label: '3. Incoming Birthdays' },
              { id: 'upcomingCalls', label: '4. People to Call in Upcoming Week' },
              { id: 'recentTalked', label: '5. People Talked to in Last 30 Days' },
              { id: 'scheduledLater', label: '6. Scheduled Later (On Track)' },
            ].map((w) => (
              <label
                key={w.id}
                className="flex items-center gap-2.5 p-2.5 rounded-xl bg-well border border-border cursor-pointer hover:border-primary/50 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out"
              >
                <input
                  type="checkbox"
                  checked={dashboardWidgets[w.id] !== false}
                  onChange={() => toggleDashboardWidget(w.id)}
                  className="rounded"
                />
                <span className="font-medium text-foreground">{w.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Row 1: Executive KPI Strip */}
      {dashboardWidgets.healthStrip !== false && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Total & Tracked Contacts */}
          <div
            onClick={() => navigateTab('contacts')}
            className="bg-card hover:bg-card-hover border border-border rounded-2xl p-5 flex flex-col justify-between shadow-xs motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" aria-hidden="true" />
              </div>
              <span className="text-xs font-medium text-muted">Total Contacts</span>
            </div>
            <div className="text-3xl font-bold tracking-tight text-foreground mt-3">
              {contacts.length}
            </div>
            <div className="flex items-center gap-1.5 text-xs mt-2">
              <span className="text-success font-semibold flex items-center gap-0.5">
                <ArrowUp className="w-3 h-3" aria-hidden="true" />
                {contacts.filter((c) => c.keepInTouch).length} tracked
              </span>
              <span className="text-muted">
                (
                {contacts.length > 0
                  ? `${Math.round(
                      (contacts.filter((c) => c.keepInTouch).length / contacts.length) * 100
                    )}%`
                  : '0%'}{' '}
                under cadence)
              </span>
            </div>
          </div>

          {/* KPI 2: Needs Attention Today */}
          <div className="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-overdue/15 text-overdue flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5" aria-hidden="true" />
              </div>
              <span className="text-xs font-medium text-muted">Due &amp; Overdue Today</span>
            </div>
            <div className="text-3xl font-bold tracking-tight text-foreground mt-3">
              {attentionContacts.length}
            </div>
            <div className="flex items-center gap-1.5 text-xs mt-2">
              <span
                className={`font-semibold ${
                  attentionContacts.length === 0 ? 'text-success' : 'text-warning'
                }`}
              >
                {attentionContacts.length === 0
                  ? 'All caught up'
                  : `Cap: ${settingsState.maxDailyDue || 3}/day`}
              </span>
              <span className="text-muted">via smart spreading</span>
            </div>
          </div>

          {/* KPI 3: Talked to Recently (30d) */}
          <div className="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-success/15 text-success flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5" aria-hidden="true" />
              </div>
              <span className="text-xs font-medium text-muted">Connected (Last 30d)</span>
            </div>
            <div className="text-3xl font-bold tracking-tight text-foreground mt-3">
              {recent30DaysContacts.length}
            </div>
            <div className="flex items-center gap-1.5 text-xs mt-2">
              <span className="text-primary font-semibold">
                +{upcomingWeekContacts.length} due this week
              </span>
              <span className="text-muted">· {upcomingBirthdays.length} birthdays</span>
            </div>
          </div>

          {/* KPI 4: Relationship Health Score */}
          <div className="bg-card border border-border rounded-2xl p-5 flex items-center justify-between shadow-xs">
            <div className="flex flex-col justify-between h-full">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                  <Heart className="w-5 h-5" aria-hidden="true" />
                </div>
                <span className="text-xs font-medium text-muted">Relationship Health</span>
              </div>
              <div className="text-3xl font-bold tracking-tight text-foreground mt-3">
                {health.scorePercent}%
              </div>
              <div className="flex items-center gap-1.5 text-xs mt-2">
                <span className="text-success font-semibold">
                  {health.onTrackCount}/{health.totalTrackedCount}
                </span>
                <span className="text-muted">on schedule</span>
              </div>
            </div>
            <ProgressRingAvatar
              name={`${health.scorePercent}%`}
              progressPercent={health.scorePercent}
              status={health.overdueCount > 0 ? 'due_soon' : 'on_track'}
              size="lg"
            />
          </div>
        </div>
      )}

      {/* Row 2: Cadence Pipeline Breakdown */}
      {dashboardWidgets.healthStrip !== false && (
        <div className="bg-card border border-border rounded-2xl p-6 flex flex-col justify-between gap-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground">
                Relationship Cadence Pipeline
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Distribution of your contacts across cadence stages
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigateTab('contacts')}
              className="text-xs text-primary hover:underline font-medium focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              View directory
            </button>
          </div>

          <div className="space-y-3.5">
            {[
              {
                label: 'On Track',
                count: onTrackContacts.length,
                total: Math.max(1, contacts.filter((c) => c.keepInTouch).length),
                barColor: 'bg-primary',
              },
              {
                label: 'Upcoming (7d)',
                count: upcomingWeekContacts.length,
                total: Math.max(1, contacts.filter((c) => c.keepInTouch).length),
                barColor: 'bg-primary/70',
              },
              {
                label: 'Due & Overdue',
                count: attentionContacts.length,
                total: Math.max(1, contacts.filter((c) => c.keepInTouch).length),
                barColor: 'bg-overdue',
              },
              {
                label: 'Talked (30d)',
                count: recent30DaysContacts.length,
                total: Math.max(1, contacts.length),
                barColor: 'bg-success',
              },
              {
                label: 'Birthdays',
                count: upcomingBirthdays.length,
                total: Math.max(1, contacts.length),
                barColor: 'bg-warning',
              },
            ].map((stage) => {
              const pct = Math.min(100, Math.round((stage.count / stage.total) * 100));
              return (
                <div key={stage.label} className="grid grid-cols-12 items-center gap-3 text-xs">
                  <span className="col-span-3 sm:col-span-2 text-muted font-medium truncate">
                    {stage.label}
                  </span>
                  <div className="col-span-7 sm:col-span-9 h-3 rounded-full bg-well border border-border/60 overflow-hidden p-0.5">
                    <div
                      className={`h-full rounded-full ${stage.barColor} transition-transform duration-300 origin-left`}
                      style={{
                        transform: `scaleX(${stage.count > 0 ? Math.max(0.06, pct / 100) : 0})`,
                      }}
                    />
                  </div>
                  <span className="col-span-2 sm:col-span-1 text-right font-semibold text-foreground">
                    {stage.count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 1: Needs Attention (Overdue & Due Today) */}
      {dashboardWidgets.overdueDue !== false && (
        <section className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <span>Overdue &amp; Due Today</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-overdue/15 text-overdue border border-overdue/30">
                  {attentionContacts.length}
                </span>
              </h2>
              <p className="text-xs text-muted mt-0.5">Priority touchpoints surfaced for today</p>
            </div>
            <button
              type="button"
              onClick={() => {
                ui.setSearchFilterTab('due');
                navigateTab('contacts');
              }}
              className="text-xs text-primary hover:underline font-medium focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              View all
            </button>
          </div>

          {attentionContacts.length === 0 ? (
            <div className="bg-well border border-border rounded-xl p-6 text-center text-sm text-muted">
              All tracked contacts are currently on track for today.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {attentionContacts.map((c) => (
                <div
                  key={c.id}
                  className="bg-well hover:bg-card-hover border border-border rounded-xl p-4 flex flex-col justify-between gap-3 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div
                      onClick={() => handleOpenContact(c)}
                      className="flex items-center gap-3 cursor-pointer"
                    >
                      <ProgressRingAvatar
                        name={c.fullName}
                        progressPercent={c.cadence.progressPercent}
                        status={c.cadence.status}
                      />
                      <div>
                        <div className="font-semibold text-sm hover:text-primary transition-colors">
                          {c.fullName}
                        </div>
                        <div className="text-xs text-muted">
                          {[c.jobTitle, c.company].filter(Boolean).join(' @ ') ||
                            c.groups.map((g) => g.name).join(', ') ||
                            'No group'}
                        </div>
                        {c.notes && (
                          <div className="text-xs text-muted mt-0.5 line-clamp-1">{c.notes}</div>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-overdue/15 text-overdue border border-overdue/30 shrink-0">
                      {c.cadence.daysSinceContact}d ago · {c.cadence.effectiveIntervalDays}d
                    </span>
                  </div>

                  {c.topics.filter((t) => !t.isCompleted).length > 0 && (
                    <div className="bg-background rounded-lg p-2.5 text-xs">
                      <span className="text-muted font-medium">To ask: </span>
                      {c.topics
                        .filter((t) => !t.isCompleted)
                        .map((t) => t.content)
                        .join(' · ')}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleQuickLog(c.id, 'call')}
                        className="px-3 py-1.5 rounded-lg bg-primary text-primary-fg font-semibold flex items-center gap-1 shadow-xs hover:opacity-95 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Phone className="w-3 h-3" aria-hidden="true" /> Call
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickLog(c.id, 'message')}
                        className="px-2.5 py-1.5 rounded-lg bg-background hover:bg-card-hover border border-border font-medium flex items-center gap-1 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <MessageSquare className="w-3 h-3" aria-hidden="true" /> Message
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickLog(c.id, 'in_person')}
                        className="px-2.5 py-1.5 rounded-lg bg-background hover:bg-card-hover border border-border font-medium flex items-center gap-1 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <UserCheck className="w-3 h-3" aria-hidden="true" /> In Person
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSnooze(c.id, 3)}
                      className="text-muted hover:text-foreground flex items-center gap-1 font-medium motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Clock className="w-3 h-3" aria-hidden="true" /> Snooze 3d
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Section 2: Incoming Birthdays & People to Call in the Upcoming Week */}
      {(dashboardWidgets.birthdays !== false || dashboardWidgets.upcomingCalls !== false) && (
        <div
          className={`grid grid-cols-1 ${
            dashboardWidgets.birthdays !== false && dashboardWidgets.upcomingCalls !== false
              ? 'lg:grid-cols-2'
              : 'grid-cols-1'
          } gap-6`}
        >
          {/* Incoming Birthdays */}
          {dashboardWidgets.birthdays !== false && (
            <section className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Cake className="w-4 h-4 text-primary" aria-hidden="true" />
                    <span>Incoming Birthdays (Next {birthdayWindowDays}d)</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                      {upcomingBirthdays.length}
                    </span>
                  </h2>
                  <p className="text-xs text-muted mt-0.5">
                    Week starts: {weekDayNames[firstDayOfWeek] || 'Sunday'}
                  </p>
                </div>
              </div>
              {upcomingBirthdays.length === 0 ? (
                <div className="bg-well border border-border rounded-xl p-5 text-center text-xs text-muted">
                  No birthdays in the upcoming {birthdayWindowDays} days. Add birthdays when
                  creating or viewing a contact.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {upcomingBirthdays.map(({ contact: c, daysUntil, turningAge, formattedDate }) => (
                    <div
                      key={c.id}
                      className="bg-well hover:bg-card-hover border border-border rounded-xl p-3.5 flex items-center justify-between gap-3 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out"
                    >
                      <div
                        onClick={() => handleOpenContact(c)}
                        className="flex items-center gap-3 cursor-pointer"
                      >
                        <ProgressRingAvatar
                          name={c.fullName}
                          progressPercent={c.cadence.progressPercent}
                          status={c.cadence.status}
                          size="sm"
                        />
                        <div>
                          <div className="text-sm font-semibold hover:text-primary flex items-center gap-1.5 transition-colors">
                            <span>{c.fullName}</span>
                            {turningAge !== null && turningAge > 0 && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-warning/15 border border-warning/30 text-warning font-medium">
                                Turns {turningAge}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted">
                            {formattedDate} ·{' '}
                            {daysUntil === 0 ? (
                              <span className="text-success font-semibold">Today!</span>
                            ) : daysUntil === 1 ? (
                              <span className="text-primary font-medium">Tomorrow</span>
                            ) : (
                              `In ${daysUntil} days`
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        <button
                          type="button"
                          onClick={() => handleQuickLog(c.id, 'call', 'Birthday call')}
                          className="px-3 py-1.5 rounded-lg bg-primary text-primary-fg font-semibold flex items-center gap-1 shadow-xs hover:opacity-95 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Phone className="w-3 h-3" aria-hidden="true" /> Call
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickLog(c.id, 'message', 'Birthday wish')}
                          className="px-2.5 py-1.5 rounded-lg bg-background border border-border font-medium flex items-center gap-1 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <MessageSquare className="w-3 h-3" aria-hidden="true" /> Wish
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* People to Call in Upcoming Week */}
          {dashboardWidgets.upcomingCalls !== false && (
            <section className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Phone className="w-4 h-4 text-primary" aria-hidden="true" />
                    <span>Upcoming Calls (Next 7d)</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                      {upcomingWeekContacts.length}
                    </span>
                  </h2>
                  <p className="text-xs text-muted mt-0.5">
                    Scheduled check-ins coming due this week
                  </p>
                </div>
              </div>
              {upcomingWeekContacts.length === 0 ? (
                <div className="bg-well border border-border rounded-xl p-5 text-center text-xs text-muted">
                  No additional contacts coming due in the next 7 days.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {upcomingWeekContacts.map((c) => (
                    <div
                      key={c.id}
                      className="bg-well hover:bg-card-hover border border-border rounded-xl p-3.5 flex items-center justify-between gap-3 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out"
                    >
                      <div
                        onClick={() => handleOpenContact(c)}
                        className="flex items-center gap-3 cursor-pointer"
                      >
                        <ProgressRingAvatar
                          name={c.fullName}
                          progressPercent={c.cadence.progressPercent}
                          status={c.cadence.status}
                          size="sm"
                        />
                        <div>
                          <div className="text-sm font-semibold hover:text-primary transition-colors">
                            {c.fullName}
                          </div>
                          <div className="text-xs text-muted">
                            {c.cadence.daysUntilDue <= 0
                              ? 'Deferred to tomorrow (Smart Spreading)'
                              : c.cadence.daysUntilDue === 1
                              ? `Tomorrow (${c.cadence.nextDueDate})`
                              : `In ${c.cadence.daysUntilDue} days (${c.cadence.nextDueDate})`}{' '}
                            ·{' '}
                            {c.groups.map((g) => g.name).join(', ') ||
                              `Every ${c.cadence.effectiveIntervalDays}d`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        <button
                          type="button"
                          onClick={() => handleQuickLog(c.id, 'call')}
                          className="px-3 py-1.5 rounded-lg bg-primary text-primary-fg font-semibold flex items-center gap-1 shadow-xs hover:opacity-95 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Phone className="w-3 h-3" aria-hidden="true" /> Call
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickLog(c.id, 'message')}
                          className="px-2.5 py-1.5 rounded-lg bg-background border border-border font-medium flex items-center gap-1 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <MessageSquare className="w-3 h-3" aria-hidden="true" /> Message
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* Section 3: People Talked to in the Last 30 Days */}
      {dashboardWidgets.recentTalked !== false && (
        <section className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-success" aria-hidden="true" />
                <span>Talked to in the Last 30 Days</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-success/15 text-success">
                  {recent30DaysContacts.length}
                </span>
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Recent touchpoints logged across your network
              </p>
            </div>
            <span className="text-xs text-muted">Most recent first</span>
          </div>
          {recent30DaysContacts.length === 0 ? (
            <div className="bg-well border border-border rounded-xl p-5 text-center text-xs text-muted">
              No logged touchpoints in the last 30 days yet. Click &quot;Call&quot;,
              &quot;Message&quot;, or &quot;In Person&quot; on any contact to log an interaction.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {recent30DaysContacts.map((c) => {
                const methodLabel =
                  c.lastTouchpoint?.method === 'call'
                    ? 'Call'
                    : c.lastTouchpoint?.method === 'message'
                    ? 'Message'
                    : c.lastTouchpoint?.method === 'in_person'
                    ? 'In Person'
                    : 'Connected';
                const whenLabel =
                  c.cadence.daysSinceContact === 0
                    ? 'Today'
                    : c.cadence.daysSinceContact === 1
                    ? 'Yesterday'
                    : `${c.cadence.daysSinceContact}d ago`;
                return (
                  <div
                    key={c.id}
                    onClick={() => handleOpenContact(c)}
                    className="bg-well hover:bg-card-hover border border-border rounded-xl p-3.5 flex items-center justify-between gap-3 cursor-pointer motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ProgressRingAvatar
                        name={c.fullName}
                        progressPercent={c.cadence.progressPercent}
                        status={c.cadence.status}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{c.fullName}</div>
                        <div className="text-xs text-muted truncate">
                          {c.lastTouchpoint?.note
                            ? `"${c.lastTouchpoint.note}"`
                            : `Next due: ${c.cadence.nextDueDate}`}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-success/15 border border-success/30 text-success font-semibold">
                        {methodLabel}
                      </span>
                      <div className="text-xs text-muted mt-1">{whenLabel}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Section 4: Scheduled Later (Beyond 7 Days) */}
      {dashboardWidgets.scheduledLater !== false && onTrackContacts.length > 0 && (
        <section className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <span>On Track · Scheduled Later</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                {onTrackContacts.length}
              </span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {onTrackContacts.map((c) => (
              <div
                key={c.id}
                onClick={() => handleOpenContact(c)}
                className="bg-well hover:bg-card-hover border border-border rounded-xl p-3.5 flex items-center justify-between cursor-pointer motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out"
              >
                <div className="flex items-center gap-3">
                  <ProgressRingAvatar
                    name={c.fullName}
                    progressPercent={c.cadence.progressPercent}
                    status={c.cadence.status}
                    size="sm"
                  />
                  <div>
                    <div className="text-sm font-semibold">{c.fullName}</div>
                    <div className="text-xs text-muted">Next due: {c.cadence.nextDueDate}</div>
                  </div>
                </div>
                <span className="text-xs text-muted">
                  {c.cadence.daysSinceContact}d / {c.cadence.effectiveIntervalDays}d
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
