'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { SparkSpinner } from '@/components/SparkSpinner';
import { ArtifactCard } from '@/components/ArtifactCard';
import { EmptyCanvasAnimation } from '@/components/EmptyCanvasAnimation';
import { InlineCostConfirm, InlineDmlConfirm } from './InlineConfirmation';
import { formatBytes } from '@/lib/format';
import type {
  ChatMessage,
  CompositionEnvelope,
  CostEstimate,
  DataManagementConfirmResult,
  StepInfo,
  HandoffEnvelope,
  ContextItem,
} from '@/lib/types';
import type { ChatError } from '@/hooks/useChatOrchestration';
import { CrystalBallThinking, ErrorCard, RegenerateButton } from './ChatThread';
import { ChatInput } from './ChatInput';
import type { RecentItem } from '@/lib/firestore-service';

// ---- Helper functions -------------------------------------------------------

function artifactIcon(type: string, data?: any): string {
  if (type === 'TABLE') return 'table_chart';
  if (type === 'SCHEMA_VIEW') {
    if (data?.scope === 'TABLE') return 'table_chart';
    if (data?.scope === 'DATASET') return 'dataset';
    return 'schema';
  }
  if (type === 'KPI_CARD') return 'speed';
  if (type === 'DATA_QUALITY_VIEW') return 'verified';
  if (type === 'DISCOVERY_VIEW') return 'explore';
  if (type === 'MONITORING_VIEW') return 'monitoring';
  if (type === 'CONFIRMATION_CARD' || type === 'COST_CONFIRM_CARD') return 'check_circle';
  if (type === 'COMPLETION_CARD') return 'task_alt';
  if (type === 'DATA_LOADING_VIEW') return 'download';
  if (type === 'PIPELINE_VIEW') return 'schedule';
  if (type === 'MULTISTEP_VIEW') return 'account_tree';
  return 'bar_chart';
}

function envelopeLabel(env: CompositionEnvelope): string {
  const { type, data } = env.primaryArtifact;
  if (type === 'SCHEMA_VIEW') {
    const d = data as any;
    if (d?.scope === 'DATASET' && d?.columns?.length) return `${d.columns.length} tables`;
    if (d?.scope === 'TABLE' && d?.table) return d.table;
    if (d?.scope === 'PROJECT') return 'Datasets';
    return 'Schema';
  }
  if (type === 'TABLE') {
    const d = data as any;
    if (d?.rows?.length !== undefined) return `${d.rows.length} rows`;
    return 'Table';
  }
  if (type === 'KPI_CARD') return 'KPI';
  if (type === 'DATA_QUALITY_VIEW') {
    const d = data as any;
    return d?.table ? `Quality: ${d.table}` : 'Quality';
  }
  if (type === 'DISCOVERY_VIEW') return 'Discovery';
  if (type === 'MONITORING_VIEW') return 'Monitor';
  if (type === 'CONFIRMATION_CARD' || type === 'COST_CONFIRM_CARD') return 'Confirm';
  if (type === 'COMPLETION_CARD') return 'Done';
  if (type === 'DATA_LOADING_VIEW') return 'Export';
  if (type === 'PIPELINE_VIEW') return 'Pipelines';
  if (type === 'MULTISTEP_VIEW') return 'Workflow';
  const chartNames: Record<string, string> = {
    LINE_CHART: 'Line chart', BAR_CHART: 'Bar chart', AREA_CHART: 'Area chart',
    PIE_CHART: 'Pie chart', DONUT_CHART: 'Donut chart', COLUMN_CHART: 'Column chart',
    SCATTER: 'Scatter plot', HISTOGRAM: 'Histogram', HEATMAP: 'Heatmap',
    FUNNEL: 'Funnel', TREEMAP: 'Treemap', GAUGE: 'Gauge',
  };
  return chartNames[type] || 'Chart';
}

// ---- Props ------------------------------------------------------------------

