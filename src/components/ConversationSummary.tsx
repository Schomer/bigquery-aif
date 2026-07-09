'use client';
// src/components/ConversationSummary.tsx
// Collapsible panel at the top of long conversations.
// Shows operations performed, current context, tables touched, and key results.
// Derives everything from the messages array -- no external state.

import { useState, useMemo } from 'react';
import type { ChatMessage, CompositionEnvelope, SkillName } from '@/lib/types';

interface ConversationSummaryProps {
  messages: ChatMessage[];
  onJumpToMessage: (index: number) => void;
}

interface OperationSummary {
  messageIndex: number;
  skill: SkillName;
  label: string;
  table?: string;
  artifactType?: string;
}

interface ContextSummary {
  project?: string;
  dataset?: string;
  tables: string[];
}

interface KeyResult {
  messageIndex: number;
  label: string;
  artifactType: string;
  envelopeId: string;
}

function deriveOperations(messages: ChatMessage[]): OperationSummary[] {
  const ops: OperationSummary[] = [];

  messages.forEach((msg, idx) => {
    if (msg.role !== 'assistant' || !msg.envelopes) return;

    for (const env of msg.envelopes) {
      const op = classifyOperation(env);
      if (op) {
        ops.push({ messageIndex: idx, ...op });
      }
    }
  });

  return ops;
}

function classifyOperation(env: CompositionEnvelope): {
  skill: SkillName;
  label: string;
  table?: string;
  artifactType?: string;
} | null {
  const data = env.primaryArtifact.data as Record<string, unknown> | null;
  const table = extractTable(env);
  const type = env.primaryArtifact.type;

  switch (env.skill) {
    case 'query':
      return { skill: 'query', label: 'Query executed', table, artifactType: type };
    case 'schema':
      if (type === 'SCHEMA_VIEW') {
        const scope = (data?.scope as string) || '';
        if (scope === 'PROJECT') return { skill: 'schema', label: 'Listed datasets', artifactType: type };
        if (scope === 'DATASET') return { skill: 'schema', label: 'Listed tables', table: (data?.dataset as string) || undefined, artifactType: type };
        return { skill: 'schema', label: 'Viewed schema', table, artifactType: type };
      }
      return { skill: 'schema', label: 'Schema inspected', table, artifactType: type };
    case 'data-management': {
      const operation = (data?.operation as string) || 'modification';
      const labels: Record<string, string> = {
        DEDUPE: 'Deduplicated',
        DELETE: 'Deleted rows',
        UPDATE: 'Updated rows',
        FILL_NULLS: 'Filled nulls',
        CREATE_TABLE: 'Created table',
        ALTER_TABLE: 'Altered table',
        CREATE_VIEW: 'Created view',
        RENAME: 'Renamed',
        COPY_TABLE: 'Copied table',
        MERGE: 'Merged data',
        PARTITION_TABLE: 'Re-partitioned',
      };
      return { skill: 'data-management', label: labels[operation] || 'Data modified', table, artifactType: type };
    }
    case 'data-quality':
      return { skill: 'data-quality', label: 'Quality check', table, artifactType: type };
    case 'data-loading': {
      const opType = (data?.operationType as string) || '';
      const loadLabels: Record<string, string> = {
        EXPORT_CSV: 'Exported CSV',
        EXPORT_SHEETS: 'Exported to Sheets',
        SCHEDULE_CREATED: 'Created schedule',
        QUERY_SAVED: 'Saved query',
        SHARE_CLIPBOARD: 'Shared results',
      };
      return { skill: 'data-loading', label: loadLabels[opType] || 'Data loaded', table, artifactType: type };
    }
    case 'monitoring':
      return { skill: 'monitoring', label: 'Monitoring check', table, artifactType: type };
    case 'discovery':
      return { skill: 'discovery', label: 'Discovery search', table, artifactType: type };
    default:
      return null;
  }
}

