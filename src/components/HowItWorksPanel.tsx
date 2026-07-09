'use client';

import { useState } from 'react';

interface SectionProps {
  icon: string;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Section({ icon, title, children, defaultOpen = false }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '14px 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--text)',
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--text-muted)' }}>
          {icon}
        </span>
        <span style={{ flex: 1 }}>{title}</span>
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--text-dim)', transition: 'transform 0.15s' }}>
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      {open && (
        <div style={{
          padding: '0 0 16px 28px',
          fontSize: 13,
          color: 'var(--text-muted)',
          lineHeight: 1.6,
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: '4px 0 0 0', padding: '0 0 0 16px', listStyle: 'disc' }}>
      {items.map((item, i) => (
        <li key={i} style={{ marginBottom: 4 }}>{item}</li>
      ))}
    </ul>
  );
}

function CanCannotTable() {
  const canDo = [
    'Query data across your datasets',
    'Check data quality and profile tables',
    'Browse and search schemas',
    'Export results to CSV or Google Sheets',
    'Schedule recurring queries',
    'Monitor job history and costs',
  ];

  const cannotDo = [
    'Access data outside your Google account permissions',
    'Make changes without your explicit confirmation',
    'Access other users\' data or queries',
    'Bypass BigQuery access controls',
    'Store or transmit your data to external services',
  ];

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.05em',
          color: 'var(--positive)',
          marginBottom: 6,
        }}>
          Can do
        </div>
        <ul style={{ margin: 0, padding: '0 0 0 16px', listStyle: 'disc' }}>
          {canDo.map((item, i) => (
            <li key={i} style={{ marginBottom: 3, fontSize: 12 }}>{item}</li>
          ))}
        </ul>
      </div>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.05em',
          color: 'var(--text-dim)',
          marginBottom: 6,
        }}>
          Cannot do
        </div>
        <ul style={{ margin: 0, padding: '0 0 0 16px', listStyle: 'disc' }}>
          {cannotDo.map((item, i) => (
            <li key={i} style={{ marginBottom: 3, fontSize: 12 }}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function CostTierTable() {
  const tiers = [
    { tier: 0, threshold: '< 10 MB', behavior: 'Runs immediately, no notice' },
    { tier: 1, threshold: '10 MB - 100 MB', behavior: 'Runs with cost shown in provenance' },
    { tier: 2, threshold: '100 MB - 1 GB', behavior: 'Runs with cost notice' },
    { tier: 3, threshold: '1 GB - 100 GB', behavior: 'Requires your confirmation before running' },
    { tier: 4, threshold: '> 100 GB', behavior: 'Requires your confirmation, shown prominently' },
  ];

  return (
    <div style={{
      marginTop: 8,
      borderRadius: 6,
      border: '1px solid var(--border-subtle)',
      overflow: 'hidden',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--surface-2)' }}>
            <th style={{ padding: '6px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text)', borderBottom: '1px solid var(--border-subtle)' }}>Tier</th>
            <th style={{ padding: '6px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text)', borderBottom: '1px solid var(--border-subtle)' }}>Data processed</th>
            <th style={{ padding: '6px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text)', borderBottom: '1px solid var(--border-subtle)' }}>Behavior</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((t) => (
            <tr key={t.tier}>
              <td style={{ padding: '6px 12px', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{t.tier}</td>
              <td style={{ padding: '6px 12px', borderBottom: '1px solid var(--border-subtle)' }}>{t.threshold}</td>
              <td style={{ padding: '6px 12px', borderBottom: '1px solid var(--border-subtle)' }}>{t.behavior}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HowItWorksPanel() {
  return (
    <div style={{
      maxWidth: 720,
      margin: '0 auto',
      padding: '32px 24px',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          fontSize: 20,
          fontWeight: 600,
          color: 'var(--text)',
          margin: '0 0 6px 0',
        }}>
          How it works
        </h1>
        <p style={{
          fontSize: 13,
          color: 'var(--text-muted)',
          margin: 0,
          lineHeight: 1.5,
        }}>
          Transparency into how this app handles your data, runs queries, and manages costs.
        </p>
      </div>

      {/* Sections */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '0 20px',
      }}>
        <Section icon="shield" title="How your data stays secure" defaultOpen>
          <BulletList items={[
            'All processing happens in your browser -- your data goes directly between your browser and Google BigQuery.',
            'Your BigQuery data never leaves Google\'s infrastructure. Queries run server-side in BigQuery, and only results are returned.',
            'The app uses your Google account\'s existing permissions. It can only access projects, datasets, and tables that your account already has access to.',
            'OAuth tokens are stored in memory only and are never persisted to disk or sent to third parties.',
          ]} />
        </Section>

        <Section icon="database" title="How queries work">
          <BulletList items={[
            'The AI generates SQL based on your question and the schemas of your tables. You can always see and edit the exact SQL before or after it runs.',
            'Every query is dry-run first to estimate its cost before execution. The dry run does not read any data.',
            'Large queries (Tier 3+, over 1 GB) require your explicit confirmation before running.',
            'Results are displayed directly in your browser. Nothing is stored externally.',
          ]} />
        </Section>

        <Section icon="edit_note" title="How data changes work">
          <BulletList items={[
            'Any operation that modifies data (INSERT, UPDATE, DELETE, or DDL like CREATE/ALTER) requires your confirmation before executing.',
            'The app shows you exactly what will change -- including affected row counts and example rows -- before you approve.',
            'BigQuery\'s time travel feature allows you to access data as it existed at any point within the past 7 days, providing a safety net for unintended changes.',
          ]} />
        </Section>

        <Section icon="smart_toy" title="What the AI can and cannot do">
          <CanCannotTable />
        </Section>

        <Section icon="payments" title="Cost controls">
          <p style={{ margin: '4px 0 8px' }}>
            The app uses a tier system to manage query costs. Each query is estimated before running,
            and larger queries require your approval.
          </p>
          <CostTierTable />
          <div style={{ marginTop: 12 }}>
            <p style={{ margin: '0 0 4px', fontWeight: 500, color: 'var(--text)', fontSize: 12 }}>How dry-run estimates work</p>
            <p style={{ margin: 0, fontSize: 12 }}>
              Before running any query, the app sends it as a dry run to BigQuery. This returns the estimated
              bytes that would be processed without actually reading any data. The estimate determines which
              cost tier applies and whether confirmation is needed.
            </p>
          </div>
          <div style={{ marginTop: 12 }}>
            <p style={{ margin: '0 0 4px', fontWeight: 500, color: 'var(--text)', fontSize: 12 }}>Setting up budget alerts</p>
            <p style={{ margin: 0, fontSize: 12 }}>
              For ongoing cost monitoring, set up budget alerts in the{' '}
              <a
                href="https://console.cloud.google.com/billing"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--accent)', textDecoration: 'none' }}
              >
                Google Cloud Billing console
              </a>
              . Budgets can send email notifications when spending approaches or exceeds your thresholds.
            </p>
          </div>
        </Section>
      </div>
    </div>
  );
}
