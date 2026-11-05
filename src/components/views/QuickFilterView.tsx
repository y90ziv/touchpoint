'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Sparkles,
  History,
  Layers,
  Heart,
  Archive,
  RotateCcw,
  SkipForward,
  Phone,
  Mail,
  Cake,
  Calendar,
  FileText,
  Building2,
  FolderKanban,
  Search,
  Check,
  X,
  ArrowLeft,
  ArrowRight,
  SlidersHorizontal,
  ExternalLink,
} from 'lucide-react';
import { ContactItem, GoogleTombstoneItem } from '@/types/touchpoint';
import { useContacts } from '@/context/ContactsContext';
import { useGroups } from '@/context/GroupsContext';
import { useUI } from '@/context/UIContext';
import { ProgressRingAvatar } from '@/components/ProgressRingAvatar';

const STORAGE_KEY = 'touchpoint_quick_filter_history_v1';
const SWIPE_THRESHOLD = 95;

export interface QuickFilterContactSnapshot {
  id: number;
  source: 'google' | 'local' | 'vcard';
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  country: string | null;
  postalCode: string | null;
  company: string | null;
  jobTitle: string | null;
  notes: string | null;
  birthday: string | null;
  significantDate: string | null;
  significantDateLabel: string | null;
  importantDates: Array<{ label: string; date: string; remindDaysBefore?: number }>;
  groupIds: number[];
  groups: Array<{ id: number; name: string }>;
  pets: string[];
  customIntervalDays: number | null;
  lastContactedAt: string | null;
  customFields: Record<number, string>;
  keepInTouch: boolean;
}

export interface QuickFilterHistoryEntry {
  historyId: string;
  contactId: number;
  decision: 'archived' | 'saved';
  previousKeepInTouch: boolean;
  timestamp: string;
  snapshot: QuickFilterContactSnapshot;
}

export type QuickFilterMode = 'deck' | 'history';
export type DeckFilterType = 'unreviewed' | 'untracked' | 'all';
export type HistoryFilterType = 'all' | 'archived' | 'saved';

export interface QuickFilterViewProps {
  initialMode?: QuickFilterMode;
}

function createContactSnapshot(contact: ContactItem): QuickFilterContactSnapshot {
  return {
    id: contact.id,
    source: contact.source || 'local',
    firstName: contact.firstName ?? null,
    lastName: contact.lastName ?? null,
    fullName: contact.fullName || 'Unnamed Contact',
    phone: contact.phone ?? null,
    email: contact.email ?? null,
    country: contact.country ?? null,
    postalCode: contact.postalCode ?? null,
    company: contact.company ?? null,
    jobTitle: contact.jobTitle ?? null,
    notes: contact.notes ?? null,
    birthday: contact.birthday ?? null,
    significantDate: contact.significantDate ?? null,
    significantDateLabel: contact.significantDateLabel ?? null,
    importantDates: (contact.importantDates || []).map((d) => ({
      label: d.label,
      date: d.date,
      remindDaysBefore: d.remindDaysBefore,
    })),
    groupIds: (contact.groups || []).map((g) => g.id),
    groups: (contact.groups || []).map((g) => ({ id: g.id, name: g.name })),
    pets: contact.pets || [],
    customIntervalDays: contact.customIntervalDays ?? null,
    lastContactedAt: contact.lastContactedAt ?? null,
    customFields: contact.customFields || {},
    keepInTouch: Boolean(contact.keepInTouch),
  };
}

