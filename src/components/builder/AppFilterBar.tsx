'use client';

// src/components/builder/AppFilterBar.tsx
// Interactive filter bar for data apps and dashboards.
// Renders dynamic controls (Date Range, Dropdown, Multi-Select, Search) and
// manages filter values with real-time reactive re-querying.

import { useState, useRef, useEffect } from 'react';
import type { AppFilterControl, FilterControlType } from '@/lib/builder-types';

interface Props {
  filters: AppFilterControl[];
  values: Record<string, unknown>;
  editMode: boolean;
  onValueChange: (paramName: string, value: unknown) => void;
  onClearAll: () => void;
  onAddFilter?: (filter: AppFilterControl) => void;
  onRemoveFilter?: (filterId: string) => void;
  isRefreshing?: boolean;
}

export function AppFilterBar({
  filters,
  values,
  editMode,
  onValueChange,
  onClearAll,
  onAddFilter,
  onRemoveFilter,
  isRefreshing,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newParam, setNewParam] = useState('');
  const [newType, setNewType] = useState<FilterControlType>('DROPDOWN');
  const [newOptionsStr, setNewOptionsStr] = useState('');
  const [newOptionsSql, setNewOptionsSql] = useState('');

  const hasAnyFilterValue = Object.values(values).some((v) => {
    if (v === undefined || v === null || v === '') return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  });

  function handleCreateFilter(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim() || !onAddFilter) return;

    const paramName = newParam.trim() || newLabel.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const options = newOptionsStr
      ? newOptionsStr.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    onAddFilter({
      id: `filter_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      label: newLabel.trim(),
      paramName,
      type: newType,
      options,
      optionsSql: newOptionsSql.trim() || undefined,
    });

    setNewLabel('');
    setNewParam('');
    setNewOptionsStr('');
    setNewOptionsSql('');
    setModalOpen(false);
  }

  if (filters.length === 0 && !editMode) {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 20px',
        background: 'var(--surface, #fff)',
        borderBottom: '1px solid var(--border)',
        flexWrap: 'wrap',
        position: 'relative',
        zIndex: 5,
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>filter_alt</span>
        Filters:
      </span>

      {filters.map((filter) => {
        const val = values[filter.paramName];

        return (
          <div
            key={filter.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--surface-2, #f8f9fc)',
              padding: '3px 8px',
              borderRadius: 8,
              border: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
              {filter.label}:
            </span>

            {/* DATE_RANGE */}
            {filter.type === 'DATE_RANGE' && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="date"
                  value={typeof val === 'object' && val !== null ? (val as any).start || '' : (values['start_date'] as string) || ''}
                  onChange={(e) => onValueChange('start_date', e.target.value)}
                  style={inputStyle}
                  aria-label={`${filter.label} start`}
                />
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>to</span>
                <input
                  type="date"
                  value={typeof val === 'object' && val !== null ? (val as any).end || '' : (values['end_date'] as string) || ''}
                  onChange={(e) => onValueChange('end_date', e.target.value)}
                  style={inputStyle}
                  aria-label={`${filter.label} end`}
                />
              </div>
            )}

            {/* DROPDOWN */}
            {filter.type === 'DROPDOWN' && (
              <select
                value={String(val ?? '')}
                onChange={(e) => onValueChange(filter.paramName, e.target.value)}
                style={selectStyle}
                aria-label={filter.label}
              >
                <option value="">All</option>
                {filter.options?.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            )}

            {/* MULTI_SELECT */}
            {filter.type === 'MULTI_SELECT' && (
              <MultiSelectFilter
                filter={filter}
                selected={(val as string[]) || []}
                onChange={(next) => onValueChange(filter.paramName, next)}
              />
            )}

            {/* SEARCH_INPUT */}
            {filter.type === 'SEARCH_INPUT' && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                <input
                  type="text"
                  placeholder="Search..."
                  value={String(val ?? '')}
                  onChange={(e) => onValueChange(filter.paramName, e.target.value)}
                  style={{ ...inputStyle, width: 110 }}
                />
                {val ? (
                  <button
                    onClick={() => onValueChange(filter.paramName, '')}
                    style={clearTinyBtn}
                    title="Clear search"
                  >
                    &#x2715;
                  </button>
                ) : null}
              </div>
            )}

            {/* NUMBER_INPUT */}
            {filter.type === 'NUMBER_INPUT' && (
              <input
                type="number"
                placeholder="Value..."
                value={String(val ?? '')}
                onChange={(e) => onValueChange(filter.paramName, e.target.value === '' ? '' : Number(e.target.value))}
                style={{ ...inputStyle, width: 80 }}
              />
            )}

            {/* Remove filter button in edit mode */}
            {editMode && onRemoveFilter && (
              <button
                onClick={() => onRemoveFilter(filter.id)}
                style={removeFilterBtn}
                title="Remove filter"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>close</span>
              </button>
            )}
          </div>
        );
      })}

      {/* Clear all active filters */}
      {hasAnyFilterValue && (
        <button
          onClick={onClearAll}
          style={{
            padding: '4px 10px',
            fontSize: 11,
            fontWeight: 500,
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          Clear filters
        </button>
      )}

      {/* Add filter button in edit mode */}
      {editMode && onAddFilter && (
        <button
          onClick={() => setModalOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            borderRadius: 6,
            border: '1px dashed #1a73e8',
            background: 'none',
            color: '#1a73e8',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
          Add Filter
        </button>
      )}

      {isRefreshing && (
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#1a73e8' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, animation: 'spin 1s linear infinite' }}>sync</span>
          Updating...
        </div>
      )}

      {/* Add Filter Modal */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setModalOpen(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              width: 440,
              maxWidth: '90vw',
              boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--text)' }}>
              Add Interactive Filter
            </div>

            <form onSubmit={handleCreateFilter} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={fieldLabel}>Filter Label</label>
                <input
                  required
                  autoFocus
                  placeholder="e.g. Country, Region, Status"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  style={modalInput}
                />
              </div>

              <div>
                <label style={fieldLabel}>SQL Parameter Name</label>
                <input
                  placeholder="e.g. country (used as {{country}} in queries)"
                  value={newParam}
                  onChange={(e) => setNewParam(e.target.value)}
                  style={modalInput}
                />
              </div>

              <div>
                <label style={fieldLabel}>Control Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as FilterControlType)}
                  style={modalInput}
                >
                  <option value="DROPDOWN">Dropdown (Single Select)</option>
                  <option value="MULTI_SELECT">Multi-Select Dropdown</option>
                  <option value="DATE_RANGE">Date Range</option>
                  <option value="SEARCH_INPUT">Text Search Box</option>
                  <option value="NUMBER_INPUT">Number Input</option>
                </select>
              </div>

              {newType !== 'DATE_RANGE' && newType !== 'SEARCH_INPUT' && newType !== 'NUMBER_INPUT' && (
                <>
                  <div>
                    <label style={fieldLabel}>Static Options (comma-separated)</label>
                    <input
                      placeholder="e.g. USA, Canada, Germany, UK"
                      value={newOptionsStr}
                      onChange={(e) => setNewOptionsStr(e.target.value)}
                      style={modalInput}
                    />
                  </div>
                  <div>
                    <label style={fieldLabel}>Dynamic Options SQL Query (Optional)</label>
                    <textarea
                      placeholder="SELECT DISTINCT country FROM `my_project.dataset.table` ORDER BY 1 LIMIT 50"
                      value={newOptionsSql}
                      onChange={(e) => setNewOptionsSql(e.target.value)}
                      rows={2}
                      style={{ ...modalInput, resize: 'vertical' }}
                    />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    padding: '8px 14px',
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
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#1a73e8',
                    color: '#fff',
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  Add Filter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MultiSelectFilter Component ──

function MultiSelectFilter({
  filter,
  selected,
  onChange,
}: {
  filter: AppFilterControl;
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const options = filter.options || [];
  const visible = search
    ? options.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  const toggle = (opt: string) => {
    const next = selected.includes(opt)
      ? selected.filter((s) => s !== opt)
      : [...selected, opt];
    onChange(next);
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 12,
          padding: '3px 8px',
          border: '1px solid var(--border)',
          borderRadius: 6,
          background: '#fff',
          cursor: 'pointer',
          color: 'var(--text)',
        }}
      >
        <span>{selected.length === 0 ? 'All' : `${selected.length} selected`}</span>
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_drop_down</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 100,
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            minWidth: 200,
            maxHeight: 240,
            overflowY: 'auto',
            padding: 4,
          }}
        >
          {options.length > 6 && (
            <input
              autoFocus
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                fontSize: 12,
                padding: '4px 6px',
                border: '1px solid var(--border)',
                borderRadius: 4,
                marginBottom: 4,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          )}

          {visible.length === 0 ? (
            <div style={{ padding: 8, fontSize: 11, color: 'var(--text-muted)' }}>No options</div>
          ) : (
            visible.map((opt) => (
              <label
                key={opt}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 8px',
                  fontSize: 12,
                  cursor: 'pointer',
                  borderRadius: 4,
                  background: selected.includes(opt) ? '#eff6ff' : 'transparent',
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggle(opt)}
                />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Shared styles ──

const inputStyle: React.CSSProperties = {
  fontSize: 12,
  padding: '3px 6px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: '#fff',
  color: 'var(--text)',
  outline: 'none',
};

const selectStyle: React.CSSProperties = {
  fontSize: 12,
  padding: '3px 6px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: '#fff',
  color: 'var(--text)',
  outline: 'none',
  cursor: 'pointer',
};

const clearTinyBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-dim)',
  fontSize: 11,
  padding: '0 2px',
};

const removeFilterBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-dim)',
  padding: 1,
  display: 'flex',
  alignItems: 'center',
  borderRadius: 4,
};

const fieldLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--text-muted)',
  marginBottom: 4,
  display: 'block',
};

const modalInput: React.CSSProperties = {
  width: '100%',
  fontSize: 13,
  padding: '8px 10px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};
