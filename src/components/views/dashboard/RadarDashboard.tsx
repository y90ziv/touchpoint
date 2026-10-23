'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Phone,
  MessageCircle,
  CheckCircle2,
  Clock,
  Calendar,
  Users,
  Activity,
  Plus,
  GripVertical,
  X,
  SlidersHorizontal,
  RotateCcw,
  Cake,
  Undo2,
  LayoutGrid,
  Columns2,
  Maximize2,
  Target,
  FileText,
  Flame,
} from 'lucide-react';
import { ContactItem, NavigationTab } from '@/types/touchpoint';
import { ProgressRingAvatar } from '@/components/ProgressRingAvatar';
import { cleanPhoneForDial } from '@/lib/formatters';
import { useTouchpoints } from '@/context/TouchpointsContext';
import { useContacts } from '@/context/ContactsContext';
import { useUI } from '@/context/UIContext';
import CalendarHeatmap from 'react-calendar-heatmap';

export type RadarWidgetId =
  | 'actionDispatch'
  | 'activityHeatmap'
  | 'upcomingWeek'
  | 'cadenceHealth'
  | 'weeklyPace'
  | 'recentActivity'
  | 'upcomingBirthdays'
  | 'quickNotes';

interface WidgetDef {
  id: RadarWidgetId;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  defaultWidth: 'half' | 'full';
}

const ALL_WIDGETS: WidgetDef[] = [
  {
    id: 'actionDispatch',
    title: "Today's action dispatch",
    subtitle: 'High-velocity 1-click outreach for overdue and due today contacts',
    icon: Activity,
    defaultWidth: 'full',
  },
  {
    id: 'activityHeatmap',
    title: 'Activity velocity heatmap',
    subtitle: 'Daily touchpoint intensity and outreach streaks across 16 weeks',
    icon: Flame,
    defaultWidth: 'full',
  },
  {
    id: 'upcomingWeek',
    title: 'Coming up this week',
    subtitle: 'Cadence touchpoints due over the next 7 days',
    icon: Calendar,
    defaultWidth: 'half',
  },
  {
    id: 'cadenceHealth',
    title: 'Cadence rhythm & health',
    subtitle: 'Overall relationship pulse and cadence distribution metrics',
    icon: Users,
    defaultWidth: 'half',
  },
  {
    id: 'weeklyPace',
    title: 'Weekly cadence pace & goal',
    subtitle: 'Track your weekly relationship goal and stay in steady rhythm',
    icon: Target,
    defaultWidth: 'half',
  },
  {
    id: 'recentActivity',
    title: 'Recent touchpoint activity',
    subtitle: 'Stream of calls, chats, and catchups logged across your network',
    icon: Clock,
    defaultWidth: 'half',
  },
  {
    id: 'upcomingBirthdays',
    title: 'Upcoming birthdays & milestones',
    subtitle: 'Upcoming member celebrations occurring in the next 14 days',
    icon: Cake,
    defaultWidth: 'half',
  },
  {
    id: 'quickNotes',
    title: 'Catchup scratchpad & notes',
    subtitle: 'Quick thoughts, follow-up reminders, and conversation topics',
    icon: FileText,
    defaultWidth: 'half',
  },
];

const DEFAULT_WIDGET_ORDER: RadarWidgetId[] = [
  'actionDispatch',
  'activityHeatmap',
  'upcomingWeek',
  'cadenceHealth',
  'weeklyPace',
  'recentActivity',
  'upcomingBirthdays',
  'quickNotes',
];

const DEFAULT_WIDGET_WIDTHS: Record<RadarWidgetId, 'half' | 'full'> = {
  actionDispatch: 'full',
  activityHeatmap: 'full',
  upcomingWeek: 'half',
  cadenceHealth: 'half',
  weeklyPace: 'half',
  recentActivity: 'half',
  upcomingBirthdays: 'half',
  quickNotes: 'half',
};

export interface RadarDashboardProps {
  contacts: ContactItem[];
  attentionContacts: ContactItem[];
  upcomingWeekContacts: ContactItem[];
  onTrackContacts: ContactItem[];
  recent30DaysContacts?: ContactItem[];
  health: { scorePercent: number; onTrackCount: number; totalTrackedCount: number; overdueCount: number };
  onOpenContact: (contact: ContactItem) => void;
  onOpenNewContact: () => void;
  onNavigateToTab: (tab: NavigationTab) => void;
}

