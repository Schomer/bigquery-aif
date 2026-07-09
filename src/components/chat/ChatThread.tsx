'use client';

import { useRef, useEffect } from 'react';
import { SparkSpinner } from '@/components/SparkSpinner';
import { ArtifactCard } from '@/components/ArtifactCard';
import type {
  ChatMessage,
  CompositionEnvelope,
  StepInfo,
  HandoffEnvelope,
  ContextItem,
} from '@/lib/types';
import type { ChatError } from '@/hooks/useChatOrchestration';

// ---- Crystal-ball thinking indicator ----------------------------------------

const THINKING_PHRASES = [
  'Gazing into the warehouse…',
  'Reading the query leaves…',
  'The crystals are computing…',
  'Communing with the schema…',
  'Divining your results…',
  'Scanning the data plane…',
  'Interrogating the cosmos…',
  'Decoding the data stream…',
];

function CrystalBallThinking() {
  const [phrase, setPhraseState] = ['' as string, (() => {}) as any];
  // Use refs to avoid stale closure issues with the interval
  const phraseRef = useRef(() => {
    const idx = Math.floor(Math.random() * THINKING_PHRASES.length);
    return THINKING_PHRASES[idx];
  });

  const currentPhrase = useRef(phraseRef.current());
  const [displayPhrase, setDisplayPhrase] = [currentPhrase.current, (v: string) => { currentPhrase.current = v; }];

  // Re-implement with proper state
  return <CrystalBallThinkingInner />;
}

function CrystalBallThinkingInner() {
  const { useState } = require('react');
  const [phrase, setPhrase] = useState(() => {
    const idx = Math.floor(Math.random() * THINKING_PHRASES.length);
    return THINKING_PHRASES[idx];
  });
  const current = useRef(phrase);

  useEffect(() => {
    const id = setInterval(() => {
      const pool = THINKING_PHRASES.filter(p => p !== current.current);
      const next = pool[Math.floor(Math.random() * pool.length)];
      current.current = next;
      setPhrase(next);
    }, 2800);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '6px 0 8px',
    }}>
      <SparkSpinner size={24} />
      <span style={{
        fontSize: 13,
        fontStyle: 'italic',
        color: 'var(--text-muted)',
        fontFamily: "'Google Sans', sans-serif",
        letterSpacing: '0.01em',
        transition: 'opacity 0.4s ease',
      }}>
        {phrase}
      </span>
    </div>
  );
}

// ---- Error Card -------------------------------------------------------------

