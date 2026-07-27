'use client';

import React, { useState, useCallback } from 'react';
import type { ClarificationResult } from '@/lib/types';

interface ClarificationCardProps {
  result: ClarificationResult;
  onSendMessage: (msg: string) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  column_reference: 'view_column',
  vague_filter: 'filter_alt',
  date_range: 'date_range',
  open_intent: 'help',
  table_ambiguity: 'table_chart',
};

export function ClarificationCard({ result, onSendMessage }: ClarificationCardProps) {
  const [customInput, setCustomInput] = useState('');

  const handleSubmitCustom = useCallback(() => {
    const trimmed = customInput.trim();
    if (trimmed) {
      onSendMessage(trimmed);
      setCustomInput('');
    }
  }, [customInput, onSendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitCustom();
    }
  }, [handleSubmitCustom]);

  const icon = CATEGORY_ICONS[result.category] || 'help';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      padding: '16px 0 8px',
    }}>
      {/* Context: what the AI already knows */}
      {result.context && (
        <div style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          lineHeight: 1.5,
        }}>
          {result.context}
        </div>
      )}

      {/* Question */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
      }}>
        <span className="material-symbols-outlined" style={{
          fontSize: 18,
          color: 'var(--accent)',
          marginTop: 1,
        }}>
          {icon}
        </span>
        <span style={{
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--text)',
          lineHeight: 1.4,
        }}>
          {result.question}
        </span>
      </div>

      {/* Options */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        paddingLeft: 26,
      }}>
        {result.options.map((opt, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSendMessage(opt.value)}
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 20,
              padding: '7px 16px',
              fontSize: 13,
              color: 'var(--text)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: 400,
              transition: 'all 0.15s',
              lineHeight: 1.3,
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)';
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(26,115,232,0.06)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-subtle)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)';
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)';
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Custom input */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 26,
      }}>
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Or type your own answer..."
          style={{
            flex: 1,
            background: 'var(--surface-2)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            padding: '7px 12px',
            fontSize: 12,
            color: 'var(--text)',
            fontFamily: 'inherit',
            outline: 'none',
            transition: 'border-color 0.15s',
          }}
          onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--accent)'; }}
          onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--border-subtle)'; }}
        />
        {customInput.trim() && (
          <button
            type="button"
            onClick={handleSubmitCustom}
            style={{
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 12,
              color: '#fff',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>send</span>
          </button>
        )}
      </div>

      {/* Assumptions */}
      {result.assumptions && result.assumptions.length > 0 && (
        <div style={{
          paddingLeft: 26,
          fontSize: 11,
          color: 'var(--text-dim)',
          lineHeight: 1.5,
        }}>
          <span style={{ fontWeight: 500 }}>Already determined:</span>
          <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
            {result.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
