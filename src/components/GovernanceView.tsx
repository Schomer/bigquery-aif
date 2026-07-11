'use client';

import type { GovernanceResult, CustomViewProps } from '@/lib/types';
import { CardHeader, CardChips, SqlPanel } from '@/components/ui/CardParts';

// GovernanceView accepts CustomViewProps when used via presentation: 'custom'.
// It owns its full layout including header, chips, and SQL panel.

export function GovernanceView(props: CustomViewProps) {
  const result = props.envelope.primaryArtifact.data as GovernanceResult;

  switch (result.governanceType) {
    case 'ACCESS_AUDIT':
      return <AccessAuditView result={result} {...props} />;
    case 'TABLE_SECURITY':
      return <TableSecurityView result={result} {...props} />;
    case 'SENSITIVE_DATA_SCAN':
      return <SensitiveDataScanView result={result} {...props} />;
    case 'DATA_CLASSIFICATION':
      return <DataClassificationView result={result} {...props} />;
    default:
      return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Unknown governance type</p>;
  }
}

// ─── Shared UI primitives ────────────────────────────────────────────────────

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

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{
      padding: '8px 14px',
      background: 'var(--surface-2)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      minWidth: 90,
    }}>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', fontFamily: mono ? 'var(--font-mono)' : 'inherit' }}>
        {value}
      </div>
    </div>
  );
}

// ─── ACCESS_AUDIT ────────────────────────────────────────────────────────────

function AccessAuditView({ result, ...props }: { result: GovernanceResult } & CustomViewProps) {
  const entries = result.accessEntries || [];

  if (entries.length === 0) {
    // Lightweight: headline is the answer, just add a brief note
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <CardHeader
          envelope={props.envelope}
          onSave={props.onSave}
          onPin={props.onPin}
          onChipClick={props.onChipClick}
          isPinned={props.isPinned}
        />
        <p style={{
          margin: 0,
          fontSize: 12,
          color: 'var(--text-muted)',
          lineHeight: 1.5,
        }}>
          OBJECT_PRIVILEGES may not be accessible, or all access is inherited from the project IAM policy.
        </p>
        <CardChips
          envelope={props.envelope}
          onChipClick={props.onChipClick}
          onSendMessage={props.onSendMessage}
          showDivider={false}
        />
      </div>
    );
  }

  // Rich: header + entity/role table + SQL + chips
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <CardHeader
        envelope={props.envelope}
        onSave={props.onSave}
        onPin={props.onPin}
        onChipClick={props.onChipClick}
        isPinned={props.isPinned}
      />

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

      <SqlPanel envelope={props.envelope} onRunSql={props.onRunSql} />
      <CardChips
        envelope={props.envelope}
        onChipClick={props.onChipClick}
        onSendMessage={props.onSendMessage}
        showDivider={true}
      />
    </div>
  );
}

// ─── TABLE_SECURITY ──────────────────────────────────────────────────────────

function TableSecurityView({ result, ...props }: { result: GovernanceResult } & CustomViewProps) {
  const policies = result.securityPolicies || { rowLevelPolicies: 0, columnLevelMasking: 0, policyTags: [] };
  const hasAny = policies.rowLevelPolicies > 0 || policies.columnLevelMasking > 0 || policies.policyTags.length > 0;

  if (!hasAny) {
    // Lightweight: no policies, just say so with a recommendation
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <CardHeader
          envelope={props.envelope}
          onSave={props.onSave}
          onPin={props.onPin}
          onChipClick={props.onChipClick}
          isPinned={props.isPinned}
        />
        <p style={{
          margin: 0,
          fontSize: 12,
          color: '#92400e',
          lineHeight: 1.5,
        }}>
          Consider adding row-level security or column-level masking if this resource contains sensitive data.
        </p>
        <CardChips
          envelope={props.envelope}
          onChipClick={props.onChipClick}
          onSendMessage={props.onSendMessage}
          showDivider={false}
        />
      </div>
    );
  }

  // Rich: stat boxes for non-zero counts + policy tag badges
  const stats: { label: string; value: string }[] = [];
  if (policies.rowLevelPolicies > 0) stats.push({ label: 'Row-level policies', value: String(policies.rowLevelPolicies) });
  if (policies.columnLevelMasking > 0) stats.push({ label: 'Column masks', value: String(policies.columnLevelMasking) });
  if (policies.policyTags.length > 0) stats.push({ label: 'Policy tags', value: String(policies.policyTags.length) });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <CardHeader
        envelope={props.envelope}
        onSave={props.onSave}
        onPin={props.onPin}
        onChipClick={props.onChipClick}
        isPinned={props.isPinned}
      />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {stats.map((s, i) => <Stat key={i} label={s.label} value={s.value} />)}
      </div>

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

      <SqlPanel envelope={props.envelope} onRunSql={props.onRunSql} />
      <CardChips
        envelope={props.envelope}
        onChipClick={props.onChipClick}
        onSendMessage={props.onSendMessage}
        showDivider={true}
      />
    </div>
  );
}