export function QuickFilterView({ initialMode = 'deck' }: QuickFilterViewProps = {}) {
  const contactsCtx = useContacts();
  const groupsCtx = useGroups();
  const ui = useUI();

  const [mode, setMode] = useState<QuickFilterMode>(initialMode);
  const [deckFilter, setDeckFilter] = useState<DeckFilterType>('unreviewed');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<number | null>(null);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilterType>('all');
  const [historySearch, setHistorySearch] = useState('');

  const [history, setHistory] = useState<QuickFilterHistoryEntry[]>([]);
  const [skippedSequence, setSkippedSequence] = useState<Record<number, number>>({});
  const skipCounterRef = useRef<number>(1);
  const [prioritizedContactId, setPrioritizedContactId] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Pointer drag state for fluid 1:1 horizontal card tracking
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const pointerStartRef = useRef<{ id: number; x: number; y: number } | null>(null);

  // Load persisted swipe history and Google tombstones on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setHistory(parsed);
          }
        }
      } catch {
        // Ignore storage read errors
      }
    }
    ui.loadGoogleTombstones();
  }, [ui.loadGoogleTombstones]);

  const persistHistory = useCallback((nextHistory: QuickFilterHistoryEntry[]) => {
    setHistory(nextHistory);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextHistory));
      } catch {
        // Ignore storage quota errors
      }
    }
  }, []);

  // Set of contact IDs that have already been reviewed in history
  const reviewedContactIds = useMemo(() => {
    return new Set(history.map((h) => h.contactId));
  }, [history]);

  // Filtered and ordered deck of contacts
  const deckContacts = useMemo(() => {
    const filtered = contactsCtx.contacts.filter((contact) => {
      // Group filter check
      if (selectedGroupFilter !== null) {
        if (selectedGroupFilter === -1) {
          if (contact.groups && contact.groups.length > 0) return false;
        } else {
          if (!contact.groups?.some((g) => g.id === selectedGroupFilter)) return false;
        }
      }

      // Deck filter check
      if (deckFilter === 'unreviewed') {
        if (prioritizedContactId === contact.id) return true;
        return !reviewedContactIds.has(contact.id);
      }
      if (deckFilter === 'untracked') {
        if (prioritizedContactId === contact.id) return true;
        return !contact.keepInTouch;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (prioritizedContactId !== null) {
        if (a.id === prioritizedContactId) return -1;
        if (b.id === prioritizedContactId) return 1;
      }
      const skipA = skippedSequence[a.id] ?? 0;
      const skipB = skippedSequence[b.id] ?? 0;
      if (skipA !== skipB) return skipA - skipB;
      return a.fullName.localeCompare(b.fullName);
    });
  }, [
    contactsCtx.contacts,
    selectedGroupFilter,
    deckFilter,
    reviewedContactIds,
    skippedSequence,
    prioritizedContactId,
  ]);

  const currentContact = deckContacts[0] || null;
  const nextContact = deckContacts[1] || null;

  // Reset drag position when top card changes
  useEffect(() => {
    setDragX(0);
    setDragY(0);
    setIsDragging(false);
    pointerStartRef.current = null;
  }, [currentContact?.id]);

  // Helper to find matching Google tombstone for a snapshot
  const findMatchingTombstone = useCallback(
    (snapshot: QuickFilterContactSnapshot): GoogleTombstoneItem | undefined => {
      const targetName = (snapshot.fullName || '').trim().toLowerCase();
      const targetEmail = (snapshot.email || '').trim().toLowerCase();
      const targetPhone = (snapshot.phone || '').replace(/[^\d+]/g, '');

      return ui.googleTombstones.find((t) => {
        if (t.reason !== 'deleted') return false;
        const tName = (t.contactName || '').trim().toLowerCase();
        const tEmail = (t.contactEmail || '').trim().toLowerCase();
        const tPhone = (t.contactPhone || '').replace(/[^\d+]/g, '');

        if (targetEmail && tEmail && targetEmail === tEmail) return true;
        if (targetPhone && tPhone && targetPhone === tPhone) return true;
        if (targetName && tName && targetName === tName) return true;
        return false;
      });
    },
    [ui.googleTombstones]
  );

  // Helper to recreate a deleted/archived contact from its snapshot
  const recreateContactFromSnapshot = useCallback(
    async (
      snapshot: QuickFilterContactSnapshot,
      keepInTouchOverride: boolean
    ): Promise<ContactItem | null> => {
      const matchingTombstone = findMatchingTombstone(snapshot);
      if (matchingTombstone) {
        await ui.unblockTombstone(matchingTombstone.id);
      }

      const payload = {
        source: snapshot.source || 'local',
        fullName: snapshot.fullName || 'Unnamed Contact',
        firstName: snapshot.firstName,
        lastName: snapshot.lastName,
        phone: snapshot.phone,
        email: snapshot.email,
        country: snapshot.country,
        postalCode: snapshot.postalCode,
        company: snapshot.company,
        jobTitle: snapshot.jobTitle,
        notes: snapshot.notes,
        birthday: snapshot.birthday,
        significantDate: snapshot.significantDate,
        significantDateLabel: snapshot.significantDateLabel,
        importantDates: snapshot.importantDates || [],
        groupIds: snapshot.groupIds || [],
        pets: snapshot.pets || [],
        customIntervalDays: snapshot.customIntervalDays,
        lastContactedAt: snapshot.lastContactedAt,
        customFields: snapshot.customFields || {},
        keepInTouch: keepInTouchOverride,
      };

      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        const created: ContactItem | null = data.contact || data || null;
        await Promise.all([contactsCtx.loadContacts(), ui.loadGoogleTombstones()]);
        return created;
      }
      return null;
    },
    [findMatchingTombstone, ui, contactsCtx]
  );

  // Swipe Left: Discard / Archive (Delete)
  const handleArchiveContact = useCallback(
    async (contact: ContactItem) => {
      if (isProcessing) return;
      setIsProcessing(true);
      try {
        const snapshot = createContactSnapshot(contact);
        const entry: QuickFilterHistoryEntry = {
          historyId: `qf-${Date.now()}-${contact.id}`,
          contactId: contact.id,
          decision: 'archived',
          previousKeepInTouch: Boolean(contact.keepInTouch),
          timestamp: new Date().toISOString(),
          snapshot,
        };

        const nextHistory = [entry, ...history.filter((h) => h.contactId !== contact.id)];
        persistHistory(nextHistory);
        if (prioritizedContactId === contact.id) {
          setPrioritizedContactId(null);
        }

        await contactsCtx.deleteContact(contact.id);
        await ui.loadGoogleTombstones();
        ui.notify(`Archived "${contact.fullName}". You can undo or restore anytime.`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, history, persistHistory, prioritizedContactId, contactsCtx, ui]
  );

  // Swipe Right: Save / Keep in Touch
  const handleSaveKeepInTouch = useCallback(
    async (contact: ContactItem) => {
      if (isProcessing) return;
      setIsProcessing(true);
      try {
        const snapshot = createContactSnapshot(contact);
        const entry: QuickFilterHistoryEntry = {
          historyId: `qf-${Date.now()}-${contact.id}`,
          contactId: contact.id,
          decision: 'saved',
          previousKeepInTouch: Boolean(contact.keepInTouch),
          timestamp: new Date().toISOString(),
          snapshot,
        };

        const nextHistory = [entry, ...history.filter((h) => h.contactId !== contact.id)];
        persistHistory(nextHistory);
        if (prioritizedContactId === contact.id) {
          setPrioritizedContactId(null);
        }

        await contactsCtx.patchContact(contact.id, { keepInTouch: true });
        ui.notify(`Added "${contact.fullName}" to Keep in Touch cadence.`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, history, persistHistory, prioritizedContactId, contactsCtx, ui]
  );

  // Skip: Move card to the end of the session queue without modifying it
  const handleSkipContact = useCallback(
    (contact: ContactItem) => {
      if (isProcessing) return;
      if (prioritizedContactId === contact.id) {
        setPrioritizedContactId(null);
      }
      const orderVal = skipCounterRef.current++;
      setSkippedSequence((prev) => ({
        ...prev,
        [contact.id]: orderVal,
      }));
      ui.notify(`Skipped "${contact.fullName}" for later in this session.`);
    },
    [isProcessing, prioritizedContactId, ui]
  );

  // Immediate Undo Last Swipe (from deck toolbar or Backspace / Z key)
  const handleUndoLast = useCallback(async () => {
    if (isProcessing || history.length === 0) return;
    const latest = history[0];
    setIsProcessing(true);
    try {
      const remainingHistory = history.slice(1);
      if (latest.decision === 'archived') {
        const created = await recreateContactFromSnapshot(
          latest.snapshot,
          latest.previousKeepInTouch
        );
        persistHistory(remainingHistory);
        if (created && created.id) {
          setPrioritizedContactId(created.id);
        }
        ui.notify(`Undid archive: "${latest.snapshot.fullName}" is back on top of the deck.`);
      } else {
        await contactsCtx.patchContact(latest.contactId, {
          keepInTouch: Boolean(latest.previousKeepInTouch),
        });
        persistHistory(remainingHistory);
        setPrioritizedContactId(latest.contactId);
        ui.notify(`Undid save: "${latest.snapshot.fullName}" returned to top of the deck.`);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, history, recreateContactFromSnapshot, persistHistory, contactsCtx, ui]);

  // Later-Phase Revert / Restore for a specific history entry
  const handleRevertHistoryEntry = useCallback(
    async (entry: QuickFilterHistoryEntry) => {
      if (isProcessing) return;
      setIsProcessing(true);
      try {
        const remainingHistory = history.filter((h) => h.historyId !== entry.historyId);
        if (entry.decision === 'archived') {
          const created = await recreateContactFromSnapshot(entry.snapshot, true);
          persistHistory(remainingHistory);
          if (created) {
            ui.notify(
              `Restored "${entry.snapshot.fullName}" to your contacts with Keep in Touch enabled!`
            );
          } else {
            ui.notify(`Restored "${entry.snapshot.fullName}" from history.`);
          }
        } else {
          await contactsCtx.patchContact(entry.contactId, {
            keepInTouch: Boolean(entry.previousKeepInTouch),
          });
          persistHistory(remainingHistory);
          ui.notify(
            `Reverted "${entry.snapshot.fullName}" to unreviewed state.`
          );
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, history, recreateContactFromSnapshot, persistHistory, contactsCtx, ui]
  );

  // Later-Phase Restore for a deleted Google tombstone not in local history
  const handleRestoreTombstoneOnly = useCallback(
    async (tombstone: GoogleTombstoneItem) => {
      if (isProcessing) return;
      setIsProcessing(true);
      try {
        await ui.unblockTombstone(tombstone.id);
        const restoredName = tombstone.contactName || 'Restored Contact';
        const res = await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'google',
            fullName: restoredName,
            phone: tombstone.contactPhone || null,
            email: tombstone.contactEmail || null,
            keepInTouch: true,
          }),
        });
        if (res.ok) {
          await Promise.all([contactsCtx.loadContacts(), ui.loadGoogleTombstones()]);
          ui.notify(`Restored "${restoredName}" and enabled Keep in Touch!`);
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, ui, contactsCtx]
  );

  // Toggle group membership directly on the active contact card
  const handleToggleContactGroup = useCallback(
    async (contact: ContactItem, groupId: number) => {
      const currentGroupIds = (contact.groups || []).map((g) => g.id);
      const isMember = currentGroupIds.includes(groupId);
      const nextGroupIds = isMember
        ? currentGroupIds.filter((id) => id !== groupId)
        : [...currentGroupIds, groupId];

      await contactsCtx.patchContact(contact.id, {
        groupIds: nextGroupIds,
      } as Partial<ContactItem>);
      await groupsCtx.loadGroups();
    },
    [contactsCtx, groupsCtx]
  );

  // Keyboard shortcuts for Deck mode: ArrowLeft, ArrowRight, Backspace, Z
  useEffect(() => {
    if (mode !== 'deck') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'ArrowLeft' && currentContact) {
        e.preventDefault();
        handleArchiveContact(currentContact);
      } else if (e.key === 'ArrowRight' && currentContact) {
        e.preventDefault();
        handleSaveKeepInTouch(currentContact);
      } else if ((e.key === 'Backspace' || e.key.toLowerCase() === 'z') && history.length > 0) {
        e.preventDefault();
        handleUndoLast();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    mode,
    currentContact,
    history.length,
    handleArchiveContact,
    handleSaveKeepInTouch,
    handleUndoLast,
  ]);

  // Pointer gesture handlers on the top card
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isProcessing || !currentContact) return;
    const target = e.target as HTMLElement | null;
    if (target && target.closest('button, a, input')) {
      return;
    }
    pointerStartRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    setIsDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture is unsupported in synthetic test env
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !pointerStartRef.current || pointerStartRef.current.id !== e.pointerId) {
      return;
    }
    const dx = e.clientX - pointerStartRef.current.x;
    const dy = (e.clientY - pointerStartRef.current.y) * 0.18;
    setDragX(dx);
    setDragY(dy);
  };

  const finishPointerGesture = (e: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
    if (!pointerStartRef.current || pointerStartRef.current.id !== e.pointerId) return;
    const finalDx = e.clientX - pointerStartRef.current.x;
    pointerStartRef.current = null;
    setIsDragging(false);

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }

    if (!cancelled && currentContact) {
      if (finalDx >= SWIPE_THRESHOLD) {
        setDragX(0);
        setDragY(0);
        handleSaveKeepInTouch(currentContact);
        return;
      }
      if (finalDx <= -SWIPE_THRESHOLD) {
        setDragX(0);
        setDragY(0);
        handleArchiveContact(currentContact);
        return;
      }
    }

    setDragX(0);
    setDragY(0);
  };

  // Deleted Google tombstones that are not already represented in local history
  const unrecordedDeletedTombstones = useMemo(() => {
    return ui.googleTombstones.filter((t) => {
      if (t.reason !== 'deleted') return false;
      const tName = (t.contactName || '').trim().toLowerCase();
      const tEmail = (t.contactEmail || '').trim().toLowerCase();
      const tPhone = (t.contactPhone || '').replace(/[^\d+]/g, '');

      const existsInHistory = history.some((h) => {
        if (h.decision !== 'archived') return false;
        const hName = (h.snapshot.fullName || '').trim().toLowerCase();
        const hEmail = (h.snapshot.email || '').trim().toLowerCase();
        const hPhone = (h.snapshot.phone || '').replace(/[^\d+]/g, '');
        if (tEmail && hEmail && tEmail === hEmail) return true;
        if (tPhone && hPhone && tPhone === hPhone) return true;
        if (tName && hName && tName === hName) return true;
        return false;
      });

      return !existsInHistory;
    });
  }, [ui.googleTombstones, history]);

  // Filtered History entries for History & Restore view
  const filteredHistoryEntries = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return history.filter((entry) => {
      if (historyFilter === 'archived' && entry.decision !== 'archived') return false;
      if (historyFilter === 'saved' && entry.decision !== 'saved') return false;
      if (!q) return true;

      const s = entry.snapshot;
      return (
        (s.fullName || '').toLowerCase().includes(q) ||
        (s.company || '').toLowerCase().includes(q) ||
        (s.jobTitle || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.phone || '').toLowerCase().includes(q) ||
        (s.notes || '').toLowerCase().includes(q)
      );
    });
  }, [history, historyFilter, historySearch]);

  const filteredUnrecordedTombstones = useMemo(() => {
    if (historyFilter === 'saved') return [];
    const q = historySearch.trim().toLowerCase();
    return unrecordedDeletedTombstones.filter((t) => {
      if (!q) return true;
      return (
        (t.contactName || '').toLowerCase().includes(q) ||
        (t.contactEmail || '').toLowerCase().includes(q) ||
        (t.contactPhone || '').toLowerCase().includes(q) ||
        (t.googleResourceName || '').toLowerCase().includes(q)
      );
    });
  }, [unrecordedDeletedTombstones, historyFilter, historySearch]);

  const archivedHistoryCount = useMemo(
    () => history.filter((h) => h.decision === 'archived').length + unrecordedDeletedTombstones.length,
    [history, unrecordedDeletedTombstones]
  );
  const savedHistoryCount = useMemo(
    () => history.filter((h) => h.decision === 'saved').length,
    [history]
  );
  const totalHistoryCount = archivedHistoryCount + savedHistoryCount;

  // Counts for deck filter pills
  const unreviewedCount = useMemo(
    () => contactsCtx.contacts.filter((c) => !reviewedContactIds.has(c.id)).length,
    [contactsCtx.contacts, reviewedContactIds]
  );
  const untrackedCount = useMemo(
    () => contactsCtx.contacts.filter((c) => !c.keepInTouch).length,
    [contactsCtx.contacts]
  );

  // Directional swipe intensities (0 to 1)
  const rightSwipeRatio = dragX > 15 ? Math.min(1, dragX / SWIPE_THRESHOLD) : 0;
  const leftSwipeRatio = dragX < -15 ? Math.min(1, Math.abs(dragX) / SWIPE_THRESHOLD) : 0;
  const cardRotationDeg = Number((dragX * 0.04).toFixed(2));

  return (
    <div className="space-y-6 pb-8">
      {/* Top Header & Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary shrink-0">
            <Sparkles className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Quick Filtering
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-well border border-border text-xs font-semibold tabular-nums text-foreground">
                {deckContacts.length} in deck
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted mt-0.5">
              Swipe right to Keep in Touch or swipe left to Archive &amp; Delete. Restore or revert any decision anytime.
            </p>
          </div>
        </div>

        {/* Mode Switcher: Swipe Deck vs History & Restore */}
        <div
          className="inline-flex items-center p-1 rounded-xl bg-well border border-border self-start md:self-auto"
          role="tablist"
          aria-label="Quick Filtering Mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'deck'}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
              mode === 'deck'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted hover:text-foreground'
            }`}
            onClick={() => setMode('deck')}
          >
            <Layers className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
            <span>Swipe Deck</span>
            <span className="px-1.5 py-0.2 rounded-md bg-well border border-border text-[10px] font-bold tabular-nums">
              {deckContacts.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={mode === 'history'}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
              mode === 'history'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted hover:text-foreground'
            }`}
            onClick={() => setMode('history')}
          >
            <History className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
            <span>History &amp; Restore</span>
            {totalHistoryCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-md bg-primary/15 text-primary text-[10px] font-bold tabular-nums">
                {totalHistoryCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {mode === 'deck' ? (
        <div className="space-y-6">
          {/* Deck Filter Bar: Unreviewed / Untracked / All Contacts + Group Filter + Undo Last */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-well border border-border rounded-2xl p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-muted px-2 flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Deck:</span>
              </span>
              {[
                { id: 'unreviewed', label: 'Unreviewed', count: unreviewedCount },
                { id: 'untracked', label: 'Untracked', count: untrackedCount },
                { id: 'all', label: 'All Contacts', count: contactsCtx.contacts.length },
              ].map((pill) => {
                const isSelected = deckFilter === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
                      isSelected
                        ? 'bg-primary text-primary-fg shadow-xs'
                        : 'bg-background border border-border text-muted hover:text-foreground'
                    }`}
                    onClick={() => setDeckFilter(pill.id as DeckFilterType)}
                  >
                    <span>{pill.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold tabular-nums ${
                        isSelected
                          ? 'bg-primary-fg/20 text-primary-fg'
                          : 'bg-well text-foreground'
                      }`}
                    >
                      {pill.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Optional Group Filter Pills & Immediate Undo Button */}
            <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-border">
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                <span className="text-[11px] font-semibold text-muted px-1 shrink-0">Group:</span>
                <button
                  type="button"
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
                    selectedGroupFilter === null
                      ? 'bg-foreground text-background'
                      : 'bg-background border border-border text-muted hover:text-foreground'
                  }`}
                  onClick={() => setSelectedGroupFilter(null)}
                >
                  All Groups
                </button>
                <button
                  type="button"
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
                    selectedGroupFilter === -1
                      ? 'bg-foreground text-background'
                      : 'bg-background border border-border text-muted hover:text-foreground'
                  }`}
                  onClick={() => setSelectedGroupFilter(-1)}
                >
                  Ungrouped
                </button>
                {groupsCtx.groups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
                      selectedGroupFilter === g.id
                        ? 'bg-primary text-primary-fg'
                        : 'bg-background border border-border text-muted hover:text-foreground'
                    }`}
                    onClick={() =>
                      setSelectedGroupFilter((prev) => (prev === g.id ? null : g.id))
                    }
                  >
                    {g.name}
                  </button>
                ))}
              </div>

              <button
                type="button"
                disabled={history.length === 0 || isProcessing}
                title="Undo most recent swipe (Backspace or Z)"
                className="px-3 py-1.5 rounded-xl bg-background hover:bg-card-hover border border-border text-xs font-semibold text-foreground flex items-center gap-1.5 motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                onClick={handleUndoLast}
              >
                <RotateCcw className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                <span>Undo Last</span>
              </button>
            </div>
          </div>

          {/* Interactive Single-Card Triage Deck */}
          {!currentContact ? (
            <div className="max-w-md mx-auto bg-card border border-border rounded-2xl p-8 text-center space-y-4 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-well border border-border flex items-center justify-center mx-auto text-primary">
                <Sparkles className="w-6 h-6" aria-hidden="true" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-lg font-bold text-foreground">
                  Deck Complete
                </h2>
                <p className="text-xs sm:text-sm text-muted">
                  You have triaged all contacts matching the current filter. Switch to All Contacts or inspect History &amp; Restore to review past choices.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                {deckFilter !== 'all' && (
                  <button
                    type="button"
                    className="px-4 py-2 rounded-xl bg-primary text-primary-fg text-xs font-semibold motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                    onClick={() => {
                      setDeckFilter('all');
                      setSelectedGroupFilter(null);
                    }}
                  >
                    Show All Contacts ({contactsCtx.contacts.length})
                  </button>
                )}
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl bg-well hover:bg-card-hover border border-border text-xs font-semibold text-foreground motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                  onClick={() => setMode('history')}
                >
                  Open History &amp; Restore ({totalHistoryCount})
                </button>
              </div>
            </div>
          ) : (
            <div className="max-w-md mx-auto space-y-5">
              {/* Card Stack Container */}
              <div className="relative pt-2 pb-4">
                {/* Subtle Next-Card Depth Layer Behind Active Card (uses bg-well, sibling to bg-card) */}
                {nextContact && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none select-none absolute inset-x-3 top-6 bottom-0 rounded-2xl bg-well border border-border opacity-70 scale-[0.96] translate-y-2 transition-transform duration-200"
                  />
                )}

                {/* Active Foreground Contact Card */}
                <div
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={(e) => finishPointerGesture(e, false)}
                  onPointerCancel={(e) => finishPointerGesture(e, true)}
                  style={{
                    transform: `translate3d(${dragX}px, ${dragY}px, 0) rotate(${cardRotationDeg}deg)`,
                  }}
                  className={`relative z-10 bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-sm select-none touch-pan-y cursor-grab active:cursor-grabbing ${
                    isDragging ? '' : 'transition-transform duration-200 ease-out'
                  }`}
                >
                  {/* Dynamic Directional Swipe Stamp Overlays */}
                  <div
                    aria-hidden={rightSwipeRatio === 0}
                    style={{ opacity: rightSwipeRatio }}
                    className="pointer-events-none absolute top-5 left-5 z-20 px-3.5 py-1.5 rounded-xl border-2 border-emerald-500 bg-emerald-500/15 text-emerald-500 font-extrabold text-xs sm:text-sm -rotate-6 transition-opacity duration-75"
                  >
                    KEEP IN TOUCH
                  </div>

                  <div
                    aria-hidden={leftSwipeRatio === 0}
                    style={{ opacity: leftSwipeRatio }}
                    className="pointer-events-none absolute top-5 right-5 z-20 px-3.5 py-1.5 rounded-xl border-2 border-red-700 bg-red-950/90 text-red-300 font-extrabold text-xs sm:text-sm rotate-6 transition-opacity duration-75"
                  >
                    ARCHIVE / DELETE
                  </div>

                  {/* Card Header: Avatar + Identity + Source Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <ProgressRingAvatar
                        name={currentContact.fullName}
                        progressPercent={currentContact.cadence?.progressPercent ?? 0}
                        status={currentContact.cadence?.status ?? 'untracked'}
                        size="lg"
                      />
                      <div className="min-w-0">
                        <h2 className="text-lg sm:text-xl font-bold text-foreground tracking-tight truncate">
                          {currentContact.fullName}
                        </h2>
                        {(currentContact.jobTitle || currentContact.company) && (
                          <p className="text-xs sm:text-sm text-muted flex items-center gap-1.5 truncate mt-0.5">
                            <Building2 className="w-3.5 h-3.5 shrink-0 text-muted" aria-hidden="true" />
                            <span className="truncate">
                              {[currentContact.jobTitle, currentContact.company]
                                .filter(Boolean)
                                .join(' at ')}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="px-2.5 py-0.5 rounded-full bg-well border border-border text-[11px] font-semibold text-muted capitalize">
                        {currentContact.source || 'local'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                          currentContact.keepInTouch
                            ? 'bg-success/15 text-success border border-success/30'
                            : 'bg-well text-muted border border-border'
                        }`}
                      >
                        {currentContact.keepInTouch ? 'Tracked' : 'Untracked'}
                      </span>
                    </div>
                  </div>

                  {/* Filled Contact Details Only */}
                  <div className="mt-5 space-y-2.5">
                    {currentContact.phone && (
                      <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-well border border-border text-xs sm:text-sm text-foreground">
                        <Phone className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                        <span className="font-mono truncate">{currentContact.phone}</span>
                      </div>
                    )}

                    {currentContact.email && (
                      <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-well border border-border text-xs sm:text-sm text-foreground">
                        <Mail className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                        <span className="truncate">{currentContact.email}</span>
                      </div>
                    )}

                    {currentContact.birthday && (
                      <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-well border border-border text-xs sm:text-sm text-foreground">
                        <Cake className="w-4 h-4 text-warning shrink-0" aria-hidden="true" />
                        <span>Birthday: {currentContact.birthday}</span>
                      </div>
                    )}

                    {currentContact.significantDate && (
                      <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-well border border-border text-xs sm:text-sm text-foreground">
                        <Calendar className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                        <span>
                          {currentContact.significantDateLabel || 'Significant Date'}:{' '}
                          {currentContact.significantDate}
                        </span>
                      </div>
                    )}

                    {currentContact.notes && (
                      <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-well border border-border text-xs text-foreground">
                        <FileText className="w-4 h-4 text-muted shrink-0 mt-0.5" aria-hidden="true" />
                        <p className="line-clamp-3 leading-relaxed whitespace-pre-line">
                          {currentContact.notes}
                        </p>
                      </div>
                    )}

                    {!currentContact.phone &&
                      !currentContact.email &&
                      !currentContact.birthday &&
                      !currentContact.significantDate &&
                      !currentContact.notes && (
                        <div className="px-3 py-4 rounded-xl bg-well border border-border text-center text-xs text-muted">
                          No phone, email, birthday, or notes recorded for this contact yet.
                        </div>
                      )}
                  </div>

                  {/* Interactive Group Membership Pills on the Card */}
                  <div className="mt-5 pt-4 border-t border-border space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-muted flex items-center gap-1.5">
                        <FolderKanban className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Assign Groups</span>
                      </span>
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                        onClick={() => contactsCtx.openContactDrawer(currentContact)}
                      >
                        <span>Inspect Full Profile</span>
                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      </button>
                    </div>

                    {groupsCtx.groups.length === 0 ? (
                      <p className="text-[11px] text-muted">
                        No groups created yet.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {groupsCtx.groups.map((group) => {
                          const isMember = currentContact.groups?.some((g) => g.id === group.id);
                          return (
                            <button
                              key={group.id}
                              type="button"
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
                                isMember
                                  ? 'bg-primary/15 border-primary/40 text-primary'
                                  : 'bg-well border-border text-muted hover:text-foreground'
                              }`}
                              onClick={() => handleToggleContactGroup(currentContact, group.id)}
                            >
                              {isMember && <Check className="w-3 h-3 shrink-0" aria-hidden="true" />}
                              <span>{group.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Subtle Gesture Hint Footer */}
                  <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted">
                    <span className="flex items-center gap-1">
                      <ArrowLeft className="w-3 h-3 text-overdue" aria-hidden="true" />
                      <span>Drag left or ← to Archive</span>
                    </span>
                    <span className="font-mono tabular-nums">
                      1 of {deckContacts.length}
                    </span>
                    <span className="flex items-center gap-1">
                      <span>Drag right or → to Save</span>
                      <ArrowRight className="w-3 h-3 text-success" aria-hidden="true" />
                    </span>
                  </div>
                </div>
              </div>

              {/* Primary Swipe Action Controls (Browser & Mobile Buttons) */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                <button
                  type="button"
                  disabled={isProcessing}
                  className="px-3.5 py-3 rounded-2xl bg-red-950/80 hover:bg-red-900/80 border border-red-700/60 text-red-200 font-semibold text-xs sm:text-sm flex flex-col sm:flex-row items-center justify-center gap-1.5 shadow-xs motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50"
                  onClick={() => handleArchiveContact(currentContact)}
                >
                  <Archive className="w-4 h-4 shrink-0 text-red-400" aria-hidden="true" />
                  <span>Discard (Archive)</span>
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  className="px-3.5 py-3 rounded-2xl bg-well hover:bg-card-hover border border-border text-foreground font-semibold text-xs sm:text-sm flex flex-col sm:flex-row items-center justify-center gap-1.5 motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50"
                  onClick={() => handleSkipContact(currentContact)}
                >
                  <SkipForward className="w-4 h-4 shrink-0 text-muted" aria-hidden="true" />
                  <span>Skip for Now</span>
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  className="px-3.5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm flex flex-col sm:flex-row items-center justify-center gap-1.5 shadow-xs motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50"
                  onClick={() => handleSaveKeepInTouch(currentContact)}
                >
                  <Heart className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Save (Keep in Touch)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Later-Phase Revert: History & Restore View */
        <div className="space-y-4">
          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search
                className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search triaged or archived contacts…"
                className="w-full pl-9 pr-9 py-2 rounded-xl bg-well border border-border text-xs sm:text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {historySearch && (
                <button
                  type="button"
                  aria-label="Clear history search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted hover:text-foreground active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary"
                  onClick={() => setHistorySearch('')}
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-well border border-border self-start sm:self-auto">
              {[
                { id: 'all', label: 'All', count: totalHistoryCount },
                { id: 'archived', label: 'Archived / Discarded', count: archivedHistoryCount },
                { id: 'saved', label: 'Saved / Keep in Touch', count: savedHistoryCount },
              ].map((tab) => {
                const isSelected = historyFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
                      isSelected
                        ? 'bg-background text-foreground shadow-xs'
                        : 'text-muted hover:text-foreground'
                    }`}
                    onClick={() => setHistoryFilter(tab.id as HistoryFilterType)}
                  >
                    <span>{tab.label}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-well border border-border font-bold tabular-nums">
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* History & Restore List */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
            {filteredHistoryEntries.length === 0 && filteredUnrecordedTombstones.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <div className="w-11 h-11 rounded-2xl bg-well border border-border flex items-center justify-center mx-auto text-muted">
                  <History className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    No triage history matches your filter
                  </p>
                  <p className="text-xs text-muted max-w-md mx-auto">
                    Contacts you swipe left (Archive / Delete) or swipe right (Save / Keep in Touch) are saved here so you can restore or revert them anytime.
                  </p>
                </div>
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl bg-primary text-primary-fg text-xs font-semibold motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                  onClick={() => setMode('deck')}
                >
                  Back to Swipe Deck
                </button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredHistoryEntries.map((entry) => {
                  const s = entry.snapshot;
                  const isArchived = entry.decision === 'archived';
                  return (
                    <div
                      key={entry.historyId}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-well/50 motion-safe:transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <ProgressRingAvatar
                          name={s.fullName}
                          progressPercent={isArchived ? 0 : 100}
                          status={isArchived ? 'untracked' : 'on_track'}
                          size="sm"
                        />
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-foreground truncate">
                              {s.fullName}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                                isArchived
                                  ? 'bg-red-950/60 border-red-700/50 text-red-300'
                                  : 'bg-emerald-500/15 border-emerald-500/35 text-emerald-500'
                              }`}
                            >
                              {isArchived ? 'Archived / Deleted' : 'Saved (Keep in Touch)'}
                            </span>
                            <span className="text-[11px] text-muted tabular-nums">
                              {new Date(entry.timestamp).toLocaleString()}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                            {(s.jobTitle || s.company) && (
                              <span>{[s.jobTitle, s.company].filter(Boolean).join(' at ')}</span>
                            )}
                            {s.phone && <span className="font-mono">{s.phone}</span>}
                            {s.email && <span>{s.email}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <button
                          type="button"
                          disabled={isProcessing}
                          className="px-3.5 py-1.5 rounded-xl bg-well hover:bg-card-hover border border-border text-xs font-semibold text-foreground flex items-center gap-1.5 motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50"
                          onClick={() => handleRevertHistoryEntry(entry)}
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                          <span>
                            {isArchived ? 'Revert / Restore Contact' : 'Revert / Restore to Deck'}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {filteredUnrecordedTombstones.map((tombstone) => {
                  const displayName = tombstone.contactName || 'Unnamed Archived Contact';
                  return (
                    <div
                      key={`tombstone-${tombstone.id}`}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-well/50 motion-safe:transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <ProgressRingAvatar
                          name={displayName}
                          progressPercent={0}
                          status="untracked"
                          size="sm"
                        />
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-foreground truncate">
                              {displayName}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-950/60 border border-red-700/50 text-red-300">
                              Archived Tombstone
                            </span>
                            {tombstone.createdAt && (
                              <span className="text-[11px] text-muted tabular-nums">
                                {new Date(tombstone.createdAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                            {tombstone.contactPhone && (
                              <span className="font-mono">{tombstone.contactPhone}</span>
                            )}
                            {tombstone.contactEmail && <span>{tombstone.contactEmail}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <button
                          type="button"
                          disabled={isProcessing}
                          className="px-3.5 py-1.5 rounded-xl bg-well hover:bg-card-hover border border-border text-xs font-semibold text-foreground flex items-center gap-1.5 motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50"
                          onClick={() => handleRestoreTombstoneOnly(tombstone)}
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                          <span>Revert / Restore Contact</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
