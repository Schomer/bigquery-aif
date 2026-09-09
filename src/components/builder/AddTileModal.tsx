'use client';

// src/components/builder/AddTileModal.tsx
// Modal for adding a new tile (Custom SQL, Saved Artifact, Markdown/Text, or KPI).

import { useState } from 'react';
import type { BuilderTile, ArtifactType } from '@/lib/builder-types';
import type { SavedArtifact } from '@/lib/types';
import { executeQuery } from '@/lib/bigquery-client';

interface Props {
  project: string;
  savedArtifacts: SavedArtifact[];
  onAdd: (tile: Partial<BuilderTile>) => void;
  onClose: () => void;
}

export function AddTileModal({ project, savedArtifacts, onAdd, onClose }: Props) {
  const [tab, setTab] = useState<'custom' | 'saved' | 'text'>('custom');

  // Custom tile state
  const [title, setTitle] = useState('');
  const [sql, setSql] = useState('');
  const [vizType, setVizType] = useState<ArtifactType>('TABLE');
  const [colSpan, setColSpan] = useState(6);
  const [rowSpan, setRowSpan] = useState(2);
  const [running, setRunning] = useState(false);

  // Text tile state
  const [textTitle, setTextTitle] = useState('Notes');
  const [textContent, setTextContent] = useState('');

  // Saved artifact search
  const [search, setSearch] = useState('');
  const filteredArtifacts = savedArtifacts.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleAddCustom(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    let snapshot = undefined;
    if (sql.trim() && project) {
      setRunning(true);
      try {
        const cleanSql = sql
          .replace(/\{\{start_date\}\}/g, '1900-01-01')
          .replace(/\{\{end_date\}\}/g, '2100-12-31');
        const res = await executeQuery(cleanSql, project);
        snapshot = {
          columns: res.columns,
          rows: res.rows as (string | number | boolean | null)[][],
          rowCount: res.rowCount,
          fetchedAt: new Date().toISOString(),
        };
      } catch (err) {
        console.warn('Initial query execution failed:', err);
      } finally {
        setRunning(false);
      }
    }

    onAdd({
      title: title.trim(),
      cachedSql: sql.trim() || undefined,
      parameterizedSql: sql.includes('{{') ? sql.trim() : undefined,
      vizType,
      colSpan,
      rowSpan,
      tileType: 'query',
      artifactData: snapshot,
      lastSnapshot: snapshot,
    });
    onClose();
  }

  function handleAddText(e: React.FormEvent) {
    e.preventDefault();
    if (!textContent.trim()) return;

    onAdd({
      title: textTitle.trim() || 'Text Note',
      textContent: textContent.trim(),
      tileType: 'text',
      colSpan: 12,
      rowSpan: 1,
    });
    onClose();
  }

  function handleAddSaved(artifact: SavedArtifact) {
    const cachedSql = artifact.steps?.find((s) => s.cachedSql)?.cachedSql || '';
    onAdd({
      title: artifact.name,
      cachedSql: cachedSql || undefined,
      vizType: 'TABLE',
      colSpan: 6,
      rowSpan: 2,
      tileType: 'query',
    });
    onClose();
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 150,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          padding: 24,
          width: 560,
          maxWidth: '92vw',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          fontFamily: "'Google Sans', sans-serif",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Add Tile</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
          <button
            onClick={() => setTab('custom')}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: 13,
              color: tab === 'custom' ? '#1a73e8' : 'var(--text-muted)',
              borderBottom: tab === 'custom' ? '2px solid #1a73e8' : '2px solid transparent',
            }}
          >
            Custom Query / Chart
          </button>
          <button
            onClick={() => setTab('saved')}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: 13,
              color: tab === 'saved' ? '#1a73e8' : 'var(--text-muted)',
              borderBottom: tab === 'saved' ? '2px solid #1a73e8' : '2px solid transparent',
            }}
          >
            From Saved Queries
          </button>
          <button
            onClick={() => setTab('text')}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: 13,
              color: tab === 'text' ? '#1a73e8' : 'var(--text-muted)',
              borderBottom: tab === 'text' ? '2px solid #1a73e8' : '2px solid transparent',
            }}
          >
            Text / Markdown
          </button>
        </div>

        {/* Custom Tab */}
        {tab === 'custom' && (
          <form onSubmit={handleAddCustom} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>Tile Title</label>
              <input
                autoFocus
                required
                placeholder="e.g. Total Revenue by Category"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Visualization</label>
                <select value={vizType} onChange={(e) => setVizType(e.target.value as ArtifactType)} style={inputStyle}>
                  <option value="TABLE">Table</option>
                  <option value="BAR_CHART">Bar Chart</option>
                  <option value="COLUMN_CHART">Column Chart</option>
                  <option value="LINE_CHART">Line Chart</option>
                  <option value="AREA_CHART">Area Chart</option>
                  <option value="PIE_CHART">Pie Chart</option>
                  <option value="KPI_CARD">KPI Card</option>
                  <option value="STAT_ROW">Stat Row</option>
                  <option value="SCATTER">Scatter Plot</option>
                  <option value="GEO_POINT_MAP">Geo Map</option>
                </select>
              </div>
              <div style={{ width: 100 }}>
                <label style={labelStyle}>Width</label>
                <select value={colSpan} onChange={(e) => setColSpan(Number(e.target.value))} style={inputStyle}>
                  {[3, 4, 6, 8, 12].map((n) => (
                    <option key={n} value={n}>{n} / 12</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>SQL Query</label>
              <textarea
                rows={5}
                placeholder="SELECT ... FROM `project.dataset.table`"
                value={sql}
                onChange={(e) => setSql(e.target.value)}
                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12 }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button type="button" onClick={onClose} style={btnSecondary}>Cancel</button>
              <button type="submit" disabled={running} style={btnPrimary}>
                {running ? 'Loading...' : 'Add Tile'}
              </button>
            </div>
          </form>
        )}

        {/* Saved Queries Tab */}
        {tab === 'saved' && (
          <div>
            <input
              placeholder="Search saved queries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...inputStyle, marginBottom: 12 }}
            />
            <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filteredArtifacts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>
                  No saved queries found.
                </div>
              ) : (
                filteredArtifacts.map((art) => (
                  <button
                    key={art.id}
                    onClick={() => handleAddSaved(art)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      background: '#fff',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ color: '#1a73e8', fontSize: 20 }}>
                      table_chart
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{art.name}</div>
                      {art.description && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {art.description}
                        </div>
                      )}
                    </div>
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--text-dim)' }}>
                      add
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Text Tab */}
        {tab === 'text' && (
          <form onSubmit={handleAddText} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>Note Title</label>
              <input
                placeholder="e.g. Overview & Key Insights"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Content</label>
              <textarea
                rows={5}
                required
                placeholder="Enter description, insights, or documentation here..."
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button type="button" onClick={onClose} style={btnSecondary}>Cancel</button>
              <button type="submit" style={btnPrimary}>Add Note Tile</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--text-muted)',
  marginBottom: 4,
  display: 'block',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontSize: 13,
  padding: '8px 10px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  background: 'var(--surface, #fff)',
};

const btnPrimary: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 6,
  border: 'none',
  background: '#1a73e8',
  color: '#fff',
  fontWeight: 500,
  cursor: 'pointer',
  fontSize: 13,
};

const btnSecondary: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'none',
  cursor: 'pointer',
  fontSize: 13,
};
