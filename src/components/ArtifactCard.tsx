'use client';

import type { CompositionEnvelope, HandoffEnvelope, QualityFlag } from '@/lib/types';
import { SchemaView } from './SchemaView';
import { DataTable } from './DataTable';
import { ConfirmationCard } from './ConfirmationCard';
import { CompletionCard } from './CompletionCard';
import { ChartView } from './ChartView';
import { KpiCard } from './KpiCard';
import { StatRowCard } from './StatRowCard';
import { CostConfirmCard } from './CostConfirmCard';
import { formatBytes } from '@/lib/format';
import { ProvenancePanel } from './ProvenancePanel';
import { DiscoveryView } from './DiscoveryView';
import { DataQualityView } from './DataQualityView';
import { MonitoringView } from './MonitoringView';
import AlertView from './AlertView';
import { DataLoadingView } from './DataLoadingView';
import { CsvUploadView } from './CsvUploadView';
import { MultistepView } from './MultistepView';
import { LineageDagView } from './LineageDagView';
import { ErDiagramView } from './ErDiagramView';
import { StorageBreakdownView } from './StorageBreakdownView';
import { AccessPatternView } from './AccessPatternView';
import { CostAnalysisView } from './CostAnalysisView';
import { FreshnessView } from './FreshnessView';
import { PipelineView } from './PipelineView';
import TaskWorkflowView from './TaskWorkflowView';
import { GovernanceView } from './GovernanceView';
import { InteractiveWidgetView } from './InteractiveWidgetView';
import { BriefingBlock } from './BriefingBlock';
import { DashboardArtifactCard } from './DashboardArtifactCard';
import { useState, useRef, useCallback, useEffect } from 'react';
import { usePreferences } from '@/lib/preferences-context';

interface Props {
  envelope: CompositionEnvelope;
  onConfirm?: () => void;
  onCancel?: () => void;
  onChipClick?: (chip: HandoffEnvelope) => void;
  onInlineClick?: (message: string) => void;
  onSave?: (envelope: CompositionEnvelope) => void;
  onPin?: (envelope: CompositionEnvelope) => void;
  onRunSql?: (sql: string) => void;
  isPinned?: boolean;
}

const TONE_CLASSES: Record<string, string> = {
  NEUTRAL: 'tone-neutral',
  POSITIVE: 'tone-positive',
  ATTENTION: 'tone-attention',
};

