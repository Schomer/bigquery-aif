'use client';

// Dashboard page: loads saved dashboards, re-runs each tile's SQL live,
// shows last cached snapshot instantly (stale-while-revalidate), then
// replaces with fresh data. Supports text tiles, drag-to-reorder, and
// an in-tile edit drawer.

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getArtifacts } from '@/lib/saved-work';
import type { SavedArtifact, SavedDashboard, DashboardTile } from '@/lib/types';

// ── Firestore helpers ─────────────────────────────────────────────────────────

async function saveDashboard(uid: string, dashboard: SavedDashboard): Promise<void> {
  const { doc, setDoc } = await import('firebase/firestore');
  const { db } = await import('@/lib/firebase');
  await setDoc(doc(db, 'users', uid, 'savedDashboards', dashboard.id), dashboard);
}

async function getDashboards(uid: string): Promise<SavedDashboard[]> {
  const { collection, getDocs, query, orderBy } = await import('firebase/firestore');
  const { db } = await import('@/lib/firebase');
  const q = query(collection(db, 'users', uid, 'savedDashboards'), orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as SavedDashboard);
}

async function deleteDashboard(uid: string, id: string): Promise<void> {
  const { doc, deleteDoc } = await import('firebase/firestore');
  const { db } = await import('@/lib/firebase');
  await deleteDoc(doc(db, 'users', uid, 'savedDashboards', id));
}