export function RadarDashboard({
  contacts,
  attentionContacts,
  upcomingWeekContacts,
  onTrackContacts,
  recent30DaysContacts = [],
  health,
  onOpenContact,
  onOpenNewContact,
  onNavigateToTab,
}: RadarDashboardProps) {
  const touchpointsCtx = useTouchpoints();
  const contactsCtx = useContacts();
  const ui = useUI();

  // Active Widgets Order, Visibility & Width State
  const [activeWidgets, setActiveWidgets] = useState<RadarWidgetId[]>(DEFAULT_WIDGET_ORDER);
  const [widgetWidths, setWidgetWidths] = useState<Record<RadarWidgetId, 'half' | 'full'>>(DEFAULT_WIDGET_WIDTHS);
  const [draggedId, setDraggedId] = useState<RadarWidgetId | null>(null);
  const [dragOverId, setDragOverId] = useState<RadarWidgetId | null>(null);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [lastRemovedWidget, setLastRemovedWidget] = useState<{ id: RadarWidgetId; title: string; index: number } | null>(null);
  const [scratchpadNote, setScratchpadNote] = useState<string>('');

  // Load persisted widget order and widths from localStorage on client mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedOrder = localStorage.getItem('touchpoint_radar_widgets_v4');
        if (storedOrder) {
          const parsed = JSON.parse(storedOrder);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const valid = parsed.filter((id): id is RadarWidgetId =>
              ALL_WIDGETS.some((w) => w.id === id)
            );
            if (valid.length > 0) {
              setActiveWidgets(valid);
            }
          }
        }

        const storedWidths = localStorage.getItem('touchpoint_radar_widget_widths_v4');
        if (storedWidths) {
          const parsedWidths = JSON.parse(storedWidths);
          if (typeof parsedWidths === 'object' && parsedWidths !== null) {
            setWidgetWidths((prev) => ({ ...prev, ...parsedWidths }));
          }
        }

        const storedNote = localStorage.getItem('touchpoint_dashboard_scratchpad');
        if (storedNote) {
          setScratchpadNote(storedNote);
        }
      } catch {}
    }
  }, []);

  const saveWidgets = useCallback((newWidgets: RadarWidgetId[]) => {
    setActiveWidgets(newWidgets);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('touchpoint_radar_widgets_v4', JSON.stringify(newWidgets));
      } catch {}
    }
  }, []);

  const saveWidths = useCallback((newWidths: Record<RadarWidgetId, 'half' | 'full'>) => {
    setWidgetWidths(newWidths);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('touchpoint_radar_widget_widths_v4', JSON.stringify(newWidths));
      } catch {}
    }
  }, []);

  // Toggle Widget Width between Half and Full
  const toggleWidgetWidth = (widgetId: RadarWidgetId) => {
    const current = widgetWidths[widgetId] || 'half';
    const next = current === 'full' ? 'half' : 'full';
    const updated = { ...widgetWidths, [widgetId]: next };
    saveWidths(updated);
    const def = ALL_WIDGETS.find((w) => w.id === widgetId);
    ui.notify(`${def?.title || 'Widget'} width set to ${next === 'full' ? '100% full width' : '50% half width'}.`);
  };

  // Widget Removal Handler
  const handleRemoveWidget = (widgetId: RadarWidgetId) => {
    const index = activeWidgets.indexOf(widgetId);
    const def = ALL_WIDGETS.find((w) => w.id === widgetId);
    const next = activeWidgets.filter((id) => id !== widgetId);
    saveWidgets(next);
    if (def) {
      setLastRemovedWidget({ id: widgetId, title: def.title, index });
      ui.notify(`Removed "${def.title}". Click Customize to restore.`);
    }
  };

  // Restore Single Widget
  const handleRestoreWidget = (widgetId: RadarWidgetId) => {
    if (activeWidgets.includes(widgetId)) return;
    const next = [...activeWidgets, widgetId];
    saveWidgets(next);
    setLastRemovedWidget(null);
    const def = ALL_WIDGETS.find((w) => w.id === widgetId);
    if (def) {
      ui.notify(`Restored "${def.title}" to dashboard.`);
    }
  };

  // Undo Last Removal
  const handleUndoRemove = () => {
    if (!lastRemovedWidget) return;
    const { id, index } = lastRemovedWidget;
    const next = [...activeWidgets];
    next.splice(Math.min(index, next.length), 0, id);
    saveWidgets(next);
    setLastRemovedWidget(null);
    ui.notify(`Restored widget.`);
  };

  // Reset to Default Order & Widths
  const handleResetLayout = () => {
    saveWidgets(DEFAULT_WIDGET_ORDER);
    saveWidths(DEFAULT_WIDGET_WIDTHS);
    setLastRemovedWidget(null);
    ui.notify('Reset dashboard to default widget arrangement and widths.');
  };

  // Scratchpad handler
  const handleScratchpadChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setScratchpadNote(val);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('touchpoint_dashboard_scratchpad', val);
      } catch {}
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, id: RadarWidgetId) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: RadarWidgetId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverId !== id) {
      setDragOverId(id);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: RadarWidgetId) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const current = [...activeWidgets];
    const fromIndex = current.indexOf(draggedId);
    const toIndex = current.indexOf(targetId);

    if (fromIndex !== -1 && toIndex !== -1) {
      current.splice(fromIndex, 1);
      current.splice(toIndex, 0, draggedId);
      saveWidgets(current);
      ui.notify('Dashboard widgets reordered.');
    }

    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  // Quick Action Handlers
  const handleQuickLog = async (contact: ContactItem, method: string) => {
    const success = await touchpointsCtx.logTouchpoint(
      contact.id,
      method,
      `Quick catchup via ${method}`,
      new Date().toISOString()
    );
    if (success) {
      ui.notify(`Logged ${method} with ${contact.fullName}. Cadence reset.`);
      await contactsCtx.loadContacts();
    }
  };

  const handleSnooze = async (contact: ContactItem, days: number) => {
    const success = await contactsCtx.snoozeContact(contact.id, days);
    if (success) {
      ui.notify(`Snoozed ${contact.fullName} for ${days} days.`);
      await contactsCtx.loadContacts();
    }
  };

  // Computations
  const contactedThisWeek = useMemo(() => {
    return contacts.filter(
      (c) => Boolean(c.lastContactedAt) && c.cadence.daysSinceContact >= 0 && c.cadence.daysSinceContact <= 7
    ).length;
  }, [contacts]);

  const weeklyPaceGoal = Math.max(5, (Number(ui.settingsState.maxDailyDue) || 3) * 3);
  const weeklyPacePercent = Math.min(100, Math.round((contactedThisWeek / weeklyPaceGoal) * 100));

  // Heatmap Data (~32 weeks continuous landscape for GitHub/Linear density)
  const heatmapData = useMemo(() => {
    const totalWeeks = 32;
    const daysToShow = totalWeeks * 7;
    const activityCounts: Record<string, number> = {};

    contacts.forEach((c) => {
      if (c.lastContactedAt) {
        const d = c.lastContactedAt.split('T')[0];
        activityCounts[d] = (activityCounts[d] || 0) + 1;
      }
    });

    const now = new Date();
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - (daysToShow - 1));

    const values: Array<{ date: string; count: number }> = [];
    const daysList: Array<{ date: string; count: number }> = [];

    for (let i = daysToShow - 1; i >= 0; i--) {
      const d = new Date(endDate);
      d.setDate(endDate.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const count = activityCounts[dateStr] || 0;
      values.push({ date: dateStr, count });
      daysList.push({ date: dateStr, count });
    }

    const totalLogged = Object.values(activityCounts).reduce((a, b) => a + b, 0);
    const activeDaysCount = daysList.filter((d) => d.count > 0).length;

    let currentStreak = 0;
    for (let i = daysList.length - 1; i >= 0; i--) {
      if (daysList[i].count > 0) {
        currentStreak++;
      } else {
        break;
      }
    }

    let maxStreak = 0;
    let temp = 0;
    for (const day of daysList) {
      if (day.count > 0) {
        temp++;
        if (temp > maxStreak) maxStreak = temp;
      } else {
        temp = 0;
      }
    }

    return { startDate, endDate, values, totalLogged, activeDaysCount, currentStreak, maxStreak };
  }, [contacts]);

  const upcomingBirthdays = useMemo(() => {
    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return contacts
      .map((c) => {
        if (!c.birthday) return null;
        const parts = c.birthday.trim().split('-').map(Number);
        if (parts.length < 2 || parts.some(Number.isNaN)) return null;
        const hasYear = parts.length === 3 && parts[0] > 1900;
        const month = hasYear ? parts[1] : parts[0];
        const day = hasYear ? parts[2] : parts[1];
        if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) return null;

        let nextBday = new Date(todayMidnight.getFullYear(), month - 1, day);
        if (nextBday < todayMidnight) {
          nextBday = new Date(todayMidnight.getFullYear() + 1, month - 1, day);
        }
        const daysUntil = Math.round((nextBday.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntil < 0 || daysUntil > 14) return null;
        return { contact: c, daysUntil, dateFormatted: `${month}/${day}` };
      })
      .filter((b): b is NonNullable<typeof b> => Boolean(b))
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [contacts]);

  // Widget Content Renderers
  const renderActionDispatch = (isFull: boolean) => (
    <div className="space-y-3.5">
      {attentionContacts.length > 0 ? (
        <div
          className={`grid gap-3.5 ${
            isFull
              ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
              : 'grid-cols-1 sm:grid-cols-2'
          }`}
        >
          {attentionContacts.map((c) => {
            const isOverdue = c.cadence.daysUntilDue < 0;
            const dialPhone = cleanPhoneForDial(c.phone);
            return (
              <div
                key={c.id}
                className="group relative p-3.5 rounded-xl bg-card border border-border hover:border-primary/50 motion-safe:transition-colors motion-safe:duration-160 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div
                      onClick={() => onOpenContact(c)}
                      className="flex items-center gap-2.5 cursor-pointer min-w-0"
                    >
                      <ProgressRingAvatar
                        name={c.fullName}
                        progressPercent={c.cadence.progressPercent}
                        status={c.cadence.status}
                        size="md"
                      />
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-foreground truncate group-hover:text-primary motion-safe:transition-colors motion-safe:duration-160">
                          {c.fullName}
                        </h4>
                        <p className="text-xs text-muted truncate">
                          {c.company || c.jobTitle ? `${c.jobTitle || ''}${c.jobTitle && c.company ? ' · ' : ''}${c.company || ''}` : 'Local contact'}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-md tabular-nums shrink-0 ${
                        isOverdue ? 'bg-overdue text-white' : 'bg-warning/20 text-warning'
                      }`}
                    >
                      {isOverdue ? `-${Math.abs(c.cadence.daysUntilDue)}d overdue` : 'Due today'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-well text-xs space-y-1">
                    <div className="flex items-center justify-between text-muted">
                      <span>Last contacted:</span>
                      <span className="font-medium text-foreground">
                        {c.lastContactedAt ? `${c.cadence.daysSinceContact}d ago (${c.lastTouchpoint?.method || 'touchpoint'})` : 'Never'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-muted">
                      <span>Cadence rule:</span>
                      <span className="font-medium text-foreground">Every {c.cadence.effectiveIntervalDays} days</span>
                    </div>
                  </div>
                </div>

                {/* 1-Click Action Buttons */}
                <div className="pt-3 border-t border-border mt-3 flex items-center gap-1.5">
                  {c.phone && (
                    <a
                      href={`https://wa.me/${dialPhone.replace('+', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-600/10 text-emerald-600 hover:bg-emerald-600 hover:text-white text-xs font-semibold flex items-center justify-center gap-1 motion-safe:transition-colors motion-safe:duration-160 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                      title="Chat on WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" /> WhatsApp
                    </a>
                  )}
                  {c.phone && (
                    <a
                      href={`tel:${dialPhone}`}
                      className="py-1.5 px-2 rounded-lg bg-well text-foreground hover:bg-card-hover text-xs font-semibold flex items-center justify-center gap-1 motion-safe:transition-colors motion-safe:duration-160 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                      title="Dial phone"
                    >
                      <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => handleQuickLog(c, 'call')}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-primary-fg text-xs font-semibold flex items-center justify-center gap-1 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Mark as contacted today"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Logged
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSnooze(c, 3)}
                    className="py-1.5 px-2 rounded-lg bg-well text-muted hover:text-foreground text-xs font-semibold flex items-center justify-center gap-1 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Snooze 3 days"
                  >
                    <Clock className="w-3.5 h-3.5" aria-hidden="true" /> 3d
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 rounded-xl bg-card border border-border text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
          </div>
          <h3 className="font-bold text-foreground">Zero pending catchups today</h3>
          <p className="text-xs text-muted max-w-sm mx-auto">
            All tracked contacts are in healthy rhythm. Enjoy your day or reconnect with someone in your network.
          </p>
        </div>
      )}
    </div>
  );

  const renderActivityHeatmap = () => {
    return (
      <div className="space-y-3.5">
        {/* Heatmap Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div className="p-2.5 rounded-lg bg-well border border-border">
            <div className="text-muted text-[11px]">Recent touchpoints</div>
            <div className="font-bold text-foreground text-sm tabular-nums mt-0.5">
              {heatmapData.totalLogged} logged
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-well border border-border">
            <div className="text-muted text-[11px]">Active outreach days</div>
            <div className="font-bold text-foreground text-sm tabular-nums mt-0.5">
              {heatmapData.activeDaysCount} days
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-well border border-border">
            <div className="text-muted text-[11px]">Current streak</div>
            <div className="font-bold text-foreground text-sm tabular-nums mt-0.5 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-warning" aria-hidden="true" />
              {heatmapData.currentStreak} day{heatmapData.currentStreak === 1 ? '' : 's'}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-well border border-border">
            <div className="text-muted text-[11px]">Longest rhythm</div>
            <div className="font-bold text-foreground text-sm tabular-nums mt-0.5">
              {heatmapData.maxStreak} day{heatmapData.maxStreak === 1 ? '' : 's'}
            </div>
          </div>
        </div>

        {/* Heatmap Calendar Matrix using react-calendar-heatmap */}
        <div className="p-3.5 rounded-xl bg-well/60 border border-border space-y-2">
          <div className="touchpoint-heatmap overflow-x-auto py-1">
            <div className="min-w-[620px]">
              <CalendarHeatmap
                startDate={heatmapData.startDate}
                endDate={heatmapData.endDate}
                values={heatmapData.values}
                gutterSize={2.5}
                showWeekdayLabels
                classForValue={(value) => {
                  if (!value || value.count === 0) return 'color-empty';
                  if (value.count === 1) return 'color-scale-1';
                  if (value.count === 2) return 'color-scale-2';
                  if (value.count === 3) return 'color-scale-3';
                  return 'color-scale-4';
                }}
                titleForValue={(value) => {
                  if (!value || !value.date) return 'No touchpoints';
                  return `${value.date}: ${value.count || 0} touchpoint${value.count === 1 ? '' : 's'}`;
                }}
              />
            </div>
          </div>

          {/* Legend Row */}
          <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted">
            <span>Cadence activity intensity timeline</span>
            <div className="flex items-center gap-1.5">
              <span>Less</span>
              <div className="w-2.5 h-2.5 rounded-xs bg-well border border-border/40 opacity-70" />
              <div className="w-2.5 h-2.5 rounded-xs bg-success/35 border border-success/40" />
              <div className="w-2.5 h-2.5 rounded-xs bg-success/60 border border-success/60" />
              <div className="w-2.5 h-2.5 rounded-xs bg-success/85 border border-success/85" />
              <div className="w-2.5 h-2.5 rounded-xs bg-success border border-success shadow-xs" />
              <span>More</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderUpcomingWeek = (isFull: boolean) => (
    <div className={`space-y-2.5 ${isFull ? 'grid grid-cols-1 sm:grid-cols-2 gap-2.5 space-y-0' : ''}`}>
      {upcomingWeekContacts.slice(0, isFull ? 8 : 4).map((c) => (
        <div
          key={c.id}
          onClick={() => onOpenContact(c)}
          className="flex items-center justify-between p-2.5 rounded-lg bg-well hover:bg-card-hover cursor-pointer motion-safe:transition-colors motion-safe:duration-160"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <ProgressRingAvatar
              name={c.fullName}
              progressPercent={c.cadence.progressPercent}
              status={c.cadence.status}
              size="sm"
            />
            <div className="min-w-0">
              <div className="truncate text-xs font-bold text-foreground">{c.fullName}</div>
              <div className="text-[11px] text-muted truncate">
                {c.company || c.jobTitle || 'Cadence contact'}
              </div>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-muted shrink-0 tabular-nums px-2 py-0.5 rounded-full bg-background border border-border">
            in {c.cadence.daysUntilDue}d
          </span>
        </div>
      ))}
      {upcomingWeekContacts.length === 0 && (
        <p className="text-xs text-muted py-6 text-center col-span-full">No touchpoints due this week.</p>
      )}
    </div>
  );

  const renderCadenceHealth = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">Relationship rhythm score</span>
        <span className="text-sm font-bold text-foreground tabular-nums">{health.scorePercent}%</span>
      </div>

      <div className="w-full bg-well h-2.5 rounded-full overflow-hidden border border-border">
        <div
          className="bg-primary h-full rounded-full motion-safe:transition-colors motion-safe:duration-160"
          style={{ width: `${health.scorePercent}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5 pt-1 text-xs">
        <div className="p-2.5 rounded-lg bg-well border border-border">
          <div className="text-muted text-[11px]">In cadence rhythm</div>
          <div className="font-bold text-foreground text-sm tabular-nums mt-0.5">{onTrackContacts.length}</div>
        </div>
        <div className="p-2.5 rounded-lg bg-well border border-border">
          <div className="text-muted text-[11px]">Total tracked</div>
          <div className="font-bold text-foreground text-sm tabular-nums mt-0.5">
            {contacts.filter((c) => c.keepInTouch).length}
          </div>
        </div>
      </div>
    </div>
  );

  const renderWeeklyPace = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">Weekly catchup goal</span>
        <span className="text-xs font-bold text-foreground tabular-nums">
          {contactedThisWeek} / {weeklyPaceGoal} touchpoints
        </span>
      </div>

      <div className="w-full bg-well h-2.5 rounded-full overflow-hidden border border-border">
        <div
          className="bg-emerald-500 h-full rounded-full motion-safe:transition-colors motion-safe:duration-160"
          style={{ width: `${weeklyPacePercent}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5 pt-1 text-xs">
        <div className="p-2.5 rounded-lg bg-well border border-border">
          <div className="text-muted text-[11px]">Pace momentum</div>
          <div className="font-bold text-foreground text-sm mt-0.5 flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${weeklyPacePercent >= 50 ? 'bg-emerald-500' : 'bg-warning'}`} />
            {weeklyPacePercent >= 100 ? 'Goal reached' : `${weeklyPacePercent}% on pace`}
          </div>
        </div>
        <div className="p-2.5 rounded-lg bg-well border border-border">
          <div className="text-muted text-[11px]">Needed this week</div>
          <div className="font-bold text-foreground text-sm tabular-nums mt-0.5">
            {Math.max(0, weeklyPaceGoal - contactedThisWeek)} contacts
          </div>
        </div>
      </div>
    </div>
  );

  const renderRecentActivity = (isFull: boolean) => (
    <div className={`space-y-2.5 ${isFull ? 'grid grid-cols-1 sm:grid-cols-2 gap-2.5 space-y-0' : ''}`}>
      {recent30DaysContacts.slice(0, isFull ? 8 : 4).map((c) => (
        <div
          key={c.id}
          onClick={() => onOpenContact(c)}
          className="flex items-center justify-between p-2.5 rounded-lg bg-well hover:bg-card-hover cursor-pointer motion-safe:transition-colors motion-safe:duration-160"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-card border border-border flex items-center justify-center text-primary font-bold text-[11px] shrink-0">
              {c.fullName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-bold text-foreground">{c.fullName}</div>
              <div className="text-[11px] text-muted truncate">
                {c.lastTouchpoint?.method ? `via ${c.lastTouchpoint.method}` : 'Catchup recorded'}
              </div>
            </div>
          </div>
          <span className="text-[11px] font-medium text-muted shrink-0 tabular-nums">
            {c.cadence.daysSinceContact}d ago
          </span>
        </div>
      ))}
      {recent30DaysContacts.length === 0 && (
        <p className="text-xs text-muted py-6 text-center col-span-full">No touchpoints logged in the last 30 days.</p>
      )}
    </div>
  );

  const renderUpcomingBirthdays = (isFull: boolean) => (
    <div className={`space-y-2.5 ${isFull ? 'grid grid-cols-1 sm:grid-cols-2 gap-2.5 space-y-0' : ''}`}>
      {upcomingBirthdays.slice(0, isFull ? 8 : 4).map(({ contact: c, daysUntil }) => (
        <div
          key={c.id}
          onClick={() => onOpenContact(c)}
          className="flex items-center justify-between p-2.5 rounded-lg bg-well hover:bg-card-hover cursor-pointer motion-safe:transition-colors motion-safe:duration-160"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-warning/15 text-warning border border-warning/30 flex items-center justify-center shrink-0">
              <Cake className="w-3.5 h-3.5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-bold text-foreground">{c.fullName}</div>
              <div className="text-[11px] text-muted truncate">
                {c.birthday}
              </div>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-warning shrink-0 tabular-nums px-2 py-0.5 rounded-full bg-warning/10">
            {daysUntil === 0 ? 'Today!' : `in ${daysUntil}d`}
          </span>
        </div>
      ))}
      {upcomingBirthdays.length === 0 && (
        <p className="text-xs text-muted py-6 text-center col-span-full">No upcoming birthdays in the next 14 days.</p>
      )}
    </div>
  );

  const renderQuickNotes = () => (
    <div className="space-y-2">
      <textarea
        value={scratchpadNote}
        onChange={handleScratchpadChange}
        placeholder="Type quick thoughts, conversation points, or follow-up notes here… (Auto-saved)"
        rows={4}
        className="w-full p-2.5 rounded-lg bg-well border border-border text-foreground text-xs placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary resize-none leading-relaxed"
      />
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span>Auto-saved to local workspace</span>
        {scratchpadNote && (
          <button
            type="button"
            onClick={() => {
              setScratchpadNote('');
              if (typeof window !== 'undefined') {
                localStorage.removeItem('touchpoint_dashboard_scratchpad');
              }
            }}
            className="text-muted hover:text-foreground text-[11px] underline motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear notes
          </button>
        )}
      </div>
    </div>
  );

  // Map of widget ID to content
  const renderWidgetContent = (id: RadarWidgetId, isFull: boolean) => {
    switch (id) {
      case 'actionDispatch':
        return renderActionDispatch(isFull);
      case 'activityHeatmap':
        return renderActivityHeatmap();
      case 'upcomingWeek':
        return renderUpcomingWeek(isFull);
      case 'cadenceHealth':
        return renderCadenceHealth();
      case 'weeklyPace':
        return renderWeeklyPace();
      case 'recentActivity':
        return renderRecentActivity(isFull);
      case 'upcomingBirthdays':
        return renderUpcomingBirthdays(isFull);
      case 'quickNotes':
        return renderQuickNotes();
      default:
        return null;
    }
  };

  // Helper for widget badges
  const getWidgetBadge = (id: RadarWidgetId) => {
    switch (id) {
      case 'actionDispatch':
        return attentionContacts.length > 0 ? (
          <span className="text-xs px-2 py-0.5 rounded-md bg-overdue text-white font-semibold tabular-nums">
            {attentionContacts.length}
          </span>
        ) : null;
      case 'activityHeatmap':
        return (
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 font-semibold tabular-nums">
            {heatmapData.totalLogged}
          </span>
        );
      case 'upcomingWeek':
        return (
          <span className="text-xs px-2 py-0.5 rounded-full bg-well text-foreground font-semibold tabular-nums border border-border">
            {upcomingWeekContacts.length}
          </span>
        );
      case 'cadenceHealth':
        return (
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold tabular-nums">
            {health.scorePercent}%
          </span>
        );
      case 'weeklyPace':
        return (
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-semibold tabular-nums">
            {contactedThisWeek}/{weeklyPaceGoal}
          </span>
        );
      case 'upcomingBirthdays':
        return upcomingBirthdays.length > 0 ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-warning/15 text-warning font-semibold tabular-nums">
            {upcomingBirthdays.length}
          </span>
        ) : null;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Header Pulse Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
            <Activity className="w-5 h-5 text-primary" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-foreground tracking-tight">Executive dashboard</h1>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Live pulse
              </span>
            </div>
            <p className="text-xs text-muted">
              {attentionContacts.length > 0
                ? `${attentionContacts.length} relationship${attentionContacts.length === 1 ? '' : 's'} require outreach today`
                : 'All relationships are currently in rhythm'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenNewContact}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-fg text-xs font-semibold hover:opacity-95 flex items-center gap-1.5 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" /> New contact
          </button>
          <button
            type="button"
            onClick={() => setShowCustomizer(true)}
            className="px-3 py-1.5 rounded-lg border border-border bg-well text-xs font-medium hover:bg-card-hover text-foreground flex items-center gap-1.5 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Configure and restore dashboard widgets"
            aria-label="Customize dashboard widgets"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
            Widgets ({activeWidgets.length}/{ALL_WIDGETS.length})
          </button>
          <button
            type="button"
            onClick={() => onNavigateToTab('contacts')}
            className="px-3 py-1.5 rounded-lg border border-border bg-well text-xs font-medium hover:bg-card-hover text-foreground motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Directory ({contacts.length})
          </button>
        </div>
      </div>

      {/* Undo Notification Banner (if recent removal) */}
      {lastRemovedWidget && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-well border border-border text-xs">
          <div className="flex items-center gap-2 text-muted">
            <X className="w-4 h-4 text-overdue shrink-0" aria-hidden="true" />
            <span>Removed &quot;{lastRemovedWidget.title}&quot; from dashboard.</span>
          </div>
          <button
            type="button"
            onClick={handleUndoRemove}
            className="px-2.5 py-1 rounded-lg bg-primary text-primary-fg font-semibold hover:opacity-90 flex items-center gap-1 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Undo2 className="w-3 h-3" aria-hidden="true" /> Undo
          </button>
        </div>
      )}

      {/* 2. Responsive 2-Column Draggable & Width-Adjustable Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {activeWidgets.map((widgetId, index) => {
          const def = ALL_WIDGETS.find((w) => w.id === widgetId);
          if (!def) return null;
          const Icon = def.icon;
          const isDragging = draggedId === widgetId;
          const isDragOver = dragOverId === widgetId;
          const isFull = (widgetWidths[widgetId] || def.defaultWidth) === 'full';

          return (
            <section
              key={widgetId}
              draggable
              onDragStart={(e) => handleDragStart(e, widgetId)}
              onDragOver={(e) => handleDragOver(e, widgetId)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, widgetId)}
              onDragEnd={handleDragEnd}
              className={`p-4 rounded-xl bg-card border border-border motion-safe:transition-colors motion-safe:duration-160 space-y-4 ${
                isFull ? 'col-span-1 md:col-span-2' : 'col-span-1'
              } ${isDragging ? 'opacity-40 border-dashed border-primary scale-[0.99]' : ''} ${
                isDragOver ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
              }`}
              aria-label={def.title}
            >
              {/* Widget Header with Drag Handle, Width Toggle & Close X */}
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Drag Handle */}
                  <div
                    className="cursor-grab active:cursor-grabbing p-1 rounded-md hover:bg-well text-muted hover:text-foreground flex items-center gap-1.5 shrink-0 select-none"
                    title="Drag to reorder widget on dashboard"
                    aria-label="Drag to reorder"
                  >
                    <GripVertical className="w-3.5 h-3.5 text-muted/80" aria-hidden="true" />
                    <span className="text-[11px] font-mono text-muted/70">
                      0{index + 1}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                    <h2 className="text-xs font-bold text-foreground truncate">
                      {def.title}
                    </h2>
                  </div>

                  {getWidgetBadge(widgetId)}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Width Toggle Button (50% vs 100%) */}
                  <button
                    type="button"
                    onClick={() => toggleWidgetWidth(widgetId)}
                    title={isFull ? 'Fit 2 in row (Set to 50% width)' : 'Expand to full width (100%)'}
                    aria-label={isFull ? 'Set to 50% width' : 'Expand to 100% width'}
                    className="p-1 rounded-md text-muted hover:text-foreground hover:bg-well motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isFull ? (
                      <Columns2 className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                    ) : (
                      <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                  </button>

                  {/* Remove Widget Button */}
                  <button
                    type="button"
                    onClick={() => handleRemoveWidget(widgetId)}
                    title={`Remove ${def.title} widget`}
                    aria-label={`Remove ${def.title} widget`}
                    className="p-1 rounded-md text-muted hover:text-overdue hover:bg-well motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Widget Body */}
              <div>{renderWidgetContent(widgetId, isFull)}</div>
            </section>
          );
        })}

        {/* Empty State / Add Widgets Prompt */}
        {activeWidgets.length === 0 ? (
          <div className="col-span-full p-12 rounded-xl bg-card border-2 border-dashed border-border text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-well border border-border flex items-center justify-center mx-auto text-muted">
              <LayoutGrid className="w-6 h-6" aria-hidden="true" />
            </div>
            <h3 className="font-bold text-base text-foreground">All dashboard widgets are hidden</h3>
            <p className="text-xs text-muted max-w-sm mx-auto">
              You removed all widgets from your dashboard. You can bring them back at any time.
            </p>
            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleResetLayout}
                className="px-4 py-2 rounded-lg bg-primary text-primary-fg text-xs font-semibold hover:opacity-90 flex items-center gap-1.5 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Reset to default layout
              </button>
            </div>
          </div>
        ) : (
          activeWidgets.length < ALL_WIDGETS.length && (
            <div className="col-span-full p-4 rounded-xl bg-well/60 border border-dashed border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <span className="text-muted">
                {ALL_WIDGETS.length - activeWidgets.length} widget{ALL_WIDGETS.length - activeWidgets.length === 1 ? ' is' : 's are'} currently hidden.
              </span>
              <button
                type="button"
                onClick={() => setShowCustomizer(true)}
                className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-well text-foreground font-semibold flex items-center gap-1.5 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                <Plus className="w-3.5 h-3.5 text-primary" aria-hidden="true" /> Add hidden widgets
              </button>
            </div>
          )
        )}
      </div>

      {/* 3. Customize Widgets Modal */}
      {showCustomizer && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="customizer-modal-title"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="w-full max-w-lg rounded-2xl bg-card border border-border p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-primary" aria-hidden="true" />
                <h3 id="customizer-modal-title" className="font-bold text-sm text-foreground">
                  Customize dashboard widgets
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomizer(false)}
                title="Close dialog"
                aria-label="Close dialog"
                className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-well motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <p className="text-xs text-muted">
              Toggle widgets on or off below, or adjust their width. You can also drag widgets directly on the dashboard to change their order.
            </p>

            {/* Widget Items List */}
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {ALL_WIDGETS.map((widget) => {
                const Icon = widget.icon;
                const isActive = activeWidgets.includes(widget.id);
                const currentWidth = widgetWidths[widget.id] || widget.defaultWidth;

                return (
                  <div
                    key={widget.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-well border border-border gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center text-primary shrink-0">
                        <Icon className="w-4 h-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-foreground truncate">
                          {widget.title}
                        </div>
                        <div className="text-[11px] text-muted truncate">
                          {widget.subtitle}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Width Badge / Switcher */}
                      {isActive && (
                        <button
                          type="button"
                          onClick={() => toggleWidgetWidth(widget.id)}
                          className="px-2 py-1 rounded-md border border-border bg-card text-[11px] font-semibold text-muted hover:text-foreground motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Toggle between 50% and 100% width"
                          aria-label={`Toggle width for ${widget.title}`}
                        >
                          {currentWidth === 'full' ? '100% row' : '50% half'}
                        </button>
                      )}

                      {/* Add/Remove Button */}
                      {isActive ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveWidget(widget.id)}
                          className="px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-overdue/10 hover:border-overdue hover:text-overdue text-xs font-semibold text-muted flex items-center gap-1 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={`Remove ${widget.title}`}
                          aria-label={`Remove ${widget.title}`}
                        >
                          <X className="w-3 h-3" aria-hidden="true" /> Remove
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRestoreWidget(widget.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-primary text-primary-fg hover:opacity-90 text-xs font-semibold flex items-center gap-1 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={`Add ${widget.title}`}
                          aria-label={`Add ${widget.title}`}
                        >
                          <Plus className="w-3 h-3" aria-hidden="true" /> Add
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-border flex items-center justify-between">
              <button
                type="button"
                onClick={handleResetLayout}
                className="px-3 py-1.5 rounded-lg border border-border bg-well hover:bg-card-hover text-muted hover:text-foreground text-xs font-medium flex items-center gap-1.5 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Reset defaults
              </button>
              <button
                type="button"
                onClick={() => setShowCustomizer(false)}
                className="px-4 py-1.5 rounded-lg bg-primary text-primary-fg hover:opacity-95 text-xs font-semibold motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
