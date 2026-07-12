'use client';

// W3-15: Dashboard tile assembly UI
// Lets users build a dashboard by selecting saved artifacts and arranging them in a 12-column grid.

import { useState, useEffect, useCallback } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getArtifacts } from '@/lib/saved-work';
import type { SavedArtifact } from '@/lib/types';
import type { SavedDashboard, DashboardTile } from '@/lib/types';

// ─── Simple grid constants ────────────────────────────────────────────────────
const COLS = 12;

function generateId(): string {
  return `tile_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Dashboard persistence ────────────────────────────────────────────────────
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
  return snap.docs.map(d => d.data() as SavedDashboard);
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [artifacts, setArtifacts] = useState<SavedArtifact[]>([]);
  const [dashboards, setDashboards] = useState<SavedDashboard[]>([]);
  const [activeDashboard, setActiveDashboard] = useState<SavedDashboard | null>(null);
  const [newDashName, setNewDashName] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  // Auth
  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, user => {
      setUid(user?.uid ?? null);
    });
  }, []);

  // Load artifacts and dashboards
  const load = useCallback(async (userId: string) => {
    const [arts, dashes] = await Promise.all([
      getArtifacts(userId).catch(() => [] as SavedArtifact[]),
      getDashboards(userId).catch(() => [] as SavedDashboard[]),
    ]);
    setArtifacts(arts);
    setDashboards(dashes);
  }, []);

  useEffect(() => {
    if (uid) load(uid);
  }, [uid, load]);

  // Create new dashboard
  function createDashboard() {
    if (!newDashName.trim() || !uid) return;
    const now = new Date().toISOString();
    const d: SavedDashboard = {
      id: generateId(),
      userId: uid,
      name: newDashName.trim(),
      description: '',
      tiles: [],
      createdAt: now,
      updatedAt: now,
    };
    setActiveDashboard(d);
    setNewDashName('');
  }

  // Add artifact as a tile
  function addTile(artifact: SavedArtifact) {
    if (!activeDashboard) return;
    const existingRows = activeDashboard.tiles.map(t => t.row + t.rowSpan);
    const nextRow = existingRows.length > 0 ? Math.max(...existingRows) : 0;
    const tile: DashboardTile = {
      id: generateId(),
      artifactId: artifact.id,
      title: artifact.name,
      col: 0,
      row: nextRow,
      colSpan: 6,
      rowSpan: 2,
    };
    setActiveDashboard(d => d ? { ...d, tiles: [...d.tiles, tile] } : d);
  }

  // Remove tile
  function removeTile(tileId: string) {
    setActiveDashboard(d => d ? { ...d, tiles: d.tiles.filter(t => t.id !== tileId) } : d);
  }

  // Update tile span
  function updateTileSpan(tileId: string, colSpan: number, rowSpan: number) {
    setActiveDashboard(d => d ? {
      ...d,
      tiles: d.tiles.map(t => t.id === tileId ? { ...t, colSpan, rowSpan } : t),
    } : d);
  }

  // Save dashboard
  async function handleSave() {
    if (!activeDashboard || !uid) return;
    setSaving(true);
    try {
      const updated = { ...activeDashboard, updatedAt: new Date().toISOString() };
      await saveDashboard(uid, updated);
      setActiveDashboard(updated);
      setStatus('Saved!');
      await load(uid);
      setTimeout(() => setStatus(''), 2000);
    } catch {
      setStatus('Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (!uid) {
    return (
      <div style={{ padding: 40, fontFamily: "'Google Sans', sans-serif", color: 'var(--text-muted)' }}>
        Please sign in to use the Dashboard editor.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: "'Google Sans', sans-serif", overflow: 'hidden' }}>
      {/* Left sidebar: artifact picker + dashboard list */}
      <aside style={{
        width: 280, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
        background: 'var(--surface, #fff)', flexShrink: 0, overflow: 'hidden',
      }}>
        {/* Dashboard list */}
        <div style={{ padding: '16px 16px 8px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>My Dashboards</div>
          {dashboards.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No dashboards yet.</div>}
          {dashboards.map(d => (
            <button
              key={d.id}
              onClick={() => setActiveDashboard(d)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '6px 10px', borderRadius: 6,
                background: activeDashboard?.id === d.id ? 'var(--accent-light, #e8f0fe)' : 'none',
                border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text)',
              }}
            >{d.name}</button>
          ))}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input
              value={newDashName}
              onChange={e => setNewDashName(e.target.value)}
              placeholder="New dashboard name"
              onKeyDown={e => e.key === 'Enter' && createDashboard()}
              style={{ flex: 1, fontSize: 12, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6, outline: 'none' }}
            />
            <button
              onClick={createDashboard}
              disabled={!newDashName.trim()}
              style={{ padding: '5px 10px', fontSize: 12, background: '#1967d2', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
            >+</button>
          </div>
        </div>

        {/* Artifact picker */}
        <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Saved Artifacts ({artifacts.length})
          </div>
          {artifacts.map(a => (
            <div key={a.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 8px', borderRadius: 6, marginBottom: 4,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--text-muted)', flexShrink: 0 }}>
                {a.type === 'query' ? 'table_chart' : a.type === 'workflow' ? 'account_tree' : 'analytics'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{a.type}</div>
              </div>
              <button
                onClick={() => addTile(a)}
                disabled={!activeDashboard}
                title="Add to dashboard"
                style={{
                  background: 'none', border: 'none', cursor: activeDashboard ? 'pointer' : 'default',
                  color: activeDashboard ? '#1967d2' : 'var(--text-dim)', flexShrink: 0,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Main canvas */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{
          height: 52, borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px',
          background: 'var(--surface)',
        }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
            {activeDashboard ? activeDashboard.name : 'Dashboard Editor'}
          </span>
          {activeDashboard && (
            <>
              <div style={{ flex: 1 }} />
              {status && <span style={{ fontSize: 12, color: status === 'Saved!' ? '#00897b' : '#c62828' }}>{status}</span>}
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '7px 18px', fontSize: 13, fontWeight: 500,
                  background: '#1967d2', color: 'white', border: 'none', borderRadius: 8,
                  cursor: saving ? 'wait' : 'pointer',
                }}
              >
                {saving ? 'Saving...' : 'Save Dashboard'}
              </button>
            </>
          )}
        </div>

        {/* Grid canvas */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {!activeDashboard ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              height: '100%', gap: 12, color: 'var(--text-muted)',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 48, opacity: 0.3 }}>dashboard</span>
              <div style={{ fontSize: 14 }}>Select a dashboard from the sidebar or create a new one.</div>
            </div>
          ) : activeDashboard.tiles.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              height: '100%', gap: 12, color: 'var(--text-muted)',
              border: '2px dashed var(--border)', borderRadius: 12,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 40, opacity: 0.3 }}>add_box</span>
              <div style={{ fontSize: 14 }}>Add artifacts from the sidebar to build your dashboard.</div>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${COLS}, 1fr)`,
              gap: 12,
              alignItems: 'start',
            }}>
              {activeDashboard.tiles.map(tile => {
                const artifact = artifacts.find(a => a.id === tile.artifactId);
                return (
                  <div
                    key={tile.id}
                    style={{
                      gridColumn: `span ${tile.colSpan}`,
                      gridRow: `span ${tile.rowSpan}`,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      minHeight: tile.rowSpan * 80,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--text-muted)' }}>
                        {artifact?.type === 'query' ? 'table_chart' : 'analytics'}
                      </span>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{tile.title}</span>
                      <button
                        onClick={() => removeTile(tile.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
                        title="Remove tile"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {artifact?.description || artifact?.type || 'Artifact'}
                    </div>
                    {/* Span controls */}
                    <div style={{ display: 'flex', gap: 6, marginTop: 'auto', alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Cols:</span>
                      {[3, 4, 6, 8, 12].map(n => (
                        <button key={n} onClick={() => updateTileSpan(tile.id, n, tile.rowSpan)} style={{
                          fontSize: 10, padding: '1px 5px', borderRadius: 4,
                          background: tile.colSpan === n ? '#1967d2' : 'var(--border)',
                          color: tile.colSpan === n ? 'white' : 'var(--text-muted)',
                          border: 'none', cursor: 'pointer',
                        }}>{n}</button>
                      ))}
                      <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 4 }}>Rows:</span>
                      {[1, 2, 3, 4].map(n => (
                        <button key={n} onClick={() => updateTileSpan(tile.id, tile.colSpan, n)} style={{
                          fontSize: 10, padding: '1px 5px', borderRadius: 4,
                          background: tile.rowSpan === n ? '#1967d2' : 'var(--border)',
                          color: tile.rowSpan === n ? 'white' : 'var(--text-muted)',
                          border: 'none', cursor: 'pointer',
                        }}>{n}</button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