function generateId(): string {
  return `tile_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// ── Skeleton tile ─────────────────────────────────────────────────────────────

function TileSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
      {[0.7, 0.9, 0.6, 0.8, 0.5].map((w, i) => (
        <div
          key={i}
          style={{
            height: 12,
            borderRadius: 6,
            width: `${w * 100}%`,
            background: 'linear-gradient(90deg, var(--border) 25%, var(--surface-2, #f3f4f6) 50%, var(--border) 75%)',
            backgroundSize: '200% 100%',
            animation: `skeleton-shimmer 1.5s ease-in-out ${i * 0.1}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ── Mini result renderer ──────────────────────────────────────────────────────

function TileResult({
  columns,
  rows,
  vizType,
}: {
  columns: string[];
  rows: (string | number | boolean | null)[][];
  vizType?: string;
}) {
  const MAX_ROWS = 6;
  const displayRows = rows.slice(0, MAX_ROWS);

  // KPI — single number
  if (vizType === 'KPI' || (columns.length === 1 && rows.length === 1)) {
    return (
      <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px', padding: '8px 0' }}>
        {String(rows[0]?.[0] ?? '—')}
      </div>
    );
  }

  // 2-column with numeric second col → mini bar chart
  const isBar =
    (vizType === 'BAR_CHART' || vizType === 'COLUMN_CHART' || !vizType) &&
    columns.length === 2 &&
    displayRows.length > 0 &&
    displayRows.every((r) => !isNaN(Number(r[1])));

  if (isBar) {
    const values = displayRows.map((r) => Number(r[1]));
    const maxVal = Math.max(...values, 1);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '4px 0' }}>
        {displayRows.map((row, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 90, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>
              {String(row[0] ?? '')}
            </span>
            <div style={{ flex: 1, height: 12, background: 'var(--surface-2, #f3f4f6)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${(values[i] / maxVal) * 100}%`, height: '100%', background: '#1967d2', borderRadius: 2, transition: 'width 0.3s' }} />
            </div>
            <span style={{ fontSize: 10, color: 'var(--text)', width: 44, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
              {values[i] >= 1e6 ? `${(values[i] / 1e6).toFixed(1)}M` : values[i] >= 1000 ? `${(values[i] / 1000).toFixed(1)}k` : values[i]}
            </span>
          </div>
        ))}
        {rows.length > MAX_ROWS && <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>+{rows.length - MAX_ROWS} more</span>}
      </div>
    );
  }

  // Generic mini table
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} style={{ textAlign: 'left', padding: '2px 6px 4px', color: 'var(--text-dim)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', fontSize: 10 }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '3px 6px', color: 'var(--text)', whiteSpace: 'nowrap', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', borderBottom: '1px solid var(--border-subtle, #f0f0f0)' }}>
                  {cell === null || cell === undefined
                    ? <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>null</span>
                    : String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > MAX_ROWS && <div style={{ fontSize: 9, color: 'var(--text-dim)', padding: '2px 6px' }}>+{rows.length - MAX_ROWS} more rows</div>}
    </div>
  );
}

// ── Artifact picker modal ─────────────────────────────────────────────────────

function ArtifactPicker({ artifacts, onAdd, onClose }: { artifacts: SavedArtifact[]; onAdd: (a: SavedArtifact) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const filtered = artifacts.filter((a) => a.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: 14, width: 440, maxHeight: '72vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden', fontFamily: "'Google Sans', sans-serif" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '16px 18px 10px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: 'var(--text)' }}>Add a tile</div>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search saved queries..." style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 10px' }}>
          {filtered.length === 0 && <div style={{ padding: 20, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>No saved queries found.</div>}
          {filtered.map((a) => (
            <button key={a.id} onClick={() => { onAdd(a); onClose(); }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', border: 'none', background: 'none', cursor: 'pointer', borderRadius: 8, textAlign: 'left', fontFamily: 'inherit' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2, #f3f4f6)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--text-muted)', flexShrink: 0 }}>
                {a.type === 'query' ? 'table_chart' : a.type === 'workflow' ? 'account_tree' : 'analytics'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{a.name}</div>
                {a.description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.description}</div>}
              </div>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#1967d2', flexShrink: 0 }}>add</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main dashboard page ───────────────────────────────────────────────────────

interface DashboardPageProps {
  /** When set (from "Open Dashboard" tab), auto-select this dashboard on load */
  initialDashboardId?: string;
}

export default function DashboardPage({ initialDashboardId }: DashboardPageProps) {
  const [uid, setUid] = useState<string | null>(null);
  const [project, setProject] = useState('');
  const [artifacts, setArtifacts] = useState<SavedArtifact[]>([]);
  const [dashboards, setDashboards] = useState<SavedDashboard[]>([]);
  const [activeDashboard, setActiveDashboard] = useState<SavedDashboard | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [newDashName, setNewDashName] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [tileStatus, setTileStatus] = useState<Record<string, 'idle' | 'loading' | 'done' | 'error'>>({});
  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  // Inline text tile add
  const [addingText, setAddingText] = useState(false);
  const [textDraft, setTextDraft] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  // Auth + project
  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, (user) => {
      if (user) {
        setUid(user.uid);
        const stored = typeof window !== 'undefined' ? localStorage.getItem('bqaif_project') ?? '' : '';
        setProject(stored);
      }
    });
  }, []);

  const load = useCallback(async (userId: string) => {
    const [arts, dashes] = await Promise.all([
      getArtifacts(userId).catch(() => [] as SavedArtifact[]),
      getDashboards(userId).catch(() => [] as SavedDashboard[]),
    ]);
    setArtifacts(arts);
    setDashboards(dashes);
    return dashes;
  }, []);

  // Auto-select dashboard from prop
  useEffect(() => {
    if (!uid) return;
    load(uid).then((dashes) => {
      if (initialDashboardId) {
        const found = dashes.find((d) => d.id === initialDashboardId);
        if (found) {
          setActiveDashboard(found);
          runTileQueries(found, project);
        }
      }
    });
  }, [uid, initialDashboardId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Execute all tile queries for a dashboard (stale-while-revalidate: snapshots already shown)
  const runTileQueries = useCallback(async (dashboard: SavedDashboard, proj: string) => {
    if (!proj) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const tilesWithSql = dashboard.tiles.filter((t) => t.cachedSql && t.tileType !== 'text');
    if (tilesWithSql.length === 0) return;

    setTileStatus(Object.fromEntries(tilesWithSql.map((t) => [t.id, 'loading' as const])));
    const { executeQuery } = await import('@/lib/bigquery-client');

    await Promise.allSettled(tilesWithSql.map(async (tile) => {
      if (ac.signal.aborted) return;
      try {
        const result = await executeQuery(tile.cachedSql!, proj);
        if (ac.signal.aborted) return;
        const snapshot = {
          columns: result.columns,
          rows: result.rows as (string | number | boolean | null)[][],
          rowCount: result.rowCount,
          fetchedAt: new Date().toISOString(),
        };
        setActiveDashboard((d) =>
          d ? { ...d, tiles: d.tiles.map((t) => t.id === tile.id ? { ...t, lastSnapshot: snapshot } : t) } : d
        );
        setTileStatus((s) => ({ ...s, [tile.id]: 'done' }));
      } catch {
        if (!ac.signal.aborted) setTileStatus((s) => ({ ...s, [tile.id]: 'error' }));
      }
    }));
  }, []);

  function selectDashboard(d: SavedDashboard) {
    setActiveDashboard(d);
    setDropdownOpen(false);
    setEditMode(false);
    runTileQueries(d, project);
  }

  function createDashboard() {
    if (!newDashName.trim() || !uid) return;
    const now = new Date().toISOString();
    const d: SavedDashboard = { id: generateId(), userId: uid, name: newDashName.trim(), description: '', tiles: [], project, createdAt: now, updatedAt: now };
    setActiveDashboard(d);
    setDashboards((prev) => [d, ...prev]);
    setNewDashName('');
    setDropdownOpen(false);
    setEditMode(true);
  }

  async function addTile(artifact: SavedArtifact) {
    if (!activeDashboard) return;
    const sql = artifact.steps?.find((s) => s.cachedSql)?.cachedSql ?? '';
    const nextRow = activeDashboard.tiles.reduce((max, t) => Math.max(max, t.row + t.rowSpan), 0);
    const tile: DashboardTile = {
      id: generateId(),
      artifactId: artifact.id,
      title: artifact.name,
      col: 0,
      row: nextRow,
      colSpan: 6,
      rowSpan: 2,
      tileType: 'query',
      cachedSql: sql || undefined,
    };
    setActiveDashboard((d) => d ? { ...d, tiles: [...d.tiles, tile] } : d);
    if (sql && project) {
      setTileStatus((s) => ({ ...s, [tile.id]: 'loading' }));
      try {
        const { executeQuery } = await import('@/lib/bigquery-client');
        const result = await executeQuery(sql, project);
        const snapshot = { columns: result.columns, rows: result.rows as (string | number | boolean | null)[][], rowCount: result.rowCount, fetchedAt: new Date().toISOString() };
        setActiveDashboard((d) => d ? { ...d, tiles: d.tiles.map((t) => t.id === tile.id ? { ...t, lastSnapshot: snapshot } : t) } : d);
        setTileStatus((s) => ({ ...s, [tile.id]: 'done' }));
      } catch {
        setTileStatus((s) => ({ ...s, [tile.id]: 'error' }));
      }
    }
  }

  function addTextTile() {
    if (!textDraft.trim() || !activeDashboard) return;
    const nextRow = activeDashboard.tiles.reduce((max, t) => Math.max(max, t.row + t.rowSpan), 0);
    const tile: DashboardTile = {
      id: generateId(),
      artifactId: '',
      title: 'Text',
      col: 0,
      row: nextRow,
      colSpan: 12,
      rowSpan: 1,
      tileType: 'text',
      textContent: textDraft.trim(),
    };
    setActiveDashboard((d) => d ? { ...d, tiles: [...d.tiles, tile] } : d);
    setTextDraft('');
    setAddingText(false);
  }

  function removeTile(id: string) {
    setActiveDashboard((d) => d ? { ...d, tiles: d.tiles.filter((t) => t.id !== id) } : d);
  }

  function updateTileSpan(id: string, colSpan: number, rowSpan: number) {
    setActiveDashboard((d) => d ? { ...d, tiles: d.tiles.map((t) => t.id === id ? { ...t, colSpan, rowSpan } : t) } : d);
  }

  // Drag-to-reorder: swap dragged tile with drop target
  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId || !activeDashboard) return;
    const tiles = [...activeDashboard.tiles];
    const fromIdx = tiles.findIndex((t) => t.id === dragId);
    const toIdx = tiles.findIndex((t) => t.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    [tiles[fromIdx], tiles[toIdx]] = [tiles[toIdx], tiles[fromIdx]];
    // Reassign row values sequentially
    let currentRow = 0;
    const reordered = tiles.map((t) => {
      const tile = { ...t, row: currentRow };
      currentRow += t.rowSpan;
      return tile;
    });
    setActiveDashboard((d) => d ? { ...d, tiles: reordered } : d);
    setDragId(null);
    setDragOverId(null);
  }

  async function handleSave() {
    if (!activeDashboard || !uid) return;
    setSaving(true);
    try {
      const updated = { ...activeDashboard, updatedAt: new Date().toISOString() };
      await saveDashboard(uid, updated);
      setActiveDashboard(updated);
      setDashboards((prev) => {
        const exists = prev.some((d) => d.id === updated.id);
        return exists ? prev.map((d) => d.id === updated.id ? updated : d) : [updated, ...prev];
      });
      setStatusMsg('Saved');
      setTimeout(() => setStatusMsg(''), 2000);
    } catch {
      setStatusMsg('Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!uid) return;
    await deleteDashboard(uid, id).catch(() => null);
    setDashboards((prev) => prev.filter((d) => d.id !== id));
    if (activeDashboard?.id === id) setActiveDashboard(null);
  }

  if (!uid) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontFamily: "'Google Sans', sans-serif", color: 'var(--text-muted)' }}>
        Please sign in to use Dashboards.
      </div>
    );
  }

  const COLS = 12;

  return (
    <>
      {/* Skeleton shimmer keyframe */}
      <style>{`
        @keyframes skeleton-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: "'Google Sans', sans-serif", background: 'var(--chat-bg, #f8f9fa)', overflow: 'hidden' }}>

        {pickerOpen && <ArtifactPicker artifacts={artifacts} onAdd={addTile} onClose={() => setPickerOpen(false)} />}

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px', height: 52, borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0, position: 'relative', zIndex: 10 }}>

          {/* Dashboard dropdown */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setDropdownOpen((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>dashboard</span>
              {activeDashboard?.name ?? 'Select dashboard'}
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--text-muted)' }}>expand_more</span>
            </button>

            {dropdownOpen && (
              <div style={{ position: 'absolute', top: '110%', left: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 270, padding: 8, zIndex: 20 }}>
                {dashboards.map((d) => (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center' }}>
                    <button onClick={() => selectDashboard(d)} style={{ flex: 1, textAlign: 'left', padding: '7px 10px', border: 'none', background: activeDashboard?.id === d.id ? '#e8f0fe' : 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text)', fontFamily: 'inherit' }}>{d.name}</button>
                    <button onClick={() => handleDelete(d.id)} style={{ padding: 4, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-dim)', borderRadius: 4 }} title="Delete"><span className="material-symbols-outlined" style={{ fontSize: 13 }}>delete</span></button>
                  </div>
                ))}
                <div style={{ borderTop: dashboards.length > 0 ? '1px solid var(--border)' : 'none', marginTop: 4, paddingTop: 8 }}>
                  <div style={{ display: 'flex', gap: 6, padding: '0 2px' }}>
                    <input value={newDashName} onChange={(e) => setNewDashName(e.target.value)} placeholder="New dashboard name" onKeyDown={(e) => e.key === 'Enter' && createDashboard()} style={{ flex: 1, fontSize: 12, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6, outline: 'none', fontFamily: 'inherit' }} autoFocus />
                    <button onClick={createDashboard} disabled={!newDashName.trim()} style={{ padding: '5px 12px', fontSize: 12, background: '#1967d2', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>Create</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {activeDashboard && (
            <>
              <button
                onClick={() => setEditMode((v) => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 8, background: editMode ? '#e8f0fe' : 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', color: editMode ? '#1967d2' : 'var(--text)', fontWeight: editMode ? 600 : 400 }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                {editMode ? 'Editing' : 'Edit'}
              </button>

              {editMode && (
                <>
                  <button onClick={() => setPickerOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', color: 'var(--text)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>Add tile
                  </button>
                  <button onClick={() => setAddingText(true)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', color: 'var(--text)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>text_fields</span>Add text
                  </button>
                </>
              )}

              <button onClick={() => activeDashboard && runTileQueries(activeDashboard, project)} title="Refresh all" style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
              </button>
            </>
          )}

          <div style={{ flex: 1 }} />
          {statusMsg && <span style={{ fontSize: 12, color: statusMsg === 'Saved' ? '#00897b' : '#c62828' }}>{statusMsg}</span>}
          {activeDashboard && (
            <button onClick={handleSave} disabled={saving} style={{ padding: '7px 18px', fontSize: 13, fontWeight: 500, background: '#1967d2', color: 'white', border: 'none', borderRadius: 8, cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>

        {/* Add text tile inline form */}
        {addingText && (
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <textarea
              autoFocus
              value={textDraft}
              onChange={(e) => setTextDraft(e.target.value)}
              placeholder="Enter text content for the tile..."
              rows={3}
              style={{ flex: 1, fontSize: 13, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, outline: 'none', fontFamily: 'inherit', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button onClick={addTextTile} disabled={!textDraft.trim()} style={{ padding: '7px 14px', fontSize: 12, background: '#1967d2', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>Add</button>
              <button onClick={() => { setAddingText(false); setTextDraft(''); }} style={{ padding: '7px 14px', fontSize: 12, background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Canvas */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {!activeDashboard ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, color: 'var(--text-muted)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 64, opacity: 0.18 }}>dashboard</span>
              <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)' }}>No dashboard selected</div>
              <div style={{ fontSize: 13 }}>Create a new dashboard or pick an existing one from the selector above.</div>
            </div>
          ) : activeDashboard.tiles.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80%', gap: 12, color: 'var(--text-muted)', border: '2px dashed var(--border)', borderRadius: 14 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 40, opacity: 0.2 }}>add_box</span>
              <div style={{ fontSize: 14 }}>Click "Edit" then "Add tile" to add your first saved query.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 12, alignItems: 'start' }}>
              {activeDashboard.tiles.map((tile) => {
                const status = tileStatus[tile.id] ?? 'idle';
                const snap = tile.lastSnapshot;
                const isDragging = dragId === tile.id;
                const isDragOver = dragOverId === tile.id;

                return (
                  <div
                    key={tile.id}
                    draggable={editMode}
                    onDragStart={() => setDragId(tile.id)}
                    onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                    onDragOver={(e) => { e.preventDefault(); setDragOverId(tile.id); }}
                    onDrop={() => handleDrop(tile.id)}
                    style={{
                      gridColumn: `span ${tile.colSpan}`,
                      background: 'var(--surface)',
                      border: isDragOver ? '2px solid #1967d2' : '1px solid var(--border)',
                      borderRadius: 12,
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      minHeight: tile.rowSpan * 100,
                      opacity: isDragging ? 0.45 : 1,
                      transition: 'opacity 0.15s, border-color 0.15s',
                      cursor: editMode ? 'grab' : 'default',
                    }}
                  >
                    {/* Tile header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {editMode && (
                        <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--text-dim)', cursor: 'grab', flexShrink: 0 }}>drag_indicator</span>
                      )}
                      <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {tile.title}
                      </span>
                      {status === 'loading' && <span style={{ fontSize: 10, color: '#1967d2' }}>Refreshing...</span>}
                      {snap && status !== 'loading' && (
                        <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>
                          {new Date(snap.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      {editMode && (
                        <button onClick={() => removeTile(tile.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 2, flexShrink: 0 }} title="Remove tile">
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>close</span>
                        </button>
                      )}
                    </div>

                    {/* Tile content */}
                    <div style={{ flex: 1 }}>
                      {tile.tileType === 'text' ? (
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                          {tile.textContent}
                        </p>
                      ) : status === 'error' ? (
                        <div style={{ fontSize: 11, color: '#c62828' }}>Query failed</div>
                      ) : !snap && status === 'loading' ? (
                        <TileSkeleton />
                      ) : !snap ? (
                        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                          {tile.cachedSql ? 'Click Refresh to load data' : 'No SQL attached'}
                        </div>
                      ) : (
                        <TileResult columns={snap.columns} rows={snap.rows} vizType={tile.vizType} />
                      )}
                    </div>

                    {/* Span controls (edit mode only) */}
                    {editMode && (
                      <div style={{ display: 'flex', gap: 3, paddingTop: 4, alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--border-subtle, #f0f0f0)', marginTop: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>W:</span>
                        {[3, 4, 6, 8, 12].map((n) => (
                          <button key={n} onClick={() => updateTileSpan(tile.id, n, tile.rowSpan)} style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: tile.colSpan === n ? '#1967d2' : 'var(--border)', color: tile.colSpan === n ? 'white' : 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>{n}</button>
                        ))}
                        <span style={{ fontSize: 9, color: 'var(--text-dim)', marginLeft: 4 }}>H:</span>
                        {[1, 2, 3, 4].map((n) => (
                          <button key={n} onClick={() => updateTileSpan(tile.id, tile.colSpan, n)} style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: tile.rowSpan === n ? '#1967d2' : 'var(--border)', color: tile.rowSpan === n ? 'white' : 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>{n}</button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
