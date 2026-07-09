'use client';

import type { PipelineResult } from '@/lib/types';
import { Badge } from './ui/Badge';
import { StatCard } from './ui/StatCard';
import { relativeTime } from '@/lib/format';
import { useState } from 'react';

interface Props {
  result: PipelineResult;
  onSendMessage: (msg: string) => void;
}

// -- Status badge mapping -----------------------------------------------------

function stateVariant(state: string): 'success' | 'warning' | 'error' | 'info' | 'default' {
  const s = (state || '').toUpperCase();
  if (s === 'SUCCEEDED' || s === 'ACTIVE') return 'success';
  if (s === 'PENDING' || s === 'RUNNING' || s === 'TRANSFER_STATE_PENDING') return 'info';
  if (s === 'FAILED' || s === 'CANCELLED' || s === 'ERROR') return 'error';
  if (s === 'INACTIVE' || s === 'DISABLED') return 'warning';
  return 'default';
}

function stateLabel(state: string): string {
  const s = (state || '').toUpperCase();
  if (s === 'TRANSFER_STATE_PENDING') return 'Pending';
  // Clean up enum-style names
  return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');
}

// -- Main component -----------------------------------------------------------

export function PipelineView({ result, onSendMessage }: Props) {
  const { pipelineType } = result;

  if (pipelineType === 'LIST_SCHEDULES') {
    return <ScheduleList result={result} onSendMessage={onSendMessage} />;
  }
  if (pipelineType === 'SCHEDULE_DETAILS') {
    return <ScheduleDetails result={result} onSendMessage={onSendMessage} />;
  }
  if (pipelineType === 'CREATE_PIPELINE') {
    return <PipelineConfirmation result={result} onSendMessage={onSendMessage} />;
  }
  if (pipelineType === 'UPDATE_SCHEDULE' || pipelineType === 'DELETE_SCHEDULE') {
    return <ActionResult result={result} />;
  }
  if (pipelineType === 'RUN_HISTORY') {
    return <RunHistory result={result} onSendMessage={onSendMessage} />;
  }

  return <ActionResult result={result} />;
}

// -- Schedule List ------------------------------------------------------------

