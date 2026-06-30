'use client';

import type { DiscoveryResult, LineageNode, LineageEdge } from '@/lib/types';
import { useState, useMemo } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────

const SVG_W = 900;
const SVG_H = 500;
const NODE_W = 180;
const NODE_H = 50;
const TARGET_W = 200;
const TARGET_H = 56;
const EDGE_COLOR = '#94a3b8';

const TYPE_COLORS: Record<string, string> = {
  TABLE: '#3b82f6',
  VIEW: '#8b5cf6',
  EXTERNAL: '#f59e0b',
  TARGET: '#10b981',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortLabel(ref: string): string {
  const parts = ref.split('.');
  return parts[parts.length - 1];
}

function clampStroke(jobCount: number): number {
  return Math.min(4, Math.max(1.5, 1.5 + (jobCount - 1) * 0.5));
}

interface LayoutNode {
  node: LineageNode;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface LayoutEdge {
  edge: LineageEdge;
  from: LayoutNode;
  to: LayoutNode;
}

// ─── Layout computation ───────────────────────────────────────────────────────

function computeLayout(
  nodes: LineageNode[],
  edges: LineageEdge[],
  targetId: string,
): { layoutNodes: LayoutNode[]; layoutEdges: LayoutEdge[] } {
  const upstream = nodes.filter(
    (n) => n.id !== targetId && edges.some((e) => e.target === targetId && e.source === n.id),
  );
  const downstream = nodes.filter(
    (n) => n.id !== targetId && edges.some((e) => e.source === targetId && e.target === n.id),
  );
  const targetNode = nodes.find((n) => n.id === targetId);

  const colX = { left: 60, center: SVG_W / 2, right: SVG_W - 60 };

  function distributeColumn(
    items: LineageNode[],
    cx: number,
    isTarget: boolean,
  ): LayoutNode[] {
    if (items.length === 0) return [];
    const w = isTarget ? TARGET_W : NODE_W;
    const h = isTarget ? TARGET_H : NODE_H;
    const totalH = items.length * h + (items.length - 1) * 20;
    const startY = (SVG_H - totalH) / 2;
    return items.map((node, i) => ({
      node,
      x: cx - w / 2,
      y: startY + i * (h + 20),
      w,
      h,
    }));
  }

  const leftNodes = distributeColumn(upstream, colX.left + NODE_W / 2 - 30, false);
  const centerNodes = targetNode
    ? distributeColumn([targetNode], colX.center, true)
    : [];
  const rightNodes = distributeColumn(downstream, colX.right - NODE_W / 2 + 30, false);

  const all = [...leftNodes, ...centerNodes, ...rightNodes];
  const nodeMap = new Map<string, LayoutNode>();
  for (const ln of all) nodeMap.set(ln.node.id, ln);

  const layoutEdges: LayoutEdge[] = [];
  for (const edge of edges) {
    const from = nodeMap.get(edge.source);
    const to = nodeMap.get(edge.target);
    if (from && to) layoutEdges.push({ edge, from, to });
  }

  return { layoutNodes: all, layoutEdges };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  result: DiscoveryResult;
  onSendMessage?: (msg: string) => void;
}

export function LineageDagView({ result, onSendMessage }: Props) {
  const send = onSendMessage ?? (() => {});
  const lineage = result.lineage;

  // ── Empty state ──
  if (!lineage) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, padding: '8px 0' }}>
        No lineage data available. This may be due to permissions or no recent job activity.
      </p>
    );
  }

  if (lineage.readsFrom.length === 0 && lineage.writtenBy.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, padding: '8px 0' }}>
        No upstream or downstream dependencies found in the last 30 days.
      </p>
    );
  }

  return <DagGraph lineage={lineage} onSendMessage={send} />;
}

// ─── Inner graph component (avoids hook issues with early returns) ─────────

interface DagGraphProps {
  lineage: NonNullable<DiscoveryResult['lineage']>;
  onSendMessage: (msg: string) => void;
}

