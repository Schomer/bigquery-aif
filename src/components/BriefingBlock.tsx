'use client';

import type { CompositionEnvelope } from '@/lib/types';

interface Props {
  briefing: NonNullable<CompositionEnvelope['briefing']>;
}

/**
 * Renders a conversational briefing above the artifact card.
 * Contains a narrative paragraph and optional key-findings bullets.
 */
export function BriefingBlock({ briefing }: Props) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <p style={{
        margin: 0,
        fontSize: 14,
        lineHeight: 1.55,
        color: '#1b2e5d',
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
          gap: 3,
        }}>
          {briefing.findings.map((f, i) => (
            <li key={i} style={{
              fontSize: 13,
              lineHeight: 1.5,
              color: '#334155',
              fontFamily: "'Google Sans', sans-serif",
            }}>
              <span style={{ fontWeight: 600, color: '#1b2e5d' }}>{f.label}</span>
              {': '}
              {f.value}
              {f.detail && (
                <span style={{ color: '#64748b' }}> -- {f.detail}</span>
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
          background: 'rgba(27, 46, 93, 0.08)',
          borderRadius: 4,
          padding: '1px 5px',
          color: '#1b2e5d',
        }}>
          {code}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
