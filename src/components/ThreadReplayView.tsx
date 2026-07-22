'use client';

import { ArtifactCard } from '@/components/ArtifactCard';
import type { ChatMessage, CompositionEnvelope } from '@/lib/types';

interface ThreadReplayViewProps {
  name: string;
  messages: ChatMessage[];
  onBack: () => void;
}

export function ThreadReplayView({ name, messages, onBack }: ThreadReplayViewProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg, #fff)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 20px',
        borderBottom: '1px solid var(--border, #e0e0e0)',
        flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary, #5f6368)',
            fontSize: 14,
            fontFamily: "'Google Sans', sans-serif",
            padding: '4px 8px',
            borderRadius: 8,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2, #f1f3f4)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
          Back
        </button>
        <div style={{
          fontSize: 16,
          fontWeight: 600,
          color: 'var(--text, #1a1a1a)',
          fontFamily: "'Google Sans', sans-serif",
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {name}
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}>
        {messages.map((msg, i) => (
          <div key={i}>
            {msg.role === 'user' ? (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{
                  maxWidth: '70%',
                  background: '#CCE8F9',
                  borderRadius: '16px 16px 4px 16px',
                  padding: '10px 16px',
                  fontSize: 15,
                  color: '#1a2744',
                  lineHeight: 1.5,
                  fontFamily: "'Google Sans', sans-serif",
                }}>
                  {msg.content}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {msg.envelopes?.map((env: CompositionEnvelope) => {
                  const aType = env.primaryArtifact?.type;
                  // Skip confirmation/cost cards in replay
                  if (aType === 'CONFIRMATION_CARD' || aType === 'COST_CONFIRM_CARD' || aType === 'COMPLETION_CARD') {
                    return null;
                  }
                  // Conversation-type artifacts: render as text
                  if (aType === 'CONVERSATION') {
                    const convData = env.primaryArtifact.data as { text: string };
                    return (
                      <div key={env.id} style={{
                        fontSize: 15,
                        lineHeight: 1.7,
                        color: 'var(--text)',
                        fontFamily: "'Google Sans', sans-serif",
                        whiteSpace: 'pre-line',
                        maxWidth: 640,
                      }}>
                        {typeof convData.text === 'string' ? convData.text : String(convData.text ?? '')}
                      </div>
                    );
                  }
                  // All other artifacts: render via ArtifactCard (read-only)
                  return (
                    <div key={env.id}>
                      <ArtifactCard
                        envelope={env}
                        onConfirm={() => {}}
                        onCancel={() => {}}
                        onChipClick={() => {}}
                        onInlineClick={() => {}}
                        onRunSql={() => {}}
                      />
                    </div>
                  );
                })}
                {(!msg.envelopes || msg.envelopes.length === 0) && msg.content && (
                  <div style={{
                    color: 'var(--text)',
                    fontSize: 15,
                    lineHeight: 1.7,
                    fontFamily: "'Google Sans', sans-serif",
                  }}>
                    {msg.content}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
