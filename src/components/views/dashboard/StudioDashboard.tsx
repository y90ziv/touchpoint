'use client';

import React from 'react';
import { ContactItem, NavigationTab } from '@/types/touchpoint';
import { cleanPhoneForDial } from '@/lib/formatters';
import { useTouchpoints } from '@/context/TouchpointsContext';
import { useContacts } from '@/context/ContactsContext';
import { useUI } from '@/context/UIContext';
import { ProgressRingAvatar } from '@/components/ProgressRingAvatar';
import { Heart, Cake, Sparkles, MessageCircle, Check, Plus, ArrowRight } from 'lucide-react';

export interface StudioDashboardProps {
  contacts: ContactItem[];
  attentionContacts: ContactItem[];
  upcomingWeekContacts: ContactItem[];
  onTrackContacts: ContactItem[];
  recent30DaysContacts: ContactItem[];
  health: { scorePercent: number; onTrackCount: number; totalTrackedCount: number; overdueCount: number };
  onOpenContact: (contact: ContactItem) => void;
  onOpenNewContact: () => void;
  onNavigateToTab: (tab: NavigationTab) => void;
}

export function StudioDashboard({
  contacts,
  attentionContacts,
  upcomingWeekContacts,
  health,
  onOpenContact,
  onOpenNewContact,
  onNavigateToTab,
}: StudioDashboardProps) {
  const touchpointsCtx = useTouchpoints();
  const contactsCtx = useContacts();
  const ui = useUI();

  const handleQuickLog = async (contact: ContactItem) => {
    const success = await touchpointsCtx.logTouchpoint(
      contact.id,
      'whatsapp',
      'Caught up via Warm Studio',
      new Date().toISOString()
    );
    if (success) {
      ui.notify(`Logged conversation with ${contact.fullName}.`);
      await contactsCtx.loadContacts();
    }
  };

  const reconnectCandidate = contacts.find((c) => c.keepInTouch && c.cadence.daysUntilDue > 5) || contacts[0];

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-2">
      {/* Friendly Warm Hero */}
      <div className="p-6 rounded-3xl bg-card border border-border flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wide">
            <Heart className="w-4 h-4 fill-primary/20 text-primary" aria-hidden="true" /> Personal relationship studio
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            {attentionContacts.length > 0
              ? `You have ${attentionContacts.length} people to reconnect with today.`
              : 'Your circle is feeling loved and in touch.'}
          </h1>
          <p className="text-sm text-muted">
            {contacts.length} meaningful relationships across your network · {health.scorePercent}% cadence rhythm
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenNewContact}
            className="px-4 py-2 rounded-2xl bg-primary text-primary-fg text-xs font-bold hover:opacity-90 flex items-center gap-1.5 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" aria-hidden="true" /> Add person
          </button>
        </div>
      </div>

      {/* 3-Column Horizon Deck */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Deck 1: Needs Touchpoint */}
        <div className="p-5 rounded-3xl bg-card border border-border space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-foreground text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-overdue" />
                Needs touchpoint
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-well font-bold text-muted tabular-nums">
                {attentionContacts.length}
              </span>
            </div>

            {attentionContacts.length > 0 ? (
              <div className="space-y-3">
                {attentionContacts.map((c) => {
                  const dialPhone = cleanPhoneForDial(c.phone);
                  return (
                    <div
                      key={c.id}
                      className="p-3.5 rounded-2xl bg-well hover:bg-card-hover border border-border motion-safe:transition-colors motion-safe:duration-160 space-y-3"
                    >
                      <div
                        onClick={() => onOpenContact(c)}
                        className="flex items-center gap-3 cursor-pointer"
                      >
                        <ProgressRingAvatar
                          name={c.fullName}
                          progressPercent={c.cadence.progressPercent}
                          status={c.cadence.status}
                          size="md"
                        />
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-foreground truncate hover:text-primary">
                            {c.fullName}
                          </h4>
                          <p className="text-xs text-muted truncate">
                            {c.company || 'Close contact'} · Every {c.cadence.effectiveIntervalDays}d
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        {c.phone && (
                          <a
                            href={`https://wa.me/${dialPhone.replace('+', '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-1 px-2 rounded-xl bg-well border border-border hover:bg-primary hover:text-primary-fg text-xs font-semibold flex items-center justify-center gap-1 motion-safe:transition-colors motion-safe:duration-160"
                          >
                            <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" /> Say hi
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleQuickLog(c)}
                          className="py-1 px-2.5 rounded-xl bg-well border border-border hover:bg-emerald-600 hover:text-white text-xs font-semibold flex items-center justify-center gap-1 motion-safe:transition-colors motion-safe:duration-160"
                          title="Log catchup"
                        >
                          <Check className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted py-8 text-center">
                All caught up. No one overdue today.
              </p>
            )}
          </div>
        </div>

        {/* Deck 2: Upcoming Moments */}
        <div className="p-5 rounded-3xl bg-card border border-border space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-foreground text-sm">
                <Cake className="w-4 h-4 text-warning" aria-hidden="true" />
                Upcoming moments
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-well font-bold text-muted tabular-nums">
                {upcomingWeekContacts.length}
              </span>
            </div>

            <div className="space-y-2.5">
              {upcomingWeekContacts.slice(0, 4).map((c) => (
                <div
                  key={c.id}
                  onClick={() => onOpenContact(c)}
                  className="p-3 rounded-2xl bg-well hover:bg-card-hover border border-border cursor-pointer flex items-center justify-between motion-safe:transition-colors motion-safe:duration-160"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ProgressRingAvatar
                      name={c.fullName}
                      progressPercent={c.cadence.progressPercent}
                      status={c.cadence.status}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-foreground truncate">{c.fullName}</div>
                      <div className="text-[11px] text-muted">Due in {c.cadence.daysUntilDue} days</div>
                    </div>
                  </div>
                  <span className="text-xs text-muted">Next</span>
                </div>
              ))}
              {upcomingWeekContacts.length === 0 && (
                <p className="text-xs text-muted py-8 text-center">
                  No birthdays or moments in the next 7 days.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Deck 3: Network Reconnect */}
        <div className="p-5 rounded-3xl bg-card border border-border space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-foreground text-sm">
                <Sparkles className="w-4 h-4 text-primary" aria-hidden="true" />
                Network Reconnect
              </div>
            </div>

            {reconnectCandidate ? (
              <div className="p-4 rounded-2xl bg-well border border-border space-y-3 text-center">
                <div className="mx-auto w-fit">
                  <ProgressRingAvatar
                    name={reconnectCandidate.fullName}
                    progressPercent={reconnectCandidate.cadence.progressPercent}
                    status={reconnectCandidate.cadence.status}
                    size="lg"
                  />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-foreground">{reconnectCandidate.fullName}</h4>
                  <p className="text-xs text-muted">{reconnectCandidate.company || 'In your circle'}</p>
                </div>
                <p className="text-xs text-muted italic px-2">
                  Haven’t spoken in {reconnectCandidate.cadence.daysSinceContact || 30} days. Perfect time to drop a note.
                </p>
                <button
                  type="button"
                  onClick={() => onOpenContact(reconnectCandidate)}
                  className="w-full py-2 rounded-xl bg-well border border-border hover:bg-card-hover text-xs font-bold text-foreground flex items-center justify-center gap-1.5 motion-safe:transition-colors motion-safe:duration-160"
                >
                  View details <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <p className="text-xs text-muted py-8 text-center">No reconnect suggestions yet.</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => onNavigateToTab('contacts')}
            className="w-full py-2 rounded-2xl bg-well text-xs font-semibold text-muted hover:text-foreground text-center"
          >
            Explore all {contacts.length} people
          </button>
        </div>
      </div>
    </div>
  );
}
