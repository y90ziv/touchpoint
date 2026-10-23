'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { GroupItem } from '@/types/touchpoint';

export interface NewGroupFormState {
  name: string;
  intervalDays: number;
  color: string;
}

export interface EditGroupFormState {
  id: number;
  name: string;
  color: string;
  intervalDays: number;
}

export interface GroupsContextValue {
  groups: GroupItem[];
  setGroups: React.Dispatch<React.SetStateAction<GroupItem[]>>;

  // Creation Form
  newGroupForm: NewGroupFormState;
  setNewGroupForm: React.Dispatch<React.SetStateAction<NewGroupFormState>>;

  // Group Details & Editing Modal
  selectedGroupDetails: GroupItem | null;
  setSelectedGroupDetails: React.Dispatch<React.SetStateAction<GroupItem | null>>;
  editGroupForm: EditGroupFormState;
  setEditGroupForm: React.Dispatch<React.SetStateAction<EditGroupFormState>>;
  openGroupDetails: (group: GroupItem) => void;
  closeGroupDetails: () => void;

  // Add Member to Group
  groupSearchQuery: string;
  setGroupSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  addContactIdToGroup: number | '';
  setAddContactIdToGroup: React.Dispatch<React.SetStateAction<number | ''>>;

  // Inline Group Creation inside Contact Modals
  showInlineNewGroup: boolean;
  setShowInlineNewGroup: React.Dispatch<React.SetStateAction<boolean>>;
  inlineGroupName: string;
  setInlineGroupName: React.Dispatch<React.SetStateAction<string>>;
  inlineGroupInterval: number;
  setInlineGroupInterval: React.Dispatch<React.SetStateAction<number>>;
  inlineGroupLoading: boolean;
  setInlineGroupLoading: React.Dispatch<React.SetStateAction<boolean>>;
  createInlineGroup: (name: string, intervalDays: number) => Promise<GroupItem | null>;

  // API Mutations
  loadGroups: () => Promise<void>;
  createGroup: (name?: string, intervalDays?: number, color?: string) => Promise<GroupItem | null>;
  updateGroup: (id: number, updates: Partial<GroupItem>) => Promise<boolean>;
  deleteGroup: (id: number) => Promise<boolean>;
  addMemberToGroup: (groupId: number, contactId: number) => Promise<boolean>;
  removeMemberFromGroup: (groupId: number, contactId: number) => Promise<boolean>;
}

export const GroupsContext = createContext<GroupsContextValue | null>(null);

