'use client';

import type { CompositionEnvelope } from '@/lib/types';

interface Props {
  briefing: NonNullable<CompositionEnvelope['briefing']>;
}

/**
 * Renders a conversational briefing as plain text in the chat area.
 * Matches user prompt styling (15px, semi-bold).
 */
export function BriefingBlock({ briefing }: Props) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <p style={{
        margin: 0,
        fontSize: 15,
        lineHeight: 1.5,
        fontWeight: 500,
        color: 'var(--text-primary, #1a1a1a)',
        fontFamily: "'Google Sans', sans-serif",
      }}>
        {renderInlineCode(briefing.narrative)}
      </p>

      {briefing.findings && briefing.findings.length > 0 && (
        <ul style={{
          margin: 0,
          paddingLeft: 18,
          listStyleType: 'disc',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
          {briefing.findings.map((f, i) => (
            <li key={i} style={{
              fontSize: 14,
              lineHeight: 1.5,
              fontWeight: 400,
              color: 'var(--text-primary, #1a1a1a)',
              fontFamily: "'Google Sans', sans-serif",
            }}>
              <span style={{ fontWeight: 600 }}>{f.label}</span>
              {': '}
              {f.value}
              {f.detail && (
                <span style={{ color: 'var(--text-muted, #64748b)' }}> -- {f.detail}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Renders backtick-wrapped substrings as inline code spans. */
function renderInlineCode(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`)/g);
  if (parts.length === 1) return text;

  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      const code = part.slice(1, -1);
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
    return <span key={i}>{part}</span>;
  });
}