function DagGraph({ lineage, onSendMessage }: DagGraphProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    content: React.ReactNode;
  } | null>(null);

  // ── Backward-compat: synthesize nodes/edges if missing ──
  const { nodes, edges } = useMemo(() => {
    if (lineage.nodes && lineage.edges) {
      return { nodes: lineage.nodes, edges: lineage.edges };
    }

    const synNodes: LineageNode[] = [];
    const synEdges: LineageEdge[] = [];

    synNodes.push({
      id: lineage.tableName,
      label: shortLabel(lineage.tableName),
      type: 'TARGET',
      dataset: '',
    });

    for (const ref of lineage.readsFrom) {
      synNodes.push({
        id: ref,
        label: shortLabel(ref),
        type: 'TABLE',
        dataset: '',
      });
      synEdges.push({
        source: ref,
        target: lineage.tableName,
        jobCount: 1,
        lastSeen: '',
        statementTypes: [],
      });
    }

    for (const ref of lineage.writtenBy) {
      synNodes.push({
        id: ref,
        label: shortLabel(ref),
        type: 'TABLE',
        dataset: '',
      });
      synEdges.push({
        source: lineage.tableName,
        target: ref,
        jobCount: 1,
        lastSeen: '',
        statementTypes: [],
      });
    }

    return { nodes: synNodes, edges: synEdges };
  }, [lineage]);

  const { layoutNodes, layoutEdges } = useMemo(
    () => computeLayout(nodes, edges, lineage.tableName),
    [nodes, edges, lineage.tableName],
  );

  // ── Edge path builder ──
  function edgePath(from: LayoutNode, to: LayoutNode): string {
    const x1 = from.x + from.w;
    const y1 = from.y + from.h / 2;
    const x2 = to.x;
    const y2 = to.y + to.h / 2;
    const dx = (x2 - x1) * 0.5;
    return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
  }

  function edgeKey(e: LineageEdge): string {
    return `${e.source}-->${e.target}`;
  }

  // ── Tooltip handlers ──
  function showNodeTooltip(ln: LayoutNode, evt: React.MouseEvent) {
    const rect = (evt.currentTarget as Element).closest('svg')!.getBoundingClientRect();
    const px = evt.clientX - rect.left;
    const py = evt.clientY - rect.top;
    const n = ln.node;
    setTooltip({
      x: px,
      y: py - 10,
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, wordBreak: 'break-all' }}>{n.id}</span>
          {n.rowCount != null && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Rows: {n.rowCount.toLocaleString()}
            </span>
          )}
          {n.lastModified && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Modified: {n.lastModified}
            </span>
          )}
        </div>
      ),
    });
  }

  function showEdgeTooltip(le: LayoutEdge, evt: React.MouseEvent) {
    const rect = (evt.currentTarget as Element).closest('svg')!.getBoundingClientRect();
    const px = evt.clientX - rect.left;
    const py = evt.clientY - rect.top;
    const e = le.edge;
    setTooltip({
      x: px,
      y: py - 10,
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 11 }}>Jobs: {e.jobCount}</span>
          {e.lastSeen && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Last seen: {e.lastSeen}</span>
          )}
          {e.statementTypes.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Types: {e.statementTypes.join(', ')}
            </span>
          )}
        </div>
      ),
    });
  }

  function hideTooltip() {
    setTooltip(null);
    setHoveredNode(null);
    setHoveredEdge(null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ position: 'relative', width: '100%', height: 420 }}>
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          style={{ width: '100%', height: '100%' }}
          onMouseLeave={hideTooltip}
        >
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 Z" fill={EDGE_COLOR} />
            </marker>
          </defs>

          {/* Edges */}
          {layoutEdges.map((le) => {
            const key = edgeKey(le.edge);
            const isHovered = hoveredEdge === key;
            return (
              <path
                key={key}
                d={edgePath(le.from, le.to)}
                fill="none"
                stroke={isHovered ? '#64748b' : EDGE_COLOR}
                strokeWidth={clampStroke(le.edge.jobCount)}
                strokeOpacity={isHovered ? 1 : 0.6}
                markerEnd="url(#arrow)"
                style={{ cursor: 'default', transition: 'stroke-opacity 0.12s' }}
                onMouseEnter={(evt) => {
                  setHoveredEdge(key);
                  showEdgeTooltip(le, evt);
                }}
                onMouseMove={(evt) => showEdgeTooltip(le, evt)}
                onMouseLeave={hideTooltip}
              />
            );
          })}

          {/* Nodes */}
          {layoutNodes.map((ln) => {
            const isTarget = ln.node.type === 'TARGET';
            const isHovered = hoveredNode === ln.node.id;
            const fill = TYPE_COLORS[ln.node.type] ?? TYPE_COLORS.TABLE;
            const hoverFill = isHovered ? lighten(fill, 0.15) : fill;

            return (
              <g
                key={ln.node.id}
                style={{ cursor: 'pointer' }}
                onClick={() => onSendMessage(`Show me the lineage for ${ln.node.id}`)}
                onMouseEnter={(evt) => {
                  setHoveredNode(ln.node.id);
                  showNodeTooltip(ln, evt);
                }}
                onMouseMove={(evt) => showNodeTooltip(ln, evt)}
                onMouseLeave={hideTooltip}
              >
                <rect
                  x={ln.x}
                  y={ln.y}
                  width={ln.w}
                  height={ln.h}
                  rx={8}
                  fill={hoverFill}
                  fillOpacity={0.15}
                  stroke={hoverFill}
                  strokeWidth={isTarget ? 2.5 : 1.5}
                  style={{ transition: 'fill 0.12s, stroke 0.12s' }}
                />
                <text
                  x={ln.x + ln.w / 2}
                  y={ln.y + ln.h / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={hoverFill}
                  fontSize={isTarget ? 13 : 12}
                  fontWeight={isTarget ? 600 : 500}
                  fontFamily="var(--font-mono)"
                >
                  {truncateLabel(ln.node.label, ln.w - 24)}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Tooltip overlay */}
        {tooltip && (
          <div
            style={{
              position: 'absolute',
              left: tooltip.x,
              top: tooltip.y,
              transform: 'translate(-50%, -100%)',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '6px 10px',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              fontSize: 12,
              color: 'var(--text)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
              zIndex: 10,
            }}
          >
            {tooltip.content}
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '0 4px' }}>
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: color,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {type.charAt(0) + type.slice(1).toLowerCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function lighten(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.min(255, Math.round(r + (255 - r) * amount));
  const ng = Math.min(255, Math.round(g + (255 - g) * amount));
  const nb = Math.min(255, Math.round(b + (255 - b) * amount));
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

function truncateLabel(label: string, maxPxApprox: number): string {
  // Rough character budget at ~7px per char in a monospace font
  const maxChars = Math.floor(maxPxApprox / 7);
  if (label.length <= maxChars) return label;
  return label.slice(0, maxChars - 1) + '\u2026';
}