function ErrorCard({ lastError, setLastError }: {
  lastError: ChatError;
  setLastError: (error: ChatError | null) => void;
}) {
  return (
    <div style={{
      background: lastError.type === 'auth' ? '#fff7ed' : lastError.type === 'rate_limit' ? '#fffbeb' : '#fef2f2',
      border: `1px solid ${lastError.type === 'auth' ? '#fed7aa' : lastError.type === 'rate_limit' ? '#fde68a' : '#fecaca'}`,
      borderRadius: 12,
      padding: '16px 20px',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="material-symbols-outlined" style={{
          fontSize: 18,
          color: lastError.type === 'auth' ? '#c2410c' : lastError.type === 'rate_limit' ? '#b45309' : '#dc2626',
        }}>
          {lastError.type === 'auth' ? 'lock' : lastError.type === 'rate_limit' ? 'schedule' : lastError.type === 'sql' ? 'code_off' : 'warning'}
        </span>
        <span style={{
          fontSize: 13,
          fontWeight: 600,
          color: lastError.type === 'auth' ? '#c2410c' : lastError.type === 'rate_limit' ? '#b45309' : '#dc2626',
        }}>
          {lastError.type === 'auth' ? 'Session Expired'
            : lastError.type === 'rate_limit' ? 'Temporarily Busy'
            : lastError.type === 'sql' ? 'Query Error'
            : lastError.type === 'gemini' ? 'AI Service Error'
            : 'Something Went Wrong'}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
        {typeof lastError.message === 'string' ? lastError.message : String(lastError.message ?? '')}
      </p>
      {lastError.sql && (
        <div className="sql-block" style={{ fontSize: 11, marginTop: 4 }}>{lastError.sql}</div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        {lastError.retryFn && (
          <button
            onClick={() => { setLastError(null); lastError.retryFn?.(); }}
            style={{
              padding: '5px 14px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--surface-2)',
              color: 'var(--text)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {lastError.type === 'auth' ? 'Sign in and continue' : 'Try again'}
          </button>
        )}
      </div>
    </div>
  );
}

// ---- Regenerate Button ------------------------------------------------------

function RegenerateButton({
  index,
  rerunningIdx,
  loading,
  onRerun,
}: {
  index: number;
  rerunningIdx: number | null;
  loading: boolean;
  onRerun: (idx: number) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: 2 }}>
      {rerunningIdx === index ? (
        <CrystalBallThinkingInner />
      ) : (
        <button
          id={`regenerate-btn-${index}`}
          onClick={() => onRerun(index)}
          disabled={loading}
          title="Regenerate response"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'none',
            border: '1px solid transparent',
            borderRadius: 6,
            padding: '3px 8px 3px 4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            color: 'var(--text-muted)',
            fontSize: 12,
            opacity: loading ? 0.4 : 0.6,
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              (e.currentTarget as HTMLButtonElement).style.opacity = '1';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)';
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.opacity = '0.6';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.background = 'none';
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 14, lineHeight: 1, fontVariationSettings: `'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20` }}
          >redo</span>
          Regenerate
        </button>
      )}
    </div>
  );
}

// ---- ChatThread Props -------------------------------------------------------

export interface ChatThreadProps {
  messages: ChatMessage[];
  thinkingSteps: Record<number, (string | StepInfo)[]>;
  loading: boolean;
  statusText: string | null;
  lastError: ChatError | null;
  setLastError: (error: ChatError | null) => void;
  editingIdx: number | null;
  editText: string;
  rerunningIdx: number | null;
  pinnedEnvelopeId: string | null;
  historyHiddenBefore: number;
  onConfirm: (envelope: CompositionEnvelope) => Promise<void>;
  onCancel: (envelope: CompositionEnvelope) => void;
  onChipClick: (chip: HandoffEnvelope) => Promise<void>;
  onRunSql: (sql: string) => void;
  onInlineClick: (message: string) => void;
  onPinContext: (env: CompositionEnvelope) => void;
  onStartEdit: (idx: number, text: string) => void;
  onCancelEdit: () => void;
  onSubmitEdit: (idx: number) => Promise<void>;
  onEditTextChange: (text: string) => void;
  onRerun: (assistantIdx: number) => Promise<void>;
  extractContextItems: (env: CompositionEnvelope) => ContextItem[];
}

// ---- ChatThread Component ---------------------------------------------------

export function ChatThread({
  messages,
  thinkingSteps,
  loading,
  statusText,
  lastError,
  setLastError,
  editingIdx,
  editText,
  rerunningIdx,
  pinnedEnvelopeId,
  historyHiddenBefore,
  onConfirm,
  onCancel,
  onChipClick,
  onRunSql,
  onInlineClick,
  onPinContext,
  onStartEdit,
  onCancelEdit,
  onSubmitEdit,
  onEditTextChange,
  onRerun,
  extractContextItems,
}: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role === 'assistant') {
      const scrollContainer = bottomRef.current?.parentElement;
      if (scrollContainer) {
        const lastMsgEl = scrollContainer.querySelector(
          `[data-msg-idx="${messages.length - 1}"]`
        ) as HTMLElement | null;
        if (lastMsgEl) {
          requestAnimationFrame(() => {
            lastMsgEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
          return;
        }
      }
    }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-focus and auto-size the edit textarea when it opens
  useEffect(() => {
    if (editingIdx !== null && editTextareaRef.current) {
      const el = editTextareaRef.current;
      el.focus();
      el.selectionStart = el.selectionEnd = el.value.length;
      autoResizeEl(el);
    }
  }, [editingIdx]);

  const autoResizeEl = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    const maxHeight = Math.round(14 * 1.5 * 8 + 2);
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
  };

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '24px 24px 140px',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
    }}>
      {messages.map((msg, i) => (
        <div key={i} data-msg-idx={i} className={i > 0 ? 'fade-up' : ''} style={i < historyHiddenBefore ? { display: 'none' } : undefined}>
          {msg.role === 'user' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginBottom: 4 }}>
              {editingIdx === i ? (
                <div style={{
                  maxWidth: '70%',
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  alignItems: 'flex-end',
                }}>
                  <textarea
                    ref={editTextareaRef}
                    value={editText}
                    onChange={(e) => { onEditTextChange(e.target.value); autoResizeEl(e.target); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmitEdit(i); }
                      if (e.key === 'Escape') { onCancelEdit(); }
                    }}
                    rows={1}
                    style={{
                      width: '100%',
                      background: 'var(--surface)',
                      border: '1.5px solid #93c5fd',
                      borderRadius: '12px 12px 4px 12px',
                      padding: '10px 14px',
                      fontSize: 14,
                      color: 'var(--text)',
                      lineHeight: 1.5,
                      resize: 'none',
                      outline: 'none',
                      fontFamily: 'inherit',
                      boxShadow: '0 0 0 3px rgba(147,197,253,0.25)',
                      transition: 'border-color 0.15s',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => onCancelEdit()}
                      style={{
                        padding: '4px 12px',
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                        background: 'var(--surface-2)',
                        color: 'var(--text-muted)',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >Cancel</button>
                    <button
                      onClick={() => onSubmitEdit(i)}
                      disabled={!editText.trim() || loading}
                      style={{
                        padding: '4px 14px',
                        borderRadius: 6,
                        border: '1px solid #93c5fd',
                        background: '#bfdbfe',
                        color: '#1d4ed8',
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: !editText.trim() || loading ? 'not-allowed' : 'pointer',
                        opacity: !editText.trim() || loading ? 0.5 : 1,
                      }}
                    >Save</button>
                  </div>
                </div>
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  title="Click to edit"
                  onClick={() => { if (!loading) onStartEdit(i, msg.content); }}
                  onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !loading) onStartEdit(i, msg.content); }}
                  style={{
                    maxWidth: '70%',
                    background: 'var(--accent-dim)',
                    borderRadius: '16px 16px 4px 16px',
                    padding: '10px 16px',
                    fontSize: 14,
                    color: '#3c4043',
                    lineHeight: 1.5,
                    cursor: loading ? 'default' : 'text',
                    userSelect: 'text',
                  }}
                >
                  {typeof msg.content === 'string' ? msg.content : String(msg.content ?? '')}
                </div>
              )}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {msg.envelopes?.map((env) => (
                <ArtifactCard
                  key={env.id}
                  envelope={env}
                  onConfirm={() => onConfirm(env)}
                  onCancel={() => onCancel(env)}
                  onChipClick={onChipClick}
                  onInlineClick={onInlineClick}
                  onRunSql={onRunSql}
                  onPin={extractContextItems(env).length > 0 ? onPinContext : undefined}
                  isPinned={pinnedEnvelopeId === env.id}
                />
              ))}
              {!msg.envelopes && msg.content && (
                <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                  {typeof msg.content === 'string' ? msg.content : String(msg.content)}
                </div>
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
          gap: 10,
          padding: '6px 0 8px',
        }}>
          <SparkSpinner size={24} />
          <span style={{
            fontSize: 13,
            fontStyle: 'italic',
            color: 'var(--text-muted)',
            fontFamily: "'Google Sans', sans-serif",
            letterSpacing: '0.01em',
            transition: 'opacity 0.4s ease',
          }}>
            {statusText || 'Processing...'}
          </span>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

// ---- Export subcomponents for reuse in split layout -------------------------

export { CrystalBallThinkingInner as CrystalBallThinking, ErrorCard, RegenerateButton };