// ─── SENSITIVE_DATA_SCAN ─────────────────────────────────────────────────────

function SensitiveDataScanView({ result, ...props }: { result: GovernanceResult } & CustomViewProps) {
  const findings = result.sensitiveFindings || [];

  const confidenceVariant = (c: string): 'warning' | 'neutral' | 'info' => {
    if (c === 'high') return 'warning';
    if (c === 'medium') return 'info';
    return 'neutral';
  };

  if (findings.length === 0) {
    // Lightweight: no findings -- positive result
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <CardHeader
          envelope={props.envelope}
          onSave={props.onSave}
          onPin={props.onPin}
          onChipClick={props.onChipClick}
          isPinned={props.isPinned}
        />
        <p style={{
          margin: 0,
          fontSize: 12,
          color: 'var(--text-muted)',
          lineHeight: 1.5,
        }}>
          Heuristic scan of 1,000 rows found no sensitive patterns. For thorough coverage, use{' '}
          <a
            href="https://cloud.google.com/sensitive-data-protection/docs/inspect-bigquery"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#1d4ed8', textDecoration: 'underline' }}
          >
            Cloud DLP
          </a>.
        </p>
        <CardChips
          envelope={props.envelope}
          onChipClick={props.onChipClick}
          onSendMessage={props.onSendMessage}
          showDivider={false}
        />
      </div>
    );
  }

  // Rich: findings table with confidence badges + DLP recommendation
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <CardHeader
        envelope={props.envelope}
        onSave={props.onSave}
        onPin={props.onPin}
        onChipClick={props.onChipClick}
        isPinned={props.isPinned}
      />

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

      <div style={{
        padding: '10px 14px',
        borderRadius: 8,
        background: '#eff6ff',
        border: '1px solid #bfdbfe',
        fontSize: 11,
        color: '#1e40af',
        lineHeight: 1.5,
      }}>
        Heuristic scan only -- pattern matching on 1,000 rows. For thorough coverage, use{' '}
        <a
          href="https://cloud.google.com/sensitive-data-protection/docs/inspect-bigquery"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#1d4ed8', textDecoration: 'underline' }}
        >
          Cloud DLP / Sensitive Data Protection
        </a>.
      </div>

      <SqlPanel envelope={props.envelope} onRunSql={props.onRunSql} />
      <CardChips
        envelope={props.envelope}
        onChipClick={props.onChipClick}
        onSendMessage={props.onSendMessage}
        showDivider={true}
      />
    </div>
  );
}

// ─── DATA_CLASSIFICATION ─────────────────────────────────────────────────────

function DataClassificationView({ result, ...props }: { result: GovernanceResult } & CustomViewProps) {
  const cls = result.classification || { documentedTables: 0, undocumentedTables: 0, documentedColumns: 0, undocumentedColumns: 0, labels: {} };
  const totalTables = cls.documentedTables + cls.undocumentedTables;
  const totalColumns = cls.documentedColumns + cls.undocumentedColumns;
  const tablePct = totalTables > 0 ? Math.round((cls.documentedTables / totalTables) * 100) : 0;
  const columnPct = totalColumns > 0 ? Math.round((cls.documentedColumns / totalColumns) * 100) : 0;
  const labelEntries = Object.entries(cls.labels);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <CardHeader
        envelope={props.envelope}
        onSave={props.onSave}
        onPin={props.onPin}
        onChipClick={props.onChipClick}
        isPinned={props.isPinned}
      />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Stat label="Tables" value={`${cls.documentedTables}/${totalTables}`} />
        <Stat label="Columns" value={`${cls.documentedColumns}/${totalColumns}`} />
      </div>

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

      <SqlPanel envelope={props.envelope} onRunSql={props.onRunSql} />
      <CardChips
        envelope={props.envelope}
        onChipClick={props.onChipClick}
        onSendMessage={props.onSendMessage}
        showDivider={true}
      />
    </div>
  );
}
