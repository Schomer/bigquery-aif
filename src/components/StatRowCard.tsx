'use client';

// W2-02: StatRowCard — renders 2-5 rows with 1 categorical + 1-2 numeric columns
// as a grid of metric cards instead of a table or bar chart.

import type { QueryResult } from '@/lib/types';
import { formatDisplayValue } from '@/lib/format-value';

interface Props { result: QueryResult; }

export function StatRowCard({ result }: Props) {
  const { columns, rows } = result;
  if (!rows.length || !columns.length) return null;

  // Find categorical and numeric column indices
  const numericRe = /^[\d.,-]+$/;
  const catIdx = columns.findIndex((_, ci) => {
    const samples = rows.slice(0, 3).map(r => String((r as unknown[])[ci] ?? ''));
    return !samples.every(s => numericRe.test(s.trim()));
  });

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${Math.min(rows.length, 4)}, 1fr)`,
      gap: 12,
      padding: '8px 0',
    }}>
      {rows.map((row, ri) => {
        const r = row as unknown[];
        const label = catIdx >= 0 ? String(r[catIdx] ?? '') : `Row ${ri + 1}`;
        const numericVals = columns
          .map((col, ci) => ({ col, val: r[ci], ci }))
          .filter(({ ci }) => ci !== catIdx);

        return (
          <div
            key={ri}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '16px 12px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              gap: 6,
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' }}>
              {label.replace(/_/g, ' ')}
            </span>
            {numericVals.map(({ col, val }) => (
              <span
                key={col}
                style={{
                  fontSize: numericVals.length > 1 ? 22 : 32,
                  fontWeight: 700,
                  color: 'var(--text)',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1.1,
                  textAlign: 'center',
                }}
              >
                {val === null || val === undefined ? '--' : formatDisplayValue(val, col)}
              </span>
            ))}
            {numericVals.length > 1 && numericVals.map(({ col }) => (
              <span key={`lbl-${col}`} style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: -4 }}>
                {col.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}