export interface ResultsSidebarProps {
  messages: ChatMessage[];
  thinkingSteps: Record<number, (string | StepInfo)[]>;
  loading: boolean;
  statusText: string | null;
  lastError: ChatError | null;
  setLastError: (error: ChatError | null) => void;
  rerunningIdx: number | null;
  pinnedEnvelopeId: string | null;
  historyHiddenBefore: number;
  layout: string;
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  activeProject: string;
  input: string;
  setInput: (value: string) => void;
  contextItems: ContextItem[];
  onSend: (text?: string) => Promise<void>;
  onRemoveContext: (id: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onConfirm: (envelope: CompositionEnvelope) => Promise<void>;
  onCancel: (envelope: CompositionEnvelope) => void;
  onChipClick: (chip: HandoffEnvelope) => Promise<void>;
  onRunSql: (sql: string) => void;
  onInlineClick: (message: string) => void;
  onPinContext: (env: CompositionEnvelope) => void;
  onRerun: (assistantIdx: number) => Promise<void>;
  extractContextItems: (env: CompositionEnvelope) => ContextItem[];
  onSave?: (envelope: CompositionEnvelope) => void;
  /** When provided, renders a "back to chats" button at the top for hierarchical navigation. */
  onBackToChats?: () => void;
  // Empty-state project selection
  favoriteProjectIds: string[];
  recentProjectIds: string[];
  recentItems: RecentItem[];
  setActiveProject: (p: string) => void;
}

// ---- Component --------------------------------------------------------------

export function ResultsSidebar({
  messages,
  thinkingSteps,
  loading,
  statusText,
  lastError,
  setLastError,
  rerunningIdx,
  pinnedEnvelopeId,
  historyHiddenBefore,
  layout,
  sidebarWidth,
  setSidebarWidth,
  activeProject,
  input,
  setInput,
  contextItems,
  onSend,
  onRemoveContext,
  onKeyDown,
  onConfirm,
  onCancel,
  onChipClick,
  onRunSql,
  onInlineClick,
  onPinContext,
  onRerun,
  extractContextItems,
  onSave,
  onBackToChats,
  favoriteProjectIds,
  recentProjectIds,
  recentItems,
  setActiveProject,
}: ResultsSidebarProps) {
  const [isDragging, setIsDragging] = useState(false);
  const resultsPanelRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const hasChat = messages.length > 0;

  // Persist sidebar width
  useEffect(() => {
    localStorage.setItem('hdn_sidebar_width', String(sidebarWidth));
  }, [sidebarWidth]);

  // Scroll the results panel to a specific envelope card
  const scrollToResult = useCallback((envelopeId: string) => {
    const panel = resultsPanelRef.current;
    if (!panel) return;
    const card = panel.querySelector(`[data-envelope-id="${envelopeId}"]`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      card.classList.remove('result-card-highlight');
      void (card as HTMLElement).offsetWidth;
      card.classList.add('result-card-highlight');
    }
  }, []);

  // Drag handle for resizing sidebar
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    const isRight = layout === 'chat-right';

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const newWidth = isRight ? startWidth - delta : startWidth + delta;
      setSidebarWidth(Math.max(280, Math.min(600, newWidth)));
    };
    const onUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [sidebarWidth, layout, setSidebarWidth]);

  // Collect envelopes from visible assistant messages for the results panel
  // Exclude confirmation envelopes -- those render inline in the chat sidebar
  const CONFIRM_TYPES = new Set(['COST_CONFIRM_CARD', 'CONFIRMATION_CARD']);
  const allEnvelopes = useMemo(() => {
    const result: CompositionEnvelope[] = [];
    for (let idx = 0; idx < messages.length; idx++) {
      if (idx < historyHiddenBefore) continue;
      const msg = messages[idx];
      if (msg.role === 'assistant' && msg.envelopes?.length) {
        for (const env of msg.envelopes) {
          if (!CONFIRM_TYPES.has(env.primaryArtifact.type)) {
            result.push(env);
          }
        }
      }
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, historyHiddenBefore]);

  // Project selection buttons (used in empty-state panels)
  const projectButtons = (
    <>
      {favoriteProjectIds.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 8 }}>Favorites</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {favoriteProjectIds.map(p => (
              <button
                key={p}
                onClick={() => setActiveProject(p)}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '8px 14px',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: 'var(--text)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--surface-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)'; }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#f59e0b' }}>star</span>
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {recentProjectIds.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 8 }}>Recent Projects</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {recentProjectIds.filter(p => !favoriteProjectIds.includes(p)).map(p => (
              <button
                key={p}
                onClick={() => setActiveProject(p)}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '8px 14px',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: 'var(--text)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--surface-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)'; }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--text-muted)' }}>history</span>
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {favoriteProjectIds.length === 0 && recentProjectIds.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0, textAlign: 'center' }}>
          Use the project selector above to choose a GCP project.
        </p>
      )}
    </>
  );

  // Recent items section
  const recentItemsSection = activeProject && recentItems.length > 0 ? (
    <div className="recent-items-section" style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className="recent-items-label" style={{ textAlign: 'center' }}>Recent</div>
      <div className="recent-items" style={{ justifyContent: 'center' }}>
        {recentItems.map((item, idx) => (
          <button
            key={`${item.type}-${item.name}-${idx}`}
            className="recent-item-chip"
            onClick={() => {
              if (item.type === 'table' && item.dataset) {
                onSend(`Show me ${item.dataset}.${item.name}`);
              } else if (item.type === 'table') {
                onSend(`Show me ${item.name}`);
              } else {
                onSend(`What tables are in the ${item.name} dataset?`);
              }
            }}
          >
            <span className="material-symbols-outlined">
              {item.type === 'table' ? 'table_chart' : 'dataset'}
            </span>
            {item.name}
            {item.type === 'table' && item.dataset && (
              <span className="recent-item-chip-sub">{item.dataset}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <>
      {/* -- Chat sidebar -- */}
      <div className="chat-sidebar" style={{ width: sidebarWidth, minWidth: 280, maxWidth: 600 }}>
        {/* Back to chats button (split layout hierarchical nav) */}
        {onBackToChats && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 8px 4px',
            flexShrink: 0,
          }}>
            <button
              onClick={onBackToChats}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                fontSize: 13,
                fontWeight: 500,
                fontFamily: "'Google Sans', sans-serif",
                padding: '6px 8px',
                borderRadius: 8,
                transition: 'background 0.12s, color 0.12s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--text)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
              All chats
            </button>
          </div>
        )}
        <div className="chat-sidebar-messages">
          {!hasChat && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Start a conversation...
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} data-msg-idx={i} style={i < historyHiddenBefore ? { display: 'none' } : undefined}>
              {msg.role === 'user' ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <div className="chat-sidebar-user-msg">
                    {typeof msg.content === 'string' ? msg.content : String(msg.content ?? '')}
                  </div>
                  {i + 1 < messages.length && messages[i + 1].role === 'assistant' && (
                    <RegenerateButton
                      index={i + 1}
                      rerunningIdx={rerunningIdx}
                      loading={loading}
                      onRerun={onRerun}
                    />
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {/* Render confirmation envelopes inline in chat sidebar */}
                  {msg.envelopes && msg.envelopes.filter(e => CONFIRM_TYPES.has(e.primaryArtifact.type)).map((env) => {
                    const aType = env.primaryArtifact.type;
                    if (aType === 'COST_CONFIRM_CARD') {
                      return (
                        <InlineCostConfirm
                          key={env.id}
                          headline={env.headline.text}
                          costEstimate={env.primaryArtifact.data as CostEstimate}
                          onConfirm={() => onConfirm(env)}
                          onCancel={() => onCancel(env)}
                        />
                      );
                    }
                    return (
                      <InlineDmlConfirm
                        key={env.id}
                        headline={env.headline.text}
                        result={env.primaryArtifact.data as DataManagementConfirmResult}
                        compact
                        onConfirm={() => onConfirm(env)}
                        onCancel={() => onCancel(env)}
                      />
                    );
                  })}

                  {/* Non-confirmation envelopes: show headline + artifact links */}
                  {(() => {
                    const nonConfirm = msg.envelopes?.filter(e => !CONFIRM_TYPES.has(e.primaryArtifact.type)) ?? [];
                    if (nonConfirm.length === 0 && (!msg.envelopes || msg.envelopes.length === 0) && msg.content) {
                      return (
                        <div className="chat-sidebar-assistant-text">
                          {typeof msg.content === 'string' ? msg.content : String(msg.content)}
                        </div>
                      );
                    }
                    return nonConfirm.length > 0 ? (
                      <>
                        <div className="chat-sidebar-assistant-text" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                          {nonConfirm.map((env) => env.briefing?.narrative || env.headline.text).join(' ')}
                        </div>
                        <div className="chat-sidebar-artifact-links">
                          {nonConfirm.map((env) => (
                            <button
                              key={env.id}
                              className="chat-sidebar-artifact-link"
                              onClick={() => scrollToResult(env.id)}
                              title={`View in results panel`}
                            >
                              <span className="material-symbols-outlined">{artifactIcon(env.primaryArtifact.type, env.primaryArtifact.data)}</span>
                              {envelopeLabel(env)}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : null;
                  })()}
                  {!msg.envelopes && msg.content && (
                    <div className="chat-sidebar-assistant-text">
                      {typeof msg.content === 'string' ? msg.content : String(msg.content)}
                    </div>
                  )}

                  {/* Show thinking (collapsible) */}
                  {(thinkingSteps[i]?.length || (msg.envelopes && msg.envelopes.some((e) => e.provenance.sql || e.skill))) && (
                    <details className="chat-sidebar-thinking">
                      <summary>
                        <svg className="thinking-sparkle-icon" width="13" height="13" viewBox="0 0 28 28" fill="currentColor">
                          <path d="M14 0C14.9 6.2 21.8 13.1 28 14C21.8 14.9 14.9 21.8 14 28C13.1 21.8 6.2 14.9 0 14C6.2 13.1 13.1 6.2 14 0Z" />
                        </svg>
                        <span className="thinking-toggle-text" />
                        <span className="material-symbols-outlined thinking-toggle-chevron">keyboard_arrow_up</span>
                      </summary>
                      <div className="chat-sidebar-thinking-content">
                        {thinkingSteps[i] && thinkingSteps[i].length > 0 && (
                          <>
                            {thinkingSteps[i].map((step, si) => {
                              const info: StepInfo = typeof step === 'string' ? { text: step } : step;
                              const isCompleted = !!info.link || /^(Matched skill:|Tool call:|Fetched|Loaded|Created|Saved|Built|Generated)/i.test(info.text);
                              return (
                                <div key={si} className="thinking-step">
                                  {isCompleted ? (
                                    <svg className="thinking-check-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                                    </svg>
                                  ) : (
                                    <span className="thinking-step-spacer" />
                                  )}
                                  <span className="thinking-step-text">
                                    {info.text}
                                    {info.link && (
                                      <a href={info.link.url} target="_blank" rel="noopener noreferrer"
                                         className="step-link" title={info.link.label || 'Open in BigQuery'}>
                                        <span className="material-symbols-outlined">open_in_new</span>
                                      </a>
                                    )}
                                  </span>
                                </div>
                              );
                            })}
                          </>
                        )}

                        {msg.envelopes && msg.envelopes.map((env) => {
                          const d = env.primaryArtifact.data as any;
                          const type = env.primaryArtifact.type;
                          return (
                            <div key={env.id} className="thinking-envelope-group">
                              <div className="thinking-step">
                                <svg className="thinking-check-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                                </svg>
                                <span className="thinking-step-text">
                                  {env.skill}{type ? ` - ${type.toLowerCase().replace(/_/g, ' ')}` : ''}
                                </span>
                              </div>

                              {type === 'SCHEMA_VIEW' && d && (
                                <div className="thinking-step-details">
                                  {d.scope === 'DATASET' && d.dataset && (
                                    <div>Dataset: <a href={`https://console.cloud.google.com/bigquery?p=${encodeURIComponent(env.provenance.project || '')}&d=${encodeURIComponent(d.dataset)}&page=dataset`} target="_blank" rel="noopener noreferrer" className="thinking-entity-link"><strong>{d.dataset}</strong></a> ({d.columns?.length || 0} tables)</div>
                                  )}
                                  {d.scope === 'TABLE' && (
                                    <>
                                      <div>Table: <a href={`https://console.cloud.google.com/bigquery?p=${encodeURIComponent(env.provenance.project || '')}&d=${encodeURIComponent(d.dataset || '')}&t=${encodeURIComponent(d.table)}&page=table`} target="_blank" rel="noopener noreferrer" className="thinking-entity-link"><strong>{d.dataset ? `${d.dataset}.` : ''}{d.table}</strong></a></div>
                                      {d.columns?.length > 0 && (
                                        <div>Fields: {d.columns.map((c: any) => `${c.name} (${c.type})`).slice(0, 8).join(', ')}{d.columns.length > 8 ? ` +${d.columns.length - 8} more` : ''}</div>
                                      )}
                                      {d.rowCount != null && <div>Row count: {Number(d.rowCount).toLocaleString()}</div>}
                                      {d.partitioning && <div>Partitioned by: {d.partitioning.field} ({d.partitioning.type})</div>}
                                      {d.clustering?.length > 0 && <div>Clustered by: {d.clustering.join(', ')}</div>}
                                    </>
                                  )}
                                  {d.scope === 'PROJECT' && <div>Project: {d.project}</div>}
                                </div>
                              )}

                              {(type === 'TABLE' || type.includes('CHART') || type === 'SCATTER' || type === 'HISTOGRAM' || type === 'HEATMAP' || type === 'KPI_CARD') && d && (
                                <div className="thinking-step-details">
                                  {d.columns?.length > 0 && (
                                    <div>Columns: {d.columns.slice(0, 10).join(', ')}{d.columns.length > 10 ? ` +${d.columns.length - 10} more` : ''}</div>
                                  )}
                                  {d.rows?.length !== undefined && <div>Rows returned: {d.rows.length}</div>}
                                  {d.totalBytesProcessed > 0 && <div>Data scanned: {formatBytes(d.totalBytesProcessed)}</div>}
                                </div>
                              )}

                              {type === 'DATA_QUALITY_VIEW' && d && (
                                <div className="thinking-step-details">
                                  <div>Table checked: <strong>{d.table}</strong></div>
                                  <div>Check type: {d.checkType}</div>
                                  {d.summary && <div>Rows scanned: {d.summary.rowsScanned?.toLocaleString()}, Issues: {d.summary.issuesFound}</div>}
                                </div>
                              )}

                              {(type === 'CONFIRMATION_CARD' || type === 'COMPLETION_CARD') && d && (
                                <div className="thinking-step-details">
                                  {d.operation && <div>Operation: {d.operation}</div>}
                                  {d.affectedRowCount != null && <div>Rows affected: {d.affectedRowCount.toLocaleString()}</div>}
                                  {d.rowsAffected != null && <div>Rows affected: {d.rowsAffected.toLocaleString()}</div>}
                                </div>
                              )}

                              {env.provenance.cost && (
                                <div className="thinking-meta">
                                  <span>{formatBytes(env.provenance.cost.totalBytesProcessed)} processed</span>
                                  <span>Tier {env.provenance.cost.tier}</span>
                                  {env.provenance.freshness && <span>{env.provenance.freshness}</span>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  )}

                  {!msg.envelopes && !msg.content && lastError && i === messages.length - 1 && (
                    <ErrorCard lastError={lastError} setLastError={setLastError} />
                  )}
                </div>
              )}
            </div>
          ))}
          {loading && rerunningIdx === null && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 0',
            }}>
              <SparkSpinner size={20} />
              <span style={{
                fontSize: 12,
                fontStyle: 'italic',
                color: 'var(--text-muted)',
                fontFamily: "'Google Sans', sans-serif",
              }}>
                {statusText || 'Processing...'}
              </span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input bar docked at bottom of sidebar */}
        <ChatInput
          input={input}
          setInput={setInput}
          loading={loading}
          activeProject={activeProject}
          contextItems={contextItems}
          onSend={onSend}
          onRemoveContext={onRemoveContext}
          onKeyDown={onKeyDown}
          variant="docked"
        />
      </div>

      {/* -- Drag handle -- */}
      <div
        className={`layout-drag-handle${isDragging ? ' layout-drag-handle--active' : ''}`}
        onMouseDown={handleDragStart}
      />

      {/* -- Results panel -- */}
      <div className="results-panel" ref={resultsPanelRef}>
        {!hasChat ? (
          <div className="results-panel-empty">
            {!activeProject && (
              <div style={{
                maxWidth: 480,
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 24,
              }}>
                <p style={{
                  color: 'var(--text-muted)',
                  fontSize: 15,
                  margin: 0,
                  textAlign: 'center',
                }}>
                  Select a project to get started
                </p>
                {projectButtons}
              </div>
            )}
            {recentItemsSection}
          </div>
        ) : allEnvelopes.length > 0 ? (
          <div className="results-panel-inner">
            {allEnvelopes.map((env) => (
              <div key={env.id} data-envelope-id={env.id}>
                <ArtifactCard
                  envelope={env}
                  onConfirm={() => onConfirm(env)}
                  onCancel={() => onCancel(env)}
                  onChipClick={onChipClick}
                  onInlineClick={onInlineClick}
                  onRunSql={onRunSql}
                  onSave={onSave}
                  onPin={extractContextItems(env).length > 0 ? onPinContext : undefined}
                  isPinned={pinnedEnvelopeId === env.id}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="results-panel-empty">
            <EmptyCanvasAnimation />
          </div>
        )}
      </div>
    </>
  );
}
