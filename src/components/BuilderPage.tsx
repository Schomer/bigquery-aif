'use client';

// BuilderPage: document editor and interactive runtime canvas rendered inside a builder tab.
// Supports:
// 1. Natural language + direct manipulation of layout, tiles, and charts.
// 2. Global reactive filter controls (Date Range, Dropdown, Multi-Select, Search) with live BigQuery re-execution.
// 3. Tile SQL editing, query testing, and visualization type switching.
// 4. Persistence to Firestore and direct export to BigQuery metadata tables.

import { useState, useCallback, useEffect, useRef } from 'react';
import { useBuilder, groupTilesIntoRows, computeEqualizedSpans } from '@/lib/builder-context';
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

const DENSITY_CONFIG: Record<string, { label: string; baseHeight: number }> = {
  compact: { label: 'Compact', baseHeight: 120 },
  standard: { label: 'Standard', baseHeight: 155 },
  spacious: { label: 'Spacious', baseHeight: 195 },
};

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
  const [loadingTiles, setLoadingTiles] = useState<Set<string>>(new Set());

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

  // Auto-execute tiles on canvas mount if they have SQL but no rows loaded yet
  const autoExecutedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!document || !activeProject) return;
    const unhydrated = document.tiles.filter(
      (t) =>
        (t.cachedSql || t.parameterizedSql) &&
        t.tileType !== 'text' &&
        (!t.lastSnapshot || !t.lastSnapshot.rows || t.lastSnapshot.rows.length === 0) &&
        !autoExecutedRef.current.has(t.id)
    );

    if (unhydrated.length > 0) {
      unhydrated.forEach(async (tile) => {
        autoExecutedRef.current.add(tile.id);
        setLoadingTiles((prev) => new Set(prev).add(tile.id));
        try {
          await builder.reRunTile(documentId, tile.id, activeProject);
        } catch (err) {
          console.warn(`Auto-executing query for tile "${tile.title}" failed:`, err);
        } finally {
          setLoadingTiles((prev) => {
            const next = new Set(prev);
            next.delete(tile.id);
            return next;
          });
        }
      });
    }
  }, [document, documentId, activeProject, builder]);

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
    if (!activeProject) {
      setStatusMsg({ text: 'Select a GCP project first', error: true });
      return;
    }
    setRefreshing(true);
    try {
      await builder.reRunAllTiles(documentId, activeProject);
    } finally {
      setRefreshing(false);
    }
  }, [builder, documentId, activeProject]);

  const handleRefreshSingleTile = useCallback(
    async (tileId: string) => {
      if (!activeProject) {
        setStatusMsg({ text: 'Select a GCP project first', error: true });
        return;
      }
      setLoadingTiles((prev) => new Set(prev).add(tileId));
      try {
        await builder.reRunTile(documentId, tileId, activeProject);
      } catch (err) {
        setStatusMsg({ text: err instanceof Error ? err.message : 'Tile query failed', error: true });
      } finally {
        setLoadingTiles((prev) => {
          const next = new Set(prev);
          next.delete(tileId);
          return next;
        });
      }
    },
    [builder, documentId, activeProject]
  );

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
  const densityKey = document.density || 'standard';
  const densityCfg = DENSITY_CONFIG[densityKey] || DENSITY_CONFIG.standard;
  const tileRows = groupTilesIntoRows(document.tiles);

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

        {/* Edit Mode Controls */}
        {editMode && (
          <>
            {/* Add Tile Button */}
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

            {/* Equalize All Rows */}
            <button
              onClick={() => builder.equalizeAllRows(documentId)}
              title="Equalize column widths across all rows on canvas"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 10px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'none',
                color: 'var(--text)',
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: "'Google Sans', sans-serif",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>view_week</span>
              Equalize All Rows
            </button>

            {/* Density Selector */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, background: 'var(--surface-2, #f1f3f4)', padding: '2px', borderRadius: 8 }}>
              {(['compact', 'standard', 'spacious'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => builder.setDocumentDensity(documentId, d)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 6,
                    border: 'none',
                    background: densityKey === d ? '#fff' : 'transparent',
                    color: densityKey === d ? '#1a73e8' : 'var(--text-muted)',
                    boxShadow: densityKey === d ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                    fontSize: 11,
                    fontWeight: densityKey === d ? 600 : 400,
                    cursor: 'pointer',
                    fontFamily: "'Google Sans', sans-serif",
                  }}
                >
                  {DENSITY_CONFIG[d].label}
                </button>
              ))}
            </div>
          </>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {tileRows.map((rowTiles, rIdx) => {
              const rowId = `row_${rIdx}`;

              return (
                <div
                  key={rowId}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(12, 1fr)',
                    gap: 16,
                    alignItems: 'start',
                  }}
                >
                  {rowTiles.map((tile) => (
                    <TileCard
                      key={tile.id}
                      tile={tile}
                      baseHeight={densityCfg.baseHeight}
                      editMode={editMode}
                      isLoading={loadingTiles.has(tile.id)}
                      isDragging={dragId === tile.id}
                      isDragOver={dragOverId === tile.id}
                      onDragStart={() => setDragId(tile.id)}
                      onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                      onDragOver={(e) => { e.preventDefault(); setDragOverId(tile.id); }}
                      onDrop={() => handleDrop(tile.id)}
                      onRemove={() => builder.removeTile(documentId, tile.id)}
                      onDuplicate={() => builder.duplicateTile(documentId, tile.id)}
                      onRename={(name) => builder.updateTile(documentId, tile.id, { title: name })}
                      onEditSql={() => setEditingTile(tile)}
                      onUpdateSpan={(colSpan, rowSpan) => builder.updateTile(documentId, tile.id, { colSpan, rowSpan })}
                      onRefresh={() => handleRefreshSingleTile(tile.id)}
                    />
                  ))}
                </div>
              );
            })}
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
              handleRefreshSingleTile(editingTile.id);
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
  baseHeight,
  editMode,
  isLoading,
  isDragging,
  isDragOver,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onRemove,
  onDuplicate,
  onRename,
  onEditSql,
  onUpdateSpan,
  onRefresh,
}: {
  tile: BuilderTile;
  baseHeight: number;
  editMode: boolean;
  isLoading: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onRename: (name: string) => void;
  onEditSql: () => void;
  onUpdateSpan: (colSpan: number, rowSpan: number) => void;
  onRefresh: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close kebab menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // Drag-to-resize handlers
  const handleWidthResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const initialColSpan = tile.colSpan;
    const parentWidth = cardRef.current?.parentElement?.getBoundingClientRect().width || 1200;
    const singleColWidth = parentWidth / 12;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaCols = Math.round(deltaX / singleColWidth);
      const newColSpan = Math.max(1, Math.min(12, initialColSpan + deltaCols));
      if (newColSpan !== tile.colSpan) {
        onUpdateSpan(newColSpan, tile.rowSpan);
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleHeightResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const initialRowSpan = tile.rowSpan;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const deltaRows = Math.round(deltaY / (baseHeight * 0.75));
      const newRowSpan = Math.max(1, Math.min(6, initialRowSpan + deltaRows));
      if (newRowSpan !== tile.rowSpan) {
        onUpdateSpan(tile.colSpan, newRowSpan);
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleCornerResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const initialColSpan = tile.colSpan;
    const initialRowSpan = tile.rowSpan;
    const parentWidth = cardRef.current?.parentElement?.getBoundingClientRect().width || 1200;
    const singleColWidth = parentWidth / 12;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      const deltaCols = Math.round(deltaX / singleColWidth);
      const deltaRows = Math.round(deltaY / (baseHeight * 0.75));
      const newColSpan = Math.max(1, Math.min(12, initialColSpan + deltaCols));
      const newRowSpan = Math.max(1, Math.min(6, initialRowSpan + deltaRows));
      if (newColSpan !== tile.colSpan || newRowSpan !== tile.rowSpan) {
        onUpdateSpan(newColSpan, newRowSpan);
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const calculatedMinHeight = tile.rowSpan * baseHeight + (tile.rowSpan - 1) * 16;

  return (
    <div
      ref={cardRef}
      draggable={editMode}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        gridColumn: `span ${tile.colSpan}`,
        minHeight: calculatedMinHeight,
        background: '#fff',
        border: isDragOver ? '2px solid #1a73e8' : editMode ? '1px solid #c2dbff' : '1px solid var(--border)',
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

        {/* Span badge in edit mode */}
        {editMode && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 500,
              padding: '1px 5px',
              borderRadius: 4,
              background: '#f1f3f4',
              color: 'var(--text-muted)',
              fontFamily: "'Google Sans', sans-serif",
            }}
          >
            {tile.colSpan}/12 col &middot; {tile.rowSpan}x
          </span>
        )}

        <div style={{ flex: 1 }} />

        {/* Refresh Tile */}
        {tile.cachedSql && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            style={actionIconBtn}
            title="Refresh tile"
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 14, animation: isLoading ? 'spin 1s linear infinite' : 'none' }}
            >
              refresh
            </span>
          </button>
        )}

        {/* Kebab menu in edit mode */}
        {editMode && (
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              style={actionIconBtn}
              title="Tile options"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                more_vert
              </span>
            </button>

            {menuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 4,
                  minWidth: 140,
                  background: '#fff',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
                  padding: '4px 0',
                  zIndex: 50,
                  display: 'flex',
                  flexDirection: 'column',
                  fontFamily: "'Google Sans', sans-serif",
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onEditSql();
                  }}
                  style={menuItemStyle}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2, #f3f4f6)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15, color: 'var(--text-muted)' }}>
                    code
                  </span>
                  SQL
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onDuplicate();
                  }}
                  style={menuItemStyle}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2, #f3f4f6)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15, color: 'var(--text-muted)' }}>
                    content_copy
                  </span>
                  Duplicate
                </button>

                <div style={{ height: 1, background: 'var(--border-subtle, #f0f0f0)', margin: '4px 0' }} />

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onRemove();
                  }}
                  style={{ ...menuItemStyle, color: '#dc2626' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#dc2626' }}>
                    delete
                  </span>
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tile Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '10px 14px', position: 'relative' }}>
        <TileContent tile={tile} isLoading={isLoading} onRunQuery={onRefresh} onEditSql={onEditSql} />
      </div>

      {/* ── Interactive Drag Resize Handles ── */}
      {editMode && (
        <>
          {/* Right edge width resize handle */}
          <div
            onMouseDown={handleWidthResizeStart}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 8,
              bottom: 0,
              cursor: 'col-resize',
              background: 'transparent',
              zIndex: 20,
            }}
            title="Drag horizontally to resize width"
          />

          {/* Bottom edge height resize handle */}
          <div
            onMouseDown={handleHeightResizeStart}
            style={{
              position: 'absolute',
              left: 0,
              bottom: 0,
              height: 8,
              right: 0,
              cursor: 'row-resize',
              background: 'transparent',
              zIndex: 20,
            }}
            title="Drag vertically to resize height"
          />

          {/* Bottom-right diagonal resize handle */}
          <div
            onMouseDown={handleCornerResizeStart}
            style={{
              position: 'absolute',
              right: 2,
              bottom: 2,
              width: 12,
              height: 12,
              cursor: 'nwse-resize',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#1a73e8',
              zIndex: 21,
              opacity: 0.7,
            }}
            title="Drag to resize width and height"
          >
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M7 1V7H1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </>
      )}
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '6px 12px',
  border: 'none',
  background: 'none',
  fontSize: 12,
  fontWeight: 400,
  color: 'var(--text)',
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: 'inherit',
};

