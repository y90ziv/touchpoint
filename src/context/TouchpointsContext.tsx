'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { GraphData } from '@/types/touchpoint';

export interface TouchpointRecord {
  id: number;
  contactedAt: string;
  method: string;
  note: string | null;
}

export interface NewRelationshipFormState {
  contactAId: string;
  contactBId: string;
  type: string;
}

export interface TouchpointsContextValue {
  // Drawer Touchpoint History & Editing
  drawerTouchpoints: TouchpointRecord[];
  setDrawerTouchpoints: React.Dispatch<React.SetStateAction<TouchpointRecord[]>>;
  editingTouchpointId: number | null;
  setEditingTouchpointId: React.Dispatch<React.SetStateAction<number | null>>;
  editTpMethod: string;
  setEditTpMethod: React.Dispatch<React.SetStateAction<string>>;
  editTpNote: string;
  setEditTpNote: React.Dispatch<React.SetStateAction<string>>;
  editTpDate: string;
  setEditTpDate: React.Dispatch<React.SetStateAction<string>>;

  // Drawer Milestones (Important Dates)
  newMilestoneLabel: string;
  setNewMilestoneLabel: React.Dispatch<React.SetStateAction<string>>;
  newMilestoneDate: string;
  setNewMilestoneDate: React.Dispatch<React.SetStateAction<string>>;
  showAddMilestone: boolean;
  setShowAddMilestone: React.Dispatch<React.SetStateAction<boolean>>;

  // Relationship Map Graph
  graph: GraphData;
  setGraph: React.Dispatch<React.SetStateAction<GraphData>>;
  newRelForm: NewRelationshipFormState;
  setNewRelForm: React.Dispatch<React.SetStateAction<NewRelationshipFormState>>;
  personASearch: string;
  setPersonASearch: React.Dispatch<React.SetStateAction<string>>;
  personBSearch: string;
  setPersonBSearch: React.Dispatch<React.SetStateAction<string>>;

  // Operations
  loadTouchpoints: (contactId: number) => Promise<void>;
  logTouchpoint: (
    contactId: number,
    method: string,
    note?: string | null,
    contactedAt?: string
  ) => Promise<boolean>;
  saveEditTouchpoint: (contactId?: number) => Promise<boolean>;
  deleteTouchpoint: (id: number, contactId?: number) => Promise<boolean>;
  addMilestone: (contactId: number, label: string, date: string) => Promise<boolean>;
  deleteMilestone: (milestoneId: number, contactId?: number) => Promise<boolean>;
  loadGraph: () => Promise<void>;
  createRelationship: (
    contactAId: number,
    contactBId: number,
    type: string,
    direction?: 'directional' | 'bidirectional'
  ) => Promise<boolean>;
  deleteRelationship: (id: number) => Promise<boolean>;
}

export const TouchpointsContext = createContext<TouchpointsContextValue | null>(null);

