'use client';

import { useState, useEffect, useCallback } from 'react';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { formatBytes, relativeTime, truncateLabel } from '@/lib/format';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OverviewDashboardProps {
  project: string;
  accessToken: string;
  onNavigate: (page: string) => void;
  onPrompt: (text: string) => void;
}

interface ProjectSummary {
  datasetCount: number;
  tableCount: number;
  totalStorageBytes: number;
  recentJobCount: number;
}

interface RecentJob {
  jobId: string;
  statementType: string;
  state: string;
  creationTime: string;
  totalBytesProcessed: number;
  durationMs: number;
  query: string;
  errorMessage: string | null;
}

type SectionState<T> = { status: 'loading' } | { status: 'loaded'; data: T } | { status: 'error'; message: string };

// ---------------------------------------------------------------------------
// BigQuery fetch helpers (uses the user's OAuth token directly)
// ---------------------------------------------------------------------------

const BQ_BASE = 'https://bigquery.googleapis.com/bigquery/v2/projects';

async function bqGet(url: string, token: string): Promise<any> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    throw new Error(String(msg));
  }
  return data;
}

async function bqQuery(sql: string, project: string, token: string): Promise<any> {
  const url = `${BQ_BASE}/${encodeURIComponent(project)}/queries`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query: sql, useLegacySql: false, maxResults: 100 }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    throw new Error(String(msg));
  }
  return data;
}