function extractTable(env: CompositionEnvelope): string | undefined {
  const data = env.primaryArtifact.data as Record<string, unknown> | null;
  if (!data) return undefined;

  if (data.table && typeof data.table === 'string') {
    const parts = (data.table as string).replace(/`/g, '').split('.');
    return parts[parts.length - 1];
  }

  // Try to extract from SQL
  const sql = env.provenance?.sql || (data.sql as string | undefined);
  if (sql && typeof sql === 'string') {
    const match = sql.match(/\bFROM\s+`?([A-Za-z0-9_.-]+)`?/i);
    if (match) {
      const parts = match[1].split('.');
      return parts[parts.length - 1];
    }
  }

  return undefined;
}

function deriveContext(messages: ChatMessage[]): ContextSummary {
  const tables = new Set<string>();
  let project: string | undefined;
  let dataset: string | undefined;

  messages.forEach((msg) => {
    if (msg.role !== 'assistant' || !msg.envelopes) return;
    for (const env of msg.envelopes) {
      const data = env.primaryArtifact.data as Record<string, unknown> | null;
      if (!data) continue;

      if (data.project && typeof data.project === 'string') project = data.project;
      if (data.dataset && typeof data.dataset === 'string') dataset = data.dataset;
      if (env.provenance?.project) project = env.provenance.project;

      const table = extractTable(env);
      if (table) tables.add(table);
    }
  });

  return { project, dataset, tables: Array.from(tables) };
}

function deriveKeyResults(messages: ChatMessage[]): KeyResult[] {
  const latestByType = new Map<string, KeyResult>();

  messages.forEach((msg, idx) => {
    if (msg.role !== 'assistant' || !msg.envelopes) return;
    for (const env of msg.envelopes) {
      const type = env.primaryArtifact.type;
      latestByType.set(type, {
        messageIndex: idx,
        label: env.headline.text,
        artifactType: type,
        envelopeId: env.id,
      });
    }
  });

  return Array.from(latestByType.values());
}

const SKILL_ICONS: Record<string, string> = {
  query: 'query_stats',
  schema: 'schema',
  'data-management': 'build',
  'data-quality': 'verified',
  'data-loading': 'download',
  monitoring: 'monitoring',
  discovery: 'search',
  multistep: 'account_tree',
  task: 'task',
};

export function ConversationSummary({ messages, onJumpToMessage }: ConversationSummaryProps) {
  const [expanded, setExpanded] = useState(false);

  const operations = useMemo(() => deriveOperations(messages), [messages]);
  const context = useMemo(() => deriveContext(messages), [messages]);
  const keyResults = useMemo(() => deriveKeyResults(messages), [messages]);

  // Only show when 6+ messages
  if (messages.length < 6) return null;

  const tableCount = context.tables.length;
  const opCount = operations.length;

  if (opCount === 0) return null;

  const summaryLine = `${opCount} operation${opCount !== 1 ? 's' : ''}${
    tableCount > 0 ? ` across ${tableCount} table${tableCount !== 1 ? 's' : ''}` : ''
  }`;

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      overflow: 'hidden',
      transition: 'all 0.2s ease',
    }}>
      {/* Collapsed header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '10px 16px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          fontSize: 13,
          fontFamily: "'Google Sans', sans-serif",
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: 16,
            transition: 'transform 0.2s',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20",
          }}
        >
          chevron_right
        </span>
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 16, color: 'var(--text-dim)', fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20" }}
        >
          summarize
        </span>
        <span style={{ fontWeight: 500 }}>{summaryLine}</span>
        {context.dataset && (
          <span style={{
            marginLeft: 'auto',
            fontSize: 11,
            padding: '2px 8px',
            background: 'var(--surface-2)',
            borderRadius: 4,
            color: 'var(--text-dim)',
          }}>
            {context.dataset}
          </span>
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div style={{
          padding: '0 16px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          {/* Operations list */}
          <div>
            <div style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-dim)',
              marginBottom: 8,
            }}>
              Operations
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {operations.map((op, i) => (
                <button
                  key={i}
                  onClick={() => onJumpToMessage(op.messageIndex)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '5px 8px',
                    background: 'none',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    color: 'var(--text)',
                    fontSize: 12,
                    textAlign: 'left',
                    width: '100%',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: 14,
                      color: 'var(--text-dim)',
                      fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20",
                    }}
                  >
                    {SKILL_ICONS[op.skill] || 'circle'}
                  </span>
                  <span>{op.label}</span>
                  {op.table && (
                    <span style={{
                      fontSize: 11,
                      padding: '1px 6px',
                      background: 'var(--surface-2)',
                      borderRadius: 4,
                      color: 'var(--text-dim)',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      {op.table}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tables touched */}
          {context.tables.length > 0 && (
            <div>
              <div style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-dim)',
                marginBottom: 8,
              }}>
                Tables Touched
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {context.tables.map((t) => (
                  <span
                    key={t}
                    style={{
                      fontSize: 11,
                      padding: '3px 10px',
                      background: 'var(--surface-2)',
                      borderRadius: 6,
                      color: 'var(--text)',
                      fontFamily: 'var(--font-mono)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Key results */}
          {keyResults.length > 0 && (
            <div>
              <div style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-dim)',
                marginBottom: 8,
              }}>
                Key Results
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {keyResults.slice(-5).map((kr) => (
                  <button
                    key={kr.envelopeId}
                    onClick={() => onJumpToMessage(kr.messageIndex)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '5px 8px',
                      background: 'none',
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
                      color: 'var(--text)',
                      fontSize: 12,
                      textAlign: 'left',
                      width: '100%',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontSize: 14,
                        color: 'var(--text-dim)',
                        fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20",
                      }}
                    >
                      open_in_new
                    </span>
                    <span style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}>
                      {kr.label}
                    </span>
                    <span style={{
                      fontSize: 10,
                      padding: '1px 6px',
                      background: 'var(--surface-2)',
                      borderRadius: 4,
                      color: 'var(--text-dim)',
                    }}>
                      {kr.artifactType.replace(/_/g, ' ').toLowerCase()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Current context */}
          {(context.project || context.dataset) && (
            <div style={{
              fontSize: 11,
              color: 'var(--text-dim)',
              display: 'flex',
              gap: 12,
              paddingTop: 4,
              borderTop: '1px solid var(--border)',
            }}>
              {context.project && <span>Project: {context.project}</span>}
              {context.dataset && <span>Dataset: {context.dataset}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
