'use client';

import type { ErDiagramData, ErTableInfo, ErRelationship } from '@/lib/types';
import React, { useState, useMemo } from 'react';

interface Props {
  data: ErDiagramData;
  onSendMessage?: (msg: string) => void;
}

// ─── Layout constants ─────────────────────────────────────────────────────────

const CARD_W = 220;
const HEADER_H = 36;
const ROW_H = 22;
const MIN_CARD_H = 80;
const GAP_X = 100;
const GAP_Y = 40;
const PAD = 30;

// ─── Layout computation ──────────────────────────────────────────────────────

interface CardLayout {
  table: ErTableInfo;
  x: number;
  y: number;
  w: number;
  h: number;
  /** y-offset for each column row (center of the row), keyed by column name */
  colY: Record<string, number>;
}

function computeLayout(tables: ErTableInfo[]): {
  cards: CardLayout[];
  svgW: number;
  svgH: number;
} {
  const cols = tables.length < 4 ? 2 : 3;
  const cards: CardLayout[] = [];

  // First pass: compute per-row max heights for alignment
  const rowCount = Math.ceil(tables.length / cols);
  const rowMaxH: number[] = Array(rowCount).fill(MIN_CARD_H);

  for (let i = 0; i < tables.length; i++) {
    const row = Math.floor(i / cols);
    const h = Math.max(HEADER_H + tables[i].columns.length * ROW_H, MIN_CARD_H);
    rowMaxH[row] = Math.max(rowMaxH[row], h);
  }

  // Second pass: position cards
  for (let i = 0; i < tables.length; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const x = PAD + col * (CARD_W + GAP_X);
    let y = PAD;
    for (let r = 0; r < row; r++) y += rowMaxH[r] + GAP_Y;
    const h = Math.max(HEADER_H + tables[i].columns.length * ROW_H, MIN_CARD_H);

    // Sort columns: PK first, then the rest
    const sorted = [...tables[i].columns].sort((a, b) => {
      if (a.isPk && !b.isPk) return -1;
      if (!a.isPk && b.isPk) return 1;
      return 0;
    });

    const colY: Record<string, number> = {};
    sorted.forEach((c, ci) => {
      colY[c.name] = HEADER_H + ci * ROW_H + ROW_H / 2;
    });

    cards.push({ table: tables[i], x, y, w: CARD_W, h, colY });
  }

  const maxCol = Math.min(tables.length, cols);
  const svgW = PAD * 2 + maxCol * CARD_W + (maxCol - 1) * GAP_X;
  let svgH = PAD * 2;
  for (const h of rowMaxH) svgH += h + GAP_Y;
  svgH -= GAP_Y; // remove trailing gap

  return { cards, svgW: Math.max(svgW, 300), svgH: Math.max(svgH, 120) };
}

// ─── Relationship path computation ───────────────────────────────────────────

