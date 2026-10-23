'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users,
  Search,
  Plus,
  GitMerge,
  Eye,
  SlidersHorizontal,
  RotateCcw,
  X,
  Phone,
  MessageCircle,
  Mail,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUp,
  ArrowDown,
  Edit2,
  Calendar,
  Building2,
  Briefcase,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import {
  ContactItem,
  ALL_COLUMN_METADATA,
  DEFAULT_COLUMN_ORDER,
  DEFAULT_COLUMN_WIDTHS,
} from '@/types/touchpoint';
import { useUI } from '@/context/UIContext';
import { useContacts } from '@/context/ContactsContext';
import { useGroups } from '@/context/GroupsContext';
import { ProgressRingAvatar } from '@/components/ProgressRingAvatar';
import { cleanPhoneForDial, formatDateByPattern } from '@/lib/formatters';

export interface ContactsDirectoryViewProps {
  onOpenContact?: (contact: ContactItem) => void;
  onOpenNewContact?: () => void;
  onOpenEditContact?: (contact: ContactItem) => void;
  onOpenMergeModal?: () => void;
}

export function ContactsDirectoryView({
  onOpenContact,
  onOpenNewContact,
  onOpenEditContact,
  onOpenMergeModal,
}: ContactsDirectoryViewProps) {
  const ui = useUI();
  const contactsCtx = useContacts();
  const groupsCtx = useGroups();

  const contacts = contactsCtx.contacts;
  const groups = groupsCtx.groups;
  const duplicates = contactsCtx.duplicates;
  const settingsState = ui.settingsState;

  // Filters & Search
  const searchQuery = ui.searchQuery;
  const setSearchQuery = ui.setSearchQuery;
  const searchFilterTab = ui.searchFilterTab;
  const setSearchFilterTab = ui.setSearchFilterTab;
  const searchFilterGroup = ui.searchFilterGroup;
  const setSearchFilterGroup = ui.setSearchFilterGroup;

  // Pagination
  const pageSize = contactsCtx.contactsPageSize;
  const currentPage = contactsCtx.contactsCurrentPage;
  const setPageSize = contactsCtx.setContactsPageSize;
  const setCurrentPage = contactsCtx.setContactsCurrentPage;

  // Columns & Layout
  const columnOrder = contactsCtx.columnOrder;
  const setColumnOrder = contactsCtx.setColumnOrder;
  const visibleColumns = contactsCtx.visibleColumns;
  const setVisibleColumns = contactsCtx.setVisibleColumns;
  const columnWidths = contactsCtx.columnWidths;
  const setColumnWidths = contactsCtx.setColumnWidths;
  const showColumnsPopover = contactsCtx.showColumnsPopover;
  const setShowColumnsPopover = contactsCtx.setShowColumnsPopover;

  // Selection
  const selectedContactIds = contactsCtx.selectedContactIds;
  const setSelectedContactIds = contactsCtx.setSelectedContactIds;

  // Local column resizing state
  const [resizingCol, setResizingCol] = useState<{
    id: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  // Column reordering & visibility handlers
  const toggleColumn = (colId: string) => {
    setVisibleColumns((prev) => {
      const next = prev.includes(colId) ? prev.filter((id) => id !== colId) : [...prev, colId];
      try {
        localStorage.setItem('touchpoint_columns', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const moveColumn = (colId: string, direction: 'up' | 'down') => {
    setColumnOrder((prev) => {
      const idx = prev.indexOf(colId);
      if (idx === -1) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      const [removed] = next.splice(idx, 1);
      next.splice(targetIdx, 0, removed);
      try {
        localStorage.setItem('touchpoint_column_order', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const moveColumnToTop = (colId: string) => {
    setColumnOrder((prev) => {
      const idx = prev.indexOf(colId);
      if (idx <= 0) return prev;
      const next = [...prev];
      const [removed] = next.splice(idx, 1);
      next.unshift(removed);
      try {
        localStorage.setItem('touchpoint_column_order', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const reorderColumns = (sourceId: string, targetId: string) => {
    setColumnOrder((prev) => {
      const srcIdx = prev.indexOf(sourceId);
      const tgtIdx = prev.indexOf(targetId);
      if (srcIdx === -1 || tgtIdx === -1 || srcIdx === tgtIdx) return prev;
      const next = [...prev];
      const [removed] = next.splice(srcIdx, 1);
      next.splice(tgtIdx, 0, removed);
      try {
        localStorage.setItem('touchpoint_column_order', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const resetColumnSettings = () => {
    const defaultVisible = [
      'firstName',
      'lastName',
      'name',
      'phone',
      'email',
      'birthday',
      'source',
      'company',
      'groups',
      'keepInTouch',
      'actions',
    ];
    setColumnOrder(DEFAULT_COLUMN_ORDER);
    setVisibleColumns(defaultVisible);
    setColumnWidths(DEFAULT_COLUMN_WIDTHS);
    try {
      localStorage.setItem('touchpoint_column_order', JSON.stringify(DEFAULT_COLUMN_ORDER));
      localStorage.setItem('touchpoint_columns', JSON.stringify(defaultVisible));
      localStorage.setItem('touchpoint_column_widths', JSON.stringify(DEFAULT_COLUMN_WIDTHS));
    } catch {}
  };

  // Mouse drag column resizing
  const handleResizeStart = (colId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const currentWidth = columnWidths[colId] || 120;
    setResizingCol({ id: colId, startX: e.clientX, startWidth: currentWidth });
  };

  const handleResizeMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!resizingCol) return;
      const deltaX = e.clientX - resizingCol.startX;
      const newWidth = Math.max(60, resizingCol.startWidth + deltaX);
      setColumnWidths((prev) => ({ ...prev, [resizingCol.id]: newWidth }));
    },
    [resizingCol, setColumnWidths]
  );

  const handleResizeMouseUp = useCallback(() => {
    if (resizingCol) {
      setResizingCol(null);
      try {
        localStorage.setItem('touchpoint_column_widths', JSON.stringify(columnWidths));
      } catch {}
    }
  }, [resizingCol, columnWidths]);

  useEffect(() => {
    if (resizingCol) {
      window.addEventListener('mousemove', handleResizeMouseMove);
      window.addEventListener('mouseup', handleResizeMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleResizeMouseMove);
        window.removeEventListener('mouseup', handleResizeMouseUp);
      };
    }
  }, [resizingCol, handleResizeMouseMove, handleResizeMouseUp]);

  // Filtered contacts calculation
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
      const matchName = c.fullName.toLowerCase().includes(q);
      const matchPhone = (c.phone || '').toLowerCase().includes(q);
      const matchEmail = (c.email || '').toLowerCase().includes(q);
      const matchCompany = (c.company || '').toLowerCase().includes(q);
      const matchTitle = (c.jobTitle || '').toLowerCase().includes(q);
      const matchNotes = (c.notes || '').toLowerCase().includes(q);
      const matchGroups = c.groups.some((g) => g.name.toLowerCase().includes(q));
      if (
        !matchName &&
        !matchPhone &&
        !matchEmail &&
        !matchCompany &&
        !matchTitle &&
        !matchNotes &&
        !matchGroups
      ) {
        return false;
      }
    }
    return true;
  });

  // Pagination metrics
  const totalContacts = filteredContacts.length;
  const totalPages = Math.max(1, Math.ceil(totalContacts / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalContacts);
  const paginatedContacts = filteredContacts.slice(startIndex, endIndex);

  const effectiveActiveColumns = columnOrder.filter((col) => visibleColumns.includes(col));

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedContactIds(paginatedContacts.map((c) => c.id));
    } else {
      setSelectedContactIds([]);
    }
  };

  const handleToggleContactSelect = (id: number) => {
    setSelectedContactIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const clickCountRef = useRef<{ [id: number]: number }>({});
  const clickTimerRef = useRef<{ [id: number]: NodeJS.Timeout }>({});

  useEffect(() => {
    return () => {
      Object.values(clickTimerRef.current).forEach((t) => clearTimeout(t));
    };
  }, []);

  const handleRowClick = (c: ContactItem, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('input, a, button, [role="button"]')) return;

    const currentCount = (clickCountRef.current[c.id] || 0) + 1;
    clickCountRef.current[c.id] = currentCount;

    if (currentCount === 1) {
      clickTimerRef.current[c.id] = setTimeout(() => {
        clickCountRef.current[c.id] = 0;
        delete clickTimerRef.current[c.id];
        if (onOpenContact) onOpenContact(c);
        else contactsCtx.openContactDrawer(c);
      }, 260);
    } else if (currentCount >= 2) {
      if (clickTimerRef.current[c.id]) {
        clearTimeout(clickTimerRef.current[c.id]);
        delete clickTimerRef.current[c.id];
      }
      clickCountRef.current[c.id] = 0;
      handleToggleContactSelect(c.id);
    }
  };

  const handleToggleKeepInTouch = async (contact: ContactItem) => {
    const updated = !contact.keepInTouch;
    const success = await contactsCtx.patchContact(contact.id, { keepInTouch: updated });
    if (success) {
      ui.notify(
        updated
          ? `Enabled cadence tracking for ${contact.fullName}.`
          : `Paused cadence tracking for ${contact.fullName}.`
      );
      await contactsCtx.loadContacts();
    }
  };

  const handleBulkAction = async (
    action: 'assign_group' | 'remove_group' | 'enable_keep_in_touch' | 'disable_keep_in_touch' | 'delete',
    groupId?: number
  ) => {
    if (selectedContactIds.length === 0) return;
    const count = selectedContactIds.length;
    const ok = await contactsCtx.bulkAction(action, groupId, selectedContactIds);
    if (ok) {
      setSelectedContactIds([]);
      await Promise.all([
        contactsCtx.loadContacts(),
        groupsCtx.loadGroups(),
        contactsCtx.loadDuplicates(),
      ]);
      ui.notify(`Updated ${count} contact${count === 1 ? '' : 's'}.`);
    } else {
      ui.notify('Bulk operation failed.');
    }
  };

  return (
    <div className="space-y-4">
      {/* View Header */}
      <div className="flex flex-wrap items-end justify-between gap-3 pb-3 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Contacts Directory{' '}
            <span className="text-base font-semibold text-muted tabular-nums">
              ({contacts.length})
            </span>
          </h1>
          <p className="text-[13px] text-muted mt-0.5">
            Manage Google, Local, and vCard contacts, company details, notes, and cadence tracking
          </p>
        </div>
        <div className="flex items-center gap-2 text-[13px]">
          {duplicates.length > 0 && (
            <button
              type="button"
              onClick={onOpenMergeModal || (() => contactsCtx.setShowMergeModal(true))}
              className="min-h-[34px] px-3.5 py-1.5 rounded-lg border border-warning/40 bg-warning/15 text-foreground font-medium flex items-center gap-1.5 hover:bg-warning/25 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <GitMerge className="w-4 h-4 text-warning" aria-hidden="true" />
              <span>Merge Duplicates ({duplicates.length})…</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenNewContact || (() => contactsCtx.setShowNewContactModal(true))}
            className="min-h-[34px] px-4 py-1.5 rounded-lg bg-primary hover:opacity-95 text-primary-fg font-semibold flex items-center gap-1.5 shadow-xs motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>New Local Contact…</span>
          </button>
        </div>
      </div>

      {/* Scope & Filter Bar */}
      <div className="bg-well border border-border rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-[13px]">
        <div className="flex-1 min-w-[200px] sm:min-w-[240px] min-h-[34px] flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-background border border-border focus-within:border-primary motion-safe:transition-colors">
          <Search className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter contacts… (⌘K)"
            aria-label="Filter contacts"
            className="w-full bg-transparent border-none text-[13px] text-foreground placeholder:text-muted focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear filter"
              className="min-h-[24px] min-w-[24px] flex items-center justify-center text-muted hover:text-foreground shrink-0 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full py-0.5">
          {[
            { id: 'all', label: `All (${contacts.length})` },
            {
              id: 'due',
              label: `Due Today (${
                contacts.filter(
                  (c) => c.keepInTouch && ['overdue', 'due_today'].includes(c.cadence?.status)
                ).length
              })`,
            },
            {
              id: 'birthdays',
              label: `Birthdays (${contacts.filter((c) => Boolean(c.birthday)).length})`,
            },
            {
              id: 'tracked',
              label: `Tracked (${contacts.filter((c) => c.keepInTouch).length})`,
            },
          ].map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setSearchFilterTab(chip.id as typeof searchFilterTab)}
              className={`min-h-[32px] px-3 py-1 rounded-lg border text-[12px] font-medium tabular-nums motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                searchFilterTab === chip.id
                  ? 'bg-primary text-primary-fg border-primary font-semibold'
                  : 'bg-background border-border text-muted hover:text-foreground hover:bg-card-hover'
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
            className="min-h-[32px] px-2.5 py-1 rounded-lg bg-background border border-border text-[12px] font-medium text-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
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
              className="min-h-[32px] px-2.5 py-1 text-[12px] font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset
            </button>
          )}

          {/* Columns Customizer Popover Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowColumnsPopover(!showColumnsPopover)}
              className="min-h-[32px] px-3 py-1 rounded-lg bg-background border border-border text-[12px] font-medium text-foreground hover:bg-card-hover flex items-center gap-1.5 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Eye className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
              <span>Columns ({effectiveActiveColumns.length})</span>
            </button>

            {showColumnsPopover && (
              <div className="absolute right-0 top-10 z-30 bg-well border border-border rounded-xl p-3.5 w-72 space-y-2.5 text-[12px] animate-in fade-in duration-100 shadow-md">
                <div className="font-semibold pb-2 border-b border-border text-foreground flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                    <span>Customize Columns</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={resetColumnSettings}
                      title="Reset to default order"
                      className="text-[11px] text-muted hover:text-foreground flex items-center gap-1 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RotateCcw className="w-3 h-3" aria-hidden="true" /> Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowColumnsPopover(false)}
                      aria-label="Close column customizer"
                      className="min-h-[24px] min-w-[24px] text-muted hover:text-foreground text-xs focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-muted leading-snug">
                  Toggle visibility, reorder columns, or drag dividers in the table header to resize.
                </p>
                <div className="space-y-1 max-h-72 overflow-y-auto pr-0.5">
                  {columnOrder.map((colId, index) => {
                    const meta = ALL_COLUMN_METADATA.find((m) => m.id === colId);
                    if (!meta) return null;
                    const isVisible = visibleColumns.includes(colId);
                    return (
                      <div
                        key={colId}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', colId);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const sourceColId = e.dataTransfer.getData('text/plain');
                          if (sourceColId && sourceColId !== colId) {
                            reorderColumns(sourceColId, colId);
                          }
                        }}
                        className="flex items-center justify-between gap-1 p-1.5 rounded-lg hover:bg-background border border-transparent hover:border-border transition group"
                      >
                        <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0 select-none">
                          <input
                            type="checkbox"
                            checked={isVisible}
                            onChange={() => toggleColumn(colId)}
                            className="rounded border-border text-primary focus:ring-0"
                          />
                          <span
                            className={`truncate ${
                              isVisible ? 'text-foreground font-medium' : 'text-muted'
                            }`}
                          >
                            {meta.label}
                          </span>
                        </label>
                        <div className="flex items-center gap-0.5 shrink-0 opacity-80 group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => moveColumnToTop(colId)}
                            title="Move to 1st place"
                            className="px-1.5 py-0.5 text-[11px] rounded bg-background border border-border hover:bg-primary hover:text-primary-fg text-muted font-semibold focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            1st
                          </button>
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => moveColumn(colId, 'up')}
                            title="Move up"
                            aria-label={`Move ${meta.label} up`}
                            className="p-1 rounded bg-background border border-border hover:bg-card-hover disabled:opacity-30 text-muted focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:cursor-not-allowed"
                          >
                            <ArrowUp className="w-3 h-3" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            disabled={index === columnOrder.length - 1}
                            onClick={() => moveColumn(colId, 'down')}
                            title="Move down"
                            aria-label={`Move ${meta.label} down`}
                            className="p-1 rounded bg-background border border-border hover:bg-card-hover disabled:opacity-30 text-muted focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:cursor-not-allowed"
                          >
                            <ArrowDown className="w-3 h-3" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedContactIds.length > 0 && (
        <div className="bg-well border border-primary/50 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-[13px] shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="sbb-baton sbb-baton-overdue tabular-nums">
              {selectedContactIds.length} Selected
            </span>
            <button
              type="button"
              onClick={() => setSelectedContactIds([])}
              className="text-[12px] font-medium text-muted hover:text-foreground underline active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              Deselect All
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkAction('assign_group', Number(e.target.value));
                }
              }}
              aria-label="Assign selected contacts to group"
              className="min-h-[32px] px-2.5 py-1 rounded-lg bg-background border border-border text-foreground font-medium text-[12px] cursor-pointer hover:border-primary focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              <option value="" disabled>
                + Assign to Group…
              </option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.intervalDays > 0 ? `${g.intervalDays}d` : 'manual'})
                </option>
              ))}
            </select>

            <select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkAction('remove_group', Number(e.target.value));
                }
              }}
              aria-label="Remove selected contacts from group"
              className="min-h-[32px] px-2.5 py-1 rounded-lg bg-background border border-border text-foreground font-medium text-[12px] cursor-pointer hover:border-primary focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              <option value="" disabled>
                − Remove from Group…
              </option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => handleBulkAction('enable_keep_in_touch')}
              className="min-h-[32px] px-2.5 py-1 rounded-lg bg-background border border-border hover:bg-card-hover text-foreground font-medium text-[12px] motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              Enable Keep in Touch
            </button>
            <button
              type="button"
              onClick={() => handleBulkAction('disable_keep_in_touch')}
              className="min-h-[32px] px-2.5 py-1 rounded-lg bg-background border border-border hover:bg-card-hover text-muted hover:text-foreground font-medium text-[12px] motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              Disable Keep in Touch
            </button>
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    `Are you sure you want to delete ${selectedContactIds.length} contacts?`
                  )
                ) {
                  handleBulkAction('delete');
                }
              }}
              className="min-h-[32px] px-3 py-1 rounded-lg bg-overdue text-primary-fg hover:opacity-90 font-semibold text-[12px] flex items-center gap-1.5 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Delete Selected</span>
            </button>
          </div>
        </div>
      )}

      {/* Directory Table Container */}
      <div className="border border-border rounded-xl overflow-hidden bg-background">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border bg-well text-muted font-medium text-[12px] select-none">
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      paginatedContacts.length > 0 &&
                      paginatedContacts.every((c) => selectedContactIds.includes(c.id))
                    }
                    onChange={handleSelectAll}
                    aria-label="Select all contacts on current page"
                    className="rounded border-border text-primary focus:ring-0"
                  />
                </th>

                {effectiveActiveColumns.map((colId) => {
                  const meta = ALL_COLUMN_METADATA.find((m) => m.id === colId);
                  if (!meta) return null;
                  const width = columnWidths[colId] || 120;
                  return (
                    <th
                      key={colId}
                      style={{ width: `${width}px`, minWidth: '60px' }}
                      className="p-3 relative font-semibold text-foreground group"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate">{meta.label}</span>
                      </div>
                      <div
                        onMouseDown={(e) => handleResizeStart(colId, e)}
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/50 group-hover:bg-border transition-colors"
                        title="Drag to resize column"
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-border text-foreground">
              {paginatedContacts.length === 0 ? (
                <tr>
                  <td
                    colSpan={effectiveActiveColumns.length + 1}
                    className="p-12 text-center text-muted"
                  >
                    <div className="space-y-2">
                      <p className="text-sm font-medium">No contacts match current filters</p>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setSearchFilterTab('all');
                          setSearchFilterGroup(null);
                        }}
                        className="text-xs text-primary hover:underline font-semibold focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Reset all filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedContacts.map((c) => {
                  const isSelected = selectedContactIds.includes(c.id);
                  return (
                    <tr
                      key={c.id}
                      onClick={(e) => handleRowClick(c, e)}
                      className={`hover:bg-well/50 cursor-pointer motion-safe:transition-colors motion-safe:duration-160 ${
                        isSelected ? 'bg-primary/5' : ''
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleContactSelect(c.id)}
                          aria-label={`Select ${c.fullName}`}
                          className="rounded border-border text-primary focus:ring-0"
                        />
                      </td>

                      {effectiveActiveColumns.map((colId) => {
                        if (colId === 'avatar') {
                          return (
                            <td key={colId} className="p-3">
                              <ProgressRingAvatar
                                name={c.fullName}
                                progressPercent={c.cadence?.progressPercent || 0}
                                status={c.cadence?.status || 'untracked'}
                                size="sm"
                              />
                            </td>
                          );
                        }

                        if (colId === 'name' || colId === 'fullName') {
                          const batonClass =
                            c.cadence?.status === 'overdue'
                              ? 'sbb-baton sbb-baton-overdue'
                              : c.cadence?.status === 'due_today'
                              ? 'sbb-baton sbb-baton-warning'
                              : c.cadence?.status === 'due_soon'
                              ? 'sbb-baton sbb-baton-due'
                              : 'sbb-baton sbb-baton-ok';
                          const batonLabel = !c.keepInTouch
                            ? 'Off'
                            : (c.cadence?.daysUntilDue ?? 0) < 0
                            ? `-${String(Math.abs(c.cadence?.daysUntilDue ?? 0)).padStart(2, '0')}d`
                            : c.cadence?.daysUntilDue === 0
                            ? 'Today'
                            : `+${String(c.cadence?.daysUntilDue ?? 0).padStart(2, '0')}d`;
                          return (
                            <td key={colId} className="p-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <ProgressRingAvatar
                                    name={c.fullName}
                                    progressPercent={c.cadence?.progressPercent || 0}
                                    status={c.cadence?.status || 'untracked'}
                                    size="sm"
                                  />
                                  <span className="font-semibold text-foreground hover:text-primary truncate">
                                    {c.fullName}
                                  </span>
                                </div>
                                {c.keepInTouch && (
                                  <span className={`${batonClass} shrink-0 tabular-nums`}>
                                    {batonLabel}
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        }

                        if (colId === 'firstName') {
                          return (
                            <td key={colId} className="p-3 text-foreground font-medium truncate">
                              {c.firstName || '—'}
                            </td>
                          );
                        }

                        if (colId === 'lastName') {
                          return (
                            <td key={colId} className="p-3 text-foreground font-medium truncate">
                              {c.lastName || '—'}
                            </td>
                          );
                        }

                        if (colId === 'phone') {
                          const dialPhone = cleanPhoneForDial(c.phone);
                          return (
                            <td key={colId} className="p-3">
                              {c.phone ? (
                                <div className="flex items-center gap-1.5">
                                  <a
                                    href={`tel:${dialPhone}`}
                                    className="text-foreground hover:text-primary font-mono text-xs truncate"
                                  >
                                    {c.phone}
                                  </a>
                                  <a
                                    href={`https://wa.me/${dialPhone.replace('+', '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Open WhatsApp chat"
                                    aria-label={`WhatsApp chat with ${c.fullName}`}
                                    className="p-1 text-muted hover:text-success"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                                  </a>
                                </div>
                              ) : (
                                <span className="text-muted text-xs">none</span>
                              )}
                            </td>
                          );
                        }

                        if (colId === 'email') {
                          return (
                            <td key={colId} className="p-3">
                              {c.email ? (
                                <a
                                  href={`mailto:${c.email}`}
                                  className="text-muted hover:text-foreground text-xs truncate flex items-center gap-1"
                                >
                                  <Mail className="w-3 h-3 text-muted shrink-0" aria-hidden="true" />
                                  <span className="truncate">{c.email}</span>
                                </a>
                              ) : (
                                <span className="text-muted text-xs">none</span>
                              )}
                            </td>
                          );
                        }

                        if (colId === 'company') {
                          return (
                            <td key={colId} className="p-3 text-muted text-xs truncate">
                              {c.company ? (
                                <span className="flex items-center gap-1 truncate">
                                  <Building2 className="w-3 h-3 text-muted shrink-0" aria-hidden="true" />
                                  <span className="truncate">{c.company}</span>
                                </span>
                              ) : null}
                            </td>
                          );
                        }

                        if (colId === 'jobTitle') {
                          return (
                            <td key={colId} className="p-3 text-muted text-xs truncate">
                              {c.jobTitle ? (
                                <span className="flex items-center gap-1 truncate">
                                  <Briefcase className="w-3 h-3 text-muted shrink-0" aria-hidden="true" />
                                  <span className="truncate">{c.jobTitle}</span>
                                </span>
                              ) : null}
                            </td>
                          );
                        }

                        if (colId === 'groups') {
                          return (
                            <td key={colId} className="p-3">
                              <div className="flex flex-wrap gap-1 max-w-[180px]">
                                {c.groups.length > 0 ? (
                                  c.groups.map((g) => (
                                    <span
                                      key={g.id}
                                      style={{ borderColor: g.color || 'var(--tp-border)' }}
                                      className="text-[11px] px-2 py-0.5 rounded-md bg-well border text-foreground font-medium truncate"
                                    >
                                      {g.name}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-muted text-xs">none</span>
                                )}
                              </div>
                            </td>
                          );
                        }

                        if (colId === 'birthday') {
                          return (
                            <td key={colId} className="p-3 text-xs text-muted tabular-nums">
                              {c.birthday ? (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-muted shrink-0" aria-hidden="true" />
                                  <span>{formatDateByPattern(c.birthday, settingsState.dateFormat)}</span>
                                </span>
                              ) : (
                                <span className="text-muted text-xs">none</span>
                              )}
                            </td>
                          );
                        }

                        if (colId === 'significantDates') {
                          const allDates: Array<{ label: string; date: string }> = [];
                          if (c.importantDates && c.importantDates.length > 0) {
                            allDates.push(...c.importantDates);
                          } else if (c.significantDate) {
                            allDates.push({ label: 'Milestone', date: c.significantDate });
                          }
                          return (
                            <td key={colId} className="p-3 text-xs">
                              <div className="flex flex-wrap items-center gap-1 max-w-[200px]">
                                {allDates.length > 0 ? (
                                  allDates.map((d, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-well border border-border text-foreground text-[11px] font-medium shrink-0"
                                    >
                                      <Calendar className="w-3 h-3 text-muted shrink-0" aria-hidden="true" />
                                      <span className="font-semibold">{d.label}:</span>
                                      <span className="font-mono tabular-nums">
                                        {formatDateByPattern(d.date, settingsState.dateFormat)}
                                      </span>
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-muted text-xs">none</span>
                                )}
                              </div>
                            </td>
                          );
                        }

                        if (colId === 'notes') {
                          return (
                            <td key={colId} className="p-3 text-muted text-xs truncate max-w-[200px]">
                              {c.notes || <span className="text-muted text-xs">none</span>}
                            </td>
                          );
                        }

                        if (colId === 'lastContacted') {
                          return (
                            <td key={colId} className="p-3 font-mono text-xs text-muted tabular-nums">
                              {c.lastContactedAt
                                ? formatDateByPattern(c.lastContactedAt, settingsState.dateFormat)
                                : 'Never'}
                            </td>
                          );
                        }

                        if (colId === 'source') {
                          return (
                            <td key={colId} className="p-3 text-xs">
                              <span className="px-2 py-0.5 rounded bg-well border border-border text-muted font-medium capitalize">
                                {c.source}
                              </span>
                            </td>
                          );
                        }

                        if (colId === 'cadence') {
                          return (
                            <td key={colId} className="p-3 text-xs">
                              {c.keepInTouch ? (
                                <div className="space-y-0.5">
                                  <div className="font-medium text-foreground">
                                    Every {c.cadence?.effectiveIntervalDays || 30}d
                                  </div>
                                  <div className="text-[11px] text-muted">
                                    Next: {c.cadence?.nextDueDate || 'Not set'}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted text-[11px]">Untracked</span>
                              )}
                            </td>
                          );
                        }

                        if (colId === 'keepInTouch') {
                          return (
                            <td key={colId} className="p-3">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={c.keepInTouch}
                                aria-label={`Toggle cadence tracking for ${c.fullName}`}
                                onClick={() => handleToggleKeepInTouch(c)}
                                className={`w-8 h-4 rounded-full p-0.5 flex items-center transition-colors motion-safe:duration-160 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
                                  c.keepInTouch ? 'bg-primary' : 'bg-muted/40'
                                }`}
                              >
                                <span
                                  className={`w-3 h-3 rounded-full bg-white shadow transition-transform motion-safe:duration-160 ${
                                    c.keepInTouch ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </td>
                          );
                        }

                        if (colId === 'actions') {
                          return (
                            <td key={colId} className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    onOpenContact
                                      ? onOpenContact(c)
                                      : contactsCtx.openContactDrawer(c)
                                  }
                                  title="Open details"
                                  aria-label={`Open details for ${c.fullName}`}
                                  className="p-1.5 rounded-lg hover:bg-well text-muted hover:text-foreground motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onOpenEditContact
                                      ? onOpenEditContact(c)
                                      : contactsCtx.openEditContact(c)
                                  }
                                  title="Edit contact"
                                  aria-label={`Edit ${c.fullName}`}
                                  className="p-1.5 rounded-lg hover:bg-well text-muted hover:text-primary motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                                </button>
                              </div>
                            </td>
                          );
                        }

                        return (
                          <td key={colId} className="p-3 text-muted text-xs truncate">
                            {null}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination Bar */}
        <div className="p-3 border-t border-border bg-well flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              aria-label="Select rows per page"
              className="px-2 py-1 rounded bg-background border border-border text-foreground font-medium focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              {[10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span className="text-muted ml-2">
              Showing {totalContacts > 0 ? startIndex + 1 : 0} to {endIndex} of {totalContacts}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage(1)}
              title="First page"
              aria-label="Go to first page"
              className="p-1.5 rounded hover:bg-background border border-border disabled:opacity-30 text-foreground motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:cursor-not-allowed"
            >
              <ChevronsLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage(Math.max(1, safeCurrentPage - 1))}
              title="Previous page"
              aria-label="Go to previous page"
              className="p-1.5 rounded hover:bg-background border border-border disabled:opacity-30 text-foreground motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <span className="px-3 py-1 font-medium text-foreground">
              Page {safeCurrentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage(Math.min(totalPages, safeCurrentPage + 1))}
              title="Next page"
              aria-label="Go to next page"
              className="p-1.5 rounded hover:bg-background border border-border disabled:opacity-30 text-foreground motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              title="Last page"
              aria-label="Go to last page"
              className="p-1.5 rounded hover:bg-background border border-border disabled:opacity-30 text-foreground motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:cursor-not-allowed"
            >
              <ChevronsRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
