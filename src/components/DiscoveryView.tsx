'use client';

import type { DiscoveryResult, DiscoverySearchResult } from '@/lib/types';
import { useState } from 'react';

interface Props {
  result: DiscoveryResult;
  onSendMessage?: (msg: string) => void;
}

export function DiscoveryView({ result, onSendMessage }: Props) {
  const send = onSendMessage ?? (() => {});
  if (result.discoveryType === 'LINEAGE') {
    return <LineageView result={result} onSendMessage={send} />;
  }
  if (result.discoveryType === 'COMPARISON') {
    return <ComparisonView result={result} onSendMessage={send} />;
  }
  return <SearchView result={result} onSendMessage={send} />;
}

// ─── Lineage view ──────────────────────────────────────────────────────────────

function LineageView({ result, onSendMessage }: { result: DiscoveryResult; onSendMessage: (msg: string) => void }) {
  const lin = result.lineage;
  if (!lin) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, padding: '8px 0' }}>
        No lineage data available
      </p>
    );
  }

  const sectionStyle: React.CSSProperties = { marginBottom: 16 };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
    textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: 6,
  };
  const itemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 12px', background: 'var(--surface-2)',
    borderRadius: 6, border: '1px solid var(--border-subtle)',
    cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-mono)',
    color: 'var(--text)', transition: 'border-color 0.12s',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={sectionStyle}>
        <div style={labelStyle}>Reads from (upstream)</div>
        {lin.readsFrom.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: 0 }}>No upstream tables found in the last 7 days</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {lin.readsFrom.map((t, i) => (
              <div key={i} style={itemStyle} onClick={() => onSendMessage(`Tell me more about ${t}`)}>
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--text-dim)' }}>arrow_back</span>
                {t}
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={sectionStyle}>
        <div style={labelStyle}>Written by (downstream)</div>
        {lin.writtenBy.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: 0 }}>No downstream tables found in the last 7 days</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {lin.writtenBy.map((t, i) => (
              <div key={i} style={itemStyle} onClick={() => onSendMessage(`Tell me more about ${t}`)}>
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--text-dim)' }}>arrow_forward</span>
                {t}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Search results ────────────────────────────────────────────────────────────

function SearchView({ result, onSendMessage }: { result: DiscoveryResult; onSendMessage: (msg: string) => void }) {
  if (result.results.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, padding: '8px 0' }}>
        No tables found matching your query
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {result.results.map((r, i) => (
        <SearchResultRow key={i} item={r} onSendMessage={onSendMessage} />
      ))}
    </div>
  );
}

function SearchResultRow({ item, onSendMessage }: { item: DiscoverySearchResult; onSendMessage: (msg: string) => void }) {
  const [hovered, setHovered] = useState(false);
  const iconMap: Record<string, string> = {
    TABLE: 'table_chart',
    VIEW: 'visibility',
    MATERIALIZED_VIEW: 'table_rows',
    EXTERNAL: 'cloud',
    DATASET: 'database',
  };

  return (
    <div
      title={`Click to inspect ${item.ref}`}
      onClick={() => onSendMessage(`Tell me more about ${item.ref}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '8px 12px',
        background: hovered ? 'var(--accent-dim)' : 'var(--surface-2)',
        borderRadius: 6,
        border: `1px solid ${hovered ? 'var(--accent)' : 'var(--border-subtle)'}`,
        cursor: 'pointer',
        transition: 'all 0.12s',
        userSelect: 'none',
      }}
    >
      <span
        className="material-symbols-outlined"
        title={item.type}
        style={{ fontSize: 15, color: 'var(--text-dim)', flexShrink: 0, marginTop: 1 }}
      >
        {iconMap[item.type] ?? 'help_outline'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: 13,
          color: hovered ? 'var(--accent)' : 'var(--text)',
          fontFamily: 'var(--font-mono)',
          wordBreak: 'break-all',
          transition: 'color 0.12s',
        }}>
          {item.ref}
        </span>
        <div style={{ display: 'flex', gap: 12, marginTop: 3, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            matched on <em>{item.matchedOn}</em>
          </span>
          {item.description && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.description}</span>
          )}
        </div>
      </div>
      <span style={{ fontSize: 12, color: 'var(--text-dim)', flexShrink: 0, marginTop: 2 }}>→</span>
    </div>
  );
}

// ─── Comparison diff view ──────────────────────────────────────────────────────

function ComparisonView({ result, onSendMessage }: { result: DiscoveryResult; onSendMessage: (msg: string) => void }) {
  const cmp = result.comparison;

  if (!cmp) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, padding: '8px 0' }}>
        Unable to compare schemas.
      </p>
    );
  }

  const hasChanges =
    cmp.addedColumns.length > 0 ||
    cmp.removedColumns.length > 0 ||
    cmp.changedColumns.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)' }}>{cmp.left}</span>
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>vs</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)' }}>{cmp.right}</span>
      </div>

      {!hasChanges ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Schemas are identical</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Change', 'Column', 'Type'].map((h) => (
                <th key={h} style={{
                  padding: '6px 12px',
                  textAlign: 'left',
                  color: 'var(--text-muted)',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cmp.addedColumns.map((col) => (
              <tr key={`add-${col.name}`} style={{ background: 'rgba(34,197,94,0.08)', borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '7px 12px', color: '#22c55e', fontWeight: 500 }}>+</td>
                <td style={{ padding: '7px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{col.name}</td>
                <td style={{ padding: '7px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: 11 }}>{col.type}</td>
              </tr>
            ))}
            {cmp.removedColumns.map((col) => (
              <tr key={`rem-${col.name}`} style={{ background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '7px 12px', color: '#ef4444', fontWeight: 500 }}>−</td>
                <td style={{ padding: '7px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{col.name}</td>
                <td style={{ padding: '7px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: 11 }}>{col.type}</td>
              </tr>
            ))}
            {cmp.changedColumns.map((col) => (
              <tr key={`chg-${col.name}`} style={{ background: 'rgba(234,179,8,0.08)', borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '7px 12px', color: '#eab308', fontWeight: 500 }}>~</td>
                <td style={{ padding: '7px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{col.name}</td>
                <td style={{ padding: '7px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: 11 }}>
                  {col.fromType} → {col.toType}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
