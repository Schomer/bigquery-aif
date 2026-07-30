'use client';
// src/components/DatasetBrowserDialog.tsx
// Modal dialog that lists all datasets in the active project with search/filter.
// Opens instantly and fetches datasets in the background.

import { useState, useEffect, useRef, useCallback } from 'react';
import { listAllDatasets } from '@/lib/bigquery-client';

interface Props {
  open: boolean;
  project: string;
  onSelect: (datasetId: string) => void;
  onClose: () => void;
}

export function DatasetBrowserDialog({ open, project, onSelect, onClose }: Props) {
  const [datasets, setDatasets] = useState<Array<{ datasetId: string; location: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Fetch datasets when dialog opens
  useEffect(() => {
    if (!open || !project) return;
    setLoading(true);
    setError(null);
    setDatasets([]);
    setFilter('');
    setActiveIdx(0);
    listAllDatasets(project)
      .then((ds) => {
        setDatasets(ds);
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.message || 'Failed to fetch datasets');
        setLoading(false);
      });
  }, [open, project]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  const filtered = filter
    ? datasets.filter(ds => ds.datasetId.toLowerCase().includes(filter.toLowerCase()))
    : datasets;

  // Reset active index when filter changes
  useEffect(() => setActiveIdx(0), [filter]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered.length > 0) {
      e.preventDefault();
      onSelect(filtered[activeIdx].datasetId);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [filtered, activeIdx, onSelect, onClose]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIdx] as HTMLElement | undefined;
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  if (!open) return null;

  return (
    <div
      className="dataset-browser-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="dataset-browser-dialog" onKeyDown={handleKeyDown}>
        {/* Header */}
        <div className="dataset-browser-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#6366f1' }}>database</span>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Datasets in {project}</span>
          </div>
          <button
            onClick={onClose}
            className="dataset-browser-close"
            aria-label="Close"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        {/* Search */}
        <div className="dataset-browser-search">
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 16, color: 'var(--text-dim)', flexShrink: 0 }}
          >search</span>
          <input
            ref={inputRef}
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter datasets..."
            className="dataset-browser-search-input"
          />
          {filter && (
            <button
              onClick={() => setFilter('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-dim)', fontSize: 14, lineHeight: 1 }}
            >x</button>
          )}
          {!loading && datasets.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {filtered.length} of {datasets.length}
            </span>
          )}
        </div>

        {/* List */}
        <div className="dataset-browser-list" ref={listRef}>
          {loading && (
            <div className="dataset-browser-status">
              Loading datasets...
            </div>
          )}
          {error && (
            <div className="dataset-browser-status" style={{ color: '#ef4444' }}>
              {error}
            </div>
          )}
          {!loading && !error && filtered.length === 0 && datasets.length > 0 && (
            <div className="dataset-browser-status">
              No datasets match &quot;{filter}&quot;
            </div>
          )}
          {!loading && !error && datasets.length === 0 && (
            <div className="dataset-browser-status">
              No datasets found in this project.
            </div>
          )}
          {filtered.map((ds, i) => (
            <button
              key={ds.datasetId}
              className={`dataset-browser-row${i === activeIdx ? ' dataset-browser-row--active' : ''}`}
              onClick={() => onSelect(ds.datasetId)}
              onMouseEnter={() => setActiveIdx(i)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#6366f1', flexShrink: 0 }}>database</span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
                {ds.datasetId}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}>{ds.location}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