function ScheduleList({ result, onSendMessage }: Props) {
  const schedules = result.schedules || [];

  if (schedules.length === 0) {
    return (
      <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>
        {result.confirmation?.sql || 'No scheduled queries found in this project.'}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Schedule</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Next Run</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((s, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={tdStyle}>
                  <button
                    onClick={() => onSendMessage(`show details for schedule "${s.displayName}"`)}
                    style={linkBtnStyle}
                  >
                    {s.displayName}
                  </button>
                </td>
                <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  {s.schedule}
                </td>
                <td style={tdStyle}>
                  <Badge variant={stateVariant(s.state)} size="sm" label={stateLabel(s.state)} />
                </td>
                <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>
                  {s.nextRunTime ? relativeTime(s.nextRunTime) : '--'}
                </td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => onSendMessage(`show run history for "${s.displayName}"`)}
                      style={actionBtnStyle}
                      title="Run history"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>history</span>
                    </button>
                    <button
                      onClick={() => onSendMessage(`show details for schedule "${s.displayName}"`)}
                      style={actionBtnStyle}
                      title="Details"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>info</span>
                    </button>
                    <button
                      onClick={() => onSendMessage(`delete the schedule "${s.displayName}"`)}
                      style={{ ...actionBtnStyle, color: '#dc2626' }}
                      title="Delete"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -- Schedule Details ---------------------------------------------------------

function ScheduleDetails({ result, onSendMessage }: Props) {
  const schedule = result.schedules?.[0];
  const runs = result.runs || [];
  const [showSql, setShowSql] = useState(false);

  if (!schedule) {
    return (
      <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>
        {result.confirmation?.sql || 'Schedule not found.'}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
        <StatCard label="Schedule" value={schedule.schedule} />
        <StatCard label="Status" value={stateLabel(schedule.state)} />
        {schedule.nextRunTime && (
          <StatCard label="Next Run" value={relativeTime(schedule.nextRunTime)} />
        )}
        {schedule.destinationTable && (
          <StatCard label="Destination" value={schedule.destinationTable} mono />
        )}
      </div>

      {/* SQL preview */}
      {schedule.sql && (
        <div>
          <button
            onClick={() => setShowSql(v => !v)}
            style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              fontSize: 12, color: 'var(--text-muted)', fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit',
            }}
          >
            <span style={{ transform: showSql ? 'rotate(90deg)' : undefined, transition: 'transform 0.15s', fontSize: 10 }}>&#9654;</span>
            SQL
          </button>
          {showSql && (
            <div className="sql-block" style={{ marginTop: 6 }}>
              {schedule.sql}
            </div>
          )}
        </div>
      )}

      {/* Run history */}
      {runs.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
            Recent Runs ({runs.length})
          </div>
          <RunTable runs={runs} />
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="chip" onClick={() => onSendMessage(`show run history for "${schedule.displayName}"`)}>
          Full run history
        </button>
        <button className="chip" onClick={() => onSendMessage(`delete the schedule "${schedule.displayName}"`)}>
          Delete schedule
        </button>
      </div>
    </div>
  );
}

// -- Pipeline Confirmation (CREATE) -------------------------------------------

function PipelineConfirmation({ result, onSendMessage }: Props) {
  const conf = result.confirmation as { action: string; sql?: string; schedule?: string; estimatedCostPerRun?: string } | undefined;

  if (!conf) {
    return <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No pipeline details available.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Pipeline flow visualization */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 16px',
        background: 'var(--surface-2)',
        borderRadius: 8,
        border: '1px solid var(--border)',
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--text-muted)' }}>database</span>
        <span style={{ fontSize: 12, fontWeight: 500 }}>Source</span>
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--text-muted)' }}>arrow_forward</span>
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--text-muted)' }}>transform</span>
        <span style={{ fontSize: 12, fontWeight: 500 }}>Transform</span>
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--text-muted)' }}>arrow_forward</span>
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--text-muted)' }}>table_chart</span>
        <span style={{ fontSize: 12, fontWeight: 500 }}>Destination</span>
      </div>

      {/* Details */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
        {conf.schedule && <StatCard label="Schedule" value={conf.schedule} />}
        {conf.estimatedCostPerRun && <StatCard label="Est. Cost / Run" value={conf.estimatedCostPerRun} />}
      </div>

      {/* SQL */}
      {conf.sql && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
            Pipeline SQL
          </div>
          <div className="sql-block">{conf.sql}</div>
        </div>
      )}

      {/* Confirm/Edit actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          className="chip"
          style={{ background: 'var(--accent, #4f7fff)', color: '#fff', border: 'none' }}
          onClick={() => onSendMessage(`schedule this query: ${conf.sql} to run ${conf.schedule}`)}
        >
          Create schedule
        </button>
        <button className="chip" onClick={() => onSendMessage('edit the pipeline SQL')}>
          Edit SQL
        </button>
      </div>
    </div>
  );
}

// -- Action Result (update/delete) --------------------------------------------

function ActionResult({ result }: { result: PipelineResult }) {
  const conf = result.confirmation;
  const message = conf?.sql || 'Operation completed.';
  const isError = conf?.action === 'ERROR' || conf?.action === 'NOT_FOUND';

  return (
    <div style={{
      fontSize: 13,
      color: isError ? '#dc2626' : 'var(--text)',
      padding: '8px 0',
      lineHeight: 1.5,
      whiteSpace: 'pre-wrap',
    }}>
      {message}
    </div>
  );
}

// -- Run History --------------------------------------------------------------

function RunHistory({ result, onSendMessage }: Props) {
  const runs = result.runs || [];
  const schedules = result.schedules || [];

  if (runs.length === 0 && result.confirmation) {
    return (
      <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>
        {result.confirmation.sql || 'No run history found.'}
      </div>
    );
  }

  const successCount = runs.filter(r => r.state === 'SUCCEEDED').length;
  const failedCount = runs.filter(r => r.state === 'FAILED').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
        <StatCard label="Total Runs" value={String(runs.length)} />
        <StatCard label="Succeeded" value={String(successCount)} color={successCount > 0 ? '#16a34a' : undefined} />
        <StatCard label="Failed" value={String(failedCount)} color={failedCount > 0 ? '#dc2626' : undefined} />
      </div>

      {/* Schedule name */}
      {schedules.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Schedule: {schedules.map(s => s.displayName).join(', ')}
        </div>
      )}

      {/* Runs table */}
      <RunTable runs={runs} />

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="chip" onClick={() => onSendMessage('show my scheduled queries')}>
          All schedules
        </button>
      </div>
    </div>
  );
}

// -- Run Table (shared) -------------------------------------------------------

function RunTable({ runs }: { runs: NonNullable<PipelineResult['runs']> }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Started</th>
            <th style={thStyle}>Duration</th>
            <th style={thStyle}>Error</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run, i) => {
            const start = run.startTime ? new Date(run.startTime) : null;
            const end = run.endTime ? new Date(run.endTime) : null;
            const duration = start && end
              ? formatDuration(end.getTime() - start.getTime())
              : '--';

            return (
              <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={tdStyle}>
                  <Badge variant={stateVariant(run.state)} size="sm" label={stateLabel(run.state)} />
                </td>
                <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>
                  {start ? relativeTime(run.startTime) : '--'}
                </td>
                <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  {duration}
                </td>
                <td style={{
                  ...tdStyle,
                  color: run.errorStatus ? '#dc2626' : 'var(--text-muted)',
                  maxWidth: 200,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {run.errorStatus || '--'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// -- Helpers ------------------------------------------------------------------

function formatDuration(ms: number): string {
  if (ms < 1000) return '<1s';
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins < 60) return `${mins}m ${remSecs}s`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m`;
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  verticalAlign: 'middle',
};

const linkBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  color: '#4f7fff',
  fontSize: 12,
  fontWeight: 500,
  textAlign: 'left',
  fontFamily: 'inherit',
};

const actionBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: '2px 4px',
  cursor: 'pointer',
  color: 'var(--text-muted)',
  borderRadius: 4,
  display: 'inline-flex',
  alignItems: 'center',
};
