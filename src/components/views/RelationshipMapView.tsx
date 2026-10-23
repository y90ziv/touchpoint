'use client';

import React, { useState } from 'react';
import { Network, Link2, Search } from 'lucide-react';
import { ContactItem } from '@/types/touchpoint';
import { useTouchpoints } from '@/context/TouchpointsContext';
import { useContacts } from '@/context/ContactsContext';
import { useUI } from '@/context/UIContext';

export interface RelationshipMapViewProps {
  onOpenContact?: (contact: ContactItem) => void;
}

export function RelationshipMapView({ onOpenContact }: RelationshipMapViewProps) {
  const touchpointsCtx = useTouchpoints();
  const contactsCtx = useContacts();
  const ui = useUI();

  const contacts = contactsCtx.contacts;
  const graph = touchpointsCtx.graph;
  const newRelForm = touchpointsCtx.newRelForm;
  const setNewRelForm = touchpointsCtx.setNewRelForm;

  const [personASearch, setPersonASearch] = useState('');
  const [personBSearch, setPersonBSearch] = useState('');

  const filteredContactsForA = contacts.filter((c) => {
    if (newRelForm.contactAId && Number(newRelForm.contactAId) === c.id) return true;
    if (!personASearch.trim()) return true;
    const q = personASearch.toLowerCase();
    return (
      c.fullName.toLowerCase().includes(q) ||
      (c.company && c.company.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q))
    );
  });

  const filteredContactsForB = contacts.filter((c) => {
    if (newRelForm.contactBId && Number(newRelForm.contactBId) === c.id) return true;
    if (!personBSearch.trim()) return true;
    const q = personBSearch.toLowerCase();
    return (
      c.fullName.toLowerCase().includes(q) ||
      (c.company && c.company.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q))
    );
  });

  const handleCreateRelationship = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRelForm.contactAId || !newRelForm.contactBId) {
      ui.notify('Please select both contacts to establish a relationship.');
      return;
    }
    if (newRelForm.contactAId === newRelForm.contactBId) {
      ui.notify('Cannot link a contact to themselves.');
      return;
    }
    const success = await touchpointsCtx.createRelationship(
      Number(newRelForm.contactAId),
      Number(newRelForm.contactBId),
      newRelForm.type
    );
    if (success) {
      ui.notify('Relationship established.');
      setNewRelForm({ contactAId: '', contactBId: '', type: 'spouse' });
      await touchpointsCtx.loadGraph();
    }
  };

  const handleNodeClick = (contactId: number) => {
    const contact = contacts.find((c) => c.id === contactId);
    if (contact) {
      if (onOpenContact) {
        onOpenContact(contact);
      } else {
        contactsCtx.openContactDrawer(contact);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Relationship Map</h1>
        <p className="text-xs text-muted mt-0.5">
          Link spouses, parents, children, siblings, and coworkers to visualize your network
        </p>
      </div>

      {/* Add Connection Panel */}
      <form
        onSubmit={handleCreateRelationship}
        className="bg-card border border-border rounded-xl p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end text-xs shadow-xs"
      >
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-muted font-medium">Person A</label>
            <input
              type="text"
              placeholder="Search A…"
              value={personASearch}
              onChange={(e) => setPersonASearch(e.target.value)}
              aria-label="Filter Person A"
              className="w-24 px-1.5 py-0.5 text-[11px] rounded bg-well border border-border text-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            />
          </div>
          <select
            value={newRelForm.contactAId}
            onChange={(e) => setNewRelForm({ ...newRelForm, contactAId: e.target.value })}
            aria-label="Select Person A"
            className="w-full px-3 py-2 rounded-lg bg-well border border-border text-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            <option value="">Select contact ({filteredContactsForA.length})…</option>
            {filteredContactsForA.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}
                {c.company ? ` (${c.company})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-muted font-medium mb-1">Relationship</label>
          <select
            value={newRelForm.type}
            onChange={(e) => setNewRelForm({ ...newRelForm, type: e.target.value })}
            aria-label="Select relationship type"
            className="w-full px-3 py-2 rounded-lg bg-well border border-border text-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            <option value="spouse">Spouse or Partner</option>
            <option value="parent_child">Parent of Child</option>
            <option value="child_of">Child of Parent</option>
            <option value="family">Family or Relative</option>
            <option value="sibling">Sibling</option>
            <option value="friend">Friend</option>
            <option value="coworker">Coworker</option>
            <option value="introduced_by">Introduced By</option>
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-muted font-medium">Person B</label>
            <input
              type="text"
              placeholder="Search B…"
              value={personBSearch}
              onChange={(e) => setPersonBSearch(e.target.value)}
              aria-label="Filter Person B"
              className="w-24 px-1.5 py-0.5 text-[11px] rounded bg-well border border-border text-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            />
          </div>
          <select
            value={newRelForm.contactBId}
            onChange={(e) => setNewRelForm({ ...newRelForm, contactBId: e.target.value })}
            aria-label="Select Person B"
            className="w-full px-3 py-2 rounded-lg bg-well border border-border text-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            <option value="">Select contact ({filteredContactsForB.length})…</option>
            {filteredContactsForB.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}
                {c.company ? ` (${c.company})` : ''}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-primary text-primary-fg font-semibold flex items-center justify-center gap-1.5 shadow-xs hover:opacity-95 motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Link Contacts</span>
        </button>
      </form>

      {/* 2D SVG Relationship Graph */}
      <div className="bg-card border border-border rounded-xl p-4 h-[420px] flex items-center justify-center shadow-xs">
        {graph.nodes.length === 0 ? (
          <span className="text-xs text-muted">
            Add contacts and link relationships above to visualize your network graph.
          </span>
        ) : (
          <svg
            className="w-full h-full"
            viewBox="0 0 700 380"
            role="img"
            aria-label="Network Relationship Graph"
          >
            {graph.edges.map((edge) => {
              const idxA = graph.nodes.findIndex((n) => n.id === edge.source);
              const idxB = graph.nodes.findIndex((n) => n.id === edge.target);
              if (idxA === -1 || idxB === -1) return null;
              const angleA = (idxA / graph.nodes.length) * Math.PI * 2;
              const angleB = (idxB / graph.nodes.length) * Math.PI * 2;
              const x1 = 350 + Math.cos(angleA) * 140;
              const y1 = 190 + Math.sin(angleA) * 120;
              const x2 = 350 + Math.cos(angleB) * 140;
              const y2 = 190 + Math.sin(angleB) * 120;
              return (
                <g key={edge.id}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="var(--tp-border, #3f4450)"
                    strokeWidth="2"
                  />
                  <text
                    x={(x1 + x2) / 2}
                    y={(y1 + y2) / 2 - 6}
                    fill="var(--tp-muted, #94a3b8)"
                    fontSize="11"
                    textAnchor="middle"
                  >
                    {edge.type.replace('_', ' ')}
                  </text>
                </g>
              );
            })}
            {graph.nodes.map((node, idx) => {
              const angle = (idx / graph.nodes.length) * Math.PI * 2;
              const x = 350 + Math.cos(angle) * 140;
              const y = 190 + Math.sin(angle) * 120;
              const stroke =
                node.status === 'overdue'
                  ? 'var(--tp-overdue, #ef4444)'
                  : node.status === 'due_soon'
                  ? 'var(--tp-warning, #f59e0b)'
                  : 'var(--tp-success, #10b981)';
              return (
                <g
                  key={node.id}
                  transform={`translate(${x},${y})`}
                  onClick={() => handleNodeClick(node.id)}
                  className="cursor-pointer"
                >
                  <circle
                    r="24"
                    fill="var(--tp-well, #1f2329)"
                    stroke={stroke}
                    strokeWidth="3"
                  />
                  <text
                    dy="4"
                    fill="var(--tp-text, #f8fafc)"
                    fontSize="12"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {node.fullName.slice(0, 2).toUpperCase()}
                  </text>
                  <text
                    dy="38"
                    fill="var(--tp-text, #f8fafc)"
                    fontSize="12"
                    textAnchor="middle"
                  >
                    {node.fullName}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}
