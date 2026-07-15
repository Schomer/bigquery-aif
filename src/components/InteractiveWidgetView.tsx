'use client';

// InteractiveWidgetView.tsx
// Renders an INTERACTIVE_WIDGET: filter controls (DATE_RANGE, DROPDOWN, MULTI_SELECT)
// + chart/table switcher. Filters apply immediately on change.

import { useState, useCallback, useRef, useEffect } from 'react';
import type { CustomViewProps, InteractiveWidgetData, VisualizationType } from '@/lib/types';
import { executeQuery } from '@/lib/bigquery-client';
import { ChartView } from './ChartView';
import { DataTable } from './DataTable';

type ViewMode = 'chart' | 'table';

// ─── Multi-select dropdown ────────────────────────────────────────────────────

const SEARCH_THRESHOLD = 8; // show search when there are more than this many options

// English pluralization for chart titles ("3 entities", "5 countries", etc.)
function pluralize(word: string): string {
  if (word.endsWith('y') && !/[aeiou]y$/.test(word)) {
    return word.slice(0, -1) + 'ies'; // entity→entities, country→countries
  }
  if (word.endsWith('s') || word.endsWith('sh') || word.endsWith('ch') || word.endsWith('x') || word.endsWith('z')) {
    return word + 'es'; // class→classes
  }
  return word + 's'; // region→regions
}


