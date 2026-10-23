'use client';

import React from 'react';
import {
  Calendar as CalendarIcon,
  Download,
  ShieldCheck,
  RefreshCw,
  Clock,
  Check,
} from 'lucide-react';
import { ContactItem } from '@/types/touchpoint';
import { useUI } from '@/context/UIContext';
import { useContacts } from '@/context/ContactsContext';
import { ProgressRingAvatar } from '@/components/ProgressRingAvatar';

export interface CalendarScheduleViewProps {
  onOpenContact?: (contact: ContactItem) => void;
}

export function CalendarScheduleView({ onOpenContact }: CalendarScheduleViewProps) {
  const ui = useUI();
  const contactsCtx = useContacts();

  const contacts = contactsCtx.contacts;
  const settingsState = ui.settingsState;
  const setSettingsState = ui.setSettingsState;

  const trackedContactsSortedByDue = contacts
    .filter((c) => c.keepInTouch)
    .sort((a, b) => a.cadence.daysUntilDue - b.cadence.daysUntilDue);

  const handleToggleCalendarPush = async () => {
    const nextVal = !settingsState.googleCalendarPushEnabled;
    setSettingsState((prev) => ({ ...prev, googleCalendarPushEnabled: nextVal }));
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ googleCalendarPushEnabled: nextVal }),
    });
    ui.notify(
      nextVal
        ? 'Outbound Google Calendar Push enabled.'
        : 'Outbound Google Calendar Push disabled.'
    );
  };

  const handleSaveSchedulePreferences = async () => {
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        googleCalendarPushEnabled: true,
        googleCalendarId: settingsState.googleCalendarId || 'primary',
        googleCalendarAutoPush: settingsState.googleCalendarAutoPush || 'manual',
        googleCalendarPushDay: Number(settingsState.googleCalendarPushDay ?? 0),
        googleCalendarPushTime: settingsState.googleCalendarPushTime || '08:00',
        googleCalendarPushAdvanceDays: Number(settingsState.googleCalendarPushAdvanceDays ?? 7),
      }),
    });
    await ui.loadSettings();
    ui.notify('Saved Google Calendar schedule preferences.');
  };

  const handleReauthorizeGoogle = async () => {
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        googleCalendarPushEnabled: true,
        googleCalendarId: settingsState.googleCalendarId || 'primary',
      }),
    });
    const currentRedirect = `${window.location.origin}/api/google`.replace(
      '0.0.0.0',
      'localhost'
    );
    const res = await fetch(`/api/google?redirect_uri=${encodeURIComponent(currentRedirect)}`);
    const data = await res.json();
    if (res.ok && data.authUrl) {
      window.location.href = data.authUrl;
    } else {
      ui.notify(
        data.error ||
          'Configure Google Client ID and Secret in Settings first'
      );
    }
  };

  const handleManualPushCalendar = async () => {
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        googleCalendarId: settingsState.googleCalendarId || 'primary',
        googleCalendarPushAdvanceDays: Number(settingsState.googleCalendarPushAdvanceDays ?? 7),
      }),
    });
    const res = await fetch('/api/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'push_calendar',
        advanceDays: Number(settingsState.googleCalendarPushAdvanceDays ?? 7),
      }),
    });
    const data = await res.json();
    if (res.ok) {
      await ui.loadSettings();
      ui.notify(
        `Pushed ${data.pushed} touchpoint events to Google Calendar (${data.skippedExisting || 0} already up to date).`
      );
    } else {
      ui.notify(data.error || 'Calendar push failed');
    }
  };

  const handleOpenContactDetail = (contact: ContactItem) => {
    if (onOpenContact) {
      onOpenContact(contact);
    } else {
      contactsCtx.openContactDrawer(contact);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Calendar and Outbound Google Calendar Push
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Push your upcoming touchpoints outward to Google Calendar, or download a local .ics snapshot file.
          </p>
        </div>
        <a
          href={`/api/calendar/${settingsState.icalSecretToken || 'token'}.ics`}
          download="touchpoint-schedule.ics"
          className="px-3.5 py-2 rounded-lg bg-well hover:bg-card-hover border border-border text-xs font-medium flex items-center gap-1.5 text-foreground motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          <Download className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
          <span>Download .ics File</span>
        </a>
      </div>

      {/* Google Calendar Push Option Card */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3.5 text-xs shadow-xs">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Outbound Google Calendar Push (Disabled by Default)
            </h2>
            <p className="text-muted mt-0.5">
              Instead of exposing a localhost URL, Touchpoint can push your upcoming contact due dates outward to your Google Calendar.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(settingsState.googleCalendarPushEnabled)}
            aria-label="Toggle outbound Google Calendar push"
            onClick={handleToggleCalendarPush}
            className={`px-3 py-1.5 rounded-full font-semibold shrink-0 border flex items-center gap-2.5 whitespace-nowrap motion-safe:transition-colors motion-safe:duration-160 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              settingsState.googleCalendarPushEnabled
                ? 'bg-success/15 border-success/50 text-success'
                : 'bg-overdue/10 border-overdue/30 text-overdue hover:border-overdue/50'
            }`}
          >
            <span
              className={`w-8 h-4 rounded-full p-0.5 flex items-center transition-colors motion-safe:duration-160 ${
                settingsState.googleCalendarPushEnabled ? 'bg-success' : 'bg-overdue/60'
              }`}
            >
              <span
                className={`w-3 h-3 rounded-full bg-white shadow transition-transform motion-safe:duration-160 ${
                  settingsState.googleCalendarPushEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </span>
            <span className="flex items-center gap-1">
              {settingsState.googleCalendarPushEnabled ? (
                <>
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Enabled</span>
                </>
              ) : (
                <span>Disabled</span>
              )}
            </span>
          </button>
        </div>

        <div className="p-3 rounded-lg bg-well border border-warning/40 text-muted leading-relaxed space-y-1.5">
          <div>
            <strong className="text-foreground">Privacy and OAuth Scope Notice:</strong> Enabling Outbound Google Calendar Push requires the container to make outbound HTTPS connections to Google API URLs (<code className="font-mono">googleapis.com/calendar/v3</code>) using the <code className="font-mono">calendar.events</code> OAuth scope. When disabled, zero requests are made to Google Calendar.
          </div>
          <div className="text-[11px] text-foreground/90 pt-1 border-t border-border/60">
            <strong>Important:</strong> If you connected Google Contacts <em>before</em> enabling this toggle, your existing Refresh Token only has read-only permission. After enabling this toggle, ensure <strong>Google Calendar API</strong> is enabled in your Google Cloud project and click <strong>Re-Authorize Google</strong> below.
          </div>
        </div>

        {settingsState.googleCalendarPushEnabled && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Target Google Calendar ID
                </label>
                <input
                  value={settingsState.googleCalendarId || 'primary'}
                  onChange={(e) =>
                    setSettingsState({ ...settingsState, googleCalendarId: e.target.value })
                  }
                  placeholder="primary"
                  aria-label="Target Google Calendar ID"
                  className="w-full px-3 py-2 rounded-lg bg-well border border-border font-mono text-xs text-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                />
                <p className="text-[11px] text-muted mt-1">
                  Use <code className="font-mono">primary</code> for default calendar, or paste a secondary calendar ID.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Push Horizon in Advance
                </label>
                <select
                  value={settingsState.googleCalendarPushAdvanceDays ?? 7}
                  onChange={(e) =>
                    setSettingsState({
                      ...settingsState,
                      googleCalendarPushAdvanceDays: Number(e.target.value),
                    })
                  }
                  aria-label="Push horizon in advance"
                  className="w-full px-3 py-2 rounded-lg bg-well border border-border text-xs text-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                >
                  <option value={1}>1 day in advance (Today and Tomorrow)</option>
                  <option value={3}>3 days in advance</option>
                  <option value={7}>7 days in advance (Upcoming 1 week)</option>
                  <option value={14}>14 days in advance (Upcoming 2 weeks)</option>
                  <option value={30}>30 days in advance (Upcoming 1 month)</option>
                  <option value={0}>All upcoming scheduled touchpoints</option>
                </select>
                <p className="text-[11px] text-muted mt-1">
                  Controls how far in advance touchpoints are pushed to your Google Calendar.
                </p>
              </div>
            </div>

            {/* Push Schedule Options */}
            <div className="p-4 rounded-xl bg-well border border-border space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-primary" aria-hidden="true" />
                  <span className="text-xs font-bold text-foreground">
                    Automatic Push Schedule
                  </span>
                </div>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {settingsState.googleCalendarAutoPush === 'daily'
                    ? 'Daily Auto-Push'
                    : settingsState.googleCalendarAutoPush === 'weekly'
                    ? 'Weekly Auto-Push'
                    : 'Manual Only'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">
                    Push Frequency
                  </label>
                  <select
                    value={settingsState.googleCalendarAutoPush || 'manual'}
                    onChange={(e) =>
                      setSettingsState({
                        ...settingsState,
                        googleCalendarAutoPush: e.target.value,
                      })
                    }
                    aria-label="Push frequency"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-xs text-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                  >
                    <option value="manual">Manual Only (Disabled)</option>
                    <option value="weekly">Weekly (Start of Week)</option>
                    <option value="daily">Daily</option>
                  </select>
                </div>

                {settingsState.googleCalendarAutoPush === 'weekly' && (
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">
                      Push Day (Start of Week)
                    </label>
                    <select
                      value={settingsState.googleCalendarPushDay ?? 0}
                      onChange={(e) =>
                        setSettingsState({
                          ...settingsState,
                          googleCalendarPushDay: Number(e.target.value),
                        })
                      }
                      aria-label="Push day"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-xs text-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                    >
                      <option value={0}>Sunday</option>
                      <option value={1}>Monday</option>
                      <option value={2}>Tuesday</option>
                      <option value={3}>Wednesday</option>
                      <option value={4}>Thursday</option>
                      <option value={5}>Friday</option>
                      <option value={6}>Saturday</option>
                    </select>
                  </div>
                )}

                {settingsState.googleCalendarAutoPush &&
                  settingsState.googleCalendarAutoPush !== 'manual' && (
                    <div>
                      <label className="block text-xs font-medium text-muted mb-1">
                        Push Time ({settingsState.timezone || 'Local'})
                      </label>
                      <input
                        type="time"
                        value={settingsState.googleCalendarPushTime || '08:00'}
                        onChange={(e) =>
                          setSettingsState({
                            ...settingsState,
                            googleCalendarPushTime: e.target.value,
                          })
                        }
                        aria-label="Push time"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-xs font-mono text-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                      />
                    </div>
                  )}
              </div>

              {/* Status info */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border text-[11px] text-muted">
                <div className="flex items-center gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
                  <span>
                    Auto-push schedule:{' '}
                    <strong className="text-foreground">
                      {settingsState.googleCalendarAutoPush === 'daily'
                        ? 'Daily'
                        : settingsState.googleCalendarAutoPush === 'weekly'
                        ? 'Weekly'
                        : 'Manual only'}
                    </strong>
                    . Deduplication active.
                  </span>
                </div>

                {settingsState.lastGoogleCalendarPushAt && (
                  <div className="shrink-0 text-[10px] text-muted">
                    Last pushed: {new Date(settingsState.lastGoogleCalendarPushAt).toLocaleString()}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleSaveSchedulePreferences}
                  className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-fg font-semibold text-xs motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] hover:opacity-90 shadow-xs focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Calendar Schedule
                </button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleReauthorizeGoogle}
                className="px-3.5 py-2 rounded-lg bg-well hover:bg-card-hover border border-border text-foreground font-semibold flex items-center gap-1.5 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] text-xs focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                <span>Re-Authorize Google</span>
              </button>
              <button
                type="button"
                onClick={handleManualPushCalendar}
                className="px-4 py-2 rounded-lg bg-primary text-primary-fg font-semibold flex items-center gap-1.5 text-xs shadow-xs hover:opacity-95 whitespace-nowrap motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Push to Calendar Now</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Built-In Schedule Agenda */}
      <div className="bg-card border border-border rounded-xl divide-y divide-border text-xs shadow-xs">
        {trackedContactsSortedByDue.length === 0 ? (
          <div className="p-6 text-center text-muted">
            No tracked contacts scheduled yet. Enable Keep in Touch on contacts to see their upcoming dates here.
          </div>
        ) : (
          trackedContactsSortedByDue.map((c) => (
            <div
              key={c.id}
              onClick={() => handleOpenContactDetail(c)}
              className="p-3.5 flex items-center justify-between hover:bg-well/50 cursor-pointer motion-safe:transition-colors motion-safe:duration-160"
            >
              <div className="flex items-center gap-3">
                <ProgressRingAvatar
                  name={c.fullName}
                  progressPercent={c.cadence.progressPercent}
                  status={c.cadence.status}
                  size="sm"
                />
                <div>
                  <div className="font-semibold text-sm text-foreground">{c.fullName}</div>
                  <div className="text-muted">
                    Every {c.cadence.effectiveIntervalDays} days ·{' '}
                    {c.groups.map((g) => g.name).join(', ') || 'Personal'}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-foreground">{c.cadence.nextDueDate}</div>
                <div className="text-muted">
                  {c.cadence.daysUntilDue < 0
                    ? `${Math.abs(c.cadence.daysUntilDue)}d overdue`
                    : c.cadence.daysUntilDue === 0
                    ? 'Due today'
                    : `In ${c.cadence.daysUntilDue} days`}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
