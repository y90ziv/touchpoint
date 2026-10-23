'use client';

import React from 'react';
import {
  X,
  Settings as SettingsIcon,
  Trash2,
  Users,
  Search,
  ExternalLink,
} from 'lucide-react';
import { useGroups } from '@/context/GroupsContext';
import { useContacts } from '@/context/ContactsContext';
import { useUI } from '@/context/UIContext';
import { ProgressRingAvatar } from '@/components/ProgressRingAvatar';
import { PRESET_GROUP_COLORS } from '@/types/touchpoint';

export function GroupDetailModal() {
  const groupsCtx = useGroups();
  const contactsCtx = useContacts();
  const ui = useUI();

  const selectedGroup = groupsCtx.selectedGroupDetails;
  if (!selectedGroup) return null;

  const contacts = contactsCtx.contacts;
  const editGroupForm = groupsCtx.editGroupForm;
  const setEditGroupForm = groupsCtx.setEditGroupForm;

  const handleSaveGroupSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await groupsCtx.updateGroup(selectedGroup.id, {
      name: editGroupForm.name,
      color: editGroupForm.color,
      intervalDays: editGroupForm.intervalDays,
    });
    if (ok) {
      await Promise.all([contactsCtx.loadContacts(), groupsCtx.loadGroups()]);
      ui.notify(`Updated group "${editGroupForm.name}".`);
    } else {
      ui.notify('Failed to update group settings.');
    }
  };

  const handleDeleteGroup = async () => {
    if (
      !window.confirm(
        `Delete group "${selectedGroup.name}"? Contacts in this group will not be deleted.`
      )
    ) {
      return;
    }
    const ok = await groupsCtx.deleteGroup(selectedGroup.id);
    if (ok) {
      await Promise.all([contactsCtx.loadContacts(), groupsCtx.loadGroups()]);
      ui.notify(`Deleted group "${selectedGroup.name}".`);
    } else {
      ui.notify('Failed to delete group.');
    }
  };

  const handleAddContactToGroup = async () => {
    if (!groupsCtx.addContactIdToGroup) return;
    const ok = await groupsCtx.addMemberToGroup(
      selectedGroup.id,
      Number(groupsCtx.addContactIdToGroup)
    );
    if (ok) {
      groupsCtx.setAddContactIdToGroup('');
      await Promise.all([contactsCtx.loadContacts(), groupsCtx.loadGroups()]);
      ui.notify('Contact added to group.');
    } else {
      ui.notify('Failed to add contact to group.');
    }
  };

  const handleRemoveContactFromGroup = async (contactId: number) => {
    const ok = await groupsCtx.removeMemberFromGroup(selectedGroup.id, contactId);
    if (ok) {
      await Promise.all([contactsCtx.loadContacts(), groupsCtx.loadGroups()]);
      ui.notify('Contact removed from group.');
    } else {
      ui.notify('Failed to remove contact from group.');
    }
  };

  const linkedContacts = contacts.filter((c) =>
    c.groups.some((cg) => cg.id === selectedGroup.id)
  );
  const unlinkedContacts = contacts.filter(
    (c) => !c.groups.some((cg) => cg.id === selectedGroup.id)
  );
  const filteredMembers = linkedContacts.filter((c) => {
    if (!groupsCtx.groupSearchQuery.trim()) return true;
    const q = groupsCtx.groupSearchQuery.toLowerCase();
    return (
      c.fullName.toLowerCase().includes(q) ||
      (c.company && c.company.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q))
    );
  });

  const accentColor = editGroupForm.color || selectedGroup.color || 'var(--tp-primary)';

  return (
    <div
      onClick={() => groupsCtx.setSelectedGroupDetails(null)}
      className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-detail-title"
        className="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-md overflow-hidden text-xs"
      >
        {/* Header with Group Accent Bar */}
        <div className="relative border-b border-border p-5 pb-4">
          <div
            className="absolute top-0 left-0 right-0 h-1.5"
            style={{ backgroundColor: accentColor }}
          />
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span
                className="w-4 h-4 rounded-full shrink-0 shadow-xs"
                style={{ backgroundColor: accentColor }}
              />
              <div>
                <h3
                  id="group-detail-title"
                  className="text-base font-bold text-foreground flex items-center gap-2"
                >
                  <span>{selectedGroup.name}</span>
                  <span className="text-xs font-normal text-muted tabular-nums">
                    ({linkedContacts.length} contacts)
                  </span>
                </h3>
                <p className="text-muted mt-0.5">
                  Configure group cadence interval, color theme, and manage linked contacts
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => groupsCtx.setSelectedGroupDetails(null)}
              aria-label="Close group details modal"
              className="text-muted hover:text-foreground p-1 rounded-lg hover:bg-card-hover motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Scrollable Body: Settings & Contacts */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1 scrollbar-thin">
          {/* SECTION 1: Group Settings Form */}
          <form
            onSubmit={handleSaveGroupSettings}
            className="space-y-4 bg-well border border-border rounded-xl p-4"
          >
            <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <SettingsIcon className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                <span>Group Settings</span>
              </div>
              <span className="text-[11px] text-muted tabular-nums">ID: {selectedGroup.id}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div>
                <label htmlFor="edit-group-name" className="block text-muted font-medium mb-1">
                  Group Name
                </label>
                <input
                  id="edit-group-name"
                  required
                  value={editGroupForm.name}
                  onChange={(e) =>
                    setEditGroupForm({ ...editGroupForm, name: e.target.value })
                  }
                  placeholder="e.g., Friends, Workplace 1…"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground font-medium focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="edit-group-interval" className="block text-muted font-medium mb-1">
                  Cadence Interval
                </label>
                <select
                  id="edit-group-interval"
                  value={editGroupForm.intervalDays}
                  onChange={(e) =>
                    setEditGroupForm({
                      ...editGroupForm,
                      intervalDays: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground focus:border-primary focus:outline-none"
                >
                  <option value={0}>Manual (Contact-level only)</option>
                  <option value={7}>Every Week (7 days)</option>
                  <option value={14}>Every 2 Weeks (14 days)</option>
                  <option value={30}>Every Month (30 days)</option>
                  <option value={60}>Every 2 Months (60 days)</option>
                  <option value={90}>Quarterly (90 days)</option>
                  <option value={180}>Semi-annually (180 days)</option>
                  <option value={365}>Annually (365 days)</option>
                </select>
              </div>
            </div>

            {/* Color Palette Selector */}
            <div>
              <label className="block text-muted font-medium mb-1.5">Group Color Theme</label>
              <div className="flex flex-wrap items-center gap-2">
                {PRESET_GROUP_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEditGroupForm({ ...editGroupForm, color: c })}
                    style={{ backgroundColor: c }}
                    aria-label={`Select color ${c}`}
                    className={`w-6 h-6 rounded-full transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
                      editGroupForm.color === c
                        ? 'scale-125 ring-2 ring-primary ring-offset-2'
                        : 'hover:scale-110 opacity-80 hover:opacity-100'
                    }`}
                    title={c}
                  />
                ))}
                <div className="flex items-center gap-1.5 ml-2 border-l border-border pl-2">
                  <span className="text-[11px] text-muted">Custom:</span>
                  <input
                    type="color"
                    value={editGroupForm.color}
                    onChange={(e) =>
                      setEditGroupForm({ ...editGroupForm, color: e.target.value })
                    }
                    aria-label="Pick custom group color"
                    className="w-7 h-7 rounded cursor-pointer border-0 p-0 bg-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/60">
              <button
                type="button"
                onClick={handleDeleteGroup}
                className="text-overdue hover:bg-overdue/10 px-2.5 py-1.5 rounded-lg motion-safe:transition-colors font-medium flex items-center gap-1.5 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Delete Group</span>
              </button>

              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-primary text-primary-fg font-semibold hover:opacity-90 motion-safe:transition-colors shadow-xs active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              >
                Save Group Settings
              </button>
            </div>
          </form>

          {/* SECTION 2: Linked Contacts Management */}
          <div className="space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                <span>Linked Contacts ({linkedContacts.length})</span>
              </div>

              {unlinkedContacts.length > 0 && (
                <div className="flex items-center gap-2">
                  <select
                    value={groupsCtx.addContactIdToGroup}
                    onChange={(e) =>
                      groupsCtx.setAddContactIdToGroup(Number(e.target.value) || '')
                    }
                    aria-label="Select contact to add to group"
                    className="px-2.5 py-1.5 rounded-lg bg-well border border-border text-foreground font-medium text-xs focus:border-primary focus:outline-none"
                  >
                    <option value="">+ Select Contact to Add…</option>
                    {unlinkedContacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} {c.company ? `(${c.company})` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!groupsCtx.addContactIdToGroup}
                    onClick={handleAddContactToGroup}
                    className="px-3 py-1.5 rounded-lg bg-primary text-primary-fg font-semibold hover:opacity-90 disabled:opacity-50 motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

            {linkedContacts.length > 3 && (
              <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-well border border-border focus-within:border-primary">
                <Search className="w-3.5 h-3.5 text-muted shrink-0" aria-hidden="true" />
                <input
                  value={groupsCtx.groupSearchQuery}
                  onChange={(e) => groupsCtx.setGroupSearchQuery(e.target.value)}
                  placeholder="Filter members by name, company, email…"
                  aria-label="Filter group members"
                  className="w-full bg-transparent border-none text-foreground placeholder:text-muted focus:outline-none"
                />
              </div>
            )}

            <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin">
              {filteredMembers.map((c) => (
                <div
                  key={c.id}
                  className="bg-well hover:bg-card-hover border border-border rounded-xl p-3 flex items-center justify-between gap-3 motion-safe:transition-colors"
                >
                  <div
                    onClick={() => contactsCtx.openContactDrawer(c)}
                    className="flex items-center gap-3 cursor-pointer min-w-0 flex-1"
                  >
                    <ProgressRingAvatar
                      name={c.fullName}
                      progressPercent={c.cadence.progressPercent}
                      status={c.cadence.status}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground hover:text-primary flex items-center gap-1.5 truncate">
                        <span>{c.fullName}</span>
                        <ExternalLink className="w-3 h-3 text-muted" aria-hidden="true" />
                      </div>
                      <div className="text-[11px] text-muted truncate">
                        {c.company || c.email || c.phone || 'No extra info'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-medium border tabular-nums ${
                        c.cadence.status === 'overdue'
                          ? 'text-overdue bg-overdue/10 border-overdue/30'
                          : c.cadence.status === 'due_today' || c.cadence.status === 'due_soon'
                          ? 'text-warning bg-warning/10 border-warning/30'
                          : 'text-success bg-success/10 border-success/30'
                      }`}
                    >
                      {c.cadence.daysUntilDue <= 0
                        ? 'Due now'
                        : `Due in ${c.cadence.daysUntilDue}d`}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleRemoveContactFromGroup(c.id)}
                      aria-label={`Remove ${c.fullName} from group`}
                      className="text-muted hover:text-overdue p-1.5 rounded-lg hover:bg-overdue/10 motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                      title="Remove contact from this group"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}

              {linkedContacts.length === 0 && (
                <div className="p-8 text-center border border-dashed border-border rounded-xl text-muted space-y-1.5">
                  <Users className="w-6 h-6 mx-auto opacity-40 mb-1" aria-hidden="true" />
                  <div className="font-medium text-foreground">
                    No contacts in this group yet
                  </div>
                  <p className="text-[11px]">
                    Use the dropdown above or select contacts in the Contacts directory to assign them.
                  </p>
                </div>
              )}

              {linkedContacts.length > 0 && filteredMembers.length === 0 && (
                <div className="p-6 text-center text-muted">
                  No members matched &ldquo;{groupsCtx.groupSearchQuery}&rdquo;
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border bg-well flex justify-end">
          <button
            type="button"
            onClick={() => groupsCtx.setSelectedGroupDetails(null)}
            className="px-4 py-2 rounded-lg border border-border text-muted hover:text-foreground hover:bg-card-hover motion-safe:transition-colors font-medium active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
