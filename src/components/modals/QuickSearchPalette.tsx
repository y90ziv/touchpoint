'use client';

import React from 'react';
import {
  Search,
  X,
  LayoutDashboard,
  Users,
  FolderKanban,
  Network,
  Calendar as CalendarIcon,
  Settings as SettingsIcon,
  Archive,
  BookOpen,
  Cake,
  Phone,
  MessageSquare,
} from 'lucide-react';
import { useUI } from '@/context/UIContext';
import { useContacts } from '@/context/ContactsContext';
import { useGroups } from '@/context/GroupsContext';
import { useTouchpoints } from '@/context/TouchpointsContext';
import { ProgressRingAvatar } from '@/components/ProgressRingAvatar';
import { NavigationTab } from '@/types/touchpoint';

export function QuickSearchPalette() {
  const ui = useUI();
  const contactsCtx = useContacts();
  const groupsCtx = useGroups();
  const tpCtx = useTouchpoints();

  if (!ui.showQuickSearchModal) return null;

  const contacts = contactsCtx.contacts;
  const groups = groupsCtx.groups;
  const searchQuery = ui.searchQuery;
  const setSearchQuery = ui.setSearchQuery;
  const searchFilterTab = ui.searchFilterTab;
  const setSearchFilterTab = ui.setSearchFilterTab;
  const searchFilterGroup = ui.searchFilterGroup;
  const setSearchFilterGroup = ui.setSearchFilterGroup;

  const attentionCount = contacts.filter(
    (c) => c.keepInTouch && ['overdue', 'due_today'].includes(c.cadence?.status)
  ).length;
  const birthdayCount = contacts.filter((c) => Boolean(c.birthday)).length;

  const filteredContacts = contacts.filter((c) => {
    if (searchFilterGroup !== null && !c.groups.some((g) => g.id === searchFilterGroup)) {
      return false;
    }
    if (searchFilterTab === 'due') {
      if (!c.keepInTouch || !['overdue', 'due_today'].includes(c.cadence?.status)) return false;
    } else if (searchFilterTab === 'birthdays') {
      if (!c.birthday) return false;
    } else if (searchFilterTab === 'tracked') {
      if (!c.keepInTouch) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        c.fullName.toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.company || '').toLowerCase().includes(q) ||
        (c.jobTitle || '').toLowerCase().includes(q) ||
        (c.notes || '').toLowerCase().includes(q) ||
        c.groups.some((g) => g.name.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleLogQuick = async (contactId: number, method: string) => {
    const ok = await tpCtx.logTouchpoint(contactId, method);
    if (ok) {
      await contactsCtx.loadContacts();
      ui.notify(`Logged ${method} touchpoint.`);
    }
  };

  const q = searchQuery.toLowerCase().trim();
  const navItems: Array<{
    id: NavigationTab;
    label: string;
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
    keywords: string;
  }> = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      desc: 'Overdue reminders, birthdays, and metrics',
      icon: LayoutDashboard,
      keywords: 'dashboard home overview due urgent',
    },
    {
      id: 'contacts',
      label: 'Contacts Directory',
      desc: 'Browse, filter, and edit all contacts',
      icon: Users,
      keywords: 'contacts directory people address book',
    },
    {
      id: 'groups',
      label: 'Groups & Circles',
      desc: 'Manage circles and cadence intervals',
      icon: FolderKanban,
      keywords: 'groups categories cadence circles',
    },
    {
      id: 'map',
      label: 'Relationship Map',
      desc: 'Visualize spouses, families, and coworker links',
      icon: Network,
      keywords: 'relationship map network graph family spouse child',
    },
    {
      id: 'calendar',
      label: 'Calendar Sync',
      desc: 'Live iCal feeds and Google Calendar integration',
      icon: CalendarIcon,
      keywords: 'calendar sync ical google agenda feed',
    },
    {
      id: 'settings',
      label: 'Settings',
      desc: 'Configure sync, Telegram, webhooks, or wipe data',
      icon: SettingsIcon,
      keywords: 'settings config preferences wipe google telegram webhook danger zone',
    },
    {
      id: 'archived',
      label: 'Archived Contacts',
      desc: 'Manage blocked or deleted Google contacts and tombstones',
      icon: Archive,
      keywords: 'archived archive blocked blocklist tombstones deleted merged google sync restore unblock',
    },
    {
      id: 'help',
      label: 'Help & Guide',
      desc: 'Read guides and OAuth troubleshooting tips',
      icon: BookOpen,
      keywords: 'help guide reference manual faq troubleshooting oauth',
    },
  ];

  const matchingNavs = navItems.filter((item) => {
    if (!q) return true;
    return (
      item.label.toLowerCase().includes(q) ||
      item.desc.toLowerCase().includes(q) ||
      item.keywords.includes(q)
    );
  });

  // Emil Kowalski frequency rule: keyboard-invoked command palette opens/closes instantaneously (0ms)
  return (
    <div
      onClick={() => ui.setShowQuickSearchModal(false)}
      className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center pt-6 sm:pt-14 p-2 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Quick Search and Command Palette"
        className="bg-card border border-border rounded-2xl max-w-2xl w-full p-3.5 sm:p-4 space-y-3.5 shadow-md text-xs overflow-hidden max-h-[88vh] flex flex-col"
      >
        <div className="flex items-center justify-between gap-3 pb-2 border-b border-border">
          <div className="flex items-center gap-2.5 flex-1">
            <Search className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contacts by name, phone, email, company, notes… (Esc to close)"
              aria-label="Search contacts or commands"
              className="w-full bg-transparent border-none text-sm text-foreground focus:outline-none placeholder:text-muted"
            />
          </div>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search query"
              className="p-1 rounded text-muted hover:text-foreground active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
          <kbd className="px-2 py-0.5 rounded bg-well border border-border text-[10px] font-mono text-muted">
            ESC
          </kbd>
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pb-1">
          {[
            { id: 'all', label: `All (${contacts.length})` },
            { id: 'due', label: `Due (${attentionCount})` },
            { id: 'birthdays', label: `Birthdays (${birthdayCount})` },
            {
              id: 'tracked',
              label: `Tracked (${contacts.filter((c) => c.keepInTouch).length})`,
            },
          ].map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setSearchFilterTab(chip.id as typeof searchFilterTab)}
              className={`px-2.5 py-1 rounded-lg border motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
                searchFilterTab === chip.id
                  ? 'bg-primary text-primary-fg border-primary font-medium'
                  : 'bg-well border-border text-muted hover:text-foreground'
              }`}
            >
              {chip.label}
            </button>
          ))}

          <select
            value={searchFilterGroup === null ? '' : searchFilterGroup}
            onChange={(e) =>
              setSearchFilterGroup(e.target.value === '' ? null : Number(e.target.value))
            }
            aria-label="Filter by group"
            className="px-2.5 py-1 rounded-lg bg-well border border-border text-foreground"
          >
            <option value="">All Groups</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>

          {(searchQuery || searchFilterTab !== 'all' || searchFilterGroup !== null) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSearchFilterTab('all');
                setSearchFilterGroup(null);
              }}
              className="px-2 py-1 text-muted hover:text-foreground underline active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              Reset
            </button>
          )}
        </div>

        {/* Quick Navigation / Tab Switcher */}
        {matchingNavs.length > 0 && (
          <div className="space-y-1 pb-2 border-b border-border">
            <div className="text-[11px] font-semibold text-muted px-1">Go to Page / Tab</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
              {matchingNavs.map((nav) => {
                const Icon = nav.icon;
                return (
                  <button
                    key={nav.id}
                    type="button"
                    onClick={() => {
                      ui.setActiveTab(nav.id);
                      ui.setShowQuickSearchModal(false);
                      setSearchQuery('');
                    }}
                    className="flex items-center gap-2.5 p-2 rounded-lg bg-well hover:bg-card-hover border border-border text-left motion-safe:transition-colors group active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                  >
                    <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0 group-hover:bg-primary group-hover:text-primary-fg motion-safe:transition-colors">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-xs text-foreground truncate">
                        Go to {nav.label}
                      </div>
                      <div className="text-[10px] text-muted truncate">{nav.desc}</div>
                    </div>
                    <span className="text-[10px] text-muted group-hover:text-foreground">
                      &rarr;
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto divide-y divide-border pr-1">
          {filteredContacts.length === 0 ? (
            <div className="py-8 text-center text-muted space-y-2">
              <p>No contacts found matching &ldquo;{searchQuery}&rdquo;</p>
              <button
                type="button"
                onClick={() => {
                  ui.setShowQuickSearchModal(false);
                  contactsCtx.setShowNewContactModal(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-fg font-semibold active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              >
                Add New Contact…
              </button>
            </div>
          ) : (
            filteredContacts.map((c) => (
              <div
                key={c.id}
                onClick={() => {
                  ui.setShowQuickSearchModal(false);
                  contactsCtx.openContactDrawer(c);
                }}
                className="py-2.5 px-2 hover:bg-card-hover rounded-lg flex items-center justify-between gap-3 cursor-pointer motion-safe:transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ProgressRingAvatar
                    name={c.fullName}
                    progressPercent={c.cadence.progressPercent}
                    status={c.cadence.status}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{c.fullName}</div>
                    <div className="text-muted truncate">
                      {[c.jobTitle, c.company].filter(Boolean).join(' @ ') ||
                        c.phone ||
                        c.email ||
                        'No details'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {c.birthday && (
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-primary font-medium flex items-center gap-1">
                      <Cake className="w-3 h-3" aria-hidden="true" />
                      <span>{c.birthday}</span>
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full bg-well border border-border text-muted font-mono tabular-nums">
                    {c.cadence.nextDueDate}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLogQuick(c.id, 'call');
                    }}
                    aria-label={`Log call with ${c.fullName}`}
                    className="p-1.5 rounded bg-primary text-primary-fg active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                    title="Log Call"
                  >
                    <Phone className="w-3 h-3" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLogQuick(c.id, 'message');
                    }}
                    aria-label={`Log message with ${c.fullName}`}
                    className="p-1.5 rounded bg-well border border-border text-foreground active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                    title="Log Message"
                  >
                    <MessageSquare className="w-3 h-3" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border text-[11px] text-muted">
          <span>{filteredContacts.length} contacts found</span>
          <span>Tip: Press ⌘K anywhere to toggle this search palette</span>
        </div>
      </div>
    </div>
  );
}
