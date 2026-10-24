'use client';

import React, { useState, useMemo } from 'react';
import {
  Archive,
  Search,
  RefreshCw,
  Trash2,
  GitMerge,
  Phone,
  Mail,
  Copy,
  Check,
  CheckSquare,
  Square,
  AlertCircle,
  ExternalLink,
  X,
  UserX,
} from 'lucide-react';
import { useUI } from '@/context/UIContext';
import { GoogleTombstoneItem } from '@/types/touchpoint';

export function ArchivedContactsView() {
  const ui = useUI();
  const {
    googleTombstones,
    loadGoogleTombstones,
    unblockTombstone,
    unblockTombstones,
    clearAllDeletedTombstones,
    runGoogleSync,
    syncLoading,
    setActiveTab,
  } = ui;

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'deleted' | 'merged'>('all');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId((prev) => (prev === id ? null : prev));
    }, 1800);
  };

  // Filtered tombstones
  const filteredTombstones = useMemo(() => {
    return googleTombstones.filter((item) => {
      // Filter by type
      if (filterType !== 'all' && item.reason !== filterType) {
        return false;
      }

      // Filter by query
      if (!search.trim()) return true;
      const q = search.toLowerCase().trim();
      const name = (item.contactName || '').toLowerCase();
      const phone = (item.contactPhone || '').toLowerCase();
      const email = (item.contactEmail || '').toLowerCase();
      const googleId = (item.googleResourceName || '').toLowerCase();
      const target = (item.targetContactName || '').toLowerCase();

      return (
        name.includes(q) ||
        phone.includes(q) ||
        email.includes(q) ||
        googleId.includes(q) ||
        target.includes(q)
      );
    });
  }, [googleTombstones, filterType, search]);

  // Counts
  const totalCount = googleTombstones.length;
  const deletedCount = useMemo(
    () => googleTombstones.filter((t) => t.reason === 'deleted').length,
    [googleTombstones]
  );
  const mergedCount = useMemo(
    () => googleTombstones.filter((t) => t.reason === 'merged').length,
    [googleTombstones]
  );

  // Selection handlers
  const isAllSelected =
    filteredTombstones.length > 0 &&
    filteredTombstones.every((t) => selectedIds.includes(t.id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds((prev) =>
        prev.filter((id) => !filteredTombstones.some((t) => t.id === id))
      );
    } else {
      const visibleIds = filteredTombstones.map((t) => t.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleToggleRow = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Bulk unblock
  const handleBulkUnblock = async () => {
    if (selectedIds.length === 0) return;
    if (
      !confirm(
        `Are you sure you want to unblock ${selectedIds.length} contact(s)? They will become eligible for re-import on the next Google Sync.`
      )
    ) {
      return;
    }
    setIsProcessing(true);
    try {
      const ok = await unblockTombstones(selectedIds);
      if (ok) {
        setSelectedIds([]);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Single unblock
  const handleSingleUnblock = async (item: GoogleTombstoneItem) => {
    const label = item.contactName || item.googleResourceName;
    if (
      !confirm(
        `Unblock "${label}" from Google sync? It can be re-imported on the next Google Sync.`
      )
    ) {
      return;
    }
    setIsProcessing(true);
    try {
      await unblockTombstone(item.id);
      setSelectedIds((prev) => prev.filter((id) => id !== item.id));
    } finally {
      setIsProcessing(false);
    }
  };

  // Clear all deleted
  const handleClearAllDeleted = async () => {
    if (
      !confirm(
        `Are you sure you want to unblock ALL ${deletedCount} deleted Google contacts? On the next Google Sync, they will be re-imported into Touchpoint.`
      )
    ) {
      return;
    }
    setIsProcessing(true);
    try {
      await clearAllDeletedTombstones();
      setSelectedIds([]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  Archived Contacts
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-well border border-border text-xs font-semibold tabular-nums text-muted">
                  {totalCount}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted mt-0.5">
                Manage blocked Google sync tombstones. Contacts deleted or merged in Touchpoint stay archived here to prevent unintended re-imports.
              </p>
            </div>
          </div>
        </div>

        {/* Global Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={syncLoading || isProcessing}
            onClick={() => runGoogleSync(false)}
            className="px-3 py-2 rounded-lg bg-well hover:bg-card-hover border border-border flex items-center gap-2 text-xs font-semibold text-foreground motion-safe:transition-colors motion-safe:duration-160 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
            title="Run Google Contacts Sync"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncLoading ? 'animate-spin text-primary' : 'text-muted'}`} />
            <span>Sync Contacts</span>
          </button>

          {deletedCount > 0 && (
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleClearAllDeleted}
              className="px-3 py-2 rounded-lg bg-well hover:bg-overdue/10 border border-border hover:border-overdue/30 text-xs font-medium text-foreground hover:text-overdue motion-safe:transition-colors motion-safe:duration-160 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
              title="Unblock all deleted contacts so they can be re-imported"
            >
              <span>Unblock All Deleted ({deletedCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Field */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, email, Google ID…"
            className="w-full pl-9 pr-9 py-2 bg-card border border-border rounded-xl text-xs sm:text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary motion-safe:transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-foreground rounded-md"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-well border border-border rounded-xl self-start sm:self-auto text-xs">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg font-medium motion-safe:transition-colors ${
              filterType === 'all'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted hover:text-foreground'
            }`}
          >
            All ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('deleted')}
            className={`px-3 py-1.5 rounded-lg font-medium motion-safe:transition-colors flex items-center gap-1.5 ${
              filterType === 'deleted'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted hover:text-foreground'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-overdue" />
            Deleted ({deletedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('merged')}
            className={`px-3 py-1.5 rounded-lg font-medium motion-safe:transition-colors flex items-center gap-1.5 ${
              filterType === 'merged'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted hover:text-foreground'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            Merged ({mergedCount})
          </button>
        </div>
      </div>

      {/* Multi-selection Action Toolbar */}
      {selectedIds.length > 0 && (
        <div className="bg-well border border-primary/50 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm animate-in fade-in duration-150">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-0.5 rounded-full bg-primary text-primary-fg font-bold text-xs tabular-nums">
              {selectedIds.length} Selected
            </span>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-xs text-muted hover:text-foreground underline motion-safe:transition-colors"
            >
              Deselect All
            </button>
            {selectedIds.length < filteredTombstones.length && (
              <button
                type="button"
                onClick={() =>
                  setSelectedIds(filteredTombstones.map((t) => t.id))
                }
                className="text-xs text-primary hover:underline font-medium"
              >
                Select all {filteredTombstones.length} filtered
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleBulkUnblock}
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-fg hover:opacity-90 font-semibold text-xs flex items-center gap-1.5 shadow-sm motion-safe:transition-all active:scale-[0.97] disabled:opacity-50"
              title="Unblock selected contacts so they can be re-imported from Google"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Unblock Selected ({selectedIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Table / Directory */}
      <div className="border border-border rounded-xl overflow-hidden bg-card shadow-xs">
        {filteredTombstones.length === 0 ? (
          <div className="p-12 text-center text-muted space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-well border border-border flex items-center justify-center mx-auto text-muted">
              {search || filterType !== 'all' ? (
                <UserX className="w-6 h-6" />
              ) : (
                <Archive className="w-6 h-6" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {search || filterType !== 'all'
                  ? 'No archived contacts match your search'
                  : 'No contacts are currently archived'}
              </p>
              <p className="text-xs text-muted max-w-md mx-auto mt-1">
                {search || filterType !== 'all'
                  ? 'Try clearing your search query or switching the filter tab above.'
                  : 'When you delete or merge Google contacts in Touchpoint, they are safely recorded here so Google Sync never re-imports them without your permission.'}
              </p>
            </div>
            {(search || filterType !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setFilterType('all');
                }}
                className="px-3 py-1.5 rounded-lg bg-well border border-border text-xs font-semibold text-primary hover:bg-card-hover"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-[13px]">
              <thead>
                <tr className="border-b border-border bg-well text-muted font-medium text-[11px] sm:text-xs select-none">
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleToggleSelectAll}
                      aria-label="Select all visible archived contacts"
                      className="rounded border-border text-primary focus:ring-0 cursor-pointer"
                    />
                  </th>
                  <th className="p-3 font-semibold text-foreground min-w-[180px]">Contact Name</th>
                  <th className="p-3 font-semibold text-foreground min-w-[140px]">Phone Number</th>
                  <th className="p-3 font-semibold text-foreground min-w-[180px]">Email Address</th>
                  <th className="p-3 font-semibold text-foreground min-w-[130px]">Status</th>
                  <th className="p-3 font-semibold text-foreground min-w-[160px]">Google ID</th>
                  <th className="p-3 font-semibold text-foreground min-w-[100px]">Date Blocked</th>
                  <th className="p-3 font-semibold text-foreground text-right w-24">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border text-foreground">
                {filteredTombstones.map((item) => {
                  const isSelected = selectedIds.includes(item.id);
                  const displayName = item.contactName || 'Unnamed Contact';
                  const initials = displayName
                    .split(' ')
                    .map((n) => n[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join('')
                    .toUpperCase() || '?';

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-well/50 motion-safe:transition-colors ${
                        isSelected ? 'bg-primary/5' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleRow(item.id)}
                          aria-label={`Select ${displayName}`}
                          className="rounded border-border text-primary focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Contact Name */}
                      <td className="p-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                              item.reason === 'deleted'
                                ? 'bg-overdue/10 text-overdue border border-overdue/20'
                                : 'bg-primary/10 text-primary border border-primary/20'
                            }`}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-foreground truncate">
                              {displayName}
                            </div>
                            {!item.contactName && (
                              <div className="text-[10px] text-muted italic">
                                Contact name was not recorded
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Phone Number */}
                      <td className="p-3">
                        {item.contactPhone ? (
                          <div className="flex items-center gap-1.5 text-foreground group">
                            <Phone className="w-3.5 h-3.5 text-muted shrink-0" />
                            <a
                              href={`tel:${item.contactPhone}`}
                              className="hover:text-primary hover:underline font-mono text-[12px] truncate"
                              title={`Call ${item.contactPhone}`}
                            >
                              {item.contactPhone}
                            </a>
                            <button
                              type="button"
                              onClick={() => handleCopy(item.contactPhone!, `phone-${item.id}`)}
                              className="p-1 rounded text-muted hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Copy phone"
                            >
                              {copiedId === `phone-${item.id}` ? (
                                <Check className="w-3 h-3 text-success" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-muted text-[11px]">—</span>
                        )}
                      </td>

                      {/* Email Address */}
                      <td className="p-3">
                        {item.contactEmail ? (
                          <div className="flex items-center gap-1.5 text-foreground group">
                            <Mail className="w-3.5 h-3.5 text-muted shrink-0" />
                            <a
                              href={`mailto:${item.contactEmail}`}
                              className="hover:text-primary hover:underline truncate max-w-[170px]"
                              title={`Email ${item.contactEmail}`}
                            >
                              {item.contactEmail}
                            </a>
                            <button
                              type="button"
                              onClick={() => handleCopy(item.contactEmail!, `email-${item.id}`)}
                              className="p-1 rounded text-muted hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Copy email"
                            >
                              {copiedId === `email-${item.id}` ? (
                                <Check className="w-3 h-3 text-success" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-muted text-[11px]">—</span>
                        )}
                      </td>

                      {/* Status / Reason */}
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 ${
                              item.reason === 'deleted'
                                ? 'bg-overdue/15 text-overdue border border-overdue/30'
                                : 'bg-primary/15 text-primary border border-primary/30'
                            }`}
                          >
                            {item.reason === 'deleted' ? (
                              <>
                                <Trash2 className="w-2.5 h-2.5" />
                                <span>Deleted</span>
                              </>
                            ) : (
                              <>
                                <GitMerge className="w-2.5 h-2.5" />
                                <span>Merged</span>
                              </>
                            )}
                          </span>
                          {item.targetContactName && (
                            <span className="text-muted text-[11px] truncate max-w-[110px]" title={`Merged into ${item.targetContactName}`}>
                              into {item.targetContactName}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Google ID */}
                      <td className="p-3">
                        <div className="flex items-center gap-1 group">
                          <span
                            className="font-mono text-[11px] text-muted truncate max-w-[130px]"
                            title={item.googleResourceName}
                          >
                            {item.googleResourceName}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(item.googleResourceName, `gid-${item.id}`)}
                            className="p-1 rounded text-muted hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Copy Google ID"
                          >
                            {copiedId === `gid-${item.id}` ? (
                              <Check className="w-3 h-3 text-success" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Blocked Date */}
                      <td className="p-3 text-muted text-[11px] whitespace-nowrap">
                        {item.createdAt ? (
                          new Date(item.createdAt).toLocaleDateString()
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleSingleUnblock(item)}
                          className="px-2.5 py-1 rounded-lg bg-well hover:bg-card-hover border border-border text-[11px] font-medium text-foreground hover:text-primary motion-safe:transition-colors motion-safe:duration-160 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50 whitespace-nowrap"
                          title="Unblock contact so it can be re-imported from Google on the next sync"
                        >
                          Unblock
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Information Footer Box */}
      <div className="p-3.5 rounded-xl bg-well border border-border flex items-start gap-3 text-xs text-muted">
        <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold text-foreground">
            How Archived Contacts &amp; Google Tombstones Work:
          </span>
          <p>
            Touchpoint uses an additive sync ledger. When you delete a contact in Touchpoint that originated from Google, or merge duplicate Google contacts, a tombstone record is created here. This guarantees Google Sync will never resurrect or duplicate deleted contacts. Unblocking a contact removes its tombstone, allowing it to be freshly re-imported on your next Google sync.
          </p>
        </div>
      </div>
    </div>
  );
}
