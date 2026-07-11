'use client';

import type { QueryResult } from '@/lib/types';
import { formatDisplayValue } from '@/lib/format-value';

interface Props { result: QueryResult; }

export function KpiCard({ result }: Props) {
  const { columns, rows } = result;
  const value = rows[0]?.[0];
  const label = columns[0] ?? 'Value';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '24px 16px',
      gap: 8,
    }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
        {label.replace(/_/g, ' ')}
      </span>
      <span style={{
        fontSize: 48,
        fontWeight: 700,
        color: 'var(--text)',
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1,
      }}>
        {value === undefined || value === null ? '--' : formatDisplayValue(value, label)}
      </span>
    </div>
  );
}

