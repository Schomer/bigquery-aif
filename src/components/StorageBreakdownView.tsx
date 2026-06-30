'use client';

import type { StorageBreakdownResult, StorageItem } from '@/lib/types';
import { useState, useMemo } from 'react';

interface Props {
  result: StorageBreakdownResult;
  onSendMessage?: (msg: string) => void;
}

interface TreemapRect {
  item: StorageItem;
  x: number;
  y: number;
  width: number;
  height: number;
  colorIndex: number;
}

interface TooltipState {
  item: StorageItem;
  x: number;
  y: number;
  total: number;
}

const PALETTE = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#84cc16', '#6366f1', '#14b8a6',
];

const GAP = 2;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, i);
  return `${val < 10 ? val.toFixed(2) : val < 100 ? val.toFixed(1) : val.toFixed(0)} ${units[i]}`;
}

// ─── Squarified Treemap ───────────────────────────────────────────────────────

function squarify(
  items: StorageItem[],
  x: number,
  y: number,
  w: number,
  h: number,
  startColorIndex: number,
): TreemapRect[] {
  if (items.length === 0 || w <= 0 || h <= 0) return [];

  const totalSize = items.reduce((s, it) => s + it.sizeBytes, 0);
  if (totalSize === 0) return [];

  const sorted = [...items].sort((a, b) => b.sizeBytes - a.sizeBytes);
  const areas = sorted.map(it => (it.sizeBytes / totalSize) * w * h);

  const rects: TreemapRect[] = [];
  let ci = startColorIndex;

  function layoutRow(row: number[], rowArea: number, remaining: number[], remAreas: number[], rx: number, ry: number, rw: number, rh: number) {
    const isHorizontal = rw >= rh;
    const totalRowArea = row.reduce((s, idx) => s + areas[idx], 0);
    const side = isHorizontal ? totalRowArea / rh : totalRowArea / rw;

    let offset = 0;
    for (const idx of row) {
      const itemArea = areas[idx];
      const span = side > 0 ? itemArea / side : 0;
      const px = isHorizontal ? rx : rx + offset;
      const py = isHorizontal ? ry + offset : ry;
      const pw = isHorizontal ? side : span;
      const ph = isHorizontal ? span : side;

      rects.push({
        item: sorted[idx],
        x: px + GAP,
        y: py + GAP,
        width: Math.max(0, pw - GAP * 2),
        height: Math.max(0, ph - GAP * 2),
        colorIndex: ci++ % PALETTE.length,
      });
      offset += span;
    }

    // Recurse on remaining
    if (remaining.length > 0) {
      const nx = isHorizontal ? rx + side : rx;
      const ny = isHorizontal ? ry : ry + side;
      const nw = isHorizontal ? rw - side : rw;
      const nh = isHorizontal ? rh : rh - side;
      layoutRemaining(remaining, remAreas, nx, ny, nw, nh);
    }
  }

  function worstRatio(row: number[], side: number): number {
    if (side <= 0) return Infinity;
    let worst = 0;
    for (const idx of row) {
      const a = areas[idx];
      const span = a / side;
      const ratio = Math.max(side / span, span / side);
      if (ratio > worst) worst = ratio;
    }
    return worst;
  }

  function layoutRemaining(indices: number[], _remAreas: number[], rx: number, ry: number, rw: number, rh: number) {
    if (indices.length === 0 || rw <= 0 || rh <= 0) return;
    if (indices.length === 1) {
      rects.push({
        item: sorted[indices[0]],
        x: rx + GAP,
        y: ry + GAP,
        width: Math.max(0, rw - GAP * 2),
        height: Math.max(0, rh - GAP * 2),
        colorIndex: ci++ % PALETTE.length,
      });
      return;
    }

    const isHorizontal = rw >= rh;
    const shortSide = isHorizontal ? rh : rw;

    const row: number[] = [indices[0]];
    let rowArea = areas[indices[0]];
    let side = rowArea / shortSide;
    let currentWorst = worstRatio(row, side);

    let i = 1;
    for (; i < indices.length; i++) {
      const candidate = [...row, indices[i]];
      const candidateArea = rowArea + areas[indices[i]];
      const candidateSide = candidateArea / shortSide;
      const candidateWorst = worstRatio(candidate, candidateSide);
      if (candidateWorst > currentWorst) break;
      row.push(indices[i]);
      rowArea = candidateArea;
      side = candidateSide;
      currentWorst = candidateWorst;
    }

    const remaining = indices.slice(i);
    const remAreas = remaining.map(idx => areas[idx]);
    layoutRow(row, rowArea, remaining, remAreas, rx, ry, rw, rh);
  }

  const allIndices = sorted.map((_, i) => i);
  layoutRemaining(allIndices, areas, x, y, w, h);

  return rects;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StorageBreakdownView({ result, onSendMessage }: Props) {
  const send = onSendMessage ?? (() => {});
  const { project, totalBytes, items } = result;

  const [drilledDataset, setDrilledDataset] = useState<StorageItem | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const datasets = items.filter(it => it.type === 'DATASET');
  const allTables = items.filter(it => it.type === 'TABLE')
    .concat(datasets.flatMap(d => d.children ?? []));

  const largestDataset = datasets.length > 0
    ? datasets.reduce((a, b) => a.sizeBytes > b.sizeBytes ? a : b)
    : null;

  const currentItems = drilledDataset?.children ?? datasets;
  const currentTotal = drilledDataset
    ? (drilledDataset.children ?? []).reduce((s, c) => s + c.sizeBytes, 0)
    : totalBytes;

  const rects = useMemo(
    () => squarify(currentItems, 0, 0, 800, 400, 0),
    [currentItems],
  );

  function handleRectClick(rect: TreemapRect, e: React.MouseEvent) {
    e.stopPropagation();
    if (rect.item.type === 'DATASET' && rect.item.children && rect.item.children.length > 0) {
      setDrilledDataset(rect.item);
      setTooltip(null);
    } else if (rect.item.type === 'TABLE') {
      send(`Show me the schema for ${rect.item.ref}`);
    }
  }

  function handleMouseMove(rect: TreemapRect, e: React.MouseEvent<SVGRectElement>) {
    const svg = e.currentTarget.closest('svg');
    if (!svg) return;
    const svgRect = svg.getBoundingClientRect();
    setTooltip({
      item: rect.item,
      x: e.clientX - svgRect.left,
      y: e.clientY - svgRect.top,
      total: currentTotal,
    });
  }

  function handleMouseLeave() {
    setTooltip(null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary bar */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <StatCard label="Total Storage" value={formatBytes(totalBytes)} />
        <StatCard label="Datasets" value={String(datasets.length)} />
        <StatCard label="Tables" value={String(allTables.length)} />
        {largestDataset && (
          <StatCard label="Largest Dataset" value={largestDataset.label} mono />
        )}
      </div>

      {/* Breadcrumb */}
      {drilledDataset && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <button
            onClick={() => { setDrilledDataset(null); setTooltip(null); }}
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 11,
              color: 'var(--accent)',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Back
          </button>
          <span style={{ color: 'var(--text-dim)' }}>{project}</span>
          <span style={{ color: 'var(--text-dim)' }}>/</span>
          <span style={{ color: 'var(--text)', fontWeight: 500 }}>{drilledDataset.label}</span>
          <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>
            ({formatBytes(drilledDataset.sizeBytes)})
          </span>
        </div>
      )}

      {/* Treemap */}
      <div style={{ position: 'relative' }}>
        <svg
          viewBox="0 0 800 400"
          style={{
            width: '100%',
            height: 400,
            display: 'block',
            borderRadius: 8,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
          }}
        >
          {rects.map((rect, i) => (
            <g key={`${rect.item.ref}-${i}`}>
              <rect
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                rx={4}
                fill={PALETTE[rect.colorIndex]}
                fillOpacity={0.85}
                stroke={PALETTE[rect.colorIndex]}
                strokeOpacity={0.4}
                strokeWidth={1}
                style={{ cursor: 'pointer', transition: 'fill-opacity 0.15s' }}
                onClick={(e) => handleRectClick(rect, e)}
                onMouseMove={(e) => handleMouseMove(rect, e)}
                onMouseLeave={handleMouseLeave}
                onMouseEnter={(e) => {
                  e.currentTarget.setAttribute('fill-opacity', '1');
                }}
                onMouseOut={(e) => {
                  e.currentTarget.setAttribute('fill-opacity', '0.85');
                }}
              />
              {rect.width > 60 && rect.height > 30 && (
                <>
                  <text
                    x={rect.x + 8}
                    y={rect.y + 18}
                    fontSize={11}
                    fontWeight={600}
                    fill="#fff"
                    pointerEvents="none"
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
                  >
                    {truncateLabel(rect.item.label, rect.width - 16)}
                  </text>
                  <text
                    x={rect.x + 8}
                    y={rect.y + 33}
                    fontSize={10}
                    fill="rgba(255,255,255,0.75)"
                    pointerEvents="none"
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                  >
                    {formatBytes(rect.item.sizeBytes)}
                  </text>
                </>
              )}
            </g>
          ))}
        </svg>

        {/* Tooltip overlay */}
        {tooltip && (
          <div
            style={{
              position: 'absolute',
              left: tooltip.x + 12,
              top: tooltip.y - 10,
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 12,
              color: 'var(--text)',
              pointerEvents: 'none',
              zIndex: 10,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              whiteSpace: 'nowrap',
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 13 }}>{tooltip.item.label}</span>
            <span style={{ color: 'var(--text-muted)' }}>
              Size: {formatBytes(tooltip.item.sizeBytes)}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>
              Rows: {tooltip.item.rowCount.toLocaleString()}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>
              {tooltip.total > 0
                ? `${((tooltip.item.sizeBytes / tooltip.total) * 100).toFixed(1)}% of ${drilledDataset ? 'dataset' : 'total'}`
                : '0%'}
            </span>
          </div>
        )}
      </div>

      {/* Legend hint */}
      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
        {drilledDataset
          ? 'Click a table to view its schema.'
          : 'Click a dataset to drill into its tables.'}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{
      background: 'var(--surface-2)',
      borderRadius: 8,
      padding: '12px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
    }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
        {label}
      </span>
      <span style={{
        fontSize: 16,
        fontWeight: 700,
        color: 'var(--text)',
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
      }}>
        {value}
      </span>
    </div>
  );
}

function truncateLabel(label: string, maxWidth: number): string {
  // Rough estimate: ~6.5px per character at 11px font
  const maxChars = Math.floor(maxWidth / 6.5);
  if (label.length <= maxChars) return label;
  return label.slice(0, Math.max(0, maxChars - 1)) + '\u2026';
}
