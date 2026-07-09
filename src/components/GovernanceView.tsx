'use client';

import type { GovernanceResult } from '@/lib/types';

interface Props {
  result: GovernanceResult;
  onSendMessage?: (msg: string) => void;
}

export function GovernanceView({ result, onSendMessage }: Props) {
  const send = onSendMessage ?? (() => {});

  switch (result.governanceType) {
    case 'ACCESS_AUDIT':
      return <AccessAuditView result={result} onSendMessage={send} />;
    case 'TABLE_SECURITY':
      return <TableSecurityView result={result} onSendMessage={send} />;
    case 'SENSITIVE_DATA_SCAN':
      return <SensitiveDataScanView result={result} onSendMessage={send} />;
    case 'DATA_CLASSIFICATION':
      return <DataClassificationView result={result} onSendMessage={send} />;
    default:
      return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Unknown governance type</p>;
  }
}

// -- Stat card --

function Stat({ label, value, mono, onClick }: { label: string; value: string; mono?: boolean; onClick?: () => void }) {
  return (
    <div
      style={{
        padding: '8px 14px',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.15s',
        minWidth: 90,
      }}
      onClick={onClick}
      onMouseEnter={(e) => onClick && ((e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent, #4f7fff)')}
      onMouseLeave={(e) => onClick && ((e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)')}
    >
      <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', fontFamily: mono ? 'var(--font-mono)' : 'inherit' }}>
        {value}
      </div>
    </div>
  );
}

// -- Badge --

function Badge({ label, variant }: { label: string; variant: 'neutral' | 'info' | 'warning' | 'positive' }) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    neutral: { bg: '#f3f4f6', text: '#4b5563', border: '#e5e7eb' },
    info: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
    warning: { bg: '#fffbeb', text: '#92400e', border: '#fde68a' },
    positive: { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
  };
  const c = colors[variant] || colors.neutral;
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 600,
      padding: '2px 7px',
      borderRadius: 4,
      background: c.bg,
      color: c.text,
      border: `1px solid ${c.border}`,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

// -- ACCESS_AUDIT view --

function AccessAuditView({ result, onSendMessage }: { result: GovernanceResult; onSendMessage: (msg: string) => void }) {
  const entries = result.accessEntries || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Stat label="Scope" value={result.scope} mono />
        <Stat label="Entries" value={String(entries.length)} />
      </div>

      {entries.length === 0 ? (
        <div style={{
          padding: '16px',
          borderRadius: 8,
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          fontSize: 13,
          color: 'var(--text-muted)',
        }}>
          No access entries found. This may mean OBJECT_PRIVILEGES is not accessible or no explicit grants exist.
        </div>
      ) : (
        <div style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          overflow: 'hidden',
          maxHeight: 400,
          overflowY: 'auto',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--surface)' }}>
                {['Entity', 'Type', 'Role'].map((h) => (
                  <th key={h} style={{
                    padding: '7px 12px',
                    textAlign: 'left',
                    color: 'var(--text-dim)',
                    fontWeight: 500,
                    fontSize: 11,
                    borderBottom: '1px solid var(--border-subtle)',
                    position: 'sticky',
                    top: 0,
                    background: 'var(--surface)',
                    zIndex: 1,
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '6px 12px', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    {entry.entity}
                  </td>
                  <td style={{ padding: '6px 12px' }}>
                    <Badge label={entry.entityType} variant={
                      entry.entityType === 'allUsers' ? 'warning'
                      : entry.entityType === 'serviceAccount' ? 'info'
                      : 'neutral'
                    } />
                  </td>
                  <td style={{ padding: '6px 12px' }}>
                    <Badge label={entry.role} variant="neutral" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// -- TABLE_SECURITY view --

function TableSecurityView({ result, onSendMessage }: { result: GovernanceResult; onSendMessage: (msg: string) => void }) {
  const policies = result.securityPolicies || { rowLevelPolicies: 0, columnLevelMasking: 0, policyTags: [] };
  const hasAny = policies.rowLevelPolicies > 0 || policies.columnLevelMasking > 0 || policies.policyTags.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Stat label="Scope" value={result.scope} mono />
        <Stat label="Row-level policies" value={String(policies.rowLevelPolicies)} />
        <Stat label="Column masks" value={String(policies.columnLevelMasking)} />
        <Stat label="Policy tags" value={String(policies.policyTags.length)} />
      </div>

      {!hasAny ? (
        <div style={{
          padding: '16px',
          borderRadius: 8,
          background: 'rgba(234, 179, 8, 0.06)',
          border: '1px solid rgba(234, 179, 8, 0.25)',
          fontSize: 13,
          color: '#92400e',
        }}>
          No security policies detected. Consider adding row-level security or column-level masking for sensitive data.
        </div>
      ) : (
        <div style={{
          padding: '16px',
          borderRadius: 8,
          background: 'rgba(34, 197, 94, 0.06)',
          border: '1px solid rgba(34, 197, 94, 0.25)',
          fontSize: 13,
          color: '#166534',
          fontWeight: 500,
        }}>
          Security policies are active on this resource.
        </div>
      )}

      {policies.policyTags.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Columns with policy tags
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {policies.policyTags.map((tag, i) => (
              <Badge key={i} label={tag} variant="info" />
            ))}
          </div>
        </div>
      )}

      <button
        className="chip"
        style={{ alignSelf: 'flex-start', fontSize: 11 }}
        onClick={() => onSendMessage(`Scan ${result.scope} for sensitive data`)}
      >
        Scan for PII
      </button>
    </div>
  );
}

// -- SENSITIVE_DATA_SCAN view --

function SensitiveDataScanView({ result, onSendMessage }: { result: GovernanceResult; onSendMessage: (msg: string) => void }) {
  const findings = result.sensitiveFindings || [];

  const confidenceVariant = (c: string): 'warning' | 'neutral' | 'info' => {
    if (c === 'high') return 'warning';
    if (c === 'medium') return 'info';
    return 'neutral';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Stat label="Scope" value={result.scope} mono />
        <Stat label="Findings" value={String(findings.length)} />
      </div>

      {/* DLP recommendation banner */}
      <div style={{
        padding: '12px 16px',
        borderRadius: 8,
        background: '#eff6ff',
        border: '1px solid #bfdbfe',
        fontSize: 12,
        color: '#1e40af',
        lineHeight: 1.5,
      }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Heuristic scan only</div>
        This scan uses pattern matching on a sample of 1,000 rows. Results are indicative, not authoritative.
        For a thorough scan, use{' '}
        <a
          href="https://cloud.google.com/sensitive-data-protection/docs/inspect-bigquery"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#1d4ed8', textDecoration: 'underline' }}
        >
          Cloud DLP / Sensitive Data Protection
        </a>.
      </div>

      {findings.length === 0 ? (
        <div style={{
          padding: '16px',
          borderRadius: 8,
          background: 'rgba(34, 197, 94, 0.06)',
          border: '1px solid rgba(34, 197, 94, 0.25)',
          fontSize: 13,
          color: '#166534',
          fontWeight: 500,
        }}>
          No sensitive data patterns detected in the sampled rows.
        </div>
      ) : (
        <div style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          overflow: 'hidden',
          maxHeight: 400,
          overflowY: 'auto',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--surface)' }}>
                {['Column', 'Pattern detected', 'Matches', 'Confidence'].map((h) => (
                  <th key={h} style={{
                    padding: '7px 12px',
                    textAlign: 'left',
                    color: 'var(--text-dim)',
                    fontWeight: 500,
                    fontSize: 11,
                    borderBottom: '1px solid var(--border-subtle)',
                    position: 'sticky',
                    top: 0,
                    background: 'var(--surface)',
                    zIndex: 1,
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {findings.map((f, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '6px 12px', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    {f.column}
                  </td>
                  <td style={{ padding: '6px 12px' }}>{f.pattern}</td>
                  <td style={{ padding: '6px 12px' }}>{f.sampleCount}</td>
                  <td style={{ padding: '6px 12px' }}>
                    <Badge label={f.confidence} variant={confidenceVariant(f.confidence)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// -- DATA_CLASSIFICATION view --

function DataClassificationView({ result, onSendMessage }: { result: GovernanceResult; onSendMessage: (msg: string) => void }) {
  const cls = result.classification || { documentedTables: 0, undocumentedTables: 0, documentedColumns: 0, undocumentedColumns: 0, labels: {} };
  const totalTables = cls.documentedTables + cls.undocumentedTables;
  const totalColumns = cls.documentedColumns + cls.undocumentedColumns;
  const tablePct = totalTables > 0 ? Math.round((cls.documentedTables / totalTables) * 100) : 0;
  const columnPct = totalColumns > 0 ? Math.round((cls.documentedColumns / totalColumns) * 100) : 0;
  const labelEntries = Object.entries(cls.labels);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Stat label="Scope" value={result.scope} mono />
        <Stat label="Tables" value={`${cls.documentedTables}/${totalTables} documented`} />
        <Stat label="Columns" value={`${cls.documentedColumns}/${totalColumns} documented`} />
      </div>

      {/* Progress bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ProgressBar label="Table documentation" pct={tablePct} />
        <ProgressBar label="Column documentation" pct={columnPct} />
      </div>

      {cls.undocumentedTables > 0 && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 8,
          background: 'rgba(234, 179, 8, 0.06)',
          border: '1px solid rgba(234, 179, 8, 0.25)',
          fontSize: 12,
          color: '#92400e',
        }}>
          {cls.undocumentedTables} table{cls.undocumentedTables !== 1 ? 's have' : ' has'} no description. Adding descriptions improves discoverability and compliance.
        </div>
      )}

      {labelEntries.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Table labels
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {labelEntries.map(([tbl, val], i) => (
              <span key={i} style={{
                fontSize: 11,
                padding: '3px 8px',
                borderRadius: 4,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                fontFamily: 'var(--font-mono)',
              }}>
                {tbl}: {val}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// -- Progress bar --

function ProgressBar({ label, pct }: { label: string; pct: number }) {
  const barColor = pct >= 80 ? '#22c55e' : pct >= 50 ? '#eab308' : '#ef4444';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600 }}>{pct}%</span>
      </div>
      <div style={{
        height: 6,
        borderRadius: 3,
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          borderRadius: 3,
          background: barColor,
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  );
}
