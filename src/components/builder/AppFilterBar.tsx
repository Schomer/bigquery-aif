'use client';

// src/components/builder/AppFilterBar.tsx
// Interactive filter bar for data apps and dashboards.
// Renders dynamic controls (Date Range with presets, Date Picker, Dropdown, Multi-Select,
// Number Range, Search Input, Button Group) with real-time reactive re-querying.

import { useState, useRef, useEffect } from 'react';
import type { AppFilterControl, FilterControlType, BuilderTile } from '@/lib/builder-types';

interface Props {
  filters: AppFilterControl[];
  values: Record<string, unknown>;
  editMode: boolean;
  tiles?: BuilderTile[];
  onValueChange: (paramName: string, value: unknown) => void;
  onClearAll: () => void;
  onAddFilter?: (filter: AppFilterControl) => void;
  onEditFilter?: (filter: AppFilterControl) => void;
  onRemoveFilter?: (filterId: string) => void;
  isRefreshing?: boolean;
}

export function AppFilterBar({
  filters,
  values,
  editMode,
  tiles = [],
  onValueChange,
  onClearAll,
  onAddFilter,
  onEditFilter,
  onRemoveFilter,
  isRefreshing,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFilterId, setEditingFilterId] = useState<string | null>(null);

  // Modal form state
  const [newLabel, setNewLabel] = useState('');
  const [newParam, setNewParam] = useState('');
  const [newColumn, setNewColumn] = useState('');
  const [newType, setNewType] = useState<FilterControlType>('DROPDOWN');
  const [newOptionsStr, setNewOptionsStr] = useState('');
  const [newOptionsSql, setNewOptionsSql] = useState('');
  const [newDefaultVal, setNewDefaultVal] = useState('');
  const [newMin, setNewMin] = useState<number | undefined>(undefined);
  const [newMax, setNewMax] = useState<number | undefined>(undefined);
  const [newStep, setNewStep] = useState<number | undefined>(undefined);
  const [newTargetTiles, setNewTargetTiles] = useState<string[]>([]);

  const hasAnyFilterValue = Object.values(values).some((v) => {
    if (v === undefined || v === null || v === '') return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  });

  function openCreateModal() {
    setEditingFilterId(null);
    setNewLabel('');
    setNewParam('');
    setNewColumn('');
    setNewType('DROPDOWN');
    setNewOptionsStr('');
    setNewOptionsSql('');
    setNewDefaultVal('');
    setNewMin(undefined);
    setNewMax(undefined);
    setNewStep(undefined);
    setNewTargetTiles([]);
    setModalOpen(true);
  }

  function openEditModal(f: AppFilterControl) {
    setEditingFilterId(f.id);
    setNewLabel(f.label);
    setNewParam(f.paramName);
    setNewColumn(f.column || '');
    setNewType(f.type);
    setNewOptionsStr(f.options ? f.options.join(', ') : '');
    setNewOptionsSql(f.optionsSql || '');
    setNewDefaultVal(typeof f.defaultValue === 'string' ? f.defaultValue : '');
    setNewMin(f.min);
    setNewMax(f.max);
    setNewStep(f.step);
    setNewTargetTiles(f.targetTileIds || []);
    setModalOpen(true);
  }

  function handleSaveFilter(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;

    const paramName = newParam.trim() || newLabel.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const options = newOptionsStr
      ? newOptionsStr.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    const filterPayload: AppFilterControl = {
      id: editingFilterId || `filter_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      label: newLabel.trim(),
      paramName,
      type: newType,
      column: newColumn.trim() || undefined,
      options: options.length > 0 ? options : undefined,
      optionsSql: newOptionsSql.trim() || undefined,
      defaultValue: newDefaultVal.trim() || undefined,
      min: newMin,
      max: newMax,
      step: newStep,
      targetTileIds: newTargetTiles.length > 0 ? newTargetTiles : undefined,
    };

    if (editingFilterId && onEditFilter) {
      onEditFilter(filterPayload);
    } else if (onAddFilter) {
      onAddFilter(filterPayload);
    }

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
          fontWeight: 500,
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
            <span
              onClick={() => editMode && openEditModal(filter)}
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                fontWeight: 500,
                cursor: editMode ? 'pointer' : 'default',
              }}
              title={editMode ? 'Click to configure filter' : undefined}
            >
              {filter.label}:
            </span>

            {/* 1. DATE_RANGE with Quick Presets */}
            {filter.type === 'DATE_RANGE' && (
              <DateRangeFilter
                paramName={filter.paramName}
                val={val}
                onValueChange={onValueChange}
              />
            )}

            {/* 2. DATE_PICKER (Single Date) */}
            {filter.type === 'DATE_PICKER' && (
              <input
                type="date"
                value={String(val ?? '')}
                onChange={(e) => onValueChange(filter.paramName, e.target.value)}
                style={inputStyle}
                aria-label={filter.label}
              />
            )}

            {/* 3. DROPDOWN (Single Select) */}
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

            {/* 4. MULTI_SELECT */}
            {filter.type === 'MULTI_SELECT' && (
              <MultiSelectFilter
                filter={filter}
                selected={(val as string[]) || []}
                onChange={(next) => onValueChange(filter.paramName, next)}
              />
            )}

            {/* 5. NUMBER_RANGE (Min / Max) */}
            {filter.type === 'NUMBER_RANGE' && (
              <NumberRangeFilter
                val={val}
                min={filter.min}
                max={filter.max}
                step={filter.step}
                onChange={(next) => onValueChange(filter.paramName, next)}
              />
            )}

            {/* 6. SEARCH_INPUT */}
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

            {/* 7. BUTTON_GROUP */}
            {filter.type === 'BUTTON_GROUP' && (
              <ButtonGroupFilter
                filter={filter}
                selected={String(val ?? '')}
                onChange={(next) => onValueChange(filter.paramName, next)}
              />
            )}

            {/* NUMBER_INPUT Fallback */}
            {filter.type === 'NUMBER_INPUT' && (
              <input
                type="number"
                placeholder="Value..."
                value={String(val ?? '')}
                onChange={(e) => onValueChange(filter.paramName, e.target.value === '' ? '' : Number(e.target.value))}
                style={{ ...inputStyle, width: 80 }}
              />
            )}

            {/* Edit / Remove filter buttons in edit mode */}
            {editMode && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginLeft: 2 }}>
                <button
                  onClick={() => openEditModal(filter)}
                  style={actionTinyBtn}
                  title="Edit filter"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>edit</span>
                </button>
                {onRemoveFilter && (
                  <button
                    onClick={() => onRemoveFilter(filter.id)}
                    style={{ ...actionTinyBtn, color: '#dc2626' }}
                    title="Remove filter"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>close</span>
                  </button>
                )}
              </div>
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
          onClick={openCreateModal}
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

      {/* Add / Edit Filter Modal */}
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
              width: 480,
              maxWidth: '90vw',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 16, color: 'var(--text)' }}>
              {editingFilterId ? 'Configure Filter' : 'Add Interactive Filter'}
            </div>

            <form onSubmit={handleSaveFilter} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={fieldLabel}>Filter Label</label>
                <input
                  required
                  autoFocus
                  placeholder="e.g. Country, Order Date, Status, Price"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  style={modalInput}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={fieldLabel}>SQL Parameter Name</label>
                  <input
                    placeholder="e.g. country (for @country or {{country}})"
                    value={newParam}
                    onChange={(e) => setNewParam(e.target.value)}
                    style={modalInput}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={fieldLabel}>Data Column / Field</label>
                  <input
                    placeholder="e.g. country_name, created_at"
                    value={newColumn}
                    onChange={(e) => setNewColumn(e.target.value)}
                    style={modalInput}
                  />
                </div>
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
                  <option value="BUTTON_GROUP">Button Group (Pill Buttons)</option>
                  <option value="DATE_RANGE">Date Range (with Quick Presets)</option>
                  <option value="DATE_PICKER">Date Picker (Single Date)</option>
                  <option value="NUMBER_RANGE">Number Range (Min & Max)</option>
                  <option value="SEARCH_INPUT">Text Search Input</option>
                </select>
              </div>

              {/* Options for list/choice filters */}
              {(newType === 'DROPDOWN' || newType === 'MULTI_SELECT' || newType === 'BUTTON_GROUP') && (
                <>
                  <div>
                    <label style={fieldLabel}>Static Options (comma-separated)</label>
                    <input
                      placeholder="e.g. United States, Germany, Japan, Canada"
                      value={newOptionsStr}
                      onChange={(e) => setNewOptionsStr(e.target.value)}
                      style={modalInput}
                    />
                  </div>
                  <div>
                    <label style={fieldLabel}>Dynamic Options Query (BigQuery SQL)</label>
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

              {/* Range settings for Number Range */}
              {newType === 'NUMBER_RANGE' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={fieldLabel}>Min Value</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={newMin !== undefined ? newMin : ''}
                      onChange={(e) => setNewMin(e.target.value === '' ? undefined : Number(e.target.value))}
                      style={modalInput}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={fieldLabel}>Max Value</label>
                    <input
                      type="number"
                      placeholder="1000"
                      value={newMax !== undefined ? newMax : ''}
                      onChange={(e) => setNewMax(e.target.value === '' ? undefined : Number(e.target.value))}
                      style={modalInput}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={fieldLabel}>Step</label>
                    <input
                      type="number"
                      placeholder="1"
                      value={newStep !== undefined ? newStep : ''}
                      onChange={(e) => setNewStep(e.target.value === '' ? undefined : Number(e.target.value))}
                      style={modalInput}
                    />
                  </div>
                </div>
              )}

              {/* Target Tiles Selection */}
              {tiles.length > 0 && (
                <div>
                  <label style={fieldLabel}>Target Tiles (Scope)</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 120, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6, padding: 6 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={newTargetTiles.length === 0}
                        onChange={() => setNewTargetTiles([])}
                      />
                      <span>All Dashboard Tiles (Global)</span>
                    </label>
                    {tiles.map((t) => (
                      <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', paddingLeft: 12 }}>
                        <input
                          type="checkbox"
                          checked={newTargetTiles.includes(t.id)}
                          onChange={() => {
                            if (newTargetTiles.includes(t.id)) {
                              setNewTargetTiles(newTargetTiles.filter(id => id !== t.id));
                            } else {
                              setNewTargetTiles([...newTargetTiles, t.id]);
                            }
                          }}
                        />
                        <span>{t.title} ({t.vizType || 'TABLE'})</span>
                      </label>
                    ))}
                  </div>
                </div>
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
                  {editingFilterId ? 'Save Changes' : 'Add Filter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 1. Date Range Filter with Presets Component ──

function DateRangeFilter({
  paramName,
  val,
  onValueChange,
}: {
  paramName: string;
  val: unknown;
  onValueChange: (paramName: string, value: unknown) => void;
}) {
  const [presetOpen, setPresetOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const startVal = typeof val === 'object' && val !== null ? (val as any).start || '' : '';
  const endVal = typeof val === 'object' && val !== null ? (val as any).end || '' : '';

  useEffect(() => {
    if (!presetOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setPresetOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [presetOpen]);

  const applyPreset = (days: number) => {
    const end = new Date().toISOString().split('T')[0];
    const start = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    onValueChange(paramName, { start, end });
    setPresetOpen(false);
  };

  const applyThisQuarter = () => {
    const now = new Date();
    const qMonth = Math.floor(now.getMonth() / 3) * 3;
    const start = new Date(now.getFullYear(), qMonth, 1).toISOString().split('T')[0];
    const end = now.toISOString().split('T')[0];
    onValueChange(paramName, { start, end });
    setPresetOpen(false);
  };

  const applyThisYear = () => {
    const now = new Date();
    const start = `${now.getFullYear()}-01-01`;
    const end = now.toISOString().split('T')[0];
    onValueChange(paramName, { start, end });
    setPresetOpen(false);
  };

  return (
    <div ref={ref} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, position: 'relative' }}>
      <button
        onClick={() => setPresetOpen((v) => !v)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 2,
          padding: '3px 6px',
          borderRadius: 4,
          border: '1px solid var(--border)',
          background: '#fff',
          fontSize: 11,
          color: 'var(--text-muted)',
          cursor: 'pointer',
        }}
        title="Quick date presets"
      >
        <span>Presets</span>
        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>expand_more</span>
      </button>

      {presetOpen && (
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
            minWidth: 140,
            padding: '4px 0',
          }}
        >
          <button onClick={() => applyPreset(7)} style={menuItemStyle}>Last 7 Days</button>
          <button onClick={() => applyPreset(30)} style={menuItemStyle}>Last 30 Days</button>
          <button onClick={() => applyPreset(90)} style={menuItemStyle}>Last 90 Days</button>
          <button onClick={applyThisQuarter} style={menuItemStyle}>This Quarter</button>
          <button onClick={applyThisYear} style={menuItemStyle}>This Year</button>
        </div>
      )}

      <input
        type="date"
        value={startVal}
        onChange={(e) => onValueChange(paramName, { start: e.target.value, end: endVal })}
        style={inputStyle}
      />
      <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>to</span>
      <input
        type="date"
        value={endVal}
        onChange={(e) => onValueChange(paramName, { start: startVal, end: e.target.value })}
        style={inputStyle}
      />
    </div>
  );
}

// ── 2. MultiSelectFilter Component ──

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

// ── 3. NumberRangeFilter Component ──

function NumberRangeFilter({
  val,
  min,
  max,
  step,
  onChange,
}: {
  val: unknown;
  min?: number;
  max?: number;
  step?: number;
  onChange: (next: { min?: number; max?: number }) => void;
}) {
  const currentMin = typeof val === 'object' && val !== null ? (val as any).min : undefined;
  const currentMax = typeof val === 'object' && val !== null ? (val as any).max : undefined;

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <input
        type="number"
        placeholder={min !== undefined ? String(min) : 'Min'}
        value={currentMin !== undefined ? currentMin : ''}
        step={step}
        onChange={(e) =>
          onChange({
            min: e.target.value === '' ? undefined : Number(e.target.value),
            max: currentMax,
          })
        }
        style={{ ...inputStyle, width: 70 }}
      />
      <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>to</span>
      <input
        type="number"
        placeholder={max !== undefined ? String(max) : 'Max'}
        value={currentMax !== undefined ? currentMax : ''}
        step={step}
        onChange={(e) =>
          onChange({
            min: currentMin,
            max: e.target.value === '' ? undefined : Number(e.target.value),
          })
        }
        style={{ ...inputStyle, width: 70 }}
      />
    </div>
  );
}

// ── 4. ButtonGroupFilter Component ──

function ButtonGroupFilter({
  filter,
  selected,
  onChange,
}: {
  filter: AppFilterControl;
  selected: string;
  onChange: (value: string) => void;
}) {
  const options = ['All', ...(filter.options || [])];

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, background: 'var(--surface-3, #e5e7eb)', padding: 2, borderRadius: 6 }}>
      {options.map((opt) => {
        const isAll = opt === 'All';
        const isActive = isAll ? !selected || selected === '' : selected === opt;

        return (
          <button
            key={opt}
            onClick={() => onChange(isAll ? '' : opt)}
            style={{
              padding: '2px 8px',
              fontSize: 11,
              fontWeight: 500,
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              background: isActive ? '#1a73e8' : 'transparent',
              color: isActive ? '#fff' : 'var(--text)',
              transition: 'background 0.1s, color 0.1s',
            }}
          >
            {opt}
          </button>
        );
      })}
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

const actionTinyBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-dim)',
  padding: 2,
  display: 'flex',
  alignItems: 'center',
  borderRadius: 4,
};

const menuItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '6px 12px',
  border: 'none',
  background: 'none',
  fontSize: 12,
  color: 'var(--text)',
  cursor: 'pointer',
  textAlign: 'left',
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
