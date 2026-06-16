'use client';

import type { CostEstimate } from '@/lib/types';

interface Props {
  result: CostEstimate;
  onConfirm?: () => void;
  onCancel?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_099_511_627_776) return `${(bytes / 1_099_511_627_776).toFixed(1)} TB`;
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  return `${(bytes / 1_048_576).toFixed(0)} MB`;
}

export function CostConfirmCard({ result, onConfirm, onCancel }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        padding: '16px',
        background: 'rgba(245,158,11,0.06)',
        border: '1px solid rgba(245,158,11,0.2)',
        borderRadius: 8,
        display: 'flex',
        gap: 16,
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 24 }}>!</span>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, marginBottom: 4 }}>
            Large query — {formatBytes(result.totalBytesProcessed)} will be processed
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            This is a Tier {result.tier} query. Confirm to proceed, or refine your request with filters or a date range to reduce cost.
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onConfirm}
          style={{
            padding: '8px 18px',
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 8,
            color: 'white',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Run anyway
        </button>
        <button
          onClick={onCancel}
          style={{
          padding: '8px 18px',
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
