'use client';

import type { DataManagementConfirmResult } from '@/lib/types';

interface Props {
  result: DataManagementConfirmResult;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export function ConfirmationCard({ result, onConfirm, onCancel }: Props) {
  const { operation, affectedRowCount, affectedGroupCount, exampleGroup, tiebreakerColumn } = result;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Operation summary */}
      <div style={{
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <Stat label="Operation" value={operation} />
        <Stat label="Rows affected" value={affectedRowCount?.toLocaleString() ?? '—'} />
        {affectedGroupCount !== undefined && (
          <Stat label="Duplicate groups" value={affectedGroupCount.toLocaleString()} />
        )}
        {tiebreakerColumn && (
          <Stat label="Keep" value={`most recent by ${tiebreakerColumn}`} />
        )}
      </div>

      {/* Example group (DEDUPE) */}
      {exampleGroup && (
        <div style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '8px 12px',
            fontSize: 11,
            color: 'var(--text-muted)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            Example group — key {JSON.stringify(exampleGroup.keyValue)}
            <span style={{ marginLeft: 'auto', color: 'var(--text-dim)' }}>and {(affectedGroupCount ?? 1) - 1} more like this</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: 'var(--surface)' }}>
                <th style={{ padding: '6px 12px', textAlign: 'left', color: 'var(--text-dim)', width: 60 }}>Action</th>
                {Object.keys(exampleGroup.keepRow).map((col) => (
                  <th key={col} style={{ padding: '6px 12px', textAlign: 'left', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Keep row */}
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(34,197,94,0.04)' }}>
                <td style={{ padding: '6px 12px' }}>
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--positive)', border: '1px solid var(--positive)', borderRadius: 3, padding: '1px 5px' }}>KEEP</span>
                </td>
                {Object.values(exampleGroup.keepRow).map((val, i) => (
                  <td key={i} style={{ padding: '6px 12px', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                    {String(val ?? 'null')}
                  </td>
                ))}
              </tr>
              {/* Remove rows */}
              {exampleGroup.removeRows.map((row, ri) => (
                <tr key={ri} style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(239,68,68,0.04)' }}>
                  <td style={{ padding: '6px 12px' }}>
                    <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--issue)', border: '1px solid var(--issue)', borderRadius: 3, padding: '1px 5px' }}>REMOVE</span>
                  </td>
                  {Object.values(row).map((val, i) => (
                    <td key={i} style={{ padding: '6px 12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {String(val ?? 'null')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Cost estimate if present */}
      {result.costEstimate && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Estimated scan: {formatBytes(result.costEstimate.totalBytesProcessed)} (Tier {result.costEstimate.tier})
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onConfirm}
          style={{
            padding: '9px 20px',
            background: 'var(--issue)',
            border: 'none',
            borderRadius: 8,
            color: 'white',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          Confirm — {operation === 'DEDUPE' ? `Remove ${affectedRowCount} rows` : `Run ${operation}`}
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '9px 20px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--text-muted)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{value}</span>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(0)} MB`;
  return `${bytes} bytes`;
}
