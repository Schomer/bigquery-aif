'use client';

import type { CostEstimate, DataManagementConfirmResult } from '@/lib/types';
import { formatBytes } from '@/lib/format';

// ---- Cost Confirmation (query / data-quality cost gate) ---------------------

interface CostConfirmProps {
  headline: string;
  costEstimate: CostEstimate;
  onConfirm: () => void;
  onCancel: () => void;
}

export function InlineCostConfirm({ headline, costEstimate, onConfirm, onCancel }: CostConfirmProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 520 }}>
      {/* Headline */}
      <div style={{
        fontSize: 13,
        color: 'var(--text)',
        lineHeight: 1.5,
        fontFamily: "'Google Sans', sans-serif",
      }}>
        {headline}
      </div>

      {/* Warning banner */}
      <div style={{
        padding: '12px 14px',
        background: 'rgba(245,158,11,0.06)',
        border: '1px solid rgba(245,158,11,0.18)',
        borderRadius: 10,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}>
        <span className="material-symbols-outlined" style={{
          fontSize: 18,
          color: '#d97706',
          marginTop: 1,
          fontVariationSettings: `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20`,
        }}>warning</span>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, marginBottom: 3 }}>
            Large query -- {formatBytes(costEstimate.totalBytesProcessed)} will be processed
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
            This is a Tier {costEstimate.tier} query. Confirm to proceed, or refine your request with filters or a date range to reduce cost.
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <ConfirmButtons
        confirmLabel="Run anyway"
        confirmColor="var(--accent)"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    </div>
  );
}

// ---- DML Confirmation (data-management operations) --------------------------

interface DmlConfirmProps {
  headline: string;
  result: DataManagementConfirmResult;
  compact?: boolean;  // simplified version for split-layout sidebar
  onConfirm: () => void;
  onCancel: () => void;
}

export function InlineDmlConfirm({ headline, result, compact, onConfirm, onCancel }: DmlConfirmProps) {
  const { operation, affectedRowCount, affectedGroupCount, tiebreakerColumn, exampleGroup, costEstimate } = result;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: compact ? undefined : 560 }}>
      {/* Headline */}
      <div style={{
        fontSize: 13,
        color: 'var(--text)',
        lineHeight: 1.5,
        fontFamily: "'Google Sans', sans-serif",
      }}>
        {headline}
      </div>

      {/* Operation summary stats */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <Stat label="Operation" value={operation} />
        <Stat label="Rows affected" value={affectedRowCount?.toLocaleString() ?? '--'} />
        {affectedGroupCount !== undefined && (
          <Stat label="Duplicate groups" value={affectedGroupCount.toLocaleString()} />
        )}
        {tiebreakerColumn && (
          <Stat label="Keep" value={`most recent by ${tiebreakerColumn}`} />
        )}
      </div>

      {/* Example group (DEDUPE) -- full detail only */}
      {!compact && exampleGroup && (
        <div style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '7px 12px',
            fontSize: 11,
            color: 'var(--text-muted)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            Example group -- key {JSON.stringify(exampleGroup.keyValue)}
            <span style={{ marginLeft: 'auto', color: 'var(--text-dim)' }}>
              and {(affectedGroupCount ?? 1) - 1} more like this
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
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
        </div>
      )}

      {/* Compact summary for DEDUPE in sidebar */}
      {compact && exampleGroup && (
        <div style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          padding: '8px 10px',
          background: 'var(--surface-2)',
          borderRadius: 6,
          border: '1px solid var(--border-subtle)',
          lineHeight: 1.4,
        }}>
          {affectedGroupCount ?? 0} duplicate groups found.
          {tiebreakerColumn && ` Keeping most recent by ${tiebreakerColumn}.`}
          {' '}Will remove {affectedRowCount?.toLocaleString() ?? 0} rows.
        </div>
      )}

      {/* W2-19: Snapshot offer for destructive ops */}
      {result.snapshotOffer && (
        <div style={{
          background: 'rgba(245,158,11,0.06)',
          border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: 8,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#f59e0b', flexShrink: 0 }}>archive</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>Create a snapshot first?</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>BigQuery snapshots are free for 7 days and let you recover data if needed.</div>
          </div>
          <button
            onClick={() => onConfirm()}
            style={{ fontSize: 11, padding: '4px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer', color: 'var(--accent)', fontWeight: 500 }}
          >
            Skip
          </button>
        </div>
      )}

      {/* Cost estimate if present */}
      {costEstimate && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Estimated scan: {formatBytes(costEstimate.totalBytesProcessed)} (Tier {costEstimate.tier})
        </div>
      )}

      {/* Action buttons */}
      <ConfirmButtons
        confirmLabel={operation === 'DEDUPE' ? `Remove ${affectedRowCount} rows` : `Run ${operation}`}
        confirmColor="var(--issue)"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    </div>
  );
}

// ---- Shared sub-components --------------------------------------------------

function ConfirmButtons({
  confirmLabel,
  confirmColor,
  onConfirm,
  onCancel,
}: {
  confirmLabel: string;
  confirmColor: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button
        onClick={onConfirm}
        style={{
          padding: '7px 16px',
          background: confirmColor,
          border: 'none',
          borderRadius: 8,
          color: 'white',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'opacity 0.15s',
          fontFamily: "'Google Sans', sans-serif",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
      >
        {confirmLabel}
      </button>
      <button
        onClick={onCancel}
        style={{
          padding: '7px 16px',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 8,
          color: 'var(--text-muted)',
          fontSize: 13,
          cursor: 'pointer',
          fontFamily: "'Google Sans', sans-serif",
        }}
      >
        Cancel
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{value}</span>
    </div>
  );
}