export function TouchpointsProvider({ children }: { children: ReactNode }) {
  const [drawerTouchpoints, setDrawerTouchpoints] = useState<TouchpointRecord[]>([]);
  const [editingTouchpointId, setEditingTouchpointId] = useState<number | null>(null);
  const [editTpMethod, setEditTpMethod] = useState<string>('call');
  const [editTpNote, setEditTpNote] = useState<string>('');
  const [editTpDate, setEditTpDate] = useState<string>('');

  const [newMilestoneLabel, setNewMilestoneLabel] = useState('');
  const [newMilestoneDate, setNewMilestoneDate] = useState('');
  const [showAddMilestone, setShowAddMilestone] = useState(false);

  const [graph, setGraph] = useState<GraphData>({ nodes: [], edges: [] });
  const [newRelForm, setNewRelForm] = useState<NewRelationshipFormState>({
    contactAId: '',
    contactBId: '',
    type: 'colleague',
  });
  const [personASearch, setPersonASearch] = useState('');
  const [personBSearch, setPersonBSearch] = useState('');

  const loadTouchpoints = useCallback(async (contactId: number) => {
    try {
      const res = await fetch(`/api/touchpoints?contactId=${contactId}`);
      if (res.ok) {
        const data = await res.json();
        setDrawerTouchpoints(data.touchpoints || []);
      }
    } catch {
      // Handled gracefully
    }
  }, []);

  const logTouchpoint = useCallback(
    async (
      contactId: number,
      method: string,
      note?: string | null,
      contactedAt?: string
    ): Promise<boolean> => {
      try {
        const res = await fetch('/api/touchpoints', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contactId,
            method,
            note: note || null,
            contactedAt: contactedAt || new Date().toISOString().split('T')[0],
          }),
        });
        if (res.ok) {
          await loadTouchpoints(contactId);
          return true;
        }
      } catch {
        // Handled gracefully
      }
      return false;
    },
    [loadTouchpoints]
  );

  const saveEditTouchpoint = useCallback(
    async (contactId?: number): Promise<boolean> => {
      if (!editingTouchpointId) return false;
      try {
        const res = await fetch('/api/touchpoints', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingTouchpointId,
            method: editTpMethod,
            note: editTpNote,
            contactedAt: editTpDate ? new Date(editTpDate).toISOString() : new Date().toISOString(),
          }),
        });
        if (res.ok) {
          if (contactId) await loadTouchpoints(contactId);
          setEditingTouchpointId(null);
          return true;
        }
      } catch {
        // Handled gracefully
      }
      return false;
    },
    [editingTouchpointId, editTpMethod, editTpNote, editTpDate, loadTouchpoints]
  );

  const deleteTouchpoint = useCallback(
    async (id: number, contactId?: number): Promise<boolean> => {
      try {
        const res = await fetch(`/api/touchpoints?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
          if (contactId) await loadTouchpoints(contactId);
          return true;
        }
      } catch {
        // Handled gracefully
      }
      return false;
    },
    [loadTouchpoints]
  );

  const addMilestone = useCallback(
    async (contactId: number, label: string, date: string): Promise<boolean> => {
      try {
        const res = await fetch('/api/touchpoints', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add_important_date',
            contactId,
            label: label.trim(),
            date,
          }),
        });
        if (res.ok) {
          setNewMilestoneLabel('');
          setNewMilestoneDate('');
          setShowAddMilestone(false);
          return true;
        }
      } catch {
        // Handled gracefully
      }
      return false;
    },
    []
  );

  const deleteMilestone = useCallback(
    async (milestoneId: number, _contactId?: number): Promise<boolean> => {
      try {
        const res = await fetch('/api/touchpoints', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'delete_important_date',
            id: milestoneId,
          }),
        });
        return res.ok;
      } catch {
        // Handled gracefully
      }
      return false;
    },
    []
  );

  const loadGraph = useCallback(async () => {
    try {
      const res = await fetch('/api/relationships');
      if (res.ok) {
        const data = await res.json();
        setGraph(data && data.nodes ? data : { nodes: [], edges: [] });
      }
    } catch {
      // Handled gracefully
    }
  }, []);

  const createRelationship = useCallback(
    async (
      contactAId: number,
      contactBId: number,
      type: string,
      direction: 'directional' | 'bidirectional' = 'bidirectional'
    ): Promise<boolean> => {
      try {
        const res = await fetch('/api/relationships', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contactAId, contactBId, type, direction }),
        });
        if (res.ok) {
          await loadGraph();
          setNewRelForm({ contactAId: '', contactBId: '', type: 'spouse' });
          setPersonASearch('');
          setPersonBSearch('');
          return true;
        }
      } catch {
        // Handled gracefully
      }
      return false;
    },
    [loadGraph]
  );

  const deleteRelationship = useCallback(
    async (id: number): Promise<boolean> => {
      try {
        const res = await fetch(`/api/relationships?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
          await loadGraph();
          return true;
        }
      } catch {
        // Handled gracefully
      }
      return false;
    },
    [loadGraph]
  );

  const value = useMemo<TouchpointsContextValue>(
    () => ({
      drawerTouchpoints,
      setDrawerTouchpoints,
      editingTouchpointId,
      setEditingTouchpointId,
      editTpMethod,
      setEditTpMethod,
      editTpNote,
      setEditTpNote,
      editTpDate,
      setEditTpDate,
      newMilestoneLabel,
      setNewMilestoneLabel,
      newMilestoneDate,
      setNewMilestoneDate,
      showAddMilestone,
      setShowAddMilestone,
      graph,
      setGraph,
      newRelForm,
      setNewRelForm,
      personASearch,
      setPersonASearch,
      personBSearch,
      setPersonBSearch,
      loadTouchpoints,
      logTouchpoint,
      saveEditTouchpoint,
      deleteTouchpoint,
      addMilestone,
      deleteMilestone,
      loadGraph,
      createRelationship,
      deleteRelationship,
    }),
    [
      drawerTouchpoints,
      editingTouchpointId,
      editTpMethod,
      editTpNote,
      editTpDate,
      newMilestoneLabel,
      newMilestoneDate,
      showAddMilestone,
      graph,
      newRelForm,
      personASearch,
      personBSearch,
      loadTouchpoints,
      logTouchpoint,
      saveEditTouchpoint,
      deleteTouchpoint,
      addMilestone,
      deleteMilestone,
      loadGraph,
      createRelationship,
      deleteRelationship,
    ]
  );

  return <TouchpointsContext.Provider value={value}>{children}</TouchpointsContext.Provider>;
}

export function useTouchpoints(): TouchpointsContextValue {
  const context = useContext(TouchpointsContext);
  if (!context) {
    throw new Error('useTouchpoints must be used within a TouchpointsProvider');
  }
  return context;
}