export function ArtifactCard({ envelope, onConfirm, onCancel, onChipClick, onInlineClick, onSave, onPin, onRunSql, isPinned }: Props) {

  const toneClass = TONE_CLASSES[envelope.headline.tone] ?? 'tone-neutral';

  // All hooks must be called unconditionally (React rules of hooks)
  const { showProvenance, showSuggestions } = usePreferences();
  const [dismissedFlags, setDismissedFlags] = useState<Set<number>>(new Set());
  const [sqlOpen, setSqlOpen] = useState(false);
  const [sqlEditing, setSqlEditing] = useState(false);
  const [editedSql, setEditedSql] = useState(envelope.provenance.sql ?? '');
  const sqlTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [kebabOpen, setKebabOpen] = useState(false);
  const kebabRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!kebabOpen) return;
    function handleClick(e: MouseEvent) {
      if (kebabRef.current && !kebabRef.current.contains(e.target as Node)) {
        setKebabOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [kebabOpen]);

  const autoSizeTextarea = useCallback(() => {
    const ta = sqlTextareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 300) + 'px';
  }, []);

  // Convert chip click -> send the chip's label as a message (primary path)
  function handleInlineClick(message: string) {
    if (onInlineClick) {
      onInlineClick(message);
    } else {
      const syntheticChip: HandoffEnvelope = {
        targetSkill: 'query',
        label: message,
        context: {},
        sourceSkill: envelope.skill,
        sourceResultRef: envelope.id,
      };
      onChipClick?.(syntheticChip);
    }
  }

  // ── Custom rendering path: view owns its full layout ──
  if (envelope.presentation === 'custom') {
    return (
      <div
        className={`fade-up ${toneClass}`}
        style={{
          background: '#ffffff',
          border: '1px solid #ECF1FA',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px 20px' }}>
          <CustomArtifact
            envelope={envelope}
            onChipClick={onChipClick}
            onSave={onSave}
            onPin={onPin}
            onRunSql={onRunSql}
            onSendMessage={handleInlineClick}
            onConfirm={onConfirm}
            onCancel={onCancel}
            isPinned={isPinned}
          />
        </div>
      </div>
    );
  }

  // ── Default rendering path: ArtifactCard owns the chrome ──

  const hasExportableData = (() => {
    if (!envelope.provenance.sql) return false;
    const d = envelope.primaryArtifact.data as Record<string, unknown> | undefined;
    return Array.isArray((d as { rows?: unknown })?.rows) && ((d as { rows: unknown[] }).rows.length > 0);
  })();

  const sqlIsModified = editedSql !== (envelope.provenance.sql ?? '');

  // Derive the best BigQuery console URL for this envelope, if any.
  const bqUrl = (() => {
    const base = 'https://console.cloud.google.com/bigquery';
    const prov = envelope.provenance;

    // Job results: deepest link
    if (prov.jobId && prov.project) {
      return `${base}?project=${encodeURIComponent(prov.project)}&j=bq:US:${encodeURIComponent(prov.jobId)}&page=queryresults`;
    }

    // Schema view: link directly to the table / dataset / project
    if (envelope.primaryArtifact.type === 'SCHEMA_VIEW') {
      const d = envelope.primaryArtifact.data as { project?: string; dataset?: string | null; table?: string | null } | undefined;
      if (d?.project) {
        if (d.table && d.dataset) {
          return `${base}?p=${encodeURIComponent(d.project)}&d=${encodeURIComponent(d.dataset)}&t=${encodeURIComponent(d.table)}&page=table`;
        }
        if (d.dataset) {
          return `${base}?p=${encodeURIComponent(d.project)}&d=${encodeURIComponent(d.dataset)}&page=dataset`;
        }
        return `${base}?project=${encodeURIComponent(d.project)}`;
      }
    }

    // Generic: link to the project console if we have a project
    if (prov.project) {
      return `${base}?project=${encodeURIComponent(prov.project)}`;
    }

    return null;
  })();

  return (
    <div
      className={`fade-up ${toneClass}`}
      style={{
        background: '#ffffff',
        border: '1px solid #ECF1FA',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      {/* Headline */}
      <div style={{ padding: '16px 20px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <p style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 500,
            color: '#334155',
            lineHeight: 1.5,
            flex: 1,
          }}>
            {typeof envelope.headline.text === 'string' ? envelope.headline.text : String(envelope.headline.text ?? '')}
          </p>
          {bqUrl && !envelope.requiresConfirmation && envelope.primaryArtifact.type !== 'COMPLETION_CARD' && envelope.primaryArtifact.type !== 'MULTISTEP_VIEW' && envelope.primaryArtifact.type !== 'COST_CONFIRM_CARD' && (
            <a
              href={bqUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="context-action-btn"
              title="Open in BigQuery"
              style={{ flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16, opacity: 0.7 }}>open_in_new</span>
            </a>
          )}
          {onSave && !envelope.requiresConfirmation && envelope.primaryArtifact.type !== 'COMPLETION_CARD' && envelope.primaryArtifact.type !== 'MULTISTEP_VIEW' && envelope.primaryArtifact.type !== 'COST_CONFIRM_CARD' && (
            <button
              className="context-action-btn"
              onClick={() => onSave(envelope)}
              title="Save"
              style={{ flexShrink: 0, marginTop: 1 }}
            >
              <img src="/icons/save.svg" alt="Save" width={16} height={16} style={{ opacity: 0.7 }} />
            </button>
          )}
          {onPin && !envelope.requiresConfirmation && envelope.primaryArtifact.type !== 'COMPLETION_CARD' && envelope.primaryArtifact.type !== 'MULTISTEP_VIEW' && envelope.primaryArtifact.type !== 'COST_CONFIRM_CARD' && (
            <button
              className={`context-action-btn${isPinned ? ' is-active' : ''}`}
              onClick={() => onPin(envelope)}
              title={isPinned ? 'Using as context' : 'Use as context'}
              style={{ flexShrink: 0, marginTop: 1 }}
            >
              <img src="/icons/add_to_context.svg" alt="Add to context" width={16} height={16} style={{ opacity: 0.7 }} />
            </button>
          )}
          {hasExportableData && !envelope.requiresConfirmation && (
            <div ref={kebabRef} style={{ position: 'relative', flexShrink: 0, marginTop: 1 }}>
              <button
                className="context-action-btn"
                onClick={() => setKebabOpen(v => !v)}
                title="More actions"
                aria-label="More actions"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16, opacity: 0.7 }}>more_vert</span>
              </button>
              {kebabOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 4,
                  background: '#fff',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                  minWidth: 160,
                  zIndex: 20,
                  overflow: 'hidden',
                }}>
                  <button
                    onClick={() => {
                      setKebabOpen(false);
                      onChipClick?.({
                        targetSkill: 'data-loading',
                        label: 'Export results',
                        context: { sql: envelope.provenance.sql },
                        sourceSkill: envelope.skill,
                        sourceResultRef: envelope.id,
                      });
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '10px 14px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 400,
                      color: 'var(--text)',
                      fontFamily: 'inherit',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2, #f5f5f5)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--text-muted)' }}>download</span>
                    Export results
                  </button>
                  {/* W3-16: Copy shareable link */}
                  <ShareLinkButton envelope={envelope} onClose={() => setKebabOpen(false)} />
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Briefing -- inside card boundary, below headline */}
      {envelope.briefing?.findings && envelope.briefing.findings.length > 0 && (
        <div style={{ padding: '0 20px 12px', borderBottom: '1px solid #ECF1FA', marginBottom: 4 }}>
          <BriefingBlock briefing={envelope.briefing} />
        </div>
      )}

      <div style={{ padding: '0 20px 16px' }}>
        <Artifact
          envelope={envelope}
          onConfirm={onConfirm}
          onCancel={onCancel}
          onSendMessage={handleInlineClick}
        />



        {/* Quality flags: dismissible data quality annotations */}
        {envelope.qualityFlags && envelope.qualityFlags.length > 0 && (() => {
          const visibleFlags = envelope.qualityFlags!.filter((_, i) => !dismissedFlags.has(i));
          if (visibleFlags.length === 0) return null;
          return (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {envelope.qualityFlags!.map((flag: QualityFlag, i: number) => {
                if (dismissedFlags.has(i)) return null;
                const isWarning = flag.severity === 'warning';
                return (
                  <div
                    key={i}
                    style={{
                      padding: '8px 12px',
                      background: isWarning ? '#fffbeb' : '#f9fafb',
                      border: `1px solid ${isWarning ? '#fde68a' : '#e5e7eb'}`,
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                    }}
                  >
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: isWarning ? '#92400e' : '#6b7280',
                      background: isWarning ? '#fef3c7' : '#f3f4f6',
                      padding: '2px 6px',
                      borderRadius: 4,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      flexShrink: 0,
                      marginTop: 1,
                    }}>
                      {isWarning ? 'Warning' : 'Note'}
                    </span>
                    <p style={{
                      margin: 0,
                      fontSize: 12,
                      color: 'var(--text)',
                      lineHeight: 1.4,
                      flex: 1,
                    }}>
                      {flag.message}
                    </p>
                    <button
                      onClick={() => setDismissedFlags((prev) => new Set([...prev, i]))}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        color: '#9ca3af',
                        fontSize: 16,
                        lineHeight: 1,
                        flexShrink: 0,
                      }}
                      aria-label="Dismiss"
                    >
                      x
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Footer meta: row count + cost + SQL + BigQuery link */}
        {(() => {
          const d = envelope.primaryArtifact.data as Record<string, unknown> | undefined;
          const rowCount = Array.isArray((d as { rows?: unknown })?.rows) ? (d as { rows: unknown[] }).rows.length : null;
          const cost = envelope.provenance.cost;
          const hasSql = !!envelope.provenance.sql;
          if (!rowCount && !cost && !envelope.provenance.jobId && !hasSql) return null;
          return (
            <>
              <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 16, alignItems: 'center' }}>
                {rowCount != null && <span>{rowCount} rows</span>}
                {cost && (
                  <>
                    <span>{formatBytes(cost.totalBytesProcessed)} processed</span>
                    <span>Tier {cost.tier}</span>
                    {envelope.provenance.freshness && <span>{envelope.provenance.freshness}</span>}
                  </>
                )}
                {hasSql && (
                  <button
                    type="button"
                    onClick={() => setSqlOpen(v => !v)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      margin: 0,
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontWeight: 500,
                      fontFamily: 'inherit',
                    }}
                  >
                    <span className="provenance-arrow" style={{ transform: sqlOpen ? 'rotate(90deg)' : undefined, transition: 'transform 0.15s' }}>&#9654;</span>
                    SQL
                  </button>
                )}
                {envelope.provenance.jobId && envelope.provenance.project && (
                  <a
                    href={`https://console.cloud.google.com/bigquery?project=${encodeURIComponent(envelope.provenance.project)}&j=bq:US:${encodeURIComponent(envelope.provenance.jobId)}&page=queryresults`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: '#4f7fff',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                      marginLeft: 'auto',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none'; }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>open_in_new</span>
                    BigQuery
                  </a>
                )}
              </div>
              {hasSql && sqlOpen && (
                <div style={{ paddingTop: 6 }}>
                  {sqlEditing ? (
                    <textarea
                      ref={sqlTextareaRef}
                      className="sql-block-editor"
                      value={editedSql}
                      onChange={(e) => {
                        setEditedSql(e.target.value);
                        autoSizeTextarea();
                      }}
                      spellCheck={false}
                    />
                  ) : (
                    <div className="sql-block">{sqlIsModified ? editedSql : envelope.provenance.sql}</div>
                  )}
                  <div className="sql-action-bar">
                    {!sqlEditing && (
                      <button
                        type="button"
                        className="sql-action-btn"
                        onClick={() => {
                          setSqlEditing(true);
                          // Auto-size after render
                          setTimeout(() => autoSizeTextarea(), 0);
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>edit</span>
                        Edit
                      </button>
                    )}
                    {sqlEditing && (
                      <button
                        type="button"
                        className="sql-action-btn"
                        onClick={() => setSqlEditing(false)}
                      >
                        Done
                      </button>
                    )}
                    {sqlIsModified && (
                      <>
                        {onRunSql && (
                          <button
                            type="button"
                            className="sql-run-btn"
                            onClick={() => {
                              setSqlEditing(false);
                              onRunSql(editedSql);
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>play_arrow</span>
                            Run
                          </button>
                        )}
                        <button
                          type="button"
                          className="sql-action-btn"
                          onClick={() => {
                            setEditedSql(envelope.provenance.sql ?? '');
                            setSqlEditing(false);
                          }}
                        >
                          Reset
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          );
        })()}

        {/* W3-01: Companion artifact for anomalies */}
        {envelope.companionArtifact && (
          <div style={{
            marginTop: 12,
            padding: '10px 14px',
            background: 'rgba(251,146,60,0.06)',
            border: '1px solid rgba(251,146,60,0.25)',
            borderLeft: '3px solid #fb923c',
            borderRadius: 6,
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#fb923c', marginBottom: 6 }}>
              Anomaly detected
            </div>
            <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 8 }}>
              {envelope.companionArtifact.label}
            </div>
            <DataTable result={envelope.companionArtifact.data as import('@/lib/types').QueryResult} onSendMessage={handleInlineClick} />



          </div>
        )}

        {/* Divider before suggestions */}
        {!envelope.requiresConfirmation && showSuggestions && envelope.nextActions.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 12 }} />
        )}

        {/* Next actions */}
        {!envelope.requiresConfirmation && showSuggestions && envelope.nextActions.length > 0 && (
          <div style={{
            marginTop: 10,
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
          }}>
            {envelope.nextActions.slice(0, 5).map((action, i) => {
              // W3-02: Map skill to icon
              const chipIcons: Record<string, string> = {
                'schema': 'table_chart',
                'query': 'search',
                'data-quality': 'verified',
                'monitoring': 'speed',
                'discovery': 'travel_explore',
                'pipeline': 'schedule',
                'governance': 'lock',
                'data-management': 'edit',
                'data-loading': 'upload',
                'alert': 'notifications',
              };
              const icon = chipIcons[action.targetSkill] ?? 'arrow_forward';
              return (
                <button
                  key={i}
                  className="chip"
                  onClick={() => onChipClick?.(action)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 13, lineHeight: 1 }}>{icon}</span>
                  {action.label}
                </button>
              );
            })}

            {(envelope.skill === 'query' || envelope.skill === 'schema' || envelope.skill === 'data-quality' || envelope.skill === 'monitoring') && (
              <button
                className="chip"
                onClick={() => {
                  const d = envelope.primaryArtifact?.data as Record<string, unknown> | undefined;
                  const sql = (d?.sql as string) || '';
                  const cols = (d?.columns as string[]) || [];
                  const rowCount = (d?.rowCount as number) || 0;
                  const insightPrompt = sql
                    ? `Analyze and generate insights about these query results. The SQL was: ${sql}. Columns returned: ${cols.join(', ')}. Total rows: ${rowCount}. Tell me what patterns, anomalies, or notable findings you see in this data.`
                    : 'Generate insights about these results';
                  handleInlineClick(insightPrompt);
                }}
              >
                Generate insights
              </button>
            )}
          </div>
        )}

        {/* Fallback: suggest next steps */}
        {!envelope.requiresConfirmation && showSuggestions && envelope.nextActions.length === 0 && (() => {
          // Build a context-aware fallback message instead of a generic one
          const data = envelope.primaryArtifact.data as Record<string, unknown> | null;
          const tbl = data?.table as string | undefined;
          const ds = data?.dataset as string | undefined;
          const fallbackMsg = tbl
            ? `What are some useful queries I can run on ${ds ? `${ds}.` : ''}${tbl}?`
            : 'What can I do next with these results?';
          return (
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="chip"
              style={{ opacity: 0.7, fontSize: 11 }}
              onClick={() => handleInlineClick(fallbackMsg)}
            >
              Suggest next steps
            </button>
            {(envelope.skill === 'query' || envelope.skill === 'schema' || envelope.skill === 'data-quality' || envelope.skill === 'monitoring') && (
              <button
                className="chip"
                onClick={() => {
                  const d = envelope.primaryArtifact?.data as Record<string, unknown> | undefined;
                  const sql = (d?.sql as string) || '';
                  const cols = (d?.columns as string[]) || [];
                  const rowCount = (d?.rowCount as number) || 0;
                  const insightPrompt = sql
                    ? `Analyze and generate insights about these query results. The SQL was: ${sql}. Columns returned: ${cols.join(', ')}. Total rows: ${rowCount}. Tell me what patterns, anomalies, or notable findings you see in this data.`
                    : 'Generate insights about these results';
                  handleInlineClick(insightPrompt);
                }}
              >
                Generate insights
              </button>
            )}
          </div>
          );
        })()}

        {/* Provenance panel -- deep-dive into how this result was computed */}
        {showProvenance && (
          <ProvenancePanel
            envelope={envelope}
            defaultExpanded={envelope.provenance.visibility === 'VISIBLE' || envelope.skill === 'monitoring' || envelope.skill === 'discovery'}
          />
        )}
      </div>

    </div>
  );
}

function Artifact({
  envelope,
  onConfirm,
  onCancel,
  onSendMessage,
}: {
  envelope: CompositionEnvelope;
  onConfirm?: () => void;
  onCancel?: () => void;
  onSendMessage: (msg: string) => void;
}) {
  const { type, data } = envelope.primaryArtifact;

  switch (type) {
    case 'SCHEMA_VIEW':
      return <SchemaView result={data as import('@/lib/types').SchemaResult} onSendMessage={onSendMessage} />;
    case 'TABLE':
      return <DataTable result={data as import('@/lib/types').QueryResult} emphasis={envelope.primaryArtifact.emphasis} onSendMessage={onSendMessage} />;
    case 'LINE_CHART':
    case 'BAR_CHART':
    case 'AREA_CHART':
    case 'SCATTER':
    case 'PIE_CHART':
    case 'DONUT_CHART':
    case 'COLUMN_CHART':
    case 'HISTOGRAM':
    case 'SPARKLINE':
    case 'RADAR':
    case 'FUNNEL':
    case 'TREEMAP':
    case 'SANKEY':
    case 'COMPOSED_CHART':
    case 'GAUGE':
    case 'HEATMAP':
    case 'BOXPLOT':
    case 'CANDLESTICK':
    case 'VIOLIN':
    case 'DENSITY_PLOT':
    case 'RIDGELINE':
    case 'NETWORK_GRAPH':
    case 'TILE_MAP':
    case 'GEO_POINT_MAP':
    case 'USA_MAP':
    case 'WORLD_MAP':
      return <ChartWithToggle result={data as import('@/lib/types').QueryResult} chartType={type} onSendMessage={onSendMessage} />;
    case 'KPI_CARD':
      return <KpiCard result={data as import('@/lib/types').QueryResult} />;
    case 'STAT_ROW':
      return <StatRowCard result={data as import('@/lib/types').QueryResult} />;

    case 'CONFIRMATION_CARD':
      return <ConfirmationCard result={data as import('@/lib/types').DataManagementConfirmResult} onConfirm={onConfirm} onCancel={onCancel} />;
    case 'COMPLETION_CARD':
      return <CompletionCard result={data as import('@/lib/types').DataManagementCompleteResult} />;
    case 'CONVERSATION':
      return null;
    case 'COST_CONFIRM_CARD':
      return <CostConfirmCard result={data as import('@/lib/types').CostEstimate} onConfirm={onConfirm} onCancel={onCancel} />;
    case 'DISCOVERY_VIEW':
      return <DiscoveryView result={data as import('@/lib/types').DiscoveryResult} onSendMessage={onSendMessage} />;
    case 'DATA_QUALITY_VIEW':
      return <DataQualityView result={data as import('@/lib/types').DataQualityResult} onSendMessage={onSendMessage} />;
    case 'ALERT_VIEW':
      return <AlertView data={data as import('@/lib/types').AlertResult} onAction={onSendMessage} />;
    case 'MONITORING_VIEW':
      return <MonitoringView result={data as import('@/lib/types').MonitoringResult} onSendMessage={onSendMessage} />;
    case 'DATA_LOADING_VIEW':
      return <DataLoadingView result={data as import('@/lib/types').DataLoadingResult} />;
    case 'CSV_UPLOAD_VIEW':
      return <CsvUploadView result={data as import('@/lib/types').DataLoadingResult} onSendMessage={onSendMessage} />;
    case 'MULTISTEP_VIEW':
      return <MultistepView envelope={envelope} onSendMessage={onSendMessage} />;
    case 'LINEAGE_DAG_VIEW':
      return <LineageDagView result={data as import('@/lib/types').DiscoveryResult} onSendMessage={onSendMessage} />;
    case 'ER_DIAGRAM_VIEW': {
      const erData = (data as import('@/lib/types').DiscoveryResult).erDiagram;
      if (!erData) return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No ER diagram data available</p>;
      return <ErDiagramView data={erData} onSendMessage={onSendMessage} />;
    }
    case 'STORAGE_VIEW':
      return <StorageBreakdownView result={data as import('@/lib/types').StorageBreakdownResult} onSendMessage={onSendMessage} />;
    case 'ACCESS_PATTERN_VIEW':
      return <AccessPatternView result={data as import('@/lib/types').AccessPatternResult} onSendMessage={onSendMessage} />;
    case 'COST_ANALYSIS_VIEW':
      return <CostAnalysisView result={data as import('@/lib/types').CostAnalysisResult} onSendMessage={onSendMessage} />;
    case 'FRESHNESS_VIEW':
      return <FreshnessView result={data as import('@/lib/types').FreshnessResult} onSendMessage={onSendMessage} />;
    case 'PIPELINE_VIEW':
      return <PipelineView result={data as import('@/lib/types').PipelineResult} onSendMessage={onSendMessage} />;
    case 'TASK_VIEW':
      return <TaskWorkflowView envelope={envelope} onSendMessage={onSendMessage} />;
    case 'GOVERNANCE_VIEW':
      // Governance uses presentation: 'custom' and routes through CustomArtifact.
      // This case should not be reached; fallback to raw JSON if it somehow is.
      return <pre style={{ fontSize: 11, color: 'var(--text-muted)', overflowX: 'auto' }}>{JSON.stringify(data, null, 2)}</pre>;
    default:
      return (
        <pre style={{ fontSize: 11, color: 'var(--text-muted)', overflowX: 'auto' }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      );
  }
}

// --- Chart <-> Table toggle ---
type ChartToggleType =
  | 'LINE_CHART' | 'BAR_CHART' | 'AREA_CHART' | 'SCATTER' | 'PIE_CHART'
  | 'DONUT_CHART' | 'COLUMN_CHART' | 'HISTOGRAM' | 'SPARKLINE'
  | 'RADAR' | 'FUNNEL' | 'TREEMAP' | 'SANKEY' | 'COMPOSED_CHART'
  | 'GAUGE' | 'HEATMAP' | 'BOXPLOT' | 'CANDLESTICK'
  | 'VIOLIN' | 'DENSITY_PLOT' | 'RIDGELINE' | 'NETWORK_GRAPH' | 'TILE_MAP'
  | 'GEO_POINT_MAP' | 'USA_MAP' | 'WORLD_MAP';

function ChartWithToggle({
  result,
  chartType,
  onSendMessage,
}: {
  result: import('@/lib/types').QueryResult;
  chartType: ChartToggleType;
  onSendMessage: (msg: string) => void;
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Toggle pill */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div
          style={{
            display: 'inline-flex',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: 2,
            gap: 2,
          }}
        >
          {(['chart', 'table'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '3px 12px',
                borderRadius: 16,
                fontSize: 11,
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s',
                background: view === v ? 'var(--accent, #4f7fff)' : 'transparent',
                color: view === v ? '#fff' : 'var(--text-muted)',
              }}
            >
              {v === 'chart' ? '\u25B2 Chart' : '\u229E Table'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {view === 'chart' ? (
        <ChartView result={result} chartType={chartType} onSendMessage={onSendMessage} />
      ) : (
        <DataTable result={result} onSendMessage={onSendMessage} />
      )}
    </div>
  );
}


// ── Custom rendering dispatcher ──────────────────────────────────────────────
// Routes to view components that own their full layout (presentation: 'custom').
// Each view receives the full envelope + all action callbacks.

function CustomArtifact(props: import('@/lib/types').CustomViewProps) {
  const { type } = props.envelope.primaryArtifact;
  switch (type) {
    case 'GOVERNANCE_VIEW':
      return <GovernanceView {...props} />;
    case 'INTERACTIVE_WIDGET':
      return <InteractiveWidgetView {...props} />;
    case 'DASHBOARD_VIEW':
      return <DashboardArtifactCard {...props} />;
    default:
      // Fallback: render as standard Artifact (shouldn't happen in practice)
      return (
        <pre style={{ fontSize: 11, color: 'var(--text-muted)', overflowX: 'auto' }}>
          {JSON.stringify(props.envelope.primaryArtifact.data, null, 2)}
        </pre>
      );
  }
}

// W3-16: Share link button — writes to sharedArtifacts/{id} and copies URL
function ShareLinkButton({ envelope, onClose }: { envelope: CompositionEnvelope; onClose: () => void }) {
  const [state, setState] = useState<'idle' | 'loading' | 'copied' | 'error'>('idle');

  const handleShare = async () => {
    setState('loading');
    try {
      const { doc, setDoc, collection } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      const id = `share_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      await setDoc(doc(collection(db, 'sharedArtifacts'), id), {
        id,
        envelopeId: envelope.id,
        skill: envelope.skill,
        headline: envelope.headline.text,
        primaryArtifactType: envelope.primaryArtifact.type,
        // Store a serializable subset of data — not the full data payload to limit size
        sql: envelope.provenance?.sql ?? null,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      });
      const url = `${window.location.origin}/shared#${id}`;
      await navigator.clipboard.writeText(url);
      setState('copied');
      onClose();
      setTimeout(() => setState('idle'), 2000);
    } catch {
      setState('error');
      setTimeout(() => setState('idle'), 2000);
    }
  };

  return (
    <button
      onClick={handleShare}
      disabled={state === 'loading'}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        width: '100%', padding: '10px 14px',
        background: 'none', border: 'none', cursor: state === 'loading' ? 'wait' : 'pointer',
        fontSize: 13, fontWeight: 400, color: state === 'copied' ? '#00897b' : state === 'error' ? '#c62828' : 'var(--text)',
        fontFamily: 'inherit', textAlign: 'left',
      }}
      onMouseEnter={(e) => { if (state === 'idle') e.currentTarget.style.background = 'var(--surface-2, #f5f5f5)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--text-muted)' }}>
        {state === 'copied' ? 'check' : state === 'error' ? 'error' : 'link'}
      </span>
      {state === 'loading' ? 'Creating link...' : state === 'copied' ? 'Copied!' : state === 'error' ? 'Failed' : 'Copy link'}
    </button>
  );
}
