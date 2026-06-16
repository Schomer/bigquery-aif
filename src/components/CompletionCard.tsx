'use client';

import type { DataManagementCompleteResult } from '@/lib/types';

interface Props { result: DataManagementCompleteResult; }

export function CompletionCard({ result }: Props) {
  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <Metric
        label="Rows removed"
        value={result.rowsAffected.toLocaleString()}
        color={result.mismatch ? 'var(--attention)' : 'var(--positive)'}
      />
      {result.mismatch && (
        <Metric label="Rows expected" value={result.rowsExpected.toLocaleString()} color="var(--text-muted)" />
      )}
      {result.jobId && (
        <Metric label="Job ID" value={result.jobId} color="var(--text-dim)" mono />
      )}
    </div>
  );
}

function Metric({ label, value, color, mono }: { label: string; value: string; color: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 700, color, fontFamily: mono ? 'var(--font-mono)' : 'inherit', letterSpacing: mono ? -0.5 : undefined }}>{value}</span>
    </div>
  );
}