// ---------------------------------------------------------------------------
// Skeleton placeholders
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div style={{
      background: 'var(--surface-2)',
      borderRadius: 8,
      padding: '12px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      minWidth: 100,
    }}>
      <div style={{ width: 60, height: 11, borderRadius: 4, background: 'var(--border)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div style={{ width: 40, height: 16, borderRadius: 4, background: 'var(--border)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: '0.2s' }} />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0' }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--border)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div style={{ flex: 1, height: 12, borderRadius: 4, background: 'var(--border)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: '0.1s' }} />
      <div style={{ width: 60, height: 12, borderRadius: 4, background: 'var(--border)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: '0.2s' }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error fallback
// ---------------------------------------------------------------------------

function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{
      padding: '16px 20px',
      background: 'var(--surface-2)',
      borderRadius: 8,
      border: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--text-dim)' }}>warning</span>
      <span style={{ flex: 1, fontSize: 13, color: 'var(--text-muted)' }}>{message}</span>
      <button
        onClick={onRetry}
        style={{
          background: 'none',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '4px 12px',
          fontSize: 12,
          color: 'var(--accent)',
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
      >
        Retry
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick action card
// ---------------------------------------------------------------------------

interface QuickAction {
  icon: string;
  label: string;
  description: string;
  onClick: () => void;
}

function ActionCard({ icon, label, description, onClick }: QuickAction) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '16px 18px',
        cursor: 'pointer',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        flex: '1 1 180px',
        minWidth: 160,
        transition: 'border-color 0.15s, box-shadow 0.15s',
        fontFamily: "'Google Sans', sans-serif",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--accent)';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(26, 115, 232, 0.08)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--accent)' }}>{icon}</span>
      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{description}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Job status icon
// ---------------------------------------------------------------------------

function JobStatusIcon({ state }: { state: string }) {
  if (state === 'DONE') {
    return <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--positive)' }}>check_circle</span>;
  }
  if (state === 'RUNNING') {
    return <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--accent)' }}>pending</span>;
  }
  return <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--issue)' }}>error</span>;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function OverviewDashboard({ project, accessToken, onNavigate, onPrompt }: OverviewDashboardProps) {
  const [summary, setSummary] = useState<SectionState<ProjectSummary>>({ status: 'loading' });
  const [recentJobs, setRecentJobs] = useState<SectionState<RecentJob[]>>({ status: 'loading' });

  // -- Fetch project summary --
  const fetchSummary = useCallback(async () => {
    setSummary({ status: 'loading' });
    try {
      // Fetch datasets list
      const dsData = await bqGet(
        `${BQ_BASE}/${encodeURIComponent(project)}/datasets?maxResults=200`,
        accessToken,
      );
      const datasets: Array<{ datasetId: string; location: string }> = (dsData.datasets || []).map((ds: any) => ({
        datasetId: ds.datasetReference?.datasetId || '',
        location: (ds.location || 'US').toLowerCase(),
      }));

      const datasetCount = datasets.length;

      // Pick a region from the first dataset for INFORMATION_SCHEMA queries
      const region = datasets[0]?.location || 'us';

      // Fetch table count and storage in parallel
      const [tableCountResult, storageResult, jobCountResult] = await Promise.allSettled([
        bqQuery(
          `SELECT COUNT(*) AS cnt FROM \`${project}\`.region-${region}.INFORMATION_SCHEMA.TABLES`,
          project,
          accessToken,
        ),
        bqQuery(
          `SELECT COALESCE(SUM(total_logical_bytes), 0) AS total_bytes FROM \`${project}\`.region-${region}.INFORMATION_SCHEMA.TABLE_STORAGE`,
          project,
          accessToken,
        ),
        bqQuery(
          `SELECT COUNT(*) AS cnt FROM \`${project}\`.region-${region}.INFORMATION_SCHEMA.JOBS_BY_PROJECT WHERE creation_time > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)`,
          project,
          accessToken,
        ),
      ]);

      const tableCount = tableCountResult.status === 'fulfilled'
        ? parseInt(tableCountResult.value.rows?.[0]?.f?.[0]?.v || '0', 10)
        : 0;

      const totalStorageBytes = storageResult.status === 'fulfilled'
        ? parseInt(storageResult.value.rows?.[0]?.f?.[0]?.v || '0', 10)
        : 0;

      const recentJobCount = jobCountResult.status === 'fulfilled'
        ? parseInt(jobCountResult.value.rows?.[0]?.f?.[0]?.v || '0', 10)
        : 0;

      setSummary({
        status: 'loaded',
        data: { datasetCount, tableCount, totalStorageBytes, recentJobCount },
      });
    } catch (err: any) {
      const msg = err?.message || 'Unknown error';
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('access denied')) {
        setSummary({ status: 'error', message: 'Missing permissions. Ensure the BigQuery Data Viewer and Job User roles are granted.' });
      } else {
        setSummary({ status: 'error', message: `Could not load project summary: ${msg}` });
      }
    }
  }, [project, accessToken]);

  // -- Fetch recent jobs --
  const fetchRecentJobs = useCallback(async () => {
    setRecentJobs({ status: 'loading' });
    try {
      // Detect region from datasets
      const dsData = await bqGet(
        `${BQ_BASE}/${encodeURIComponent(project)}/datasets?maxResults=1`,
        accessToken,
      );
      const region = ((dsData.datasets || [])[0]?.location || 'US').toLowerCase();

      const sql = `
        SELECT
          job_id,
          statement_type,
          state,
          creation_time,
          total_bytes_processed,
          TIMESTAMP_DIFF(end_time, start_time, MILLISECOND) AS duration_ms,
          SUBSTR(query, 1, 200) AS query_snippet,
          error_result.reason AS error_reason
        FROM \`${project}\`.\`region-${region}\`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
        WHERE creation_time > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
        ORDER BY creation_time DESC
        LIMIT 10
      `;
      const data = await bqQuery(sql, project, accessToken);
      const rows: RecentJob[] = (data.rows || []).map((r: any) => {
        const f = r.f || [];
        return {
          jobId: f[0]?.v || '',
          statementType: f[1]?.v || '',
          state: f[2]?.v || 'DONE',
          creationTime: f[3]?.v || '',
          totalBytesProcessed: parseInt(f[4]?.v || '0', 10),
          durationMs: parseInt(f[5]?.v || '0', 10),
          query: f[6]?.v || '',
          errorMessage: f[7]?.v || null,
        };
      });
      setRecentJobs({ status: 'loaded', data: rows });
    } catch (err: any) {
      const msg = err?.message || 'Unknown error';
      setRecentJobs({ status: 'error', message: `Could not load recent activity: ${msg}` });
    }
  }, [project, accessToken]);

  useEffect(() => {
    fetchSummary();
    fetchRecentJobs();
  }, [fetchSummary, fetchRecentJobs]);

  // -- Quick actions --
  const quickActions: QuickAction[] = [
    {
      icon: 'chat',
      label: 'Ask a question',
      description: 'Query your data in natural language',
      onClick: () => { onNavigate('chat'); },
    },
    {
      icon: 'dataset',
      label: 'Browse datasets',
      description: 'Explore schemas and table structures',
      onClick: () => { onPrompt('What datasets are available in this project?'); },
    },
    {
      icon: 'verified',
      label: 'Check data quality',
      description: 'Profile tables for nulls, duplicates, freshness',
      onClick: () => { onPrompt('Run a data quality check on my most important tables'); },
    },
    {
      icon: 'payments',
      label: 'View costs',
      description: 'Analyze query costs over the last 7 days',
      onClick: () => { onPrompt('Show me a cost analysis for the last 7 days'); },
    },
    {
      icon: 'download',
      label: 'Export data',
      description: 'Export query results to Sheets or CSV',
      onClick: () => { onPrompt('Export my latest query results to Google Sheets'); },
    },
  ];

  function formatDuration(ms: number): string {
    if (ms <= 0) return '---';
    if (ms < 1000) return `${ms}ms`;
    const secs = ms / 1000;
    if (secs < 60) return `${secs.toFixed(1)}s`;
    const mins = Math.floor(secs / 60);
    const remSecs = Math.round(secs % 60);
    return `${mins}m ${remSecs}s`;
  }

  return (
    <div style={{
      padding: '24px 32px',
      maxWidth: 1000,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 28,
      fontFamily: "'Google Sans', sans-serif",
    }}>

      {/* Section header */}
      <div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500, color: 'var(--text)' }}>
          Project Overview
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
          {project}
        </p>
      </div>

      {/* ============================================================
         Section 1: Project Summary (StatCards)
         ============================================================ */}
      {summary.status === 'loading' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}
      {summary.status === 'error' && (
        <SectionError message={summary.message} onRetry={fetchSummary} />
      )}
      {summary.status === 'loaded' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <StatCard
            label="Datasets"
            value={summary.data.datasetCount.toLocaleString()}
            icon="dataset"
          />
          <StatCard
            label="Tables"
            value={summary.data.tableCount.toLocaleString()}
            icon="table_chart"
          />
          <StatCard
            label="Storage"
            value={formatBytes(summary.data.totalStorageBytes)}
            icon="storage"
          />
          <StatCard
            label="Jobs (24h)"
            value={summary.data.recentJobCount.toLocaleString()}
            icon="work_history"
          />
        </div>
      )}

      {/* ============================================================
         Section 2: Recent Activity
         ============================================================ */}
      <div>
        <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>
          Recent Activity
        </h3>

        {recentJobs.status === 'loading' && (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '12px 16px',
          }}>
            {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        )}

        {recentJobs.status === 'error' && (
          <SectionError message={recentJobs.message} onRetry={fetchRecentJobs} />
        )}

        {recentJobs.status === 'loaded' && recentJobs.data.length === 0 && (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '24px 16px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: 13,
          }}>
            No recent jobs found in the last 7 days
          </div>
        )}

        {recentJobs.status === 'loaded' && recentJobs.data.length > 0 && (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={thStyle}>Status</th>
                  <th style={{ ...thStyle, textAlign: 'left' }}>Query</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Duration</th>
                  <th style={thStyle}>Processed</th>
                  <th style={thStyle}>Time</th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.data.map((job) => (
                  <tr
                    key={job.jobId}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    onClick={() => onPrompt(`Show me details for job ${job.jobId}`)}
                  >
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <JobStatusIcon state={job.state} />
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'left', maxWidth: 320 }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        color: 'var(--text-muted)',
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {truncateLabel(job.query || '(no query)', 80)}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <Badge label={job.statementType || '---'} variant="default" size="sm" />
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                      {formatDuration(job.durationMs)}
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                      {formatBytes(job.totalBytesProcessed)}
                    </td>
                    <td style={{ ...tdStyle, fontSize: 11, color: 'var(--text-dim)' }}>
                      {relativeTime(job.creationTime)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============================================================
         Section 3: Quick Actions
         ============================================================ */}
      <div>
        <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>
          Quick Actions
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {quickActions.map((action) => (
            <ActionCard key={action.label} {...action} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table cell styles
// ---------------------------------------------------------------------------

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 11,
  fontWeight: 500,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  textAlign: 'center',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'center',
  whiteSpace: 'nowrap',
  color: 'var(--text)',
};
