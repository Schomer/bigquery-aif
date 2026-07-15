'use client';

import type { DataManagementCompleteResult } from '@/lib/types';

interface Props { result: DataManagementCompleteResult; }

const CREATION_OPERATIONS = ['CREATE_TABLE', 'CREATE_VIEW', 'CREATE_SCHEMA', 'COPY_TABLE', 'RENAME'];

function operationVerb(op: string): string {
  switch (op) {
    case 'DELETE':     return 'Deleted';
    case 'TRUNCATE':   return 'Truncated';
    case 'DROP_TABLE': return 'Dropped';
    case 'UPDATE':     return 'Updated';
    case 'FILL_NULLS': return 'Filled';
    case 'DEDUPE':     return 'Removed';
    case 'MERGE':      return 'Merged';
    default:           return 'Affected';
  }
}

function operationUnit(op: string): string {
  return op === 'DEDUPE' ? 'duplicate rows' : op === 'DROP_TABLE' ? 'table' : 'rows';
}

export function CompletionCard({ result }: Props) {
  const isCreation = CREATION_OPERATIONS.includes(result.operation);

  if (isCreation) {
    return (
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {result.completionMessage && (
          <Metric label="Result" value={result.completionMessage} color="var(--positive)" />
        )}
        {result.table && (
          <Metric label="Table" value={result.table} color="var(--text)" mono />
        )}
        {result.jobId && (
          <Metric label="Job ID" value={result.jobId} color="var(--text-dim)" mono small />
        )}
      </div>
    );
  }

  // Destructive / mutation operations
  const verb = operationVerb(result.operation);
  const unit = operationUnit(result.operation);
  const countLabel = result.operation === 'DROP_TABLE' ? verb : `${verb} ${result.rowsAffected.toLocaleString()} ${unit}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Primary stat row */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        {/* Big count */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {result.operation === 'DROP_TABLE' ? 'Status' : result.operation === 'DEDUPE' ? 'Duplicates removed' : 'Rows deleted'}
          </span>
          <span style={{
            fontSize: result.operation === 'DROP_TABLE' ? 18 : 28,
            fontWeight: 700,
            color: result.mismatch ? 'var(--attention)' : 'var(--positive)',
            letterSpacing: -0.5,
            lineHeight: 1,
          }}>
            {result.operation === 'DROP_TABLE' ? 'Done' : result.rowsAffected.toLocaleString()}
          </span>
        </div>

        {/* Table */}
        {result.table && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Table</span>
            <span style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font-mono)', letterSpacing: -0.3 }}>
              {result.table}
            </span>
          </div>
        )}

        {/* Expected vs actual (non-mismatch: omit to reduce noise) */}
        {result.mismatch && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Expected</span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {result.rowsExpected.toLocaleString()}
            </span>
          </div>
        )}

        {/* Job ID */}
        {result.jobId && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Job ID</span>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              {result.jobId}
            </span>
          </div>
        )}
      </div>

      {/* Mismatch warning */}
      {result.mismatch && result.mismatchNote && (
        <div style={{
          padding: '9px 12px',
          background: 'rgba(245,158,11,0.06)',
          border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: 8,
          fontSize: 12,
          color: 'var(--text-muted)',
          lineHeight: 1.5,
        }}>
          {result.mismatchNote}
        </div>
      )}
    </div>
  );
}
