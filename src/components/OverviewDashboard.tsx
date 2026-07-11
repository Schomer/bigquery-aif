'use client';

import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/Badge';
import { formatBytes, relativeTime, truncateLabel } from '@/lib/format';
import { getConversations, type SavedConversation } from '@/lib/firestore-service';
import { getArtifacts, type SavedArtifact } from '@/lib/saved-work';
import { useAuth } from '@/lib/auth-context';
import { useConversation } from '@/lib/conversation-context';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OverviewDashboardProps {
  project: string;
  accessToken: string;
  onNavigate: (page: string) => void;
  onPrompt: (text: string) => void;
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

interface RecentChart {
  conversationId: string;
  conversationTitle: string;
  headline: string;
  chartType: string;
  updatedAt: string;
}

type SectionState<T> = { status: 'loading' } | { status: 'loaded'; data: T } | { status: 'error'; message: string };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_ICONS: Record<string, string> = {
  query: 'query_stats',
  workflow: 'conversion_path',
  pipeline: 'schedule',
  app: 'apps',
};

const CHART_ICON = 'bar_chart';

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
// Chart extraction helper
// ---------------------------------------------------------------------------

function extractRecentCharts(conversations: SavedConversation[], limit: number): RecentChart[] {
  const charts: RecentChart[] = [];
  for (const conv of conversations) {
    if (charts.length >= limit) break;
    for (const msg of conv.messages) {
      if (charts.length >= limit) break;
      if (msg.role !== 'assistant' || !msg.envelopes) continue;
      for (const env of msg.envelopes) {
        if (charts.length >= limit) break;
        const artType = env.primaryArtifact?.type;
        if (typeof artType === 'string' && artType.includes('chart')) {
          charts.push({
            conversationId: conv.id,
            conversationTitle: conv.title || 'Untitled conversation',
            headline: env.headline?.text || 'Chart',
            chartType: artType,
            updatedAt: msg.timestamp || conv.updatedAt || conv.createdAt,
          });
        }
      }
    }
  }
  return charts;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function OverviewDashboard({ project, accessToken, onNavigate, onPrompt }: OverviewDashboardProps) {
  const { user } = useAuth();
  const { loadConversation } = useConversation();

  const [recentJobs, setRecentJobs] = useState<SectionState<RecentJob[]>>({ status: 'loading' });
  const [recentCharts, setRecentCharts] = useState<SectionState<RecentChart[]>>({ status: 'loading' });
  const [savedItems, setSavedItems] = useState<SectionState<SavedArtifact[]>>({ status: 'loading' });

  // -- Fetch recent charts from conversations --
  const fetchRecentCharts = useCallback(async () => {
    if (!user) return;
    setRecentCharts({ status: 'loading' });
    try {
      const conversations = await getConversations(user.uid);
      const charts = extractRecentCharts(conversations, 6);
      setRecentCharts({ status: 'loaded', data: charts });
    } catch (err: any) {
      setRecentCharts({ status: 'error', message: err?.message || 'Could not load recent charts' });
    }
  }, [user]);

  // -- Fetch saved artifacts --
  const fetchSavedItems = useCallback(async () => {
    if (!user) return;
    setSavedItems({ status: 'loading' });
    try {
      const artifacts = await getArtifacts(user.uid);
      setSavedItems({ status: 'loaded', data: artifacts.slice(0, 6) });
    } catch (err: any) {
      setSavedItems({ status: 'error', message: err?.message || 'Could not load saved items' });
    }
  }, [user]);

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
    fetchRecentJobs();
    if (user) {
      fetchRecentCharts();
      fetchSavedItems();
    }
  }, [fetchRecentJobs, fetchRecentCharts, fetchSavedItems, user]);

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
         Section 1: Recent Charts
         ============================================================ */}
      {user && (
        <div>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>
            Recent Charts
          </h3>

          {recentCharts.status === 'loading' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          )}

          {recentCharts.status === 'error' && (
            <SectionError message={recentCharts.message} onRetry={fetchRecentCharts} />
          )}

          {recentCharts.status === 'loaded' && recentCharts.data.length === 0 && (
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '24px 16px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 13,
            }}>
              No charts found in recent conversations
            </div>
          )}

          {recentCharts.status === 'loaded' && recentCharts.data.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {recentCharts.data.map((chart, i) => (
                <button
                  key={`${chart.conversationId}-${i}`}
                  onClick={() => { loadConversation(chart.conversationId); onNavigate('chat'); }}
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
                    maxWidth: 320,
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
                  <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--accent)' }}>{CHART_ICON}</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {truncateLabel(chart.headline, 40)}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {truncateLabel(chart.conversationTitle, 36)}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    {relativeTime(chart.updatedAt)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================
         Section 2: Recently Saved
         ============================================================ */}
      {user && (
        <div>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>
            Recently Saved
          </h3>

          {savedItems.status === 'loading' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          )}

          {savedItems.status === 'error' && (
            <SectionError message={savedItems.message} onRetry={fetchSavedItems} />
          )}

          {savedItems.status === 'loaded' && savedItems.data.length === 0 && (
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '24px 16px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 13,
            }}>
              No saved items yet
            </div>
          )}

          {savedItems.status === 'loaded' && savedItems.data.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {savedItems.data.map((artifact) => (
                <button
                  key={artifact.id}
                  onClick={() => { onPrompt(`run my ${artifact.name}`); }}
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
                    maxWidth: 320,
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
                  <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--accent)' }}>
                    {TYPE_ICONS[artifact.type] || 'description'}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {truncateLabel(artifact.name, 36)}
                  </span>
                  {artifact.description && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {truncateLabel(artifact.description, 50)}
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    {relativeTime(artifact.updatedAt || artifact.createdAt)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================
         Section 3: Recent Activity
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
         Section 4: Quick Actions
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
