'use client';

// BuilderPage: document editor canvas rendered inside a builder tab.
// Shows a grid of tiles that the user has added from chat results.
// Supports rename, remove tiles, save, and discard.

import { useState, useCallback } from 'react';
import { useBuilder } from '@/lib/builder-context';
import { usePage } from '@/lib/page-context';
import type { BuilderTile } from '@/lib/builder-types';
import { ChartView } from './ChartView';
import { DataTable } from './DataTable';
import { KpiCard } from './KpiCard';
import { StatRowCard } from './StatRowCard';
import { PresentationView } from './PresentationView';
import type { QueryResult } from '@/lib/types';

const DOC_TYPE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  app: 'App',
  report: 'Report',
  recipe: 'Recipe',
};

const DOC_TYPE_ICONS: Record<string, string> = {
  dashboard: 'dashboard',
  app: 'widgets',
  report: 'description',
  recipe: 'receipt_long',
};

// Chart-type artifact types that should render via ChartView
const CHART_TYPES = new Set<string>([
  'LINE_CHART', 'BAR_CHART', 'AREA_CHART', 'SCATTER', 'PIE_CHART',
  'DONUT_CHART', 'COLUMN_CHART', 'HISTOGRAM', 'SPARKLINE',
  'RADAR', 'FUNNEL', 'TREEMAP', 'SANKEY', 'COMPOSED_CHART',
  'GAUGE', 'HEATMAP', 'BOXPLOT', 'CANDLESTICK',
  'VIOLIN', 'DENSITY_PLOT', 'RIDGELINE', 'NETWORK_GRAPH', 'TILE_MAP',
  'GEO_POINT_MAP', 'USA_MAP', 'WORLD_MAP',
]);

interface Props {
  documentId: string;
}

export function BuilderPage({ documentId }: Props) {
  const builder = useBuilder();
  const { closeTab } = usePage();
  const document = builder.getDocument(documentId);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await builder.saveDocument(documentId);
    } finally {
      setSaving(false);
    }
  }, [builder, documentId]);

  const handleDiscard = useCallback(() => {
    if (builder.hasUnsavedChanges(documentId)) {
      const ok = window.confirm('Discard unsaved changes?');
      if (!ok) return;
    }
    builder.discardDocument(documentId);
    closeTab(`builder:${documentId}`);
  }, [builder, documentId, closeTab]);

  if (!document) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        Document not found.
      </div>
    );
  }

  const unsaved = builder.hasUnsavedChanges(documentId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--chat-bg, #f8f9fa)' }}>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 20px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface, #fff)',
          flexShrink: 0,
        }}
      >
        {/* Type badge */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 10px',
            borderRadius: 12,
            background: 'var(--surface-2, #f0f0f0)',
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--text-muted)',
            fontFamily: "'Google Sans', sans-serif",
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
            {DOC_TYPE_ICONS[document.type] ?? 'dashboard'}
          </span>
          {DOC_TYPE_LABELS[document.type] ?? document.type}
        </span>

        {/* Editable name */}
        <EditableName
          value={document.name}
          onChange={(name) => builder.renameDocument(documentId, name)}
        />

        {/* Unsaved indicator */}
        {unsaved && (
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#fb923c',
              flexShrink: 0,
            }}
            title="Unsaved changes"
          />
        )}

        <div style={{ flex: 1 }} />

        {/* Tile count */}
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: "'Google Sans', sans-serif" }}>
          {document.tiles.length} {document.tiles.length === 1 ? 'tile' : 'tiles'}
        </span>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '6px 16px',
            borderRadius: 8,
            border: 'none',
            background: unsaved ? '#1a73e8' : 'var(--surface-2, #e8eaed)',
            color: unsaved ? '#fff' : 'var(--text-muted)',
            fontSize: 13,
            fontWeight: 500,
            fontFamily: "'Google Sans', sans-serif",
            cursor: saving ? 'wait' : 'pointer',
            transition: 'background 0.15s',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>save</span>
          {saving ? 'Saving...' : 'Save'}
        </button>

        {/* Discard / close */}
        <button
          onClick={handleDiscard}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 12px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'none',
            color: 'var(--text-muted)',
            fontSize: 13,
            fontWeight: 400,
            fontFamily: "'Google Sans', sans-serif",
            cursor: 'pointer',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>close</span>
          Close
        </button>
      </div>

      {/* Grid canvas */}
      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        {document.tiles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 40, marginBottom: 12, display: 'block', opacity: 0.4 }}>
              {DOC_TYPE_ICONS[document.type] ?? 'dashboard'}
            </span>
            <p style={{ margin: 0, fontSize: 14, fontFamily: "'Google Sans', sans-serif" }}>
              No tiles yet. Add results from chat using the &ldquo;Add to...&rdquo; action on any card.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(12, 1fr)',
              gap: 16,
              gridAutoRows: 'minmax(180px, auto)',
            }}
          >
            {document.tiles.map((tile) => (
              <TileCard
                key={tile.id}
                tile={tile}
                onRemove={() => builder.removeTile(documentId, tile.id)}
                onRename={(name) => builder.updateTile(documentId, tile.id, { title: name })}
              />
            ))}
          </div>
        )}

        {/* Hint */}
        {document.tiles.length > 0 && (
          <p style={{
            marginTop: 24,
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--text-dim, #80868b)',
            fontFamily: "'Google Sans', sans-serif",
          }}>
            Add more tiles from chat results using the &ldquo;Add to...&rdquo; action on any result card.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Editable name ──

function EditableName({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <span
        onClick={() => { setDraft(value); setEditing(true); }}
        style={{
          fontSize: 15,
          fontWeight: 500,
          color: 'var(--text)',
          fontFamily: "'Google Sans', sans-serif",
          cursor: 'text',
          padding: '2px 4px',
          borderRadius: 4,
          minWidth: 80,
        }}
        title="Click to rename"
      >
        {value}
      </span>
    );
  }

  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { onChange(draft.trim() || value); setEditing(false); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { onChange(draft.trim() || value); setEditing(false); }
        if (e.key === 'Escape') { setDraft(value); setEditing(false); }
      }}
      style={{
        fontSize: 15,
        fontWeight: 500,
        color: 'var(--text)',
        fontFamily: "'Google Sans', sans-serif",
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '2px 8px',
        outline: 'none',
        minWidth: 120,
        background: 'var(--surface)',
      }}
    />
  );
}

