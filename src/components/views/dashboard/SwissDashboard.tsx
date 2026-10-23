'use client';

import React from 'react';
import { ContactItem, NavigationTab } from '@/types/touchpoint';
import { cleanPhoneForDial } from '@/lib/formatters';
import { useTouchpoints } from '@/context/TouchpointsContext';
import { useContacts } from '@/context/ContactsContext';
import { useUI } from '@/context/UIContext';
import { ArrowRight, Check } from 'lucide-react';

export interface SwissDashboardProps {
  contacts: ContactItem[];
  attentionContacts: ContactItem[];
  upcomingWeekContacts: ContactItem[];
  onTrackContacts: ContactItem[];
  health: { scorePercent: number; onTrackCount: number; totalTrackedCount: number; overdueCount: number };
  onOpenContact: (contact: ContactItem) => void;
  onOpenNewContact: () => void;
  onNavigateToTab: (tab: NavigationTab) => void;
}

export function SwissDashboard({
  contacts,
  attentionContacts,
  upcomingWeekContacts,
  onTrackContacts,
  health,
  onOpenContact,
  onNavigateToTab,
}: SwissDashboardProps) {
  const touchpointsCtx = useTouchpoints();
  const contactsCtx = useContacts();
  const ui = useUI();

  const handleQuickLog = async (contact: ContactItem) => {
    const success = await touchpointsCtx.logTouchpoint(
      contact.id,
      'call',
      'Logged in Swiss Ledger',
      new Date().toISOString()
    );
    if (success) {
      ui.notify(`Touchpoint recorded for ${contact.fullName}.`);
      await contactsCtx.loadContacts();
    }
  };

  return (
    <div className="space-y-10 max-w-6xl mx-auto py-2">
      {/* Swiss Header Rule */}
      <div className="border-b-2 border-foreground pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Network ledger
          </h1>
          <p className="text-xs text-muted mt-1">
            SBB chronological cadence dispatch
          </p>
        </div>
        <div className="flex items-center gap-6 text-xs">
          <div>
            <div className="text-muted">Indexed</div>
            <div className="text-xl font-bold text-foreground tabular-nums font-mono">{contacts.length}</div>
          </div>
          <div className="border-l border-border pl-6">
            <div className="text-muted">Health</div>
            <div className="text-xl font-bold text-primary tabular-nums font-mono">{health.scorePercent}%</div>
          </div>
          <div className="border-l border-border pl-6">
            <div className="text-muted">Pending</div>
            <div className="text-xl font-bold text-overdue tabular-nums font-mono">{attentionContacts.length}</div>
          </div>
        </div>
      </div>

      {/* 01 / Immediate Attention */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between border-b border-border pb-2">
          <h2 className="text-xs font-semibold text-muted">
            01 / Immediate attention
          </h2>
          <span className="text-xs text-muted tabular-nums">
            {attentionContacts.length} contact{attentionContacts.length === 1 ? '' : 's'} due
          </span>
        </div>

        {attentionContacts.length > 0 ? (
          <div className="divide-y divide-border border-t border-border">
            {attentionContacts.map((c, idx) => {
              const dialPhone = cleanPhoneForDial(c.phone);
              const isOverdue = c.cadence.daysUntilDue < 0;
              return (
                <div
                  key={c.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-well/40 px-2 motion-safe:transition-colors motion-safe:duration-160"
                >
                  <div className="flex items-baseline gap-4 min-w-0">
                    <span className="font-mono text-xs text-muted tabular-nums w-6">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onOpenContact(c)}
                        className="font-bold text-base text-foreground hover:text-primary motion-safe:transition-colors motion-safe:duration-160 text-left"
                      >
                        {c.fullName}
                      </button>
                      <div className="text-xs text-muted truncate">
                        {c.company || 'Local contact'} · Interval: {c.cadence.effectiveIntervalDays}d · Last: {c.cadence.daysSinceContact}d ago
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-xs">
                    <span
                      className={`px-2 py-0.5 font-bold tabular-nums font-mono ${
                        isOverdue ? 'bg-overdue text-white' : 'bg-primary text-primary-fg'
                      }`}
                    >
                      {isOverdue ? `-${Math.abs(c.cadence.daysUntilDue)}d overdue` : 'Due today'}
                    </span>
                    {c.phone && (
                      <a
                        href={`https://wa.me/${dialPhone.replace('+', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 border border-border hover:border-foreground motion-safe:transition-colors motion-safe:duration-160"
                      >
                        WhatsApp
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleQuickLog(c)}
                      className="px-2.5 py-1 bg-foreground text-background font-bold hover:opacity-90 flex items-center gap-1 motion-safe:transition-opacity motion-safe:duration-160"
                    >
                      <Check className="w-3.5 h-3.5" aria-hidden="true" /> Logged
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-xs text-muted border-b border-border">
            Zero contacts require attention today. All cadence limits respected.
          </div>
        )}
      </section>

      {/* 02 / Time Horizons */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between border-b border-border pb-2">
          <h2 className="text-xs font-semibold text-muted">
            02 / Time horizons
          </h2>
          <button
            type="button"
            onClick={() => onNavigateToTab('contacts')}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            Open full directory <ArrowRight className="w-3 h-3" aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          <div className="border border-border p-4 space-y-2">
            <div className="text-xs text-muted">Horizon 1: immediate</div>
            <div className="text-3xl font-light tabular-nums font-mono text-overdue">{attentionContacts.length}</div>
            <div className="text-[11px] text-muted">Overdue or due today</div>
          </div>
          <div className="border border-border p-4 space-y-2">
            <div className="text-xs text-muted">Horizon 2: 7 days</div>
            <div className="text-3xl font-light tabular-nums font-mono text-foreground">{upcomingWeekContacts.length}</div>
            <div className="text-[11px] text-muted">Upcoming this week</div>
          </div>
          <div className="border border-border p-4 space-y-2">
            <div className="text-xs text-muted">Horizon 3: in rhythm</div>
            <div className="text-3xl font-light tabular-nums font-mono text-primary">{onTrackContacts.length}</div>
            <div className="text-[11px] text-muted">Cadence on track</div>
          </div>
        </div>
      </section>
    </div>
  );
}
