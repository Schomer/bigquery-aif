'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useConversation } from '@/lib/conversation-context';
import {
  getConversations,
  deleteConversation,
  saveConversation,
  type SavedConversation,
} from '@/lib/firestore-service';
import type { ChatMessage, ContextItem } from '@/lib/types';

// -- Helpers -----------------------------------------------------------------

function relativeTime(iso: string | undefined): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// -- Component ---------------------------------------------------------------

interface ChatSidebarProps {
  open: boolean;
  onClose: () => void;
  // Chat state props (for detail view)
  messages: ChatMessage[];
  chatLoading: boolean;
  input: string;
  setInput: (value: string) => void;
  activeProject: string;
  contextItems: ContextItem[];
  onSend: (text?: string) => Promise<void>;
  onRemoveContext: (id: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export function ChatSidebar({
  open,
  onClose,
  messages: chatMessages,
  chatLoading,
  input,
  setInput,
  activeProject,
  contextItems,
  onSend,
  onRemoveContext,
  onKeyDown,
}: ChatSidebarProps) {
  const { user } = useAuth();
  const { conversationId, loadConversation, newConversation } = useConversation();

  const [conversations, setConversations] = useState<SavedConversation[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [panelWidth, setPanelWidth] = useState(280);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('bqaif_pinned_chats');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [filterMode, setFilterMode] = useState<'all' | 'pinned'>('all');
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [view, setView] = useState<'list' | 'detail'>('list');
  const isResizingRef = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const uid = user?.uid;

  const loadConvs = useCallback(() => {
    if (!uid) return;
    setLoading(true);
    getConversations(uid)
      .then(setConversations)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [uid]);

  useEffect(() => { loadConvs(); }, [loadConvs]);
  useEffect(() => { loadConvs(); }, [conversationId, loadConvs]);

  // Auto-scroll detail view when new messages arrive
  useEffect(() => {
    if (view === 'detail' && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages.length, view]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuId && !filterMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuId && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuId(null);
      }
      if (filterMenuOpen && filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        setFilterMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuId, filterMenuOpen]);

  // Persist pinned IDs
  function persistPinned(ids: Set<string>) {
    try { localStorage.setItem('bqaif_pinned_chats', JSON.stringify([...ids])); } catch {}
  }

  function togglePin(id: string) {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persistPinned(next);
      return next;
    });
    setMenuId(null);
  }

  async function handleDelete(id: string) {
    if (!user) return;
    await deleteConversation(user.uid, id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (id === conversationId) newConversation();
    setMenuId(null);
  }

  async function handleRename(id: string) {
    if (!user || !renameValue.trim()) { setRenamingId(null); return; }
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    const updated = { ...conv, title: renameValue.trim() };
    await saveConversation(user.uid, updated);
    setConversations((prev) => prev.map((c) => c.id === id ? updated : c));
    setRenamingId(null);
  }

  function handleSelectConversation(id: string) {
    loadConversation(id);
    setView('detail');
  }

  function handleNewConversation() {
    newConversation();
    setView('detail');
  }

  // Resize handle
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    const startX = e.clientX;
    const startWidth = panelWidth;

    const onMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;
      const deltaX = moveEvent.clientX - startX;
      setPanelWidth(Math.min(Math.max(200, startWidth + deltaX), 450));
    };

    const onUp = () => {
      isResizingRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Auto-resize textarea
  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    const maxHeight = Math.round(14 * 1.5 * 4 + 2);
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
  };

  useEffect(() => {
    if (textareaRef.current) autoResize(textareaRef.current);
  }, [input]);

  // Filter by search + filter mode
  let filtered = search.trim()
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(search.toLowerCase())
      )
    : conversations;

  if (filterMode === 'pinned') {
    filtered = filtered.filter((c) => pinnedIds.has(c.id));
  }

  // Sort: pinned items first (when in "all" mode)
  if (filterMode === 'all') {
    filtered = [...filtered].sort((a, b) => {
      const aPinned = pinnedIds.has(a.id) ? 1 : 0;
      const bPinned = pinnedIds.has(b.id) ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    });
  }

  if (!open) return null;

  // Find the active conversation title for the detail header
  const activeConv = conversations.find((c) => c.id === conversationId);
  const activeTitle = activeConv?.title || 'New chat';

  const filterLabel = filterMode === 'all' ? 'All chats' : 'Pinned';

  // =========================================================================
  // DETAIL VIEW: shows conversation messages + input
  // =========================================================================
  if (view === 'detail') {
    return (
      <div
        style={{
          width: panelWidth,
          minWidth: panelWidth,
          flexShrink: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--chat-bg)',
          borderRight: '1px solid var(--border)',
          position: 'relative',
          userSelect: 'none',
        }}
      >
        {/* Detail header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '10px 8px 8px',
          flexShrink: 0,
          borderBottom: '1px solid var(--border)',
        }}>
          <button
            onClick={() => setView('list')}
            style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              flexShrink: 0,
              transition: 'background 0.12s',
            }}
            title="Back to chats"
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_back</span>
          </button>
          <span style={{
            flex: 1,
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--text)',
            fontFamily: "'Google Sans', sans-serif",
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
          }}>
            {activeTitle}
          </span>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              flexShrink: 0,
              transition: 'background 0.12s',
            }}
            title="Close"
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>left_panel_close</span>
          </button>
        </div>

        {/* Messages area */}
        <div className="chat-sidebar-messages">
          {chatMessages.length === 0 && (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: 13,
              fontFamily: "'Google Sans', sans-serif",
            }}>
              Start a conversation...
            </div>
          )}
          {chatMessages.map((msg, i) => (
            <div key={i}>
              {msg.role === 'user' ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <div className="chat-sidebar-user-msg">
                    {typeof msg.content === 'string' ? msg.content : String(msg.content ?? '')}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {/* Show headline text for envelopes, or raw content */}
                  {msg.envelopes && msg.envelopes.length > 0 ? (
                    msg.envelopes.map((env, ei) => (
                      <div key={ei} className="chat-sidebar-assistant-text" style={{ fontSize: 12 }}>
                        {env.headline.text}
                      </div>
                    ))
                  ) : (
                    msg.content && (
                      <div className="chat-sidebar-assistant-text">
                        {typeof msg.content === 'string' ? msg.content : String(msg.content)}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          ))}
          {chatLoading && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--text-muted)',
              fontSize: 12,
              fontFamily: "'Google Sans', sans-serif",
            }}>
              <span
                className="material-symbols-outlined chat-sidebar-spinner"
                style={{ fontSize: 16, color: 'var(--accent)' }}
              >
                progress_activity
              </span>
              Thinking...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Docked input */}
        <div className="chat-sidebar-input">
          <div className="chat-sidebar-input-inner mystic-prompt-container" style={{
            ...(activeProject ? { background: '#fff', backgroundImage: 'none' } : {}),
          }}>
            {contextItems.length > 0 && (
              <div className="context-chips-row" style={{ marginBottom: 4 }}>
                {contextItems.map((item) => (
                  <span key={item.id} className="context-chip">
                    <span className="material-symbols-outlined">{item.icon}</span>
                    {item.label}
                    <button
                      className="context-chip-dismiss"
                      onClick={() => onRemoveContext(item.id)}
                      aria-label={`Remove ${item.label}`}
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, width: '100%' }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => { setInput(e.target.value); autoResize(e.target); }}
                onKeyDown={onKeyDown}
                placeholder={activeProject ? 'Ask a follow-up...' : 'Select a project first...'}
                disabled={!activeProject}
                rows={1}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text)',
                  fontSize: 13,
                  resize: 'none',
                  lineHeight: 1.5,
                  fontFamily: 'inherit',
                  alignSelf: 'center',
                  opacity: activeProject ? 1 : 0.5,
                  cursor: activeProject ? 'text' : 'not-allowed',
                }}
              />
              <button
                onClick={() => onSend()}
                disabled={chatLoading || !input.trim() || !activeProject}
                style={{
                  width: 30,
                  height: 30,
                  flexShrink: 0,
                  borderRadius: '50%',
                  background: input.trim() ? '#bfdbfe' : 'var(--surface)',
                  border: `1px solid ${input.trim() ? '#93c5fd' : 'var(--border)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: input.trim() ? 'pointer' : 'default',
                  transition: 'all 0.15s',
                  padding: 0,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 13V3M8 3L3.5 7.5M8 3L12.5 7.5" stroke={input.trim() ? '#1d4ed8' : 'var(--text-muted)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={handleResizeMouseDown}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: 4,
            cursor: 'col-resize',
            zIndex: 30,
            transition: 'background 0.12s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 30%, transparent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          title="Drag to resize"
        />
      </div>
    );
  }

  // =========================================================================
  // LIST VIEW: shows all conversations
  // =========================================================================
  return (
    <div
      style={{
        width: panelWidth,
        minWidth: panelWidth,
        flexShrink: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--chat-bg)',
        borderRight: '1px solid var(--border)',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 12px 6px',
        height: 48,
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 18,
          fontWeight: 600,
          color: 'var(--text)',
          fontFamily: "'Google Sans', sans-serif",
          letterSpacing: '-0.01em',
        }}>
          Chats
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              transition: 'background 0.12s',
            }}
            title="Collapse"
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>left_panel_close</span>
          </button>
        </div>
      </div>

      {/* New + Filter row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px 6px',
        flexShrink: 0,
      }}>
        <button
          onClick={handleNewConversation}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--accent)',
            fontSize: 13,
            fontWeight: 500,
            fontFamily: "'Google Sans', sans-serif",
            padding: '6px 10px',
            borderRadius: 20,
            transition: 'background 0.12s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
          New
        </button>

        {/* All chats dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setFilterMenuOpen(!filterMenuOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              color: 'var(--text-muted)',
              fontWeight: 500,
              fontFamily: "'Google Sans', sans-serif",
              padding: '4px 8px',
              borderRadius: 16,
              transition: 'background 0.12s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
          >
            {filterLabel}
            <span className="material-symbols-outlined" style={{ fontSize: 16, marginLeft: 1 }}>arrow_drop_down</span>
          </button>

          {filterMenuOpen && (
            <div
              ref={filterMenuRef}
              style={{
                position: 'absolute',
                right: 0,
                top: 32,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                boxShadow: '0 6px 24px rgba(0,0,0,0.14)',
                zIndex: 100,
                padding: 4,
                minWidth: 140,
              }}
            >
              {[
                { key: 'all' as const, label: 'All chats', icon: 'forum' },
                { key: 'pinned' as const, label: 'Pinned', icon: 'push_pin' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '8px 12px',
                    background: filterMode === opt.key ? 'var(--accent-bg, color-mix(in srgb, var(--accent) 10%, transparent))' : 'none',
                    border: 'none', cursor: 'pointer',
                    fontSize: 13, color: 'var(--text)', borderRadius: 8,
                    fontFamily: "'Google Sans', sans-serif", transition: 'background 0.1s',
                    fontWeight: filterMode === opt.key ? 500 : 400,
                  }}
                  onMouseEnter={(e) => { if (filterMode !== opt.key) e.currentTarget.style.background = 'var(--surface-2)'; }}
                  onMouseLeave={(e) => { if (filterMode !== opt.key) e.currentTarget.style.background = 'none'; }}
                  onClick={() => { setFilterMode(opt.key); setFilterMenuOpen(false); }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '0 8px 6px', flexShrink: 0 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '7px 12px',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--surface)',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--text-dim)' }}>search</span>
          <input
            type="text"
            placeholder="Search chat"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'none',
              fontSize: 13,
              color: 'var(--text)',
              fontFamily: "'Google Sans', sans-serif",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 0, display: 'flex' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
            </button>
          )}
        </div>
      </div>

      {/* Conversation list */}
      <div className="chat-sidebar-item-list" style={{ flex: 1, overflowY: 'auto', padding: '0 6px 8px' }}>
        {loading && (
          <>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{ padding: '12px 10px', borderRadius: 10 }}>
                <div style={{ height: 13, width: '55%', borderRadius: 4, background: 'var(--border)', opacity: 0.5 }} />
                <div style={{ height: 10, width: '35%', borderRadius: 4, background: 'var(--border)', opacity: 0.4, marginTop: 6 }} />
              </div>
            ))}
          </>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 16px',
            textAlign: 'center',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--text-dim)', marginBottom: 8 }}>forum</span>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>
              {search ? 'No chats match your search' : filterMode === 'pinned' ? 'No pinned chats' : 'No conversations yet'}
            </p>
          </div>
        )}

        {!loading && filtered.map((conv) => {
          const isActive = conv.id === conversationId;
          const isPinned = pinnedIds.has(conv.id);
          const timestamp = relativeTime(conv.updatedAt);

          return (
            <div
              key={conv.id}
              className="chat-sidebar-item"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '10px 10px',
                cursor: 'pointer',
                position: 'relative',
                borderRadius: 10,
                background: isActive ? 'var(--accent-bg, color-mix(in srgb, var(--accent) 10%, transparent))' : 'transparent',
                transition: 'background 0.12s',
              }}
              onClick={() => handleSelectConversation(conv.id)}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--surface-2)'; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              {/* Status indicator column */}
              <div style={{ width: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 20, marginTop: 1 }}>
                {isActive ? (
                  <span
                    className="material-symbols-outlined chat-sidebar-spinner"
                    style={{ fontSize: 16, color: 'var(--accent)' }}
                  >
                    progress_activity
                  </span>
                ) : (
                  <span style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    opacity: 0.65,
                    flexShrink: 0,
                  }} />
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {renamingId === conv.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => handleRename(conv.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(conv.id);
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: '100%',
                      padding: '2px 6px',
                      fontSize: 13,
                      fontWeight: 500,
                      border: '1px solid var(--accent)',
                      borderRadius: 4,
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      outline: 'none',
                      fontFamily: "'Google Sans', sans-serif",
                    }}
                  />
                ) : (
                  <>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 4,
                    }}>
                      <p style={{
                        margin: 0,
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--text)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontFamily: "'Google Sans', sans-serif",
                        flex: 1,
                        minWidth: 0,
                      }}>
                        {conv.title}
                      </p>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
                        {/* Pin indicator */}
                        {isPinned && (
                          <span className="material-symbols-outlined" style={{
                            fontSize: 14,
                            color: 'var(--text-dim)',
                            transform: 'rotate(45deg)',
                          }}>push_pin</span>
                        )}

                        {/* Three-dot menu */}
                        <button
                          className="chat-sidebar-actions"
                          style={{
                            width: 24,
                            height: 24,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '50%',
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-dim)',
                            flexShrink: 0,
                            padding: 0,
                            opacity: menuId === conv.id ? 1 : undefined,
                          }}
                          onClick={(e) => { e.stopPropagation(); setMenuId(menuId === conv.id ? null : conv.id); }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.06)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>more_vert</span>
                        </button>
                      </div>
                    </div>
                    {/* Timestamp */}
                    <p style={{
                      margin: '2px 0 0',
                      fontSize: 12,
                      color: 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      fontFamily: "'Google Sans', sans-serif",
                    }}>
                      {timestamp}
                    </p>
                  </>
                )}
              </div>

              {/* Context menu */}
              {menuId === conv.id && (
                <div
                  ref={menuRef}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: 36,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    boxShadow: '0 6px 24px rgba(0,0,0,0.14)',
                    zIndex: 100,
                    padding: 4,
                    minWidth: 150,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      width: '100%', padding: '8px 12px',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 13, color: 'var(--text)', borderRadius: 8,
                      fontFamily: "'Google Sans', sans-serif", transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                    onClick={(e) => { e.stopPropagation(); togglePin(conv.id); }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>push_pin</span>
                    {isPinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      width: '100%', padding: '8px 12px',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 13, color: 'var(--text)', borderRadius: 8,
                      fontFamily: "'Google Sans', sans-serif", transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenamingId(conv.id);
                      setRenameValue(conv.title);
                      setMenuId(null);
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                    Rename
                  </button>
                  <button
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      width: '100%', padding: '8px 12px',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 13, color: 'var(--issue)', borderRadius: 8,
                      fontFamily: "'Google Sans', sans-serif", transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                    onClick={(e) => { e.stopPropagation(); handleDelete(conv.id); }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                    Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Resize handle on right edge */}
      <div
        onMouseDown={handleResizeMouseDown}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: 4,
          cursor: 'col-resize',
          zIndex: 30,
          transition: 'background 0.12s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 30%, transparent)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        title="Drag to resize"
      />
    </div>
  );
}