function MultiSelectDropdown({
  id,
  label,
  options,
  selected,
  onChange,
}: {
  id: string;
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
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

  const visible = search
    ? options.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  const toggle = (opt: string) => {
    const next = selected.includes(opt)
      ? selected.filter((s) => s !== opt)
      : [...selected, opt];
    onChange(next);
  };

  const removeChip = (val: string) => onChange(selected.filter((s) => s !== val));

  return (
    <>
      {/* Dropdown trigger — compact when items selected, labeled when empty */}
      <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
        <button
          id={id}
          onClick={() => setOpen((v) => !v)}
          aria-label={`${label} filter`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: selected.length > 0 ? 2 : 6,
            fontSize: 12,
            fontFamily: 'inherit',
            padding: selected.length > 0 ? '5px 8px' : '5px 10px',
            border: '1px solid var(--border, #e8edf5)',
            borderRadius: 7,
            background: '#fff',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          {selected.length === 0 && <span>All</span>}
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ opacity: 0.45 }}>
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Panel — search + checkboxes only */}
        {open && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 100,
            background: '#fff',
            border: '1px solid var(--border, #e8edf5)',
            borderRadius: 10,
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            minWidth: 220,
            maxWidth: 320,
          }}>
            {/* Search — shown when there are more than SEARCH_THRESHOLD options */}
            {options.length > SEARCH_THRESHOLD && (
              <div style={{ padding: '8px 10px 6px' }}>
                <input
                  autoFocus
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: '100%', fontSize: 12, fontFamily: 'inherit',
                    padding: '5px 8px', border: '1px solid var(--border, #e8edf5)',
                    borderRadius: 6, outline: 'none',
                    background: 'var(--surface-2, #f8f9fc)', color: 'var(--text)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            {/* Option list */}
            <div style={{ maxHeight: 260, overflowY: 'auto', padding: '4px 0' }}>
              {visible.length === 0 ? (
                <p style={{ margin: 0, padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                  No matches
                </p>
              ) : visible.map((opt) => {
                const checked = selected.includes(opt);
                return (
                  <label
                    key={opt}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '5px 12px', fontSize: 12, color: 'var(--text)',
                      cursor: 'pointer',
                      background: checked ? 'var(--accent-subtle, #eff6ff)' : 'transparent',
                      transition: 'background 0.1s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(opt)}
                      style={{ width: 13, height: 13, cursor: 'pointer', accentColor: 'var(--accent, #4f7fff)' }}
                    />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {opt}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Selected value chips — one per selected value, each with its own × */}
      {selected.map((val) => (
        <span
          key={val}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 12, padding: '3px 6px 3px 9px',
            background: 'var(--surface-3, #e2e8f0)',
            border: '1px solid var(--border, #e8edf5)',
            borderRadius: 5,
            color: 'var(--text-muted, #64748b)',
            whiteSpace: 'nowrap',
            maxWidth: 160,
            overflow: 'hidden',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{val}</span>
          <button
            onClick={() => removeChip(val)}
            title={`Remove ${val}`}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 14, height: 14, padding: 0, border: 'none', borderRadius: '50%',
              background: 'transparent', color: 'var(--text-muted, #94a3b8)',
              cursor: 'pointer', fontSize: 11, fontWeight: 700, flexShrink: 0,
              lineHeight: 1,
            }}
          >
            &#x2715;
          </button>
        </span>
      ))}
    </>
  );
}

// ─── Main widget view ─────────────────────────────────────────────────────────

export function InteractiveWidgetView({ envelope, onSendMessage, onSave, onPin, isPinned }: CustomViewProps) {
  const widgetData = envelope.primaryArtifact.data as InteractiveWidgetData;

  const [startDate, setStartDate] = useState<string>(widgetData.defaultStart ?? '');
  const [endDate, setEndDate] = useState<string>(widgetData.defaultEnd ?? '');

  const [dropdownValues, setDropdownValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const ctrl of widgetData.controls) {
      if (ctrl.type === 'DROPDOWN') initial[ctrl.param] = ctrl.defaultValue ?? '';
    }
    return initial;
  });

  const [multiSelectValues, setMultiSelectValues] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    for (const ctrl of widgetData.controls) {
      if (ctrl.type === 'MULTI_SELECT') initial[ctrl.param] = ctrl.defaultValues ?? [];
    }
    return initial;
  });

  const [viewMode, setViewMode] = useState<ViewMode>('chart');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentResult, setCurrentResult] = useState<{
    columns: string[];
    columnTypes?: string[];
    rows: unknown[][];
    rowCount: number;
  }>(widgetData.initialResult);

  const isChartable = !['TABLE', 'KPI_CARD', 'STAT_ROW', 'INTERACTIVE_WIDGET'].includes(widgetData.visualization);

  const runQuery = useCallback(async (opts: {
    startDate: string;
    endDate: string;
    dropdownValues: Record<string, string>;
    multiSelectValues: Record<string, string[]>;
  }) => {
    setError(null);

    const hasDateRange = opts.startDate.length > 0 || opts.endDate.length > 0;
    const hasDropdown = Object.values(opts.dropdownValues).some((v) => v.length > 0);
    const hasMultiSelect = Object.values(opts.multiSelectValues).some((v) => v.length > 0);
    const hasAnyFilter = hasDateRange || hasDropdown || hasMultiSelect;

    let sqlToRun = hasAnyFilter ? widgetData.parameterizedSql : widgetData.baseSql;

    // DATE_RANGE substitution
    if (hasDateRange) {
      sqlToRun = sqlToRun
        .replace(/\{\{start_date\}\}/g, opts.startDate || '1900-01-01')
        .replace(/\{\{end_date\}\}/g, opts.endDate || '2100-12-31');
    }

    // DROPDOWN substitution — handles quoted/unquoted placeholder
    for (const [param, value] of Object.entries(opts.dropdownValues)) {
      if (value) {
        const safe = value.replace(/'/g, "''");
        const quotedLiteral = `'${safe}'`;
        const escapedParam = param.replace(/[{}]/g, '\\$&');
        const quotedPlaceholder = new RegExp(`'${escapedParam}'`, 'g');
        if (quotedPlaceholder.test(sqlToRun)) {
          sqlToRun = sqlToRun.replace(quotedPlaceholder, quotedLiteral);
        } else {
          sqlToRun = sqlToRun.replace(new RegExp(escapedParam, 'g'), quotedLiteral);
        }
      }
    }

    // MULTI_SELECT substitution — replaces {{param}} with 'val1', 'val2', 'val3'
    for (const [param, values] of Object.entries(opts.multiSelectValues)) {
      if (values.length > 0) {
        const inList = values.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ');
        const escapedParam = param.replace(/[{}]/g, '\\$&');
        sqlToRun = sqlToRun.replace(new RegExp(escapedParam, 'g'), inList);
      }
    }

    setIsLoading(true);
    try {
      const result = await executeQuery(sqlToRun, widgetData.project);
      setCurrentResult({
        columns: result.columns,
        columnTypes: result.columnTypes,
        rows: result.rows,
        rowCount: result.rowCount,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query failed');
    } finally {
      setIsLoading(false);
    }
  }, [widgetData]);

  const handleDropdownChange = useCallback((param: string, value: string) => {
    const next = { ...dropdownValues, [param]: value };
    setDropdownValues(next);
    runQuery({ startDate, endDate, dropdownValues: next, multiSelectValues });
  }, [dropdownValues, startDate, endDate, multiSelectValues, runQuery]);

  const handleMultiSelectChange = useCallback((param: string, values: string[]) => {
    const next = { ...multiSelectValues, [param]: values };
    setMultiSelectValues(next);
    runQuery({ startDate, endDate, dropdownValues, multiSelectValues: next });
  }, [multiSelectValues, startDate, endDate, dropdownValues, runQuery]);

  const handleStartDateChange = useCallback((value: string) => {
    setStartDate(value);
    runQuery({ startDate: value, endDate, dropdownValues, multiSelectValues });
  }, [endDate, dropdownValues, multiSelectValues, runQuery]);

  const handleEndDateChange = useCallback((value: string) => {
    setEndDate(value);
    runQuery({ startDate, endDate: value, dropdownValues, multiSelectValues });
  }, [startDate, dropdownValues, multiSelectValues, runQuery]);

  const handleClear = useCallback(() => {
    const clearedDropdown: Record<string, string> = {};
    for (const k of Object.keys(dropdownValues)) clearedDropdown[k] = '';
    const clearedMulti: Record<string, string[]> = {};
    for (const k of Object.keys(multiSelectValues)) clearedMulti[k] = [];
    setStartDate('');
    setEndDate('');
    setDropdownValues(clearedDropdown);
    setMultiSelectValues(clearedMulti);
    runQuery({ startDate: '', endDate: '', dropdownValues: clearedDropdown, multiSelectValues: clearedMulti });
  }, [dropdownValues, multiSelectValues, runQuery]);

  const hasAnyFilter =
    startDate.length > 0 ||
    endDate.length > 0 ||
    Object.values(dropdownValues).some((v) => v.length > 0) ||
    Object.values(multiSelectValues).some((v) => v.length > 0);

  // Dynamic title — uses LLM chartTitle as the base, appends filter context
  const chartTitle = (() => {
    const base = widgetData.chartTitle
      || (typeof envelope.headline.text === 'string' ? envelope.headline.text : '');
    const parts: string[] = [];
    for (const ctrl of widgetData.controls) {
      if (ctrl.type === 'DROPDOWN') {
        const val = dropdownValues[ctrl.param];
        if (val) parts.push(val);
      } else if (ctrl.type === 'MULTI_SELECT') {
        const vals = multiSelectValues[ctrl.param] ?? [];
        if (vals.length === 1) parts.push(vals[0]);
        else if (vals.length > 1) parts.push(`${vals.length} ${pluralize(ctrl.label.toLowerCase())}`);
      } else if (ctrl.type === 'DATE_RANGE') {
        if (startDate && endDate) parts.push(`${fmtDate(startDate)}\u2013${fmtDate(endDate)}`);
        else if (startDate) parts.push(`from ${fmtDate(startDate)}`);
        else if (endDate) parts.push(`until ${fmtDate(endDate)}`);
      }
    }
    return parts.length > 0 ? `${base} \u2014 ${parts.join(', ')}` : base;
  })();

  const queryResult = {
    skill: 'query' as const,
    sql: widgetData.baseSql,
    requiresConfirmation: false,
    costConfirm: null,
    columns: currentResult.columns,
    columnTypes: currentResult.columnTypes,
    rows: currentResult.rows,
    rowCount: currentResult.rowCount,
    totalBytesProcessed: 0,
    costTier: 0 as const,
    suggestedVisualization: widgetData.visualization,
    xAxis: widgetData.xAxis ?? null,
    yAxis: widgetData.yAxis ?? null,
    notableFindings: null,
    resultSummary: null,
  };

  const chartType = widgetData.visualization as Exclude<VisualizationType, 'TABLE' | 'KPI_CARD' | 'STAT_ROW' | 'INTERACTIVE_WIDGET'>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Control bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'nowrap',
        padding: '10px 14px',
        overflow: 'hidden',
      }}>
        {widgetData.controls.map((ctrl, i) => {
          if (ctrl.type === 'DATE_RANGE') {
            return (
              <div key={i} style={{ display: 'contents' }}>
                <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {ctrl.label}
                </span>
                <input
                  id="widget-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  style={dateInputStyle}
                  aria-label="Start date"
                  max={endDate || undefined}
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>to</span>
                <input
                  id="widget-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  style={dateInputStyle}
                  aria-label="End date"
                  min={startDate || undefined}
                />
              </div>
            );
          }

          if (ctrl.type === 'DROPDOWN') {
            return (
              <div key={i} style={{ display: 'contents' }}>
                <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {ctrl.label}
                </span>
                <select
                  id={`widget-dropdown-${i}`}
                  value={dropdownValues[ctrl.param] ?? ''}
                  onChange={(e) => handleDropdownChange(ctrl.param, e.target.value)}
                  style={selectStyle}
                  aria-label={ctrl.label}
                >
                  <option value="">All</option>
                  {ctrl.options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            );
          }

          if (ctrl.type === 'MULTI_SELECT') {
            return (
              <div key={i} style={{ display: 'contents' }}>
                <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {ctrl.label}
                </span>
                <MultiSelectDropdown
                  id={`widget-multiselect-${i}`}
                  label={ctrl.label}
                  options={ctrl.options}
                  selected={multiSelectValues[ctrl.param] ?? []}
                  onChange={(values) => handleMultiSelectChange(ctrl.param, values)}
                />
              </div>
            );
          }

          return null;
        })}

        {/* Round X clear button */}
        {hasAnyFilter && (
          <button onClick={handleClear} style={clearBtnStyle} aria-label="Clear filters" title="Clear filters">
            &#x2715;
          </button>
        )}

        {/* Spinner */}
        {isLoading && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
            <span className="widget-spinner" />
            Running...
          </span>
        )}

        {/* Row count + action buttons */}
        <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 'auto', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {currentResult.rowCount.toLocaleString()} row{currentResult.rowCount !== 1 ? 's' : ''}
        </span>
        {onSave && (
          <button
            onClick={() => onSave(envelope)}
            title="Save"
            aria-label="Save"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26, padding: 0, border: 'none',
              background: 'transparent', cursor: 'pointer', borderRadius: 6,
              flexShrink: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-3, #eff0f3)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <img src="/icons/save.svg" alt="Save" width={16} height={16} style={{ opacity: 0.65 }} />
          </button>
        )}
        {onPin && (
          <button
            onClick={() => onPin(envelope)}
            title={isPinned ? 'Using as context' : 'Use as context'}
            aria-label={isPinned ? 'Using as context' : 'Use as context'}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26, padding: 0, border: 'none',
              background: isPinned ? 'var(--accent-subtle, #eff6ff)' : 'transparent',
              cursor: 'pointer', borderRadius: 6, flexShrink: 0,
            }}
            onMouseEnter={(e) => { if (!isPinned) e.currentTarget.style.background = 'var(--surface-3, #eff0f3)'; }}
            onMouseLeave={(e) => { if (!isPinned) e.currentTarget.style.background = 'transparent'; }}
          >
            <img src="/icons/add_to_context.svg" alt="Add to context" width={16} height={16} style={{ opacity: isPinned ? 1 : 0.65 }} />
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '8px 12px', background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#b91c1c' }}>
          {error}
        </div>
      )}

      {/* Dynamic chart title */}
      {chartTitle && (
        <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: '#334155', lineHeight: 1.5 }}>
          {chartTitle}
        </p>
      )}

      {/* Chart / Table switcher */}
      {isChartable && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 20, padding: 2, gap: 2 }}>
            {(['chart', 'table'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                style={{
                  padding: '3px 12px',
                  borderRadius: 16,
                  fontSize: 11,
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s',
                  background: viewMode === v ? 'var(--accent, #4f7fff)' : 'transparent',
                  color: viewMode === v ? '#fff' : 'var(--text-muted)',
                }}
              >
                {v === 'chart' ? '\u25B2 Chart' : '\u229E Table'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      {isChartable && viewMode === 'chart' ? (
        <ChartView result={queryResult} chartType={chartType} onSendMessage={onSendMessage ?? (() => {})} />
      ) : (
        <div style={{ maxHeight: 420, overflowY: 'auto', borderRadius: 8, border: '1px solid var(--border, #e8edf5)' }}>
          <DataTable result={queryResult} onSendMessage={onSendMessage ?? (() => {})} />
        </div>
      )}

      <style>{`
        .widget-spinner {
          display: inline-block;
          width: 10px; height: 10px;
          border: 1.5px solid var(--border, #e8edf5);
          border-top-color: var(--accent, #4f7fff);
          border-radius: 50%;
          animation: widget-spin 0.6s linear infinite;
          vertical-align: middle;
        }
        @keyframes widget-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const dateInputStyle: React.CSSProperties = {
  fontSize: 12, fontFamily: 'inherit', padding: '5px 8px',
  border: '1px solid var(--border, #e8edf5)', borderRadius: 7,
  background: '#fff', color: 'var(--text-muted)', outline: 'none', cursor: 'pointer',
  fontWeight: 400,
};

const selectStyle: React.CSSProperties = {
  fontSize: 12, fontFamily: 'inherit', padding: '5px 32px 5px 8px',
  border: '1px solid var(--border, #e8edf5)', borderRadius: 7,
  background: '#fff', color: 'var(--text-muted)', outline: 'none',
  cursor: 'pointer', appearance: 'auto', maxWidth: 220, fontWeight: 400,
};

const clearBtnStyle: React.CSSProperties = {
  width: 20, height: 20, borderRadius: '50%',
  background: '#e2e8f0',
  border: 'none', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  color: '#94a3b8', fontSize: 11, fontWeight: 700, lineHeight: 1,
  padding: 0, flexShrink: 0, transition: 'background 0.15s',
};

const quickActionStyle: React.CSSProperties = {
  fontSize: 11, fontFamily: 'inherit', padding: '2px 8px',
  border: '1px solid var(--border, #e8edf5)', borderRadius: 5,
  background: 'transparent', color: 'var(--text-muted)',
  cursor: 'pointer', transition: 'background 0.1s',
};

// ─── Date helper ──────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const m = months[parseInt(month, 10) - 1] ?? month;
  return `${m} ${parseInt(day, 10)}, ${year}`;
}
