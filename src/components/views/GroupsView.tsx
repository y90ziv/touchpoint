'use client';

import React from 'react';
import { FolderKanban, Trash2, Clock, Users, Plus } from 'lucide-react';
import { GroupItem, PRESET_GROUP_COLORS } from '@/types/touchpoint';
import { useGroups } from '@/context/GroupsContext';
import { useContacts } from '@/context/ContactsContext';
import { useUI } from '@/context/UIContext';

export interface GroupsViewProps {
  onOpenGroupDetails?: (group: GroupItem) => void;
}

export function GroupsView({ onOpenGroupDetails }: GroupsViewProps) {
  const groupsCtx = useGroups();
  const contactsCtx = useContacts();
  const ui = useUI();

  const groups = groupsCtx.groups;
  const contacts = contactsCtx.contacts;
  const newGroupForm = groupsCtx.newGroupForm;
  const setNewGroupForm = groupsCtx.setNewGroupForm;

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupForm.name.trim()) return;
    const created = await groupsCtx.createGroup(
      newGroupForm.name.trim(),
      newGroupForm.intervalDays,
      newGroupForm.color
    );
    if (created) {
      ui.notify(`Group "${created.name}" created.`);
      setNewGroupForm({ name: '', intervalDays: 0, color: '#e85d3a' });
      await groupsCtx.loadGroups();
    }
  };

  const handleDeleteGroup = async (id: number, name: string) => {
    if (!window.confirm(`Delete group "${name}"? Contacts in this group will not be deleted.`)) {
      return;
    }
    const success = await groupsCtx.deleteGroup(id);
    if (success) {
      ui.notify(`Group "${name}" deleted.`);
      await groupsCtx.loadGroups();
      await contactsCtx.loadContacts();
    }
  };

  const handleOpenDetails = (group: GroupItem) => {
    if (onOpenGroupDetails) {
      onOpenGroupDetails(group);
    } else {
      groupsCtx.openGroupDetails(group);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Groups and Cadence Intervals</h1>
        <p className="text-xs text-muted mt-0.5">
          Organize contacts into circles with custom cadence intervals
        </p>
      </div>

      {/* Create Group Form */}
      <form
        onSubmit={handleCreateGroup}
        className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-end gap-3 text-xs shadow-xs"
      >
        <div className="flex-1 min-w-[200px]">
          <label className="block text-muted mb-1 font-medium">Group Name</label>
          <input
            required
            value={newGroupForm.name}
            onChange={(e) => setNewGroupForm({ ...newGroupForm, name: e.target.value })}
            placeholder="e.g. Friends, Workplace, Family"
            aria-label="Group name"
            className="w-full px-3 py-2 rounded-lg bg-well border border-border text-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          />
        </div>

        <div className="w-56">
          <label className="block text-muted mb-1 font-medium">Cadence Interval</label>
          <select
            value={newGroupForm.intervalDays}
            onChange={(e) =>
              setNewGroupForm({ ...newGroupForm, intervalDays: Number(e.target.value) })
            }
            aria-label="Cadence interval"
            className="w-full px-3 py-2 rounded-lg bg-well border border-border text-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            <option value={0}>Manual (Contact level only)</option>
            <option value={7}>Every Week (7 days)</option>
            <option value={14}>Every 2 Weeks (14 days)</option>
            <option value={30}>Every Month (30 days)</option>
            <option value={60}>Every 2 Months (60 days)</option>
            <option value={90}>Quarterly (90 days)</option>
          </select>
        </div>

        <div className="w-auto">
          <label className="block text-muted mb-1 font-medium">Color</label>
          <div className="flex items-center gap-1.5 h-[34px]">
            {PRESET_GROUP_COLORS.slice(0, 5).map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setNewGroupForm({ ...newGroupForm, color })}
                style={{ backgroundColor: color }}
                aria-label={`Select color ${color}`}
                className={`w-6 h-6 rounded-full motion-safe:transition-transform motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  newGroupForm.color === color
                    ? 'scale-110 ring-2 ring-primary ring-offset-1 ring-offset-card'
                    : 'opacity-70 hover:opacity-100'
                }`}
                title={color}
              />
            ))}
            <input
              type="color"
              value={newGroupForm.color}
              onChange={(e) => setNewGroupForm({ ...newGroupForm, color: e.target.value })}
              className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"
              title="Custom Color"
              aria-label="Custom color picker"
            />
          </div>
        </div>

        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-primary text-primary-fg font-semibold shadow-xs hover:opacity-95 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Create Group
        </button>
      </form>

      {/* Groups Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {groups.map((g) => {
          const groupContacts = contacts.filter((c) => c.groups.some((cg) => cg.id === g.id));
          return (
            <div
              key={g.id}
              onClick={() => handleOpenDetails(g)}
              className="bg-card border border-border hover:border-primary/60 rounded-xl p-5 pt-6 flex flex-col justify-between motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] cursor-pointer shadow-xs group relative overflow-hidden"
            >
              {/* Top Accent Stripe */}
              <div
                className="absolute top-0 left-0 right-0 h-1.5"
                style={{ backgroundColor: g.color || 'var(--primary)' }}
              />

              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-3.5 h-3.5 rounded-full flex-shrink-0 shadow-xs ring-2 ring-background"
                      style={{ backgroundColor: g.color || 'var(--primary)' }}
                    />
                    <span className="font-semibold text-sm group-hover:text-primary transition-colors truncate text-foreground">
                      {g.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteGroup(g.id, g.name);
                    }}
                    aria-label={`Delete ${g.name} group`}
                    className="text-muted hover:text-overdue p-1 rounded hover:bg-well motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete Group"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="text-xs text-muted mt-2 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-muted shrink-0" aria-hidden="true" />
                    <span>
                      {g.intervalDays > 0
                        ? `Cadence: Every ${g.intervalDays} days`
                        : 'Manual cadence (Contact level)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-muted shrink-0" aria-hidden="true" />
                    <span>
                      {groupContacts.length}{' '}
                      {groupContacts.length === 1 ? 'contact' : 'contacts'} linked
                    </span>
                  </div>
                </div>
              </div>

              {/* Member Avatars pile & Click prompt */}
              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                <div className="flex items-center -space-x-1.5 overflow-hidden">
                  {groupContacts.slice(0, 4).map((c) => (
                    <div
                      key={c.id}
                      className="w-6 h-6 rounded-full bg-well border-2 border-background flex items-center justify-center text-[10px] font-bold text-foreground"
                      title={c.fullName}
                    >
                      {c.fullName.slice(0, 1)}
                    </div>
                  ))}
                  {groupContacts.length > 4 && (
                    <div className="w-6 h-6 rounded-full bg-well border-2 border-background flex items-center justify-center text-[9px] font-bold text-muted">
                      +{groupContacts.length - 4}
                    </div>
                  )}
                  {groupContacts.length === 0 && (
                    <span className="text-[11px] text-muted italic">No contacts yet</span>
                  )}
                </div>

                <span className="text-[11px] font-medium text-primary flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  Manage and Edit
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
