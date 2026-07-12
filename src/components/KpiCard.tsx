'use client';

import type { QueryResult } from '@/lib/types';
import { formatDisplayValue } from '@/lib/format-value';

interface Props { result: QueryResult; }

export function KpiCard({ result }: Props) {
  const { columns, rows } = result;

  // W2-03: Detect delta scenarios:
  // A) Single row, 2 numeric cols → cols[0] = current, cols[1] = previous period
  // B) Two rows, 1 numeric col → rows[0] = current, rows[1] = previous period
  let primaryValue: unknown = null;
  let primaryLabel = columns[0] ?? 'Value';
  let previousValue: unknown = null;
  let previousLabel: string | null = null;

  const isNumeric = (v: unknown) => v !== null && v !== undefined && !isNaN(Number(v));

  if (rows.length === 1 && columns.length >= 2) {
    // Scenario A: columns = [current_value, prev_value] or [metric_name, current, prev]
    const v0 = (rows[0] as unknown[])[0];
    const v1 = (rows[0] as unknown[])[1];
    if (isNumeric(v0) && isNumeric(v1)) {
      primaryValue = v0;
      previousValue = v1;
      previousLabel = columns[1];
    } else if (!isNumeric(v0) && isNumeric(v1) && columns.length >= 3) {
      // col[0] is a label, col[1] = current, col[2] = prev
      primaryLabel = String(v0);
      primaryValue = v1;
      previousValue = (rows[0] as unknown[])[2];
      previousLabel = columns[2];
    } else {
      primaryValue = v0;
    }
  } else if (rows.length === 2 && columns.length === 1) {
    // Scenario B: two period rows
    primaryValue = (rows[0] as unknown[])[0];
    previousValue = (rows[1] as unknown[])[0];
    previousLabel = 'previous period';
  } else {
    primaryValue = (rows[0] as unknown[])?.[0] ?? null;
  }

  // Delta calculation
  let delta: number | null = null;
  if (isNumeric(primaryValue) && isNumeric(previousValue) && Number(previousValue) !== 0) {
    delta = ((Number(primaryValue) - Number(previousValue)) / Math.abs(Number(previousValue))) * 100;
  }

  const isPositive = delta !== null && delta > 0;
  const isNegative = delta !== null && delta < 0;
  const deltaColor = isPositive ? '#10b981' : isNegative ? '#ef4444' : 'var(--text-muted)';
  const deltaArrow = isPositive ? 'arrow_upward' : isNegative ? 'arrow_downward' : 'remove';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '24px 16px',
      gap: 8,
    }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
        {primaryLabel.replace(/_/g, ' ')}
      </span>
      <span style={{
        fontSize: 48,
        fontWeight: 700,
        color: 'var(--text)',
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1,
      }}>
        {primaryValue === undefined || primaryValue === null ? '--' : formatDisplayValue(primaryValue, primaryLabel)}
      </span>
      {/* W2-03: Delta badge */}
      {delta !== null && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          padding: '3px 8px',
          borderRadius: 20,
          background: `${deltaColor}18`,
          color: deltaColor,
          fontSize: 13,
          fontWeight: 600,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{deltaArrow}</span>
          {Math.abs(delta).toFixed(1)}%
          {previousLabel && (
            <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 400, marginLeft: 2 }}>
              vs {previousLabel.replace(/_/g, ' ')}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
