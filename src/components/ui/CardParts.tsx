'use client';

import type { CompositionEnvelope, HandoffEnvelope } from '@/lib/types';
import { formatBytes } from '@/lib/format';
import { useState, useRef, useCallback, useEffect } from 'react';

// ─── CardHeader ──────────────────────────────────────────────────────────────
// Headline text + save/pin/export action buttons.

interface CardHeaderProps {
  envelope: CompositionEnvelope;
  onSave?: (envelope: CompositionEnvelope) => void;
  onPin?: (envelope: CompositionEnvelope) => void;
  onChipClick?: (chip: HandoffEnvelope) => void;
  isPinned?: boolean;
}

export function CardHeader({ envelope, onSave, onPin, onChipClick, isPinned }: CardHeaderProps) {
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

  const hasExportableData = (() => {
    if (!envelope.provenance.sql) return false;
    const d = envelope.primaryArtifact.data as Record<string, unknown> | undefined;
    return Array.isArray((d as { rows?: unknown })?.rows) && ((d as { rows: unknown[] }).rows.length > 0);
  })();

  const showActions = !envelope.requiresConfirmation
    && envelope.primaryArtifact.type !== 'COMPLETION_CARD'
    && envelope.primaryArtifact.type !== 'MULTISTEP_VIEW'
    && envelope.primaryArtifact.type !== 'COST_CONFIRM_CARD';

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <p style={{
        margin: 0,
        fontSize: 14,
        fontWeight: 500,
        color: 'var(--text)',
        lineHeight: 1.5,
        flex: 1,
      }}>
        {typeof envelope.headline.text === 'string' ? envelope.headline.text : String(envelope.headline.text ?? '')}
      </p>
      {onSave && showActions && (
        <button
          className="context-action-btn"
          onClick={() => onSave(envelope)}
          title="Save"
          style={{ flexShrink: 0, marginTop: 1 }}
        >
          <img src="/icons/save.svg" alt="Save" width={16} height={16} style={{ opacity: 0.7 }} />
        </button>
      )}
      {onPin && showActions && (
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── CardChips ────────────────────────────────────────────────────────────────
// Next-action suggestion chip strip.

interface CardChipsProps {
  envelope: CompositionEnvelope;
  onChipClick?: (chip: HandoffEnvelope) => void;
  onSendMessage?: (msg: string) => void;
  /** Show divider above chips. Default true. */
  showDivider?: boolean;
  /** Show "Generate insights" chip. Default false. */
  showInsights?: boolean;
}

export function CardChips({ envelope, onChipClick, onSendMessage, showDivider = true, showInsights = false }: CardChipsProps) {
  if (envelope.requiresConfirmation) return null;
  if (envelope.nextActions.length === 0 && !showInsights) {
    // Fallback chip
    const data = envelope.primaryArtifact.data as Record<string, unknown> | null;
    const tbl = data?.table as string | undefined;
    const ds = data?.dataset as string | undefined;
    const fallbackMsg = tbl
      ? `What are some useful queries I can run on ${ds ? `${ds}.` : ''}${tbl}?`
      : 'What can I do next with these results?';
    return (
      <>
        {showDivider && <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 12 }} />}
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="chip"
            style={{ opacity: 0.7, fontSize: 11 }}
            onClick={() => onSendMessage?.(fallbackMsg)}
          >
            Suggest next steps
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {showDivider && <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 12 }} />}
      <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {envelope.nextActions.slice(0, 5).map((action, i) => (
          <button
            key={i}
            className="chip"
            onClick={() => onChipClick?.(action)}
          >
            {action.label}
          </button>
        ))}
        {showInsights && (
          <button
            className="chip"
            onClick={() => onSendMessage?.('Generate insights about these results')}
          >
            Generate insights
          </button>
        )}
      </div>
    </>
  );
}

// ─── SqlPanel ─────────────────────────────────────────────────────────────────
// Collapsible SQL viewer with edit/run capability.

interface SqlPanelProps {
  envelope: CompositionEnvelope;
  onRunSql?: (sql: string) => void;
}

export function SqlPanel({ envelope, onRunSql }: SqlPanelProps) {
  const [sqlOpen, setSqlOpen] = useState(false);
  const [sqlEditing, setSqlEditing] = useState(false);
  const [editedSql, setEditedSql] = useState(envelope.provenance.sql ?? '');
  const sqlTextareaRef = useRef<HTMLTextAreaElement>(null);

  const autoSizeTextarea = useCallback(() => {
    const ta = sqlTextareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 300) + 'px';
  }, []);

  const sqlIsModified = editedSql !== (envelope.provenance.sql ?? '');

  if (!envelope.provenance.sql) return null;

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 16, alignItems: 'center' }}>
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
      </div>
      {sqlOpen && (
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
    </div>
  );
}

// ─── CardMeta ─────────────────────────────────────────────────────────────────
// Row count + cost + tier + BigQuery link footer line.

interface CardMetaProps {
  envelope: CompositionEnvelope;
}

export function CardMeta({ envelope }: CardMetaProps) {
  const d = envelope.primaryArtifact.data as Record<string, unknown> | undefined;
  const rowCount = Array.isArray((d as { rows?: unknown })?.rows) ? (d as { rows: unknown[] }).rows.length : null;
  const cost = envelope.provenance.cost;

  if (!rowCount && !cost && !envelope.provenance.jobId) return null;

  return (
    <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 16, alignItems: 'center' }}>
      {rowCount != null && <span>{rowCount} rows</span>}
      {cost && (
        <>
          <span>{formatBytes(cost.totalBytesProcessed)} processed</span>
          <span>Tier {cost.tier}</span>
          {envelope.provenance.freshness && <span>{envelope.provenance.freshness}</span>}
        </>
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
  );
}
