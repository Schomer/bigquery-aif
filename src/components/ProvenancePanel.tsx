'use client';

import React, { useState, useCallback } from 'react';
import type { CompositionEnvelope, QualityFlag } from '@/lib/types';
import { formatBytes } from '@/lib/format';
import { Badge } from './ui/Badge';

interface ProvenancePanelProps {
  envelope: CompositionEnvelope;
  defaultExpanded?: boolean;
}

// Simple SQL keyword highlighting -- keywords in accent, strings in muted tone
function highlightSql(sql: string): React.JSX.Element[] {
  const SQL_KEYWORDS = /\b(SELECT|FROM|WHERE|AND|OR|NOT|IN|IS|NULL|AS|ON|JOIN|LEFT|RIGHT|INNER|OUTER|CROSS|FULL|GROUP|BY|ORDER|HAVING|LIMIT|OFFSET|UNION|ALL|DISTINCT|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|ALTER|DROP|TABLE|VIEW|INDEX|IF|EXISTS|BETWEEN|LIKE|CASE|WHEN|THEN|ELSE|END|ASC|DESC|COUNT|SUM|AVG|MIN|MAX|CAST|COALESCE|PARTITION|OVER|WINDOW|WITH|RECURSIVE|EXCEPT|INTERSECT|UNNEST|STRUCT|ARRAY|TIMESTAMP|DATE|INT64|FLOAT64|STRING|BOOL|NUMERIC|INTERVAL|EXTRACT|FORMAT|CURRENT_TIMESTAMP|CURRENT_DATE|TIMESTAMP_SUB|TIMESTAMP_ADD|DATE_SUB|DATE_ADD|INFORMATION_SCHEMA)\b/gi;
  const STRING_LITERAL = /'[^']*'/g;

  // Build a map of ranges to highlight
  const ranges: Array<{ start: number; end: number; type: 'keyword' | 'string' }> = [];

  let match: RegExpExecArray | null;
  while ((match = SQL_KEYWORDS.exec(sql)) !== null) {
    ranges.push({ start: match.index, end: match.index + match[0].length, type: 'keyword' });
  }
  while ((match = STRING_LITERAL.exec(sql)) !== null) {
    ranges.push({ start: match.index, end: match.index + match[0].length, type: 'string' });
  }

  // Sort by start position
  ranges.sort((a, b) => a.start - b.start);

  // Remove overlapping ranges (strings take precedence)
  const filtered: typeof ranges = [];
  for (const r of ranges) {
    const last = filtered[filtered.length - 1];
    if (last && r.start < last.end) {
      // Overlap: keep string, discard keyword
      if (r.type === 'string') {
        filtered[filtered.length - 1] = r;
      }
      continue;
    }
    filtered.push(r);
  }

  // Build elements
  const elements: React.JSX.Element[] = [];
  let cursor = 0;
  for (let i = 0; i < filtered.length; i++) {
    const r = filtered[i];
    if (cursor < r.start) {
      elements.push(<span key={`t${i}`}>{sql.slice(cursor, r.start)}</span>);
    }
    const color = r.type === 'keyword' ? 'var(--accent)' : '#9aa0a6';
    const fontWeight = r.type === 'keyword' ? 600 : 400;
    elements.push(
      <span key={`h${i}`} style={{ color, fontWeight }}>
        {sql.slice(r.start, r.end)}
      </span>
    );
    cursor = r.end;
  }
  if (cursor < sql.length) {
    elements.push(<span key="tail">{sql.slice(cursor)}</span>);
  }

  return elements;
}

// Extract table references from SQL (backtick-quoted fully qualified refs)
function extractReferencedTables(sql: string): string[] {
  const refs = new Set<string>();
  const pattern = /`([A-Za-z0-9_-]+\.[A-Za-z0-9_]+\.[A-Za-z0-9_]+)`/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(sql)) !== null) {
    refs.add(m[1]);
  }
  return Array.from(refs);
}

const TIER_LABELS: Record<number, { label: string; variant: 'default' | 'info' | 'success' | 'warning' | 'error' }> = {
  0: { label: 'Tier 0 -- Free', variant: 'success' },
  1: { label: 'Tier 1 -- Small', variant: 'info' },
  2: { label: 'Tier 2 -- Medium', variant: 'info' },
  3: { label: 'Tier 3 -- Large', variant: 'warning' },
  4: { label: 'Tier 4 -- Very Large', variant: 'error' },
};

const COST_PER_TB = 6.25; // On-demand pricing in USD

function estimateCost(bytes: number): string {
  const tb = bytes / (1024 ** 4);
  const cost = tb * COST_PER_TB;
  if (cost < 0.001) return '< $0.001';
  if (cost < 1) return `~$${cost.toFixed(3)}`;
  return `~$${cost.toFixed(2)}`;
}