// ── Tile card ──

function TileCard({
  tile,
  onRemove,
  onRename,
}: {
  tile: BuilderTile;
  onRemove: () => void;
  onRename: (name: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        gridColumn: `${tile.col + 1} / span ${tile.colSpan}`,
        gridRow: `${tile.row + 1} / span ${tile.rowSpan}`,
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: 10,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        transition: 'box-shadow 0.15s',
        boxShadow: hovered ? '0 2px 12px rgba(0,0,0,0.08)' : 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Tile header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-subtle, #f0f0f0)',
          flexShrink: 0,
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 14, color: 'var(--text-dim)', cursor: 'grab' }}
          title="Drag to rearrange"
        >
          drag_indicator
        </span>
        <EditableName value={tile.title} onChange={onRename} />
        <div style={{ flex: 1 }} />
        {/* Remove button -- visible on hover */}
        <button
          onClick={onRemove}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            borderRadius: 4,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: 'var(--text-dim)',
            opacity: hovered ? 1 : 0,
            transition: 'opacity 0.12s',
            padding: 0,
          }}
          title="Remove tile"
          onMouseEnter={(e) => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#dc2626'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-dim)'; }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>close</span>
        </button>
      </div>

      {/* Tile content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
        <TileContent tile={tile} />
      </div>
    </div>
  );
}

// ── Tile content renderer ──

function TileContent({ tile }: { tile: BuilderTile }) {
  const data = tile.artifactData;
  const vizType = tile.vizType;

  if (!data || !vizType) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)' }}>
        <span style={{ fontSize: 12, fontFamily: "'Google Sans', sans-serif" }}>No preview available</span>
      </div>
    );
  }

  // Chart types
  if (CHART_TYPES.has(vizType)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <ChartView result={data as QueryResult} chartType={vizType as any} onSendMessage={() => {}} />;
  }

  // Table
  if (vizType === 'TABLE') {
    return <DataTable result={data as QueryResult} onSendMessage={() => {}} />;
  }

  // KPI
  if (vizType === 'KPI_CARD') {
    return <KpiCard result={data as QueryResult} />;
  }

  // Stat row
  if (vizType === 'STAT_ROW') {
    return <StatRowCard result={data as QueryResult} />;
  }

  // Presentation
  if (vizType === 'PRESENTATION') {
    return <PresentationView data={data as import('./PresentationView').PresentationData} onSendMessage={() => {}} />;
  }

  // Fallback: try as table if it has rows
  if (typeof data === 'object' && data !== null && 'rows' in data) {
    return <DataTable result={data as QueryResult} onSendMessage={() => {}} />;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)' }}>
      <span style={{ fontSize: 12, fontFamily: "'Google Sans', sans-serif" }}>{vizType}</span>
    </div>
  );
}
