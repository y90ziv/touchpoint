'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  Simulation,
} from 'd3-force';
import { Network, Link2, ZoomIn, ZoomOut, RotateCcw, Trash2, Info } from 'lucide-react';
import { ContactItem, GraphNode, GraphEdge, GraphData } from '@/types/touchpoint';
import { useTouchpoints } from '@/context/TouchpointsContext';
import { useContacts } from '@/context/ContactsContext';
import { useUI } from '@/context/UIContext';

export interface RelationshipMapViewProps {
  onOpenContact?: (contact: ContactItem) => void;
}

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface SimLink {
  id: number;
  source: SimNode | number;
  target: SimNode | number;
  type: string;
}

const VIEW_WIDTH = 700;
const VIEW_HEIGHT = 420;

function computeInitialNodes(nodes: GraphNode[]): SimNode[] {
  const count = nodes.length || 1;
  return nodes.map((n, idx) => {
    const angle = (idx / count) * Math.PI * 2;
    return {
      ...n,
      x: VIEW_WIDTH / 2 + Math.cos(angle) * (count === 1 ? 0 : 150),
      y: VIEW_HEIGHT / 2 + Math.sin(angle) * (count === 1 ? 0 : 130),
    };
  });
}

function computeInitialLinks(edges: GraphEdge[], nodes: SimNode[]): SimLink[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  return edges
    .filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target))
    .map((e) => ({
      id: e.id,
      source: nodeMap.get(e.source)!,
      target: nodeMap.get(e.target)!,
      type: e.type,
    }));
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

  // Simulation State
  const [simNodes, setSimNodes] = useState<SimNode[]>(() => computeInitialNodes(graph.nodes));
  const [simLinks, setSimLinks] = useState<SimLink[]>(() =>
    computeInitialLinks(graph.edges, computeInitialNodes(graph.nodes))
  );

  // Pan & Zoom State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Dragging State
  const [draggingNodeId, setDraggingNodeId] = useState<number | null>(null);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const didDragRef = useRef(false);

  // Hover state
  const [hoveredNodeId, setHoveredNodeId] = useState<number | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const simRef = useRef<Simulation<SimNode, any> | null>(null);

  // Sync simulation when graph data updates
  useEffect(() => {
    if (graph.nodes.length === 0) {
      setSimNodes([]);
      setSimLinks([]);
      return;
    }

    // Preserve existing coordinates to avoid visual jumping
    const existingMap = new Map(simNodes.map((n) => [n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy }]));
    const count = graph.nodes.length;

    const nodes: SimNode[] = graph.nodes.map((n, idx) => {
      const existing = existingMap.get(n.id);
      if (existing && !Number.isNaN(existing.x) && !Number.isNaN(existing.y)) {
        return { ...n, x: existing.x, y: existing.y, vx: existing.vx, vy: existing.vy };
      }
      const angle = (idx / count) * Math.PI * 2;
      return {
        ...n,
        x: VIEW_WIDTH / 2 + Math.cos(angle) * (count === 1 ? 0 : 150),
        y: VIEW_HEIGHT / 2 + Math.sin(angle) * (count === 1 ? 0 : 130),
      };
    });

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const validEdges = graph.edges.filter(
      (e) => nodeMap.has(e.source) && nodeMap.has(e.target) && e.source !== e.target
    );

    const links: any[] = validEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type,
    }));

    const simulation = forceSimulation<SimNode>(nodes)
      .force(
        'link',
        forceLink<SimNode, any>(links)
          .id((d) => d.id)
          .distance(135)
          .strength(0.7)
      )
      .force('charge', forceManyBody().strength(-280))
      .force('center', forceCenter(VIEW_WIDTH / 2, VIEW_HEIGHT / 2).strength(0.6))
      .force('collide', forceCollide<SimNode>().radius(38).strength(0.9));

    simRef.current = simulation;

    simulation.on('tick', () => {
      // Soft boundary clamp
      for (const node of nodes) {
        if (node.x < 45) node.x = 45;
        if (node.x > VIEW_WIDTH - 45) node.x = VIEW_WIDTH - 45;
        if (node.y < 45) node.y = 45;
        if (node.y > VIEW_HEIGHT - 45) node.y = VIEW_HEIGHT - 45;
      }
      setSimNodes([...nodes]);
      setSimLinks([...links]);
    });

    return () => {
      simulation.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph.nodes, graph.edges]);

  // Connected nodes map for hover highlighting
  const connectedNodeIds = useMemo(() => {
    if (hoveredNodeId === null) return null;
    const set = new Set<number>([hoveredNodeId]);
    for (const link of simLinks) {
      const sId = typeof link.source === 'object' ? link.source.id : link.source;
      const tId = typeof link.target === 'object' ? link.target.id : link.target;
      if (sId === hoveredNodeId) set.add(tId);
      if (tId === hoveredNodeId) set.add(sId);
    }
    return set;
  }, [hoveredNodeId, simLinks]);

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
      if (simRef.current) {
        simRef.current.alpha(0.5).restart();
      }
    }
  };

  const handleDeleteRelationship = async (edgeId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Remove this relationship link?')) return;
    const success = await touchpointsCtx.deleteRelationship(edgeId);
    if (success) {
      ui.notify('Relationship removed.');
      await touchpointsCtx.loadGraph();
      if (simRef.current) {
        simRef.current.alpha(0.3).restart();
      }
    }
  };

  const handleNodeClick = (contactId: number) => {
    if (didDragRef.current) return;
    const contact = contacts.find((c) => c.id === contactId);
    if (contact) {
      if (onOpenContact) {
        onOpenContact(contact);
      } else {
        contactsCtx.openContactDrawer(contact);
      }
    }
  };

  // Drag Handlers
  const handleNodePointerDown = (e: React.PointerEvent, nodeId: number) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDraggingNodeId(nodeId);
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    didDragRef.current = false;

    if (simRef.current) {
      simRef.current.alphaTarget(0.3).restart();
      const node = simNodes.find((n) => n.id === nodeId);
      if (node) {
        node.fx = node.x;
        node.fy = node.y;
      }
    }
  };

  const handleSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.target === svgRef.current || (e.target as HTMLElement).tagName === 'svg') {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (draggingNodeId !== null && svgRef.current) {
      const dx = Math.abs(e.clientX - dragStartPosRef.current.x);
      const dy = Math.abs(e.clientY - dragStartPosRef.current.y);
      if (dx > 4 || dy > 4) {
        didDragRef.current = true;
      }

      const rect = svgRef.current.getBoundingClientRect();
      const rawX = ((e.clientX - rect.left) / rect.width) * VIEW_WIDTH;
      const rawY = ((e.clientY - rect.top) / rect.height) * VIEW_HEIGHT;

      // Invert pan and zoom
      const svgX = (rawX - VIEW_WIDTH / 2 - pan.x) / zoom + VIEW_WIDTH / 2;
      const svgY = (rawY - VIEW_HEIGHT / 2 - pan.y) / zoom + VIEW_HEIGHT / 2;

      const node = simNodes.find((n) => n.id === draggingNodeId);
      if (node) {
        node.fx = Math.max(30, Math.min(VIEW_WIDTH - 30, svgX));
        node.fy = Math.max(30, Math.min(VIEW_HEIGHT - 30, svgY));
        if (simRef.current) {
          simRef.current.alpha(0.3).restart();
        }
      }
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
    }
  };

  const handlePointerUp = () => {
    if (draggingNodeId !== null) {
      const node = simNodes.find((n) => n.id === draggingNodeId);
      if (node) {
        node.fx = null;
        node.fy = null;
      }
      if (simRef.current) {
        simRef.current.alphaTarget(0);
      }
      setDraggingNodeId(null);
    }
    if (isPanning) {
      setIsPanning(false);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((prev) => Math.min(2.5, Math.max(0.4, prev * factor)));
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    if (simRef.current) {
      simRef.current.alpha(0.4).restart();
    }
  };

  const getNodeCoordinates = (nodeRef: SimNode | number): { x: number; y: number } | null => {
    if (typeof nodeRef === 'object' && nodeRef !== null) {
      return { x: nodeRef.x, y: nodeRef.y };
    }
    const found = simNodes.find((n) => n.id === nodeRef);
    return found ? { x: found.x, y: found.y } : null;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-foreground">Relationship Map</h1>
          <p className="text-xs text-muted mt-0.5">
            Link spouses, parents, children, siblings, and coworkers to visualize your network
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="px-2.5 py-1 rounded-md bg-well border border-border font-mono">
            {graph.nodes.length} contacts • {graph.edges.length} relationships
          </span>
        </div>
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

      {/* Force-Directed SVG Relationship Graph Container */}
      <div className="relative bg-card border border-border rounded-xl p-2 sm:p-4 h-[460px] flex items-center justify-center shadow-xs overflow-hidden select-none">
        {graph.nodes.length === 0 ? (
          <span className="text-xs text-muted">
            Add contacts and link relationships above to visualize your network graph.
          </span>
        ) : (
          <>
            {/* Graph Controls Toolbar */}
            <div className="absolute top-4 right-4 z-10 flex items-center gap-1 bg-well/90 backdrop-blur-xs border border-border rounded-lg p-1 shadow-xs">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
                title="Zoom In"
                aria-label="Zoom In"
                className="p-1.5 rounded hover:bg-card text-muted hover:text-foreground active:scale-[0.97] motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-primary"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
                title="Zoom Out"
                aria-label="Zoom Out"
                className="p-1.5 rounded hover:bg-card text-muted hover:text-foreground active:scale-[0.97] motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-primary"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleResetView}
                title="Reset View"
                aria-label="Reset View"
                className="p-1.5 rounded hover:bg-card text-muted hover:text-foreground active:scale-[0.97] motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-primary"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Hint pill */}
            <div className="absolute bottom-3 left-4 z-10 pointer-events-none hidden sm:flex items-center gap-1.5 text-[11px] text-muted bg-well/80 backdrop-blur-xs px-2.5 py-1 rounded-md border border-border/60">
              <Info className="w-3.5 h-3.5 text-primary" />
              <span>Drag nodes to pin • Drag background to pan • Scroll to zoom</span>
            </div>

            <svg
              ref={svgRef}
              className={`w-full h-full ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
              viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
              role="img"
              aria-label="Network Relationship Graph"
              onPointerDown={handleSvgPointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onWheel={handleWheel}
            >
              <defs>
                <filter id="node-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              <g
                transform={`translate(${VIEW_WIDTH / 2 + pan.x}, ${VIEW_HEIGHT / 2 + pan.y}) scale(${zoom}) translate(${-VIEW_WIDTH / 2}, ${-VIEW_HEIGHT / 2})`}
              >
                {/* 1. Relationship Edges */}
                {simLinks.map((edge) => {
                  const s = getNodeCoordinates(edge.source);
                  const t = getNodeCoordinates(edge.target);
                  if (!s || !t) return null;
                  if (Number.isNaN(s.x) || Number.isNaN(s.y) || Number.isNaN(t.x) || Number.isNaN(t.y)) {
                    return null;
                  }

                  const sId = typeof edge.source === 'object' ? edge.source.id : edge.source;
                  const tId = typeof edge.target === 'object' ? edge.target.id : edge.target;

                  const isConnectedToHover =
                    hoveredNodeId !== null &&
                    (sId === hoveredNodeId || tId === hoveredNodeId);
                  const isDimmed =
                    hoveredNodeId !== null && !isConnectedToHover;

                  const midX = (s.x + t.x) / 2;
                  const midY = (s.y + t.y) / 2;

                  return (
                    <g
                      key={edge.id}
                      className="motion-safe:transition-opacity motion-safe:duration-150"
                      opacity={isDimmed ? 0.2 : 1}
                    >
                      <line
                        x1={s.x}
                        y1={s.y}
                        x2={t.x}
                        y2={t.y}
                        stroke={
                          isConnectedToHover
                            ? 'var(--tp-primary, #6366f1)'
                            : 'var(--tp-border, #3f4450)'
                        }
                        strokeWidth={isConnectedToHover ? 2.5 : 1.75}
                        strokeDasharray={edge.type === 'introduced_by' ? '4 3' : undefined}
                      />

                      {/* Edge Label Pill */}
                      <g
                        transform={`translate(${midX}, ${midY})`}
                        className="cursor-pointer group"
                        onClick={(e) => handleDeleteRelationship(edge.id, e)}
                      >
                        <rect
                          x="-35"
                          y="-9"
                          width="70"
                          height="18"
                          rx="9"
                          fill="var(--tp-card, #181b20)"
                          stroke={
                            isConnectedToHover
                              ? 'var(--tp-primary, #6366f1)'
                              : 'var(--tp-border, #3f4450)'
                          }
                          strokeWidth="1"
                          className="motion-safe:transition-colors group-hover:stroke-overdue"
                        />
                        <text
                          y="3"
                          fill="var(--tp-muted, #94a3b8)"
                          fontSize="9.5"
                          fontWeight="500"
                          textAnchor="middle"
                          className="group-hover:fill-overdue motion-safe:transition-colors"
                        >
                          {edge.type.replace('_', ' ')}
                        </text>
                      </g>
                    </g>
                  );
                })}

                {/* 2. Contact Nodes */}
                {simNodes.map((node) => {
                  const x = Number.isNaN(node.x) ? VIEW_WIDTH / 2 : node.x;
                  const y = Number.isNaN(node.y) ? VIEW_HEIGHT / 2 : node.y;

                  const isHovered = hoveredNodeId === node.id;
                  const isConnected =
                    connectedNodeIds === null || connectedNodeIds.has(node.id);
                  const isDimmed = !isConnected;

                  const stroke =
                    node.status === 'overdue'
                      ? 'var(--tp-overdue, #ef4444)'
                      : node.status === 'due_soon'
                      ? 'var(--tp-warning, #f59e0b)'
                      : node.status === 'on_track' || node.status === 'due_today'
                      ? 'var(--tp-success, #10b981)'
                      : 'var(--tp-border, #475569)';

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${x},${y})`}
                      onPointerDown={(e) => handleNodePointerDown(e, node.id)}
                      onClick={() => handleNodeClick(node.id)}
                      onMouseEnter={() => setHoveredNodeId(node.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                      className="cursor-pointer motion-safe:transition-opacity motion-safe:duration-150"
                      opacity={isDimmed ? 0.25 : 1}
                      filter={isHovered ? 'url(#node-glow)' : undefined}
                    >
                      {/* Node Avatar Circle */}
                      <circle
                        r={isHovered ? 26 : 23}
                        fill="var(--tp-well, #1f2329)"
                        stroke={stroke}
                        strokeWidth={isHovered ? 3.5 : 2.5}
                        className="motion-safe:transition-colors motion-safe:duration-150"
                      />

                      {/* Initials */}
                      <text
                        dy="4"
                        fill="var(--tp-text, #f8fafc)"
                        fontSize="11"
                        fontWeight="700"
                        textAnchor="middle"
                        pointerEvents="none"
                      >
                        {node.fullName.slice(0, 2).toUpperCase()}
                      </text>

                      {/* Contact Name Label Badge */}
                      <g transform="translate(0, 36)" pointerEvents="none">
                        <text
                          dy="0"
                          fill="var(--tp-text, #f8fafc)"
                          fontSize="11"
                          fontWeight={isHovered ? '700' : '500'}
                          textAnchor="middle"
                          stroke="var(--tp-well, #1f2329)"
                          strokeWidth="3"
                          paintOrder="stroke"
                        >
                          {node.fullName}
                        </text>
                      </g>
                    </g>
                  );
                })}
              </g>
            </svg>
          </>
        )}
      </div>
    </div>
  );
}
