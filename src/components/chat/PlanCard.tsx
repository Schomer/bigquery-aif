'use client';

import { useState } from 'react';

export interface PlanStep {
  label: string;
  detail: string;
}

export interface PlanCardData {
  title: string;
  summary: string;
  steps: PlanStep[];
  estimatedCost?: string | null;
  dataAccessed?: string[];
  originalQuery: string;
}

interface PlanCardProps {
  data: PlanCardData;
  onProceed: (originalQuery: string) => void;
  onComment: (originalQuery: string, comment: string) => void;
  onCancel: () => void;
}

export function PlanCard({ data, onProceed, onComment, onCancel }: PlanCardProps) {
  const [mode, setMode] = useState<'idle' | 'commenting' | 'cancelled'>('idle');
  const [comment, setComment] = useState('');

  function handleCommentSubmit() {
    if (!comment.trim()) return;
    onComment(data.originalQuery, comment.trim());
  }

  if (mode === 'cancelled') {
    return (
      <div style={{
        padding: '14px 18px',
        borderRadius: 10,
        border: '1px solid var(--border)',
        background: 'var(--surface-2)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        color: 'var(--text-muted)',
        fontSize: 13,
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>cancel</span>
        Plan cancelled
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 18px',
        borderBottom: '1px solid var(--border)',
        background: 'linear-gradient(135deg, #f0f4ff 0%, #f8faff 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="material-symbols-outlined" style={{
            fontSize: 18,
            color: '#4f6ef7',
            fontVariationSettings: `'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 20`,
          }}>
            lightbulb
          </span>
          <span style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--text)',
            fontFamily: "'Google Sans', sans-serif",
          }}>
            {data.title}
          </span>
        </div>
        <span style={{
          fontSize: 11,
          fontWeight: 500,
          padding: '2px 8px',
          borderRadius: 20,
          background: '#e8f0fe',
          color: '#4f6ef7',
          letterSpacing: '0.02em',
        }}>
          No queries run yet
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Summary */}
        <p style={{
          margin: 0,
          fontSize: 13,
          color: 'var(--text)',
          lineHeight: 1.6,
        }}>
          {data.summary}
        </p>

        {/* Steps */}
        {data.steps.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {data.steps.map((step, i) => (
              <div key={i}>
                {/* Step row */}
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  {/* Number badge + connector line column */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: '#496CC3',
                      color: 'white',
                      fontSize: 11,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: "'Google Sans', sans-serif",
                      flexShrink: 0,
                    }}>
                      {i + 1}
                    </div>
                    {/* Connector line — shown for all but last step */}
                    {i < data.steps.length - 1 && (
                      <div style={{
                        width: 2,
                        flex: 1,
                        minHeight: 20,
                        background: '#dadce0',
                        margin: '4px 0',
                      }} />
                    )}
                  </div>
                  {/* Step content */}
                  <div style={{
                    paddingTop: 4,
                    paddingBottom: i < data.steps.length - 1 ? 20 : 0,
                  }}>
                    <span style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#1B2E5D',
                      fontFamily: "'Google Sans', sans-serif",
                      lineHeight: 1.3,
                      display: 'block',
                    }}>
                      {step.label}
                    </span>
                    {step.detail && (
                      <span style={{
                        fontSize: 13,
                        color: 'var(--text-muted)',
                        lineHeight: 1.5,
                        display: 'block',
                        marginTop: 2,
                      }}>
                        {step.detail}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Metadata row */}
        {(data.estimatedCost || (data.dataAccessed && data.dataAccessed.length > 0)) && (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            paddingTop: 4,
            borderTop: '1px solid var(--border)',
          }}>
            {data.estimatedCost && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>payments</span>
                Est. {data.estimatedCost}
              </div>
            )}
            {data.dataAccessed && data.dataAccessed.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>table_chart</span>
                {data.dataAccessed.join(', ')}
              </div>
            )}
          </div>
        )}

        {/* Comment area */}
        {mode === 'commenting' && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: '12px 14px',
            background: 'var(--surface-2)',
            borderRadius: 8,
            border: '1px solid var(--border)',
          }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>
              Add a comment or amendment:
            </label>
            <textarea
              autoFocus
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleCommentSubmit();
                }
                if (e.key === 'Escape') {
                  setMode('idle');
                  setComment('');
                }
              }}
              placeholder="e.g. filter to US only, use last 90 days instead..."
              rows={2}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 13,
                lineHeight: 1.5,
                resize: 'vertical',
                outline: 'none',
                fontFamily: "'Google Sans', sans-serif",
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setMode('idle'); setComment(''); }}
                style={BTN_GHOST}
              >
                Cancel
              </button>
              <button
                onClick={handleCommentSubmit}
                disabled={!comment.trim()}
                style={comment.trim() ? BTN_PRIMARY : { ...BTN_PRIMARY, opacity: 0.5, cursor: 'not-allowed' }}
              >
                Re-plan
              </button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {mode !== 'commenting' && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
            <button
              id="plan-cancel-btn"
              onClick={() => { setMode('cancelled'); onCancel(); }}
              style={BTN_GHOST}
            >
              Cancel
            </button>
            <button
              id="plan-comment-btn"
              onClick={() => setMode('commenting')}
              style={BTN_OUTLINE}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit_note</span>
              Comment
            </button>
            <button
              id="plan-proceed-btn"
              onClick={() => onProceed(data.originalQuery)}
              style={BTN_PRIMARY}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>play_arrow</span>
              Proceed
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Shared button styles ---------------------------------------------------

const BTN_BASE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '6px 14px',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: "'Google Sans', sans-serif",
  transition: 'all 0.15s',
  border: 'none',
};

const BTN_PRIMARY: React.CSSProperties = {
  ...BTN_BASE,
  background: '#4f6ef7',
  color: '#fff',
};

const BTN_OUTLINE: React.CSSProperties = {
  ...BTN_BASE,
  background: 'transparent',
  color: 'var(--text)',
  border: '1px solid var(--border)',
};

const BTN_GHOST: React.CSSProperties = {
  ...BTN_BASE,
  background: 'transparent',
  color: 'var(--text-muted)',
  border: '1px solid transparent',
};