export function GroupsProvider({ children }: { children: ReactNode }) {
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [newGroupForm, setNewGroupForm] = useState<NewGroupFormState>({
    name: '',
    intervalDays: 0,
    color: '#e85d3a',
  });

  const [selectedGroupDetails, setSelectedGroupDetails] = useState<GroupItem | null>(null);
  const [editGroupForm, setEditGroupForm] = useState<EditGroupFormState>({
    id: 0,
    name: '',
    color: '#e85d3a',
    intervalDays: 0,
  });

  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [addContactIdToGroup, setAddContactIdToGroup] = useState<number | ''>('');

  const [showInlineNewGroup, setShowInlineNewGroup] = useState(false);
  const [inlineGroupName, setInlineGroupName] = useState('');
  const [inlineGroupInterval, setInlineGroupInterval] = useState(30);
  const [inlineGroupLoading, setInlineGroupLoading] = useState(false);

  const openGroupDetails = useCallback((group: GroupItem) => {
    setSelectedGroupDetails(group);
    setEditGroupForm({
      id: group.id,
      name: group.name,
      color: group.color || '#e85d3a',
      intervalDays: group.intervalDays ?? 0,
    });
    setGroupSearchQuery('');
    setAddContactIdToGroup('');
  }, []);

  const closeGroupDetails = useCallback(() => {
    setSelectedGroupDetails(null);
  }, []);

  const loadGroups = useCallback(async () => {
    try {
      const res = await fetch('/api/groups');
      if (res.ok) {
        const data = await res.json();
        const loadedGroups: GroupItem[] = data.groups || [];
        setGroups(loadedGroups);
        setSelectedGroupDetails((prev) => {
          if (!prev) return null;
          return loadedGroups.find((g) => g.id === prev.id) || null;
        });
      }
    } catch {
      // Handled gracefully
    }
  }, []);

  const createGroup = useCallback(
    async (
      name?: string,
      intervalDays?: number,
      color?: string
    ): Promise<GroupItem | null> => {
      const gName = (name || newGroupForm.name).trim();
      if (!gName) return null;
      const gInterval = intervalDays !== undefined ? intervalDays : newGroupForm.intervalDays;
      const gColor = color || newGroupForm.color || '#e85d3a';

      try {
        const res = await fetch('/api/groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: gName, intervalDays: gInterval, color: gColor }),
        });
        if (res.ok) {
          const data = await res.json();
          const created: GroupItem = data.group || data;
          await loadGroups();
          setNewGroupForm({ name: '', intervalDays: 0, color: '#e85d3a' });
          return created;
        }
      } catch {
        // Handled gracefully
      }
      return null;
    },
    [newGroupForm, loadGroups]
  );

  const updateGroup = useCallback(
    async (id: number, updates: Partial<GroupItem>): Promise<boolean> => {
      try {
        const res = await fetch('/api/groups', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...updates }),
        });
        if (res.ok) {
          await loadGroups();
          if (selectedGroupDetails && selectedGroupDetails.id === id) {
            setSelectedGroupDetails((prev) => (prev ? { ...prev, ...updates } : null));
          }
          return true;
        }
      } catch {
        // Handled gracefully
      }
      return false;
    },
    [selectedGroupDetails, loadGroups]
  );

  const deleteGroup = useCallback(
    async (id: number): Promise<boolean> => {
      try {
        const res = await fetch(`/api/groups?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
          await loadGroups();
          if (selectedGroupDetails && selectedGroupDetails.id === id) {
            setSelectedGroupDetails(null);
          }
          return true;
        }
      } catch {
        // Handled gracefully
      }
      return false;
    },
    [selectedGroupDetails, loadGroups]
  );

  const addMemberToGroup = useCallback(
    async (groupId: number, contactId: number): Promise<boolean> => {
      try {
        const res = await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operation: 'bulk',
            contactIds: [contactId],
            action: 'assign_group',
            groupId,
          }),
        });
        if (res.ok) {
          setAddContactIdToGroup('');
          await loadGroups();
          return true;
        }
      } catch {
        // Handled gracefully
      }
      return false;
    },
    [loadGroups]
  );

  const removeMemberFromGroup = useCallback(
    async (groupId: number, contactId: number): Promise<boolean> => {
      try {
        const res = await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operation: 'bulk',
            contactIds: [contactId],
            action: 'remove_group',
            groupId,
          }),
        });
        if (res.ok) {
          await loadGroups();
          return true;
        }
      } catch {
        // Handled gracefully
      }
      return false;
    },
    [loadGroups]
  );

  const createInlineGroup = useCallback(
    async (name: string, intervalDays: number): Promise<GroupItem | null> => {
      setInlineGroupLoading(true);
      try {
        const res = await fetch('/api/groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), intervalDays: Number(intervalDays) || 30, color: '#e85d3a' }),
        });
        if (res.ok) {
          const data = await res.json();
          const created: GroupItem = data.group || data;
          await loadGroups();
          setShowInlineNewGroup(false);
          setInlineGroupName('');
          setInlineGroupInterval(30);
          return created;
        }
      } catch {
        // Handled gracefully
      } finally {
        setInlineGroupLoading(false);
      }
      return null;
    },
    [loadGroups]
  );

  const value = useMemo<GroupsContextValue>(
    () => ({
      groups,
      setGroups,
      newGroupForm,
      setNewGroupForm,
      selectedGroupDetails,
      setSelectedGroupDetails,
      editGroupForm,
      setEditGroupForm,
      openGroupDetails,
      closeGroupDetails,
      groupSearchQuery,
      setGroupSearchQuery,
      addContactIdToGroup,
      setAddContactIdToGroup,
      showInlineNewGroup,
      setShowInlineNewGroup,
      inlineGroupName,
      setInlineGroupName,
      inlineGroupInterval,
      setInlineGroupInterval,
      inlineGroupLoading,
      setInlineGroupLoading,
      createInlineGroup,
      loadGroups,
      createGroup,
      updateGroup,
      deleteGroup,
      addMemberToGroup,
      removeMemberFromGroup,
    }),
    [
      groups,
      newGroupForm,
      selectedGroupDetails,
      editGroupForm,
      openGroupDetails,
      closeGroupDetails,
      groupSearchQuery,
      addContactIdToGroup,
      showInlineNewGroup,
      inlineGroupName,
      inlineGroupInterval,
      inlineGroupLoading,
      createInlineGroup,
      loadGroups,
      createGroup,
      updateGroup,
      deleteGroup,
      addMemberToGroup,
      removeMemberFromGroup,
    ]
  );

  return <GroupsContext.Provider value={value}>{children}</GroupsContext.Provider>;
}

export function useGroups(): GroupsContextValue {
  const context = useContext(GroupsContext);
  if (!context) {
    throw new Error('useGroups must be used within a GroupsProvider');
  }
  return context;
}
