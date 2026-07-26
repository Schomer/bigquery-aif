'use client';

import React, { useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  text: string;
  onSendMessage?: (msg: string) => void;
}

type Segment =
  | { type: 'text'; content: string }
  | { type: 'list'; items: string[] }
  | { type: 'break' };

// ── Entity Detection ──────────────────────────────────────────────────────────

const SQL_KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'JOIN', 'ON',
  'GROUP', 'ORDER', 'BY', 'LIMIT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE',
  'DROP', 'ALTER', 'SET', 'AS', 'WITH', 'CASE', 'WHEN', 'THEN', 'ELSE',
  'END', 'NULL', 'TRUE', 'FALSE', 'HAVING', 'DISTINCT', 'BETWEEN', 'LIKE',
  'EXISTS', 'UNION', 'ALL', 'ANY', 'IS', 'INTO', 'VALUES', 'TABLE', 'VIEW',
  'INDEX', 'DATABASE', 'SCHEMA', 'GRANT', 'REVOKE', 'LEFT', 'RIGHT',
  'INNER', 'OUTER', 'CROSS', 'FULL', 'ASC', 'DESC', 'COUNT', 'SUM',
  'AVG', 'MIN', 'MAX', 'IF', 'ELSE', 'COALESCE', 'CAST', 'EXTRACT',
  'DATE', 'TIMESTAMP', 'STRING', 'INT64', 'FLOAT64', 'BOOL', 'ARRAY',
  'STRUCT', 'UNNEST', 'PARTITION', 'CLUSTER', 'OVER', 'ROWS', 'RANGE',
]);

/** Returns true if the text looks like a clickable BigQuery entity name. */
function isEntityName(text: string): boolean {
  if (!text || text.length > 80) return false;
  // Must not contain spaces (would be a phrase, not an identifier)
  if (text.includes(' ')) return false;
  // Must not be a SQL keyword
  if (SQL_KEYWORDS.has(text.toUpperCase())) return false;
  // Must look like an identifier: starts with letter/underscore, contains only
  // alphanumerics, underscores, hyphens, dots (for project.dataset.table)
  return /^[a-zA-Z_][a-zA-Z0-9_.-]*$/.test(text);
}