export function ProvenancePanel({ envelope, defaultExpanded = false }: ProvenancePanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [sqlCopied, setSqlCopied] = useState(false);

  const { provenance, skill, qualityFlags } = envelope;
  const hasSql = !!provenance.sql;
  const hasCost = !!provenance.cost;
  const hasJobId = !!provenance.jobId;
  const hasQualityFlags = qualityFlags && qualityFlags.length > 0;
  const referencedTables = hasSql ? extractReferencedTables(provenance.sql!) : [];

  // Nothing to show if provenance is empty
  const hasContent = hasSql || hasCost || hasJobId || hasQualityFlags;
  if (!hasContent) return null;

  const handleCopySql = useCallback(() => {
    if (!provenance.sql) return;
    navigator.clipboard.writeText(provenance.sql).then(() => {
      setSqlCopied(true);
      setTimeout(() => setSqlCopied(false), 2000);
    }).catch(() => {});
  }, [provenance.sql]);

  const bqConsoleUrl = provenance.jobId && provenance.project
    ? `https://console.cloud.google.com/bigquery?project=${encodeURIComponent(provenance.project)}&j=bq:US:${encodeURIComponent(provenance.jobId)}&page=queryresults`
    : null;

  return (
    <div style={{
      borderTop: '1px solid var(--border-subtle)',
      marginTop: 12,
    }}>
      {/* Toggle */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        style={{
          background: 'none',
          border: 'none',
          padding: '8px 0',
          margin: 0,
          fontSize: 11,
          color: 'var(--text-dim)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontFamily: 'inherit',
          fontWeight: 400,
          transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-dim)'; }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
          {expanded ? 'expand_less' : 'expand_more'}
        </span>
        How was this computed?
      </button>

      {/* Expanded content */}
      {expanded && (
        <div style={{
          background: 'var(--surface-2)',
          borderRadius: 8,
          padding: '12px 16px',
          marginTop: 4,
          marginBottom: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          fontSize: 12,
          color: 'var(--text-muted)',
        }}>
          {/* Skill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--text-dim)' }}>
              build
            </span>
            <span style={{ fontWeight: 500, color: 'var(--text)' }}>Skill:</span>
            <span>{skill}</span>
          </div>

          {/* SQL */}
          {hasSql && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--text-dim)' }}>
                  code
                </span>
                <span style={{ fontWeight: 500, color: 'var(--text)' }}>SQL executed</span>
                <button
                  type="button"
                  onClick={handleCopySql}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontSize: 10,
                    color: sqlCopied ? 'var(--positive)' : 'var(--text-dim)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    fontFamily: 'inherit',
                    transition: 'all 0.15s',
                    marginLeft: 'auto',
                  }}
                  onMouseEnter={(e) => { if (!sqlCopied) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
                  onMouseLeave={(e) => { if (!sqlCopied) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-dim)'; }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
                    {sqlCopied ? 'check' : 'content_copy'}
                  </span>
                  {sqlCopied ? 'Copied' : 'Copy'}
                </button>
                {bqConsoleUrl && (
                  <a
                    href={bqConsoleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 10,
                      color: 'var(--accent)',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none'; }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>open_in_new</span>
                    BigQuery Console
                  </a>
                )}
              </div>
              <pre style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                background: '#1e1e2e',
                color: '#cdd6f4',
                borderRadius: 6,
                padding: 12,
                overflowX: 'auto',
                maxHeight: 200,
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: 1.5,
              }}>
                {highlightSql(provenance.sql!)}
              </pre>
            </div>
          )}

          {/* Cost */}
          {hasCost && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--text-dim)' }}>
                  payments
                </span>
                <span style={{ fontWeight: 500, color: 'var(--text)' }}>Cost</span>
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <span>{formatBytes(provenance.cost!.totalBytesProcessed)} processed</span>
                <span>{estimateCost(provenance.cost!.totalBytesProcessed)}</span>
                <Badge
                  label={TIER_LABELS[provenance.cost!.tier]?.label ?? `Tier ${provenance.cost!.tier}`}
                  variant={TIER_LABELS[provenance.cost!.tier]?.variant ?? 'default'}
                  size="sm"
                />
              </div>
            </div>
          )}

          {/* Job Info */}
          {hasJobId && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--text-dim)' }}>
                  assignment
                </span>
                <span style={{ fontWeight: 500, color: 'var(--text)' }}>Job</span>
              </div>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--text-muted)',
                wordBreak: 'break-all',
              }}>
                {provenance.jobId}
              </span>
            </div>
          )}

          {/* Tables Referenced */}
          {referencedTables.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--text-dim)' }}>
                  table_chart
                </span>
                <span style={{ fontWeight: 500, color: 'var(--text)' }}>Tables referenced</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {referencedTables.map((ref) => (
                  <span key={ref} style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    background: 'rgba(26,115,232,0.08)',
                    color: 'var(--accent-text)',
                    padding: '2px 8px',
                    borderRadius: 4,
                  }}>
                    {ref}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Quality Flags */}
          {hasQualityFlags && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--text-dim)' }}>
                  fact_check
                </span>
                <span style={{ fontWeight: 500, color: 'var(--text)' }}>Quality observations</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {qualityFlags!.map((flag: QualityFlag, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                    <Badge
                      label={flag.severity === 'warning' ? 'Warning' : 'Note'}
                      variant={flag.severity === 'warning' ? 'warning' : 'default'}
                      size="sm"
                    />
                    <span style={{ fontSize: 11, lineHeight: 1.4 }}>{flag.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Freshness */}
          {provenance.freshness && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--text-dim)' }}>
                schedule
              </span>
              <span style={{ fontWeight: 500, color: 'var(--text)' }}>Freshness:</span>
              <span>{provenance.freshness}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