// ── Tile Content Renderer ──

function TileContent({
  tile,
  isLoading,
  onRunQuery,
  onEditSql,
}: {
  tile: BuilderTile;
  isLoading?: boolean;
  onRunQuery?: () => void;
  onEditSql?: () => void;
}) {
  if (isLoading) {
    return <TileLoadingSkeleton vizType={tile.vizType} />;
  }

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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 120, gap: 10, color: 'var(--text-dim)' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 28, opacity: 0.35 }}>
          {vizType === 'TABLE' ? 'table_rows' : 'bar_chart'}
        </span>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
          {tile.cachedSql ? 'Query not yet loaded' : 'No query configured'}
        </div>
        {tile.cachedSql ? (
          <button
            onClick={onRunQuery}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 12px',
              borderRadius: 6,
              border: '1px solid #1a73e8',
              background: '#eff6ff',
              color: '#1a73e8',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>play_arrow</span>
            Run Query
          </button>
        ) : (
          <button
            onClick={onEditSql}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 12px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: '#fff',
              color: 'var(--text)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
            Add Query
          </button>
        )}
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

// ── Tile Loading Skeleton ──

function TileLoadingSkeleton({ vizType }: { vizType?: ArtifactType }) {
  const isChart = vizType && CHART_TYPES.has(vizType);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10, padding: 8, opacity: 0.65 }}>
      {/* Header bars */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ width: 80, height: 10, borderRadius: 4, background: '#e2e8f0', animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ width: 40, height: 10, borderRadius: 4, background: '#f1f5f9' }} />
      </div>

      {isChart ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 12, padding: '10px 0' }}>
          {[40, 75, 55, 90, 65, 80, 45].map((h, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${h}%`,
                borderRadius: '4px 4px 0 0',
                background: 'linear-gradient(180deg, #93c5fd 0%, #dbeafe 100%)',
                animation: 'pulse 1.5s ease-in-out infinite',
                animationDelay: `${i * 120}ms`,
              }}
            />
          ))}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3, 4].map((row) => (
            <div key={row} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ width: '25%', height: 12, borderRadius: 3, background: '#e2e8f0', animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div style={{ width: '35%', height: 12, borderRadius: 3, background: '#f1f5f9', animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div style={{ width: '20%', height: 12, borderRadius: 3, background: '#f1f5f9', animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div style={{ width: '20%', height: 12, borderRadius: 3, background: '#e2e8f0', animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
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