/** Returns true if a list of items looks like entity names (datasets, tables). */
function isEntityList(items: string[]): boolean {
  if (items.length < 2) return false;
  const entityCount = items.filter(item => {
    // Strip backticks and leading/trailing whitespace
    const clean = item.replace(/`/g, '').trim();
    return isEntityName(clean);
  }).length;
  return entityCount > items.length / 2;
}

/** Extracts the short name from an entity for the click message. */
function entityClickMessage(name: string): string {
  // For dotted paths like project.dataset.table, use last two segments
  const parts = name.split('.');
  if (parts.length >= 2) {
    return `Show me the schema for ${parts.slice(-2).join('.')}`;
  }
  return `List the tables in ${name}`;
}

// ── Text Parsing ──────────────────────────────────────────────────────────────

function parseSegments(text: string): Segment[] {
  const lines = text.split('\n');
  const segments: Segment[] = [];
  let currentList: string[] = [];
  let textAccum: string[] = [];

  const flushText = () => {
    if (textAccum.length > 0) {
      segments.push({ type: 'text', content: textAccum.join('\n') });
      textAccum = [];
    }
  };

  const flushList = () => {
    if (currentList.length > 0) {
      segments.push({ type: 'list', items: [...currentList] });
      currentList = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Bullet list item (-, *, or numbered like "1.")
    if (/^[-*]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed)) {
      flushText();
      const content = trimmed.replace(/^[-*]\s+/, '').replace(/^\d+[.)]\s+/, '');
      currentList.push(content);
      continue;
    }

    // Empty line
    if (trimmed === '') {
      flushList();
      if (textAccum.length > 0) {
        flushText();
        segments.push({ type: 'break' });
      }
      continue;
    }

    // Regular text line
    flushList();
    textAccum.push(trimmed);
  }

  flushList();
  flushText();

  return segments;
}

// ── Inline Content Renderer ───────────────────────────────────────────────────

function renderInlineContent(
  text: string,
  onSendMessage?: (msg: string) => void,
): React.ReactNode {
  // Split on backtick-wrapped and bold patterns
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return text;

  return parts.map((part, i) => {
    // Backtick-wrapped content
    if (part.startsWith('`') && part.endsWith('`')) {
      const code = part.slice(1, -1);
      if (isEntityName(code) && onSendMessage) {
        return (
          <EntityChip
            key={i}
            name={code}
            onClick={() => onSendMessage(entityClickMessage(code))}
          />
        );
      }
      // Non-entity inline code
      return (
        <code key={i} style={{
          fontFamily: "var(--font-mono, 'Roboto Mono', monospace)",
          fontSize: '0.88em',
          background: 'rgba(0, 0, 0, 0.06)',
          borderRadius: 4,
          padding: '1px 5px',
        }}>
          {code}
        </code>
      );
    }

    // Bold text
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }

    return <span key={i}>{part}</span>;
  });
}

// ── Entity Chip ───────────────────────────────────────────────────────────────

function EntityChip({ name, onClick }: { name: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`Click to explore ${name}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 10px',
        margin: '0 2px',
        borderRadius: 12,
        border: '1px solid #b3d3ef',
        background: hovered ? '#b3d3ef' : '#D1E6F7',
        color: '#18376C',
        fontSize: '0.88em',
        fontFamily: "'Google Sans', sans-serif",
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'background 0.15s ease, border-color 0.15s ease',
        verticalAlign: 'baseline',
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#496CC3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        {name.includes('.')
          ? <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></>
          : <><ellipse cx="12" cy="5.5" rx="9" ry="3.5" /><path d="M21 12c0 1.93-4.03 3.5-9 3.5S3 13.93 3 12" /><path d="M3 5.5v13c0 1.93 4.03 3.5 9 3.5s9-1.57 9-3.5v-13" /></>
        }
      </svg>
      {name}
    </button>
  );
}

// ── Entity Card List ──────────────────────────────────────────────────────────

function EntityCardList({
  items,
  onSendMessage,
}: {
  items: string[];
  onSendMessage?: (msg: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, margin: '4px 0' }}>
      {items.map((item, i) => {
        const clean = item.replace(/`/g, '').trim();
        const clickable = isEntityName(clean) && onSendMessage;

        return (
          <EntityCardRow
            key={clean + i}
            name={clean}
            index={i}
            onClick={clickable ? () => onSendMessage(entityClickMessage(clean)) : undefined}
          />
        );
      })}
      <ListAnimationStyle />
    </div>
  );
}

function EntityCardRow({
  name,
  index,
  onClick,
}: {
  name: string;
  index: number;
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isDotted = name.includes('.');

  return (
    <div
      className="entity-list-row"
      title={onClick ? `Click to explore ${name}` : undefined}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 10px',
        background: hovered ? 'var(--accent-dim, rgba(73,108,195,0.08))' : '#F5FBFF',
        borderRadius: 10,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 0.12s ease',
        userSelect: 'none',
        animationName: 'listRowSlideIn',
        animationDuration: '0.2s',
        animationTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
        animationFillMode: 'both',
        animationDelay: `${index * 25}ms`,
      }}
    >
      {/* Icon badge */}
      <div style={{
        width: 24,
        height: 24,
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isDotted ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)',
        flexShrink: 0,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isDotted ? '#10b981' : '#6366f1'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {isDotted
            ? <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></>
            : <><ellipse cx="12" cy="5.5" rx="9" ry="3.5" /><path d="M21 12c0 1.93-4.03 3.5-9 3.5S3 13.93 3 12" /><path d="M3 5.5v13c0 1.93 4.03 3.5 9 3.5s9-1.57 9-3.5v-13" /></>
          }
        </svg>
      </div>

      <span style={{
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--text, #1a1a1a)',
        flex: 1,
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontFamily: "'Google Sans', sans-serif",
      }}>
        {name}
      </span>

      {onClick && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted, #94a3b8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: hovered ? 1 : 0.4, transition: 'opacity 0.15s' }}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      )}
    </div>
  );
}

function ListAnimationStyle() {
  return (
    <style>{`
      @keyframes listRowSlideIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `}</style>
  );
}

// ── Styled List (non-entity) ──────────────────────────────────────────────────

function StyledList({
  items,
  onSendMessage,
}: {
  items: string[];
  onSendMessage?: (msg: string) => void;
}) {
  return (
    <ul style={{
      margin: '4px 0',
      paddingLeft: 0,
      listStyleType: 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      {items.map((item, i) => (
        <li key={i} style={{
          fontSize: 14,
          lineHeight: 1.6,
          color: 'var(--text, #1a1a1a)',
          fontFamily: "'Google Sans', sans-serif",
          padding: '4px 10px',
          borderLeft: '2px solid var(--accent, #496CC3)',
          background: 'rgba(73, 108, 195, 0.03)',
          borderRadius: '0 6px 6px 0',
        }}>
          {renderInlineContent(item, onSendMessage)}
        </li>
      ))}
    </ul>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

/**
 * Renders CONVERSATION text as rich, interactive content.
 * Parses text into paragraphs, bullet lists, inline entities, and bold text.
 * Entity names in backticks become clickable chips. Lists of entities
 * become clickable card rows matching the SchemaView design language.
 */
export function ConversationRenderer({ text, onSendMessage }: Props) {
  const segments = parseSegments(typeof text === 'string' ? text : String(text ?? ''));

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      maxWidth: 640,
    }}>
      {segments.map((seg, i) => {
        if (seg.type === 'break') {
          return <div key={i} style={{ height: 4 }} />;
        }

        if (seg.type === 'list') {
          if (isEntityList(seg.items)) {
            return (
              <EntityCardList
                key={i}
                items={seg.items}
                onSendMessage={onSendMessage}
              />
            );
          }
          return (
            <StyledList
              key={i}
              items={seg.items}
              onSendMessage={onSendMessage}
            />
          );
        }

        // Text segment
        return (
          <p key={i} style={{
            margin: 0,
            fontSize: 15,
            lineHeight: 1.7,
            color: 'var(--text, #1a1a1a)',
            fontFamily: "'Google Sans', sans-serif",
          }}>
            {renderInlineContent(seg.content, onSendMessage)}
          </p>
        );
      })}
    </div>
  );
}
