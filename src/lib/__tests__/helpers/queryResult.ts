import type { QueryResult, VisualizationType } from '../../types';

export function makeResult(opts: {
  columns: string[];
  rows: unknown[][];
  columnTypes?: string[];
  sql?: string;
  suggestedVisualization?: string;
}): QueryResult {
  return {
    skill: 'query',
    sql: opts.sql || 'SELECT 1',
    requiresConfirmation: false,
    columns: opts.columns,
    columnTypes: opts.columnTypes,
    rows: opts.rows,
    rowCount: opts.rows.length,
    totalBytesProcessed: 0,
    costTier: 0 as const,
    suggestedVisualization: (opts.suggestedVisualization || 'TABLE') as VisualizationType,
  };
}

export function timeSeries(n: number, seriesCount = 1) {
  const columns = ['date'];
  const columnTypes = ['DATE'];
  for (let i = 0; i < seriesCount; i++) {
    columns.push(`value${i + 1}`);
    columnTypes.push('FLOAT64');
  }

  const rows = Array.from({ length: n }, (_, i) => {
    const row: unknown[] = [`2024-01-0${(i + 1).toString().padStart(2, '0')}`];
    for (let j = 0; j < seriesCount; j++) {
      row.push(Math.random() * 100);
    }
    return row;
  });

  return makeResult({ columns, columnTypes, rows });
}

export function categorical(n: number, opts?: { sql?: string; columnName?: string; columnTypes?: string[] }) {
  const columns = ['category', opts?.columnName || 'value'];
  const columnTypes = opts?.columnTypes || ['STRING', 'FLOAT64'];
  const rows = Array.from({ length: n }, (_, i) => [`Cat ${i}`, Math.random() * 100]);
  return makeResult({ columns, columnTypes, rows, sql: opts?.sql });
}

export function singleValue(value: unknown = 42) {
  return makeResult({
    columns: ['total'],
    columnTypes: ['FLOAT64'],
    rows: [[value]],
  });
}
