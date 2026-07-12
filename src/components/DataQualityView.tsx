'use client';

import type { DataQualityResult, DqFinding, DqSeverity } from '@/lib/types';
import { useState } from 'react';

interface Props {
  result: DataQualityResult;
  onSendMessage?: (msg: string) => void;
}

export function DataQualityView({ result, onSendMessage }: Props) {
  const send = onSendMessage ?? (() => {});
  const { checkType, table, findings, summary } = result;
  const tableName = table.split('.').pop();

  // W1-07: pass/fail summary counts
  const passCount = findings.filter(f => f.severity === 'PASS').length;
  const issueCount = findings.filter(f => f.severity === 'ISSUE').length;
  const warnCount = findings.filter(f => f.severity === 'WARNING').length;
  const totalChecks = findings.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stat row */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Stat label="Check type" value={checkType} />
        <Stat
          label="Table"
          value={tableName ?? table}
          mono
          onClick={() => send(`Show me ${table}`)}
        />
        <Stat label="Rows scanned" value={summary.rowsScanned.toLocaleString()} />
        <Stat label="Issues found" value={String(summary.issuesFound)} />
        <Stat label="Checked at" value={new Date(summary.checkedAt).toLocaleString()} />
      </div>

      {/* W1-07: pass/fail summary banner */}
      {totalChecks > 0 && (
        <div style={{
          display: 'flex',
          gap: 12,
          padding: '8px 12px',
          borderRadius: 6,
          background: issueCount > 0 ? 'rgba(239,68,68,0.04)' : 'rgba(34,197,94,0.04)',
          border: `1px solid ${issueCount > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
          fontSize: 12,
          fontWeight: 500,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}>
          {passCount > 0 && <span style={{ color: '#16a34a' }}>{passCount} passed</span>}
          {issueCount > 0 && <span style={{ color: '#ef4444' }}>{issueCount} {issueCount === 1 ? 'issue' : 'issues'}</span>}
          {warnCount > 0 && <span style={{ color: '#f59e0b' }}>{warnCount} {warnCount === 1 ? 'warning' : 'warnings'}</span>}
        </div>
      )}

      {findings.length === 0 ? (
        <div style={{
          padding: '20px 16px',
          borderRadius: 8,
          background: 'rgba(34,197,94,0.06)',
          border: '1px solid rgba(34,197,94,0.25)',
          color: 'var(--positive)',
          fontSize: 13,
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>OK</span>
          No issues found
        </div>
      ) : (
        <div style={{
          border: '1px solid var(--border)',
          borderRadius: 8,
          overflow: 'hidden',
          maxHeight: 480,
          overflowY: 'auto',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: 'var(--surface)' }}>
                {['Column', 'Metric', 'Value', 'Severity'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '7px 12px',
                      textAlign: 'left',
                      color: 'var(--text)',
                      fontWeight: 600,
                      fontSize: 11,
                      borderBottom: '1px solid var(--border-subtle)',
                      position: 'sticky',
                      top: 0,
                      background: 'var(--surface)',
                      zIndex: 1,
                      boxShadow: '0 1px 0 var(--border-subtle)',
                    }}
                  >
                    {h}
                  </th>
                ))}
                <th
                  style={{
                    width: 120,
                    padding: '7px 8px',
                    borderBottom: '1px solid var(--border-subtle)',
                    position: 'sticky',
                    top: 0,
                    background: 'var(--surface)',
                    zIndex: 1,
                    boxShadow: '0 1px 0 var(--border-subtle)',
                  }}
                />
              </tr>
            </thead>
            <tbody>
              {findings.map((f, i) => (
                <FindingRow
                  key={i}
                  finding={f}
                  table={table}
                  index={i}
                  total={findings.length}
                  onSendMessage={send}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, mono, onClick }: { label: string; value: string; mono?: boolean; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false);
  const isClickable = !!onClick;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
      <span
        onClick={onClick}
        onMouseEnter={() => isClickable && setHovered(true)}
        onMouseLeave={() => isClickable && setHovered(false)}
        style={{
          fontSize: 13,
          color: isClickable && hovered ? 'var(--accent)' : 'var(--text)',
          fontFamily: mono ? 'var(--font-mono)' : 'inherit',
          cursor: isClickable ? 'pointer' : 'default',
          textDecoration: isClickable && hovered ? 'underline' : 'none',
          transition: 'color 0.12s',
        }}
      >{value}</span>
    </div>
  );
}

function FindingRow({
  finding: f,
  table,
  index,
  total,
  onSendMessage,
}: {
  finding: DqFinding;
  table: string;
  index: number;
  total: number;
  onSendMessage: (msg: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  // Determine what action makes sense for this finding
  function getActions(): Array<{ label: string; msg: string }> {
    const actions: Array<{ label: string; msg: string }> = [];
    if (f.metric === 'duplicate_groups' && Number(f.value) > 0) {
      actions.push({ label: 'Deduplicate', msg: `Remove duplicates from \`${table}\` keeping the latest row` });
    }
    if (f.metric === 'null_rate' && Number(f.value) > 0) {
      actions.push({ label: 'Show nulls', msg: `Show rows where ${f.column} is null in \`${table}\`` });
      actions.push({ label: 'Fix nulls', msg: `Fill null values in the ${f.column} column of \`${table}\`` });
    }
    if (f.metric === 'out_of_range_count' && Number(f.value) > 0) {
      actions.push({ label: 'Show rows', msg: `Show the out-of-range rows for ${f.column} in \`${table}\`` });
    }
    if (f.metric === 'distinct_count') {
      actions.push({ label: 'Distribution', msg: `Show the distribution of ${f.column} in \`${table}\`` });
    }
    return actions;
  }

  const actions = getActions();
  const hasSamples = f.sampleRows && f.sampleRows.length > 0;
  const sampleCols = hasSamples ? Object.keys(f.sampleRows![0]).slice(0, 6) : [];

  return (
    <>
      <tr
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          borderBottom: !hasSamples && index < total - 1 ? '1px solid var(--border-subtle)' : undefined,
          background: hovered ? 'var(--accent-dim)' : rowBg(f.severity),
          transition: 'background 0.1s',
        }}
      >
        <td style={{ padding: '6px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{f.column}</td>
        <td style={{ padding: '6px 12px', color: 'var(--text-muted)' }}>{f.metric}</td>
        <td style={{ padding: '6px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
          {f.value === null ? <span style={{ color: 'var(--text-dim)' }}>null</span> : String(f.value)}
        </td>
        <td style={{ padding: '6px 12px' }}>
          <SeverityBadge severity={f.severity} />
        </td>
        {/* Inline action buttons — visible on hover */}
        <td style={{ padding: '4px 8px', whiteSpace: 'nowrap', width: 120 }}>
          {actions.length > 0 && (
            <div style={{ display: 'flex', gap: 4, visibility: hovered ? 'visible' : 'hidden' }}>
              {actions.map((a) => (
                <button
                  key={a.label}
                  onClick={() => onSendMessage(a.msg)}
                  style={{
                    fontSize: 10,
                    padding: '2px 7px',
                    borderRadius: 4,
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--accent)',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </td>
      </tr>
      {/* W2-14: Sample failing rows inline */}
      {hasSamples && (
        <tr style={{ background: 'rgba(239,68,68,0.02)', borderBottom: index < total - 1 ? '1px solid var(--border-subtle)' : undefined }}>
          <td colSpan={5} style={{ padding: '0 12px 8px 24px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
              Sample rows where {f.column} IS NULL ({f.sampleRows!.length} shown):
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ fontSize: 11, borderCollapse: 'collapse', minWidth: '100%' }}>
                <thead>
                  <tr>
                    {sampleCols.map(col => (
                      <th key={col} style={{ padding: '2px 8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500, borderBottom: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)' }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {f.sampleRows!.map((row, ri) => (
                    <tr key={ri}>
                      {sampleCols.map(col => (
                        <td key={col} style={{ padding: '2px 8px', fontFamily: 'var(--font-mono)', color: row[col] == null ? 'var(--text-dim)' : 'var(--text)' }}>
                          {row[col] == null ? 'NULL' : String(row[col]).slice(0, 40)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function SeverityBadge({ severity }: { severity: DqSeverity }) {
  const color = severity === 'ISSUE' ? '#ef4444' : severity === 'WARNING' ? '#f59e0b' : severity === 'PASS' ? '#16a34a' : 'var(--text-muted)';
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 500,
      color,
      border: `1px solid ${color}`,
      borderRadius: 3,
      padding: '1px 5px',
    }}>
      {severity}
    </span>
  );
}

function rowBg(severity: DqSeverity): string {
  if (severity === 'ISSUE') return 'rgba(239,68,68,0.04)';
  if (severity === 'WARNING') return 'rgba(245,158,11,0.04)';
  if (severity === 'PASS') return 'rgba(34,197,94,0.02)';
  return 'transparent';
}
