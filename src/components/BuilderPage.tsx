'use client';

// BuilderPage: document editor and interactive runtime canvas rendered inside a builder tab.
// Supports:
// 1. Natural language + direct manipulation of layout, tiles, and charts.
// 2. Global reactive filter controls (Date Range, Dropdown, Multi-Select, Search) with live BigQuery re-execution.
// 3. Tile SQL editing, query testing, and visualization type switching.
// 4. Persistence to Firestore and direct export to BigQuery metadata tables.

import { useState, useCallback, useEffect } from 'react';
import { useBuilder } from '@/lib/builder-context';
import { usePage } from '@/lib/page-context';
import { useAuth } from '@/lib/auth-context';
import { getArtifacts } from '@/lib/saved-work';
import { getBuilderDocuments } from '@/lib/builder-persistence';
import type { BuilderTile, ArtifactType, AppFilterControl } from '@/lib/builder-types';
import type { QueryResult, SavedArtifact } from '@/lib/types';
import { ChartView } from './ChartView';
import { DataTable } from './DataTable';
import { KpiCard } from './KpiCard';
import { StatRowCard } from './StatRowCard';
import { PresentationView } from './PresentationView';
import { AppFilterBar } from './builder/AppFilterBar';
import { TileSqlEditor } from './builder/TileSqlEditor';
import { AddTileModal } from './builder/AddTileModal';

const DOC_TYPE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  app: 'Interactive App',
  report: 'Report',
  recipe: 'Recipe',
};

