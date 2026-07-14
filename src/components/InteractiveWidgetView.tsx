'use client';

// InteractiveWidgetView.tsx
// Renders an INTERACTIVE_WIDGET envelope: date range pickers + chart/table switcher.
// The re-query on Apply is a direct BigQuery REST call, no chat API round-trip.

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
  const [viewMode, setViewMode] = useState<ViewMode>('chart');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentResult, setCurrentResult] = useState<{
    columns: string[];
    columnTypes?: string[];
    rows: unknown[][];
    rowCount: number;
  }>(widgetData.initialResult);

  const handleApply = useCallback(async () => {
    setError(null);

    // If no dates selected, revert to base SQL (all data)
    const hasDateRange = startDate.length > 0 || endDate.length > 0;
    const sqlToRun = hasDateRange
      ? widgetData.parameterizedSql
          .replace(/\{\{start_date\}\}/g, startDate || '1900-01-01')
          .replace(/\{\{end_date\}\}/g, endDate || '2100-12-31')
      : widgetData.baseSql;

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
  }, [startDate, endDate, widgetData]);

  // Build a QueryResult-shaped object for ChartView / DataTable
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

  const isChartable = !['TABLE', 'KPI_CARD', 'STAT_ROW', 'INTERACTIVE_WIDGET'].includes(widgetData.visualization);
  const chartType = widgetData.visualization as Exclude<VisualizationType, 'TABLE' | 'KPI_CARD' | 'STAT_ROW' | 'INTERACTIVE_WIDGET'>;

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
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          Date range
        </span>

        <input
          id="widget-start-date"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          style={dateInputStyle}
          aria-label="Start date"
          max={endDate || undefined}
        />

        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>to</span>

        <input
          id="widget-end-date"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          style={dateInputStyle}
          aria-label="End date"
          min={startDate || undefined}
        />

        {(startDate || endDate) && (
          <button
            onClick={() => { setStartDate(''); setEndDate(''); }}
            style={clearBtnStyle}
            aria-label="Clear date range"
          >
            Clear
          </button>
        )}

        <button
          id="widget-apply-btn"
          onClick={handleApply}
          disabled={isLoading}
          style={{
            ...applyBtnStyle,
            opacity: isLoading ? 0.6 : 1,
            cursor: isLoading ? 'wait' : 'pointer',
          }}
        >
          {isLoading ? (
            <>
              <span className="widget-spinner" />
              Running...
            </>
          ) : 'Apply'}
        </button>

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
        <DataTable result={queryResult} onSendMessage={onSendMessage ?? (() => {})} />
      )}

      {/* Spinner keyframes */}
      <style>{`
        .widget-spinner {
          display: inline-block;
          width: 10px;
          height: 10px;
          border: 1.5px solid rgba(255,255,255,0.4);
          border-top-color: #fff;
          border-radius: 50%;
          animation: widget-spin 0.6s linear infinite;
          margin-right: 6px;
          vertical-align: middle;
        }
        @keyframes widget-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// Shared styles
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

const applyBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '5px 14px',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'inherit',
  background: 'var(--accent, #4f7fff)',
  color: '#fff',
  border: 'none',
  borderRadius: 7,
  transition: 'opacity 0.15s',
};

const clearBtnStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 400,
  fontFamily: 'inherit',
  padding: '4px 10px',
  border: '1px solid var(--border, #e8edf5)',
  borderRadius: 7,
  background: 'transparent',
  color: 'var(--text-muted)',
  cursor: 'pointer',
};
