'use client';

// InteractiveWidgetView.tsx
// Renders an INTERACTIVE_WIDGET envelope: filter controls + chart/table switcher.
// Supports DATE_RANGE and DROPDOWN controls. Filters apply immediately on change.

import { useState, useCallback } from 'react';
import type { CustomViewProps, InteractiveWidgetData, VisualizationType } from '@/lib/types';
import { executeQuery } from '@/lib/bigquery-client';
import { ChartView } from './ChartView';
import { DataTable } from './DataTable';

type ViewMode = 'chart' | 'table';

export function InteractiveWidgetView({ envelope, onSendMessage }: CustomViewProps) {
  const widgetData = envelope.primaryArtifact.data as InteractiveWidgetData;

  const [startDate, setStartDate] = useState<string>(widgetData.defaultStart ?? '');
  const [endDate, setEndDate] = useState<string>(widgetData.defaultEnd ?? '');

  const [dropdownValues, setDropdownValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const ctrl of widgetData.controls) {
      if (ctrl.type === 'DROPDOWN') {
        initial[ctrl.param] = ctrl.defaultValue ?? '';
      }
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

  // Core query runner — takes explicit values so it works correctly in onChange
  // handlers before React state has flushed.
  const runQuery = useCallback(async (opts: {
    startDate: string;
    endDate: string;
    dropdownValues: Record<string, string>;
  }) => {
    setError(null);

    const hasDateRange = opts.startDate.length > 0 || opts.endDate.length > 0;
    const hasDropdown = Object.values(opts.dropdownValues).some((v) => v.length > 0);
    const hasAnyFilter = hasDateRange || hasDropdown;

    let sqlToRun = hasAnyFilter ? widgetData.parameterizedSql : widgetData.baseSql;

    if (hasDateRange) {
      sqlToRun = sqlToRun
        .replace(/\{\{start_date\}\}/g, opts.startDate || '1900-01-01')
        .replace(/\{\{end_date\}\}/g, opts.endDate || '2100-12-31');
    }

    for (const [param, value] of Object.entries(opts.dropdownValues)) {
      if (value) {
        const safe = value.replace(/'/g, "\\'");
        sqlToRun = sqlToRun.replace(new RegExp(param.replace(/[{}]/g, '\\$&'), 'g'), safe);
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
    runQuery({ startDate, endDate, dropdownValues: next });
  }, [dropdownValues, startDate, endDate, runQuery]);

  const handleStartDateChange = useCallback((value: string) => {
    setStartDate(value);
    runQuery({ startDate: value, endDate, dropdownValues });
  }, [endDate, dropdownValues, runQuery]);

  const handleEndDateChange = useCallback((value: string) => {
    setEndDate(value);
    runQuery({ startDate, endDate: value, dropdownValues });
  }, [startDate, dropdownValues, runQuery]);

  const handleClear = useCallback(() => {
    const cleared: Record<string, string> = {};
    for (const k of Object.keys(dropdownValues)) cleared[k] = '';
    setStartDate('');
    setEndDate('');
    setDropdownValues(cleared);
    runQuery({ startDate: '', endDate: '', dropdownValues: cleared });
  }, [dropdownValues, runQuery]);

  const hasAnyFilter =
    startDate.length > 0 ||
    endDate.length > 0 ||
    Object.values(dropdownValues).some((v) => v.length > 0);

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

  // Dynamic title: use LLM-provided chartTitle as the base, fall back to headline.
  // Filter selections are appended client-side so the title updates live.
  const chartTitle = (() => {
    const base = widgetData.chartTitle
      || (typeof envelope.headline.text === 'string' ? envelope.headline.text : '');
    const parts: string[] = [];

    for (const ctrl of widgetData.controls) {
      if (ctrl.type === 'DROPDOWN') {
        const val = dropdownValues[ctrl.param];
        if (val) parts.push(val);
      } else if (ctrl.type === 'DATE_RANGE') {
        if (startDate && endDate) {
          parts.push(`${fmtDate(startDate)}\u2013${fmtDate(endDate)}`);
        } else if (startDate) {
          parts.push(`from ${fmtDate(startDate)}`);
        } else if (endDate) {
          parts.push(`until ${fmtDate(endDate)}`);
        }
      }
    }

    return parts.length > 0 ? `${base} \u2014 ${parts.join(', ')}` : base;
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Control bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
        padding: '10px 14px',
        background: 'var(--surface-2, #f8f9fc)',
        border: '1px solid var(--border, #e8edf5)',
        borderRadius: 10,
      }}>
        {widgetData.controls.map((ctrl, i) => {
          if (ctrl.type === 'DATE_RANGE') {
            return (
              <div key={i} style={{ display: 'contents' }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
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
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
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

          return null;
        })}

        {/* Round X clear button */}
        {hasAnyFilter && (
          <button
            onClick={handleClear}
            style={clearBtnStyle}
            aria-label="Clear filters"
            title="Clear filters"
          >
            {/* × character, visually centered */}
            &#x2715;
          </button>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
            <span className="widget-spinner" />
            Running...
          </span>
        )}

        {/* Row count */}
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {currentResult.rowCount.toLocaleString()} row{currentResult.rowCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Inline error */}
      {error && (
        <div style={{
          padding: '8px 12px',
          background: '#fff5f5',
          border: '1px solid #fecaca',
          borderRadius: 8,
          fontSize: 12,
          color: '#b91c1c',
        }}>
          {error}
        </div>
      )}

      {/* Dynamic chart title */}
      {chartTitle && (
        <p style={{
          margin: 0,
          fontSize: 15,
          fontWeight: 500,
          color: '#334155',
          lineHeight: 1.5,
        }}>
          {chartTitle}
        </p>
      )}

      {/* Chart / Table switcher */}

      {isChartable && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{
            display: 'inline-flex',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: 2,
            gap: 2,
          }}>
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
          width: 10px;
          height: 10px;
          border: 1.5px solid var(--border, #e8edf5);
          border-top-color: var(--accent, #4f7fff);
          border-radius: 50%;
          animation: widget-spin 0.6s linear infinite;
          vertical-align: middle;
        }
        @keyframes widget-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const dateInputStyle: React.CSSProperties = {
  fontSize: 12,
  fontFamily: 'inherit',
  padding: '5px 8px',
  border: '1px solid var(--border, #e8edf5)',
  borderRadius: 7,
  background: '#fff',
  color: 'var(--text)',
  outline: 'none',
  cursor: 'pointer',
};

const selectStyle: React.CSSProperties = {
  fontSize: 12,
  fontFamily: 'inherit',
  padding: '5px 32px 5px 8px',
  border: '1px solid var(--border, #e8edf5)',
  borderRadius: 7,
  background: '#fff',
  color: 'var(--text)',
  outline: 'none',
  cursor: 'pointer',
  appearance: 'auto',
  maxWidth: 220,
};

// Round X clear button
const clearBtnStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: '50%',
  background: '#bfdbfe',
  border: 'none',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#1d4ed8',
  fontSize: 11,
  fontWeight: 700,
  lineHeight: 1,
  padding: 0,
  flexShrink: 0,
  transition: 'background 0.15s',
};
// Date formatting helper: 'Jan 15, 2024'
function fmtDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const m = months[parseInt(month, 10) - 1] ?? month;
  return `${m} ${parseInt(day, 10)}, ${year}`;
}