const DOC_TYPE_ICONS: Record<string, string> = {
  dashboard: 'dashboard',
  app: 'widgets',
  report: 'description',
  recipe: 'receipt_long',
};

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
  const { activeProject, user } = useAuth();
  const document = builder.getDocument(documentId);

  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingBq, setSavingBq] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // Modals
  const [addTileOpen, setAddTileOpen] = useState(false);
  const [editingTile, setEditingTile] = useState<BuilderTile | null>(null);
  const [savedArtifacts, setSavedArtifacts] = useState<SavedArtifact[]>([]);

  // Drag-and-drop state
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Fetch saved artifacts for the Add Tile modal
  useEffect(() => {
    if (user?.uid) {
      getArtifacts(user.uid)
        .then(setSavedArtifacts)
        .catch(() => {});
    }
  }, [user?.uid]);

  // Load document from Firestore if not yet in state
  useEffect(() => {
    if (!document && user?.uid) {
      getBuilderDocuments(user.uid)
        .then((docs) => {
          const found = docs.find((d) => d.id === documentId);
          if (found) {
            builder.loadDocument(found);
          }
        })
        .catch((err) => console.warn('Failed to load document:', err));
    }
  }, [document, documentId, user?.uid, builder]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setStatusMsg(null);
    try {
      await builder.saveDocument(documentId);
      setStatusMsg({ text: 'Saved to Library' });
      setTimeout(() => setStatusMsg(null), 2500);
    } catch {
      setStatusMsg({ text: 'Save failed', error: true });
    } finally {
      setSaving(false);
    }
  }, [builder, documentId]);

  const handleSaveToBigQuery = useCallback(async () => {
    if (!activeProject) {
      setStatusMsg({ text: 'Select a project first', error: true });
      return;
    }
    setSavingBq(true);
    setStatusMsg(null);
    try {
      const res = await builder.saveToBigQuery(documentId, activeProject);
      setStatusMsg({ text: res.message || 'Saved to BigQuery' });
      setTimeout(() => setStatusMsg(null), 3500);
    } catch (err) {
      setStatusMsg({ text: err instanceof Error ? err.message : 'BigQuery save failed', error: true });
    } finally {
      setSavingBq(false);
    }
  }, [builder, documentId, activeProject]);

  const handleRefreshAll = useCallback(async () => {
    if (!activeProject) return;
    setRefreshing(true);
    try {
      await builder.reRunAllTiles(documentId, activeProject);
    } finally {
      setRefreshing(false);
    }
  }, [builder, documentId, activeProject]);

  const handleFilterChange = useCallback(
    async (paramName: string, value: unknown) => {
      builder.setFilterValue(documentId, paramName, value);
      if (activeProject) {
        setRefreshing(true);
        try {
          await builder.reRunAllTiles(documentId, activeProject);
        } finally {
          setRefreshing(false);
        }
      }
    },
    [builder, documentId, activeProject],
  );

  const handleClearFilters = useCallback(async () => {
    builder.clearFilters(documentId);
    if (activeProject) {
      setRefreshing(true);
      try {
        await builder.reRunAllTiles(documentId, activeProject);
      } finally {
        setRefreshing(false);
      }
    }
  }, [builder, documentId, activeProject]);

  const handleDrop = useCallback(
    (targetId: string) => {
      if (!dragId || dragId === targetId || !document) return;
      const tiles = [...document.tiles];
      const fromIdx = tiles.findIndex((t) => t.id === dragId);
      const toIdx = tiles.findIndex((t) => t.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return;

      const [removed] = tiles.splice(fromIdx, 1);
      tiles.splice(toIdx, 0, removed);

      let currentRow = 0;
      const reordered = tiles.map((t) => {
        const tile = { ...t, row: currentRow };
        currentRow += t.rowSpan;
        return tile;
      });

      builder.reorderTiles(documentId, reordered);
      setDragId(null);
      setDragOverId(null);
    },
    [dragId, document, builder, documentId],
  );

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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--text-muted)' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 32 }}>dashboard</span>
        <div style={{ fontSize: 14 }}>Loading dashboard...</div>
      </div>
    );
  }

  const unsaved = builder.hasUnsavedChanges(documentId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--chat-bg, #f8f9fa)', overflow: 'hidden' }}>
      {/* ── Top Toolbar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 20px',
          height: 52,
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface, #fff)',
          flexShrink: 0,
          position: 'relative',
          zIndex: 10,
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

        {/* Document Title */}
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

        <div style={{ width: 8 }} />

        {/* Edit mode toggle */}
        <button
          onClick={() => setEditMode((v) => !v)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '5px 12px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: editMode ? '#e8f0fe' : 'none',
            color: editMode ? '#1967d2' : 'var(--text)',
            fontSize: 12,
            fontWeight: editMode ? 600 : 400,
            cursor: 'pointer',
            fontFamily: "'Google Sans', sans-serif",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
            {editMode ? 'edit' : 'edit_note'}
          </span>
          {editMode ? 'Editing Canvas' : 'Edit Canvas'}
        </button>

        {/* Add Tile Button (in edit mode) */}
        {editMode && (
          <button
            onClick={() => setAddTileOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 12px',
              borderRadius: 8,
              border: '1px solid #1a73e8',
              background: '#eff6ff',
              color: '#1a73e8',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: "'Google Sans', sans-serif",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
            Add Tile
          </button>
        )}

        {/* Refresh All */}
        <button
          onClick={handleRefreshAll}
          disabled={refreshing}
          title="Refresh all queries"
          style={{
            padding: '6px 8px',
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'none',
            cursor: refreshing ? 'wait' : 'pointer',
            color: 'var(--text-muted)',
            lineHeight: 1,
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 16, animation: refreshing ? 'spin 1s linear infinite' : 'none' }}
          >
            refresh
          </span>
        </button>

        <div style={{ flex: 1 }} />

        {/* Status notification */}
        {statusMsg && (
          <span
            style={{
              fontSize: 12,
              color: statusMsg.error ? '#dc2626' : '#16a34a',
              fontWeight: 500,
              marginRight: 8,
            }}
          >
            {statusMsg.text}
          </span>
        )}

        {/* Save to BigQuery */}
        <button
          onClick={handleSaveToBigQuery}
          disabled={savingBq}
          title="Save definition to BigQuery metadata table"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 12px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'none',
            color: 'var(--text)',
            fontSize: 12,
            fontWeight: 500,
            cursor: savingBq ? 'wait' : 'pointer',
            fontFamily: "'Google Sans', sans-serif",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#1a73e8' }}>
            cloud_upload
          </span>
          {savingBq ? 'Saving to BQ...' : 'Save to BigQuery'}
        </button>

        {/* Save Button */}
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

        {/* Close Button */}
        <button
          onClick={handleDiscard}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'none',
            color: 'var(--text-muted)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>close</span>
        </button>
      </div>

      {/* ── Global Filter Bar ── */}
      <AppFilterBar
        filters={document.globalFilters || []}
        values={document.filterValues || {}}
        editMode={editMode}
        onValueChange={handleFilterChange}
        onClearAll={handleClearFilters}
        onAddFilter={(filter) => builder.addFilter(documentId, filter)}
        onRemoveFilter={(filterId) => builder.removeFilter(documentId, filterId)}
        isRefreshing={refreshing}
      />

      {/* ── Grid Canvas ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        {document.tiles.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '75%',
              gap: 14,
              border: '2px dashed var(--border)',
              borderRadius: 14,
              color: 'var(--text-muted)',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 44, opacity: 0.25 }}>
              {DOC_TYPE_ICONS[document.type] ?? 'dashboard'}
            </span>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>
              Canvas is empty
            </div>
            <div style={{ fontSize: 13, maxWidth: 400, textAlign: 'center' }}>
              Add results from chat, ask the AI to &ldquo;add to dashboard&rdquo;, or click below to build custom tiles.
            </div>
            <button
              onClick={() => setAddTileOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 18px',
                borderRadius: 8,
                border: 'none',
                background: '#1a73e8',
                color: '#fff',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
              Add First Tile
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(12, 1fr)',
              gap: 16,
              alignItems: 'start',
            }}
          >
            {document.tiles.map((tile) => (
              <TileCard
                key={tile.id}
                tile={tile}
                editMode={editMode}
                isDragging={dragId === tile.id}
                isDragOver={dragOverId === tile.id}
                onDragStart={() => setDragId(tile.id)}
                onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                onDragOver={(e) => { e.preventDefault(); setDragOverId(tile.id); }}
                onDrop={() => handleDrop(tile.id)}
                onRemove={() => builder.removeTile(documentId, tile.id)}
                onRename={(name) => builder.updateTile(documentId, tile.id, { title: name })}
                onEditSql={() => setEditingTile(tile)}
                onUpdateSpan={(colSpan, rowSpan) => builder.updateTile(documentId, tile.id, { colSpan, rowSpan })}
                onRefresh={() => activeProject && builder.reRunTile(documentId, tile.id, activeProject)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {addTileOpen && (
        <AddTileModal
          project={activeProject}
          savedArtifacts={savedArtifacts}
          onAdd={(tile) => builder.addCustomTile(documentId, tile)}
          onClose={() => setAddTileOpen(false)}
        />
      )}

      {editingTile && (
        <TileSqlEditor
          tile={editingTile}
          project={activeProject}
          onSave={(updates) => {
            builder.updateTile(documentId, editingTile.id, updates);
            if (activeProject && (updates.cachedSql || updates.parameterizedSql)) {
              builder.reRunTile(documentId, editingTile.id, activeProject);
            }
          }}
          onClose={() => setEditingTile(null)}
        />
      )}
    </div>
  );
}

// ── Editable Name Component ──

function EditableName({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <span
        onClick={() => { setDraft(value); setEditing(true); }}
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--text)',
          fontFamily: "'Google Sans', sans-serif",
          cursor: 'text',
          padding: '2px 6px',
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
        fontWeight: 600,
        color: 'var(--text)',
        fontFamily: "'Google Sans', sans-serif",
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '2px 8px',
        outline: 'none',
        minWidth: 140,
        background: 'var(--surface)',
      }}
    />
  );
}

// ── Tile Card Component ──

function TileCard({
  tile,
  editMode,
  isDragging,
  isDragOver,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onRemove,
  onRename,
  onEditSql,
  onUpdateSpan,
  onRefresh,
}: {
  tile: BuilderTile;
  editMode: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onRemove: () => void;
  onRename: (name: string) => void;
  onEditSql: () => void;
  onUpdateSpan: (colSpan: number, rowSpan: number) => void;
  onRefresh: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      draggable={editMode}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        gridColumn: `span ${tile.colSpan}`,
        minHeight: tile.rowSpan * 110,
        background: '#fff',
        border: isDragOver ? '2px solid #1a73e8' : '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        opacity: isDragging ? 0.45 : 1,
        transition: 'box-shadow 0.15s, border-color 0.15s',
        boxShadow: hovered ? '0 4px 16px rgba(0,0,0,0.08)' : 'none',
        cursor: editMode ? 'grab' : 'default',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Tile Header */}
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
        {editMode && (
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 14, color: 'var(--text-dim)', cursor: 'grab' }}
            title="Drag to rearrange"
          >
            drag_indicator
          </span>
        )}
        <EditableName value={tile.title} onChange={onRename} />
        <div style={{ flex: 1 }} />

        {/* Tile Actions */}
        {tile.cachedSql && (
          <button
            onClick={onRefresh}
            style={actionIconBtn}
            title="Refresh tile"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
          </button>
        )}

        {editMode && (
          <button
            onClick={onEditSql}
            style={actionIconBtn}
            title="Edit SQL / visualization"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>tune</span>
          </button>
        )}

        {editMode && (
          <button
            onClick={onRemove}
            style={{ ...actionIconBtn, color: '#dc2626' }}
            title="Remove tile"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
          </button>
        )}
      </div>

      {/* Tile Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '10px 14px' }}>
        <TileContent tile={tile} />
      </div>

      {/* Span controls (in edit mode) */}
      {editMode && (
        <div
          style={{
            display: 'flex',
            gap: 4,
            padding: '6px 12px',
            alignItems: 'center',
            borderTop: '1px solid var(--border-subtle, #f0f0f0)',
            background: 'var(--surface-2, #fafafa)',
          }}
        >
          <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 500 }}>W:</span>
          {[3, 4, 6, 8, 12].map((n) => (
            <button
              key={n}
              onClick={() => onUpdateSpan(n, tile.rowSpan)}
              style={{
                fontSize: 9,
                padding: '2px 5px',
                borderRadius: 4,
                background: tile.colSpan === n ? '#1a73e8' : 'var(--border)',
                color: tile.colSpan === n ? '#fff' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {n}
            </button>
          ))}
          <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 6, fontWeight: 500 }}>H:</span>
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              onClick={() => onUpdateSpan(tile.colSpan, n)}
              style={{
                fontSize: 9,
                padding: '2px 5px',
                borderRadius: 4,
                background: tile.rowSpan === n ? '#1a73e8' : 'var(--border)',
                color: tile.rowSpan === n ? '#fff' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tile Content Renderer ──

function TileContent({ tile }: { tile: BuilderTile }) {
  if (tile.tileType === 'text') {
    return (
      <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
        {tile.textContent}
      </div>
    );
  }

  const snapshot = tile.lastSnapshot;
  const artifactData = tile.artifactData;
  const vizType = tile.vizType || 'TABLE';

  // If snapshot exists, build query result object
  const queryResult: QueryResult | null = snapshot
    ? {
        skill: 'query' as const,
        sql: tile.cachedSql || '',
        requiresConfirmation: false,
        costConfirm: null,
        columns: snapshot.columns,
        rows: snapshot.rows,
        rowCount: snapshot.rowCount,
        totalBytesProcessed: 0,
        costTier: 0 as const,
        suggestedVisualization: vizType as any,
        xAxis: null,
        yAxis: null,
        notableFindings: null,
        resultSummary: null,
      }
    : (artifactData as QueryResult) || null;

  if (!queryResult || !queryResult.rows || queryResult.rows.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 80, color: 'var(--text-dim)' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 24, opacity: 0.4 }}>table_rows</span>
        <span style={{ fontSize: 12, marginTop: 4 }}>No data loaded</span>
      </div>
    );
  }

  // Chart rendering
  if (CHART_TYPES.has(vizType)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <ChartView result={queryResult} chartType={vizType as any} onSendMessage={() => {}} />;
  }

  // KPI
  if (vizType === 'KPI_CARD') {
    return <KpiCard result={queryResult} />;
  }

  // Stat Row
  if (vizType === 'STAT_ROW') {
    return <StatRowCard result={queryResult} />;
  }

  // Presentation
  if (vizType === 'PRESENTATION') {
    return <PresentationView data={artifactData as any} onSendMessage={() => {}} />;
  }

  // Default DataTable
  return <DataTable result={queryResult} onSendMessage={() => {}} />;
}

const actionIconBtn: React.CSSProperties = {
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
  padding: 0,
};
