'use client';

// src/components/builder/TileSqlEditor.tsx
// Drawer/Modal for viewing and editing the SQL query, visualization type,
// and parameter placeholders of a tile.

import { useState } from 'react';
import type { BuilderTile, ArtifactType } from '@/lib/builder-types';
import { executeQuery } from '@/lib/bigquery-client';

const VIZ_OPTIONS: Array<{ label: string; value: ArtifactType; icon: string }> = [
  { label: 'Table', value: 'TABLE', icon: 'table_chart' },
  { label: 'KPI Card', value: 'KPI_CARD', icon: 'pin' },
  { label: 'Stat Row', value: 'STAT_ROW', icon: 'view_headline' },
  { label: 'Bar Chart', value: 'BAR_CHART', icon: 'bar_chart' },
  { label: 'Column Chart', value: 'COLUMN_CHART', icon: 'insert_chart' },
  { label: 'Line Chart', value: 'LINE_CHART', icon: 'show_chart' },
  { label: 'Area Chart', value: 'AREA_CHART', icon: 'area_chart' },
  { label: 'Pie Chart', value: 'PIE_CHART', icon: 'pie_chart' },
  { label: 'Donut Chart', value: 'DONUT_CHART', icon: 'donut_large' },
  { label: 'Scatter Plot', value: 'SCATTER', icon: 'scatter_plot' },
  { label: 'Histogram', value: 'HISTOGRAM', icon: 'bar_chart' },
  { label: 'Geo Map', value: 'GEO_POINT_MAP', icon: 'public' },
  { label: 'Treemap', value: 'TREEMAP', icon: 'grid_view' },
];

interface Props {
  tile: BuilderTile;
  project: string;
  onSave: (updates: Partial<BuilderTile>) => void;
  onClose: () => void;
}

export function TileSqlEditor({ tile, project, onSave, onClose }: Props) {
  const [title, setTitle] = useState(tile.title);
  const [sql, setSql] = useState(tile.parameterizedSql || tile.cachedSql || '');
  const [vizType, setVizType] = useState<ArtifactType>(tile.vizType || 'TABLE');
  const [colSpan, setColSpan] = useState(tile.colSpan);
  const [rowSpan, setRowSpan] = useState(tile.rowSpan);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ rowCount?: number; error?: string } | null>(null);

  async function handleTest() {
    if (!sql.trim() || !project) return;
    setTesting(true);
    setTestResult(null);
    try {
      const cleanSql = sql
        .replace(/\{\{start_date\}\}/g, '1900-01-01')
        .replace(/\{\{end_date\}\}/g, '2100-12-31')
        .replace(/\{\{[^}]+\}\}/g, '1');
      const res = await executeQuery(cleanSql, project);
      setTestResult({ rowCount: res.rowCount });
    } catch (err) {
      setTestResult({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      setTesting(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      title: title.trim() || tile.title,
      cachedSql: sql.trim() || undefined,
      parameterizedSql: sql.includes('{{') ? sql.trim() : undefined,
      vizType,
      colSpan,
      rowSpan,
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
          width: 600,
          maxWidth: '92vw',
          maxHeight: '88vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          fontFamily: "'Google Sans', sans-serif",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
            Edit Tile: {tile.title}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Tile Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={inputStyle}
              placeholder="e.g. Monthly Revenue Trend"
            />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Visualization Type</label>
              <select
                value={vizType}
                onChange={(e) => setVizType(e.target.value as ArtifactType)}
                style={inputStyle}
              >
                {VIZ_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div style={{ width: 100 }}>
              <label style={labelStyle}>Width (cols)</label>
              <select
                value={colSpan}
                onChange={(e) => setColSpan(Number(e.target.value))}
                style={inputStyle}
              >
                {[3, 4, 6, 8, 12].map((n) => (
                  <option key={n} value={n}>{n} / 12</option>
                ))}
              </select>
            </div>
            <div style={{ width: 100 }}>
              <label style={labelStyle}>Height (rows)</label>
              <select
                value={rowSpan}
                onChange={(e) => setRowSpan(Number(e.target.value))}
                style={inputStyle}
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>{n} row{n !== 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <label style={labelStyle}>BigQuery SQL Query</label>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                Use placeholders like <code style={{ color: '#1a73e8' }}>{'{{country}}'}</code> or <code style={{ color: '#1a73e8' }}>{'{{start_date}}'}</code>
              </span>
            </div>
            <textarea
              rows={6}
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              placeholder="SELECT ... FROM `project.dataset.table` WHERE date >= '{{start_date}}' ..."
              style={{
                ...inputStyle,
                fontFamily: 'monospace',
                fontSize: 12,
                lineHeight: 1.5,
                resize: 'vertical',
              }}
            />
          </div>

          {/* Query testing response */}
          {testResult && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                fontSize: 12,
                background: testResult.error ? '#fef2f2' : '#f0fdf4',
                color: testResult.error ? '#b91c1c' : '#15803d',
                border: `1px solid ${testResult.error ? '#fecaca' : '#bbf7d0'}`,
              }}
            >
              {testResult.error ? `Error: ${testResult.error}` : `Success: Returned ${testResult.rowCount} rows.`}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !sql.trim()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '7px 14px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'none',
                cursor: testing ? 'wait' : 'pointer',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>play_arrow</span>
              {testing ? 'Testing...' : 'Test Query'}
            </button>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '7px 14px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  padding: '7px 16px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#1a73e8',
                  color: '#fff',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </form>
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
