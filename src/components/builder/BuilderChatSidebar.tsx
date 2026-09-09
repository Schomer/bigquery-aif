'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { BuilderDocument, BuilderTile } from '@/lib/builder-types';
import type { ChatMessage, StepInfo } from '@/lib/types';
import { ChatOrchestrator } from '@/lib/chat-orchestrator';
import { useAuth } from '@/lib/auth-context';
import { useBuilder } from '@/lib/builder-context';

interface Props {
  document: BuilderDocument;
  selectedTile: BuilderTile | null;
  onClearSelectedTile: () => void;
  onClose: () => void;
  onRefreshDocument?: () => void;
}

export function BuilderChatSidebar({
  document,
  selectedTile,
  onClearSelectedTile,
  onClose,
  onRefreshDocument,
}: Props) {
  const { activeProject, user } = useAuth();
  const builder = useBuilder();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [liveSteps, setLiveSteps] = useState<(string | StepInfo)[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, liveSteps, statusText]);

  const handleSend = useCallback(async (promptText?: string) => {
    const text = (promptText ?? input).trim();
    if (!text || loading) return;

    setInput('');
    setLoading(true);
    setStatusText('Thinking...');
    setLiveSteps([]);

    const controller = new AbortController();
    abortRef.current = controller;

    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    const nextMsgs = [...messages, userMsg];
    setMessages(nextMsgs);

    try {
      const activeDashboardInfo = {
        id: document.id,
        name: document.name,
        type: document.type,
        tiles: document.tiles.map((t) => ({
          id: t.id,
          title: t.title,
          vizType: t.vizType,
          sql: t.cachedSql || t.parameterizedSql,
          colorPalette: t.colorPalette,
        })),
        globalFilters: document.globalFilters?.map((f) => ({
          id: f.id,
          label: f.label,
          paramName: f.paramName,
          column: f.column,
          type: f.type,
          options: f.options,
        })),
        interactions: document.interactions?.map((i) => ({
          id: i.id,
          dimension: i.dimension,
          sourceTileTitle: i.sourceTileTitle,
          targetTileTitles: i.targetTileTitles,
        })),
      };

      const selectedTileInfo = selectedTile
        ? {
            id: selectedTile.id,
            title: selectedTile.title,
            vizType: selectedTile.vizType,
            sql: selectedTile.cachedSql || selectedTile.parameterizedSql,
            colorPalette: selectedTile.colorPalette,
          }
        : undefined;

      const result = await ChatOrchestrator.processMessage({
        message: text,
        history: messages,
        context: {
          project: activeProject,
          uid: user?.uid,
        },
        activeDashboard: activeDashboardInfo as any,
        selectedTile: selectedTileInfo as any,
        onStatus: (s) => {
          if (controller.signal.aborted) return;
          const statusStr = typeof s === 'string' ? s : s.text;
          setStatusText(statusStr);
          setLiveSteps((prev) => [...prev, s]);
        },
        signal: controller.signal,
      });

      const envelopes = result.envelopes || [];
      const replyText =
        envelopes[0]?.headline?.text ||
        (typeof envelopes[0]?.primaryArtifact?.data === 'object' && (envelopes[0]?.primaryArtifact?.data as any)?.text) ||
        'Updated dashboard based on your prompt.';

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: replyText,
        envelopes,
        timestamp: new Date().toISOString(),
      };

      setMessages([...nextMsgs, assistantMsg]);

      // Trigger document refresh in UI
      onRefreshDocument?.();
    } catch (err: any) {
      if (err?.name !== 'AbortError' && !controller.signal.aborted) {
        const errorMsg: ChatMessage = {
          role: 'assistant',
          content: err instanceof Error ? err.message : 'An error occurred while updating the dashboard.',
          timestamp: new Date().toISOString(),
        };
        setMessages([...nextMsgs, errorMsg]);
      }
    } finally {
      setLoading(false);
      setStatusText(null);
      setLiveSteps([]);
      abortRef.current = null;
    }
  }, [input, loading, messages, document, selectedTile, activeProject, user?.uid, onRefreshDocument]);

  const handleStop = () => {
    abortRef.current?.abort();
    setLoading(false);
    setStatusText(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Context-aware suggestion chips
  const suggestions = selectedTile
    ? [
        `Change to Bar Chart`,
        `Change to Line Chart`,
        `Use Sunset color palette`,
        `Use Ocean color palette`,
      ]
    : [
        `When clicking a country in the map, filter the other charts`,
        `Add a Date Range filter`,
        `Add a Dropdown filter for status`,
        `Use Emerald theme for this dashboard`,
      ];

  return (
    <aside
      aria-label="AI Assistant Sidebar"
      style={{
        width: 340,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface, #ffffff)',
        borderLeft: '1px solid var(--border)',
        flexShrink: 0,
        boxShadow: '-2px 0 12px rgba(0,0,0,0.04)',
        zIndex: 25,
      }}
    >
      {/* ── Sidebar Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 18, color: '#1a73e8' }}
          >
            auto_awesome
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            AI Assistant
          </span>
        </div>

        <button
          onClick={onClose}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 6,
            border: 'none',
            background: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2, #f1f3f4)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
          title="Close AI Assistant"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            close
          </span>
        </button>
      </div>

      {/* ── Active Selection Scope Bar ── */}
      <div
        style={{
          padding: '8px 14px',
          borderBottom: '1px solid var(--border-subtle, #f0f0f0)',
          background: selectedTile ? 'rgba(26, 115, 232, 0.06)' : 'var(--surface-2, #f8f9fa)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: 15,
            color: selectedTile ? '#1a73e8' : 'var(--text-dim)',
          }}
        >
          {selectedTile ? 'view_compact' : 'dashboard'}
        </span>

        {selectedTile ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
            <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>Target:</span>
            <span
              style={{
                color: '#1a73e8',
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={selectedTile.title}
            >
              {selectedTile.title} ({selectedTile.vizType || 'TABLE'})
            </span>
            <button
              onClick={onClearSelectedTile}
              style={{
                marginLeft: 'auto',
                padding: '1px 5px',
                border: 'none',
                background: 'rgba(26, 115, 232, 0.15)',
                color: '#1a73e8',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 500,
                flexShrink: 0,
              }}
              title="Clear card context"
            >
              Clear
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
            <span style={{ color: 'var(--text-muted)' }}>Target:</span>
            <span
              style={{
                color: 'var(--text)',
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              Entire Dashboard ({document.tiles.length} cards)
            </span>
          </div>
        )}
      </div>

      {/* ── Messages Stream ── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              padding: '24px 8px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 32, color: 'var(--text-dim)', marginBottom: 8, display: 'block' }}
            >
              magic_button
            </span>
            <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
              Prompt to Update Dashboard
            </div>
            <div>
              Ask the AI to modify tiles, switch chart types, apply color palettes, create interactive filters, or wire cross-filtering across cards.
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isUser ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '90%',
                    padding: '8px 12px',
                    borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    background: isUser ? '#1a73e8' : 'var(--surface-2, #f1f3f4)',
                    color: isUser ? '#ffffff' : 'var(--text)',
                    fontSize: 12.5,
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            );
          })
        )}

        {/* Live Loading / Thinking Status */}
        {loading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 8,
              background: 'var(--surface-2, #f1f3f4)',
              color: 'var(--text-muted)',
              fontSize: 12,
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 16, animation: 'spin 1.2s linear infinite', color: '#1a73e8' }}
            >
              progress_activity
            </span>
            <span>{statusText || 'Updating dashboard...'}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Context Suggestions / Chips ── */}
      <div
        style={{
          padding: '8px 12px',
          borderTop: '1px solid var(--border-subtle, #f0f0f0)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          background: 'var(--surface)',
        }}
      >
        {suggestions.map((chip, i) => (
          <button
            key={i}
            onClick={() => handleSend(chip)}
            disabled={loading}
            style={{
              padding: '4px 9px',
              borderRadius: 14,
              border: '1px solid var(--border)',
              background: 'var(--surface-2, #f8f9fa)',
              color: 'var(--text)',
              fontSize: 11,
              cursor: loading ? 'default' : 'pointer',
              whiteSpace: 'nowrap',
              fontFamily: "'Google Sans', sans-serif",
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.background = '#eff6ff';
                e.currentTarget.style.borderColor = '#93c5fd';
                e.currentTarget.style.color = '#1a73e8';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--surface-2, #f8f9fa)';
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--text)';
            }}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* ── Prompt Input Bar ── */}
      <div
        style={{
          padding: '10px 12px 14px',
          borderTop: '1px solid var(--border)',
          background: 'var(--surface)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 8,
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '6px 8px',
            background: 'var(--surface)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedTile
                ? `Update "${selectedTile.title}" (chart type, color, query)...`
                : 'Update dashboard, add filter, set interactions...'
            }
            rows={2}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontSize: 12.5,
              color: 'var(--text)',
              background: 'transparent',
              fontFamily: 'inherit',
              lineHeight: 1.4,
            }}
          />

          {loading ? (
            <button
              onClick={handleStop}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 30,
                height: 30,
                borderRadius: 8,
                border: 'none',
                background: '#fee2e2',
                color: '#dc2626',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              title="Stop request"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                stop
              </span>
            </button>
          ) : (
            <button
              onClick={() => handleSend()}
              disabled={!input.trim()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 30,
                height: 30,
                borderRadius: 8,
                border: 'none',
                background: input.trim() ? '#1a73e8' : 'var(--surface-2, #e8eaed)',
                color: input.trim() ? '#ffffff' : 'var(--text-dim)',
                cursor: input.trim() ? 'pointer' : 'default',
                flexShrink: 0,
                transition: 'all 0.15s',
              }}
              title="Send prompt"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                arrow_upward
              </span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