interface RelPath {
  rel: ErRelationship;
  d: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function computeRelPaths(
  relationships: ErRelationship[],
  cardMap: Map<string, CardLayout>,
): RelPath[] {
  return relationships
    .map((rel) => {
      const from = cardMap.get(rel.fromTable);
      const to = cardMap.get(rel.toTable);
      if (!from || !to) return null;

      // Use the first column in the FK set for anchor points
      const fromColName = rel.fromColumns[0];
      const toColName = rel.toColumns[0];
      const fromRowY = from.colY[fromColName] ?? HEADER_H + ROW_H / 2;
      const toRowY = to.colY[toColName] ?? HEADER_H + ROW_H / 2;

      // Determine which side to exit/enter
      const fromCx = from.x + from.w / 2;
      const toCx = to.x + to.w / 2;
      let x1: number, y1: number, x2: number, y2: number;

      if (fromCx < toCx) {
        // from is left of to
        x1 = from.x + from.w;
        x2 = to.x;
      } else if (fromCx > toCx) {
        // from is right of to
        x1 = from.x;
        x2 = to.x + to.w;
      } else {
        // same column — exit right, enter left
        x1 = from.x + from.w;
        x2 = to.x + to.w;
      }
      y1 = from.y + fromRowY;
      y2 = to.y + toRowY;

      const dx = Math.abs(x2 - x1);
      const cpOffset = Math.max(dx * 0.45, 40);
      const cp1x = x1 < x2 ? x1 + cpOffset : x1 - cpOffset;
      const cp2x = x1 < x2 ? x2 - cpOffset : x2 + cpOffset;

      const d = `M ${x1} ${y1} C ${cp1x} ${y1}, ${cp2x} ${y2}, ${x2} ${y2}`;

      return { rel, d, x1, y1, x2, y2 } as RelPath;
    })
    .filter((p): p is RelPath => p !== null);
}

// ─── Main component ──────────────────────────────────────────────────────────

export function ErDiagramView({ data, onSendMessage }: Props) {
  const send = onSendMessage ?? (() => {});
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [hoveredRel, setHoveredRel] = useState<number | null>(null);

  const { cards, svgW, svgH } = useMemo(
    () => computeLayout(data.tables),
    [data.tables],
  );

  const cardMap = useMemo(() => {
    const m = new Map<string, CardLayout>();
    for (const c of cards) m.set(c.table.name, c);
    return m;
  }, [cards]);

  const relPaths = useMemo(
    () => computeRelPaths(data.relationships, cardMap),
    [data.relationships, cardMap],
  );

  // ── Empty state ──
  if (data.tables.length === 0) {
    return (
      <div style={{
        padding: '32px 16px',
        textAlign: 'center',
        color: 'var(--text-dim)',
        fontSize: 13,
      }}>
        No tables found in this dataset.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        padding: '0 2px',
      }}>
        <span style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--text)',
          fontFamily: 'var(--font-mono)',
        }}>
          {data.dataset}
        </span>
        <span style={{
          fontSize: 11,
          color: 'var(--text-dim)',
        }}>
          {data.tables.length} table{data.tables.length !== 1 ? 's' : ''}
          {data.relationships.length > 0 &&
            ` / ${data.relationships.length} relationship${data.relationships.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* SVG diagram */}
      <div style={{
        maxHeight: 500,
        overflow: 'auto',
        borderRadius: 8,
        border: '1px solid var(--border-subtle)',
        background: 'var(--surface-2)',
      }}>
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          width={svgW}
          height={svgH}
          style={{ display: 'block' }}
        >
          {/* Relationship lines (behind cards) */}
          {relPaths.map((rp, i) => (
            <RelLine
              key={i}
              rp={rp}
              isHovered={hoveredRel === i}
              onMouseEnter={() => setHoveredRel(i)}
              onMouseLeave={() => setHoveredRel(null)}
            />
          ))}

          {/* Table cards */}
          {cards.map((card) => (
            <TableCard
              key={card.table.name}
              card={card}
              dataset={data.dataset}
              isHovered={hoveredCard === card.table.name}
              onMouseEnter={() => setHoveredCard(card.table.name)}
              onMouseLeave={() => setHoveredCard(null)}
              onClick={() => send(`Show me ${data.dataset}.${card.table.name}`)}
            />
          ))}

          {/* Relationship tooltips (rendered last, on top) */}
          {hoveredRel !== null && relPaths[hoveredRel] && (
            <RelTooltip rp={relPaths[hoveredRel]} />
          )}
        </svg>
      </div>

      {/* No-relationships note */}
      {data.tables.length > 0 && data.relationships.length === 0 && (
        <div style={{
          fontSize: 11,
          color: 'var(--text-dim)',
          padding: '4px 2px',
        }}>
          No foreign key relationships defined.
        </div>
      )}
    </div>
  );
}

// ─── Table card SVG group ────────────────────────────────────────────────────

function TableCard({
  card,
  dataset,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: {
  card: CardLayout;
  dataset: string;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}) {
  // Sort columns: PK first
  const sorted = useMemo(
    () =>
      [...card.table.columns].sort((a, b) => {
        if (a.isPk && !b.isPk) return -1;
        if (!a.isPk && b.isPk) return 1;
        return 0;
      }),
    [card.table.columns],
  );

  return (
    <g
      transform={`translate(${card.x}, ${card.y})`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      {/* Card background */}
      <rect
        width={card.w}
        height={card.h}
        rx={8}
        fill="#ffffff"
        stroke={isHovered ? 'var(--accent)' : 'var(--border)'}
        strokeWidth={isHovered ? 1.5 : 1}
      />

      {/* Header bar */}
      <rect
        width={card.w}
        height={HEADER_H}
        rx={8}
        fill="#f1f5f9"
      />
      {/* Square off bottom corners of header */}
      <rect
        y={HEADER_H - 8}
        width={card.w}
        height={8}
        fill="#f1f5f9"
      />
      {/* Separator line */}
      <line
        x1={0}
        y1={HEADER_H}
        x2={card.w}
        y2={HEADER_H}
        stroke="var(--border)"
        strokeWidth={0.5}
      />

      {/* Table name */}
      <text
        x={12}
        y={HEADER_H / 2 + 1}
        dominantBaseline="central"
        style={{
          fontSize: 12,
          fontWeight: 600,
          fill: 'var(--text)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {truncate(card.table.name, 24)}
      </text>

      {/* Column rows */}
      {sorted.map((col, ci) => {
        const rowY = HEADER_H + ci * ROW_H;
        return (
          <g key={col.name} transform={`translate(0, ${rowY})`}>
            {/* PK indicator: small filled diamond */}
            {col.isPk && (
              <g transform={`translate(10, ${ROW_H / 2})`}>
                <polygon
                  points="0,-4 4,0 0,4 -4,0"
                  fill="#f59e0b"
                  stroke="#d97706"
                  strokeWidth={0.5}
                />
              </g>
            )}

            {/* Column name */}
            <text
              x={col.isPk ? 20 : 12}
              y={ROW_H / 2 + 1}
              dominantBaseline="central"
              style={{
                fontSize: 11,
                fill: 'var(--text)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {truncate(col.name, 18)}
            </text>

            {/* Column type */}
            <text
              x={card.w - 8}
              y={ROW_H / 2 + 1}
              dominantBaseline="central"
              textAnchor="end"
              style={{
                fontSize: 10,
                fill: 'var(--text-dim)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {col.type}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// ─── Relationship line ───────────────────────────────────────────────────────

function RelLine({
  rp,
  isHovered,
  onMouseEnter,
  onMouseLeave,
}: {
  rp: RelPath;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const isFk = rp.rel.type === 'FOREIGN_KEY';
  const baseColor = isFk ? '#6366f1' : '#94a3b8';
  const strokeColor = isHovered ? '#818cf8' : baseColor;
  const strokeW = isHovered ? 2.5 : 1.5;

  return (
    <g onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      {/* Invisible wider path for easier hover target */}
      <path
        d={rp.d}
        fill="none"
        stroke="transparent"
        strokeWidth={12}
        style={{ cursor: 'pointer' }}
      />

      {/* Visible path */}
      <path
        d={rp.d}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeW}
        strokeDasharray={isFk ? 'none' : '6 3'}
        style={{ transition: 'stroke 0.15s, stroke-width 0.15s' }}
      />

      {/* Dot at start */}
      <circle
        cx={rp.x1}
        cy={rp.y1}
        r={isHovered ? 4 : 3}
        fill={strokeColor}
        style={{ transition: 'r 0.15s, fill 0.15s' }}
      />

      {/* Dot at end */}
      <circle
        cx={rp.x2}
        cy={rp.y2}
        r={isHovered ? 4 : 3}
        fill={strokeColor}
        style={{ transition: 'r 0.15s, fill 0.15s' }}
      />
    </g>
  );
}

// ─── Relationship tooltip ────────────────────────────────────────────────────

function RelTooltip({ rp }: { rp: RelPath }) {
  const midX = (rp.x1 + rp.x2) / 2;
  const midY = (rp.y1 + rp.y2) / 2;
  const label = `${rp.rel.fromTable}.${rp.rel.fromColumns.join(',')}  ->  ${rp.rel.toTable}.${rp.rel.toColumns.join(',')}`;
  const typeLabel = rp.rel.type === 'FOREIGN_KEY' ? 'FK' : 'Inferred';

  // Estimate text width roughly
  const textW = Math.min(label.length * 6 + 40, 340);
  const boxH = 28;

  return (
    <g>
      <rect
        x={midX - textW / 2}
        y={midY - boxH - 6}
        width={textW}
        height={boxH}
        rx={6}
        fill="rgba(15, 23, 42, 0.92)"
      />
      <text
        x={midX}
        y={midY - boxH / 2 - 6}
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          fontSize: 10,
          fill: '#e2e8f0',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <tspan fill="#94a3b8">[{typeLabel}]</tspan>
        {' '}
        {truncate(label, 48)}
      </text>
    </g>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '\u2026' : s;
}
