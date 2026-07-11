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
  visible: boolean;
  onSelectChat?: () => void;
  /** 'overlay' = unified layout (auto-hide on selection). 'persistent' = split layout (always visible, internal nav). */
  mode?: 'overlay' | 'persistent';
  /** Which side the border goes on. Default 'right'. */
  side?: 'left' | 'right';
  /** Whether the active chat is currently processing a request. */
  activeLoading?: boolean;
}

// Key for localStorage seen-timestamps map
const SEEN_KEY = 'bqaif_chat_seen';

function readSeenMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function markSeen(id: string) {
  const map = readSeenMap();
  map[id] = new Date().toISOString();
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(map)); } catch {}
}

export function ChatSidebar({
  visible,
  onSelectChat,
  mode = 'overlay',
  side = 'right',
  activeLoading = false,
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
  // In persistent mode, tracks whether we show the chats list or the single thread
  const [sidebarView, setSidebarView] = useState<'list' | 'thread'>(
    mode === 'persistent' && conversationId ? 'thread' : 'list'
  );
  const isResizingRef = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);

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

  // Track seen state
  const [seenMap, setSeenMap] = useState<Record<string, string>>(() => readSeenMap());

  // Mark current conversation as seen whenever it changes or loading finishes
  useEffect(() => {
    if (conversationId && !activeLoading) {
      markSeen(conversationId);
      setSeenMap(readSeenMap());
    }
  }, [conversationId, activeLoading]);

  function handleSelectConversation(id: string) {
    markSeen(id);
    setSeenMap(readSeenMap());
    loadConversation(id);
    if (mode === 'persistent') {
      // In persistent mode, navigate to the thread view within the sidebar
      setSidebarView('thread');
    }
    onSelectChat?.();
  }

  function handleNewConversation() {
    newConversation();
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

  const filterLabel = filterMode === 'all' ? 'All chats' : 'Pinned';

  // In persistent mode, whether to show the chats list
  const showList = mode === 'overlay' || sidebarView === 'list';
  const showThread = mode === 'persistent' && sidebarView === 'thread';

  // Find active conversation title for thread view header
  const activeConv = conversations.find((c) => c.id === conversationId);

  // Border goes on the appropriate side
  const borderStyle = visible ? '1px solid var(--border)' : 'none';

  return (
    <div
      style={{
        width: visible ? panelWidth : 0,
        minWidth: visible ? panelWidth : 0,
        flexShrink: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--chat-bg)',
        borderRight: side === 'right' ? borderStyle : 'none',
        borderLeft: side === 'left' ? borderStyle : 'none',
        position: 'relative',
        userSelect: 'none',
        overflow: 'hidden',
        transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* === THREAD VIEW (persistent mode only) === */}
      {showThread && (
        <>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '10px 8px 6px',
            height: 48,
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}>
            <button
              onClick={() => setSidebarView('list')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                fontSize: 13,
                fontWeight: 500,
                fontFamily: "'Google Sans', sans-serif",
                padding: '6px 8px',
                borderRadius: 8,
                transition: 'background 0.12s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
              All chats
            </button>
          </div>
          <div style={{
            padding: '0 12px 10px',
            flexShrink: 0,
          }}>
            <p style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--text)',
              fontFamily: "'Google Sans', sans-serif",
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {activeConv?.title || 'Current chat'}
            </p>
            {activeConv?.updatedAt && (
              <p style={{
                margin: '2px 0 0',
                fontSize: 12,
                color: 'var(--text-muted)',
                fontFamily: "'Google Sans', sans-serif",
              }}>
                {relativeTime(activeConv.updatedAt)}
              </p>
            )}
          </div>
        </>
      )}

      {/* === CHATS LIST VIEW === */}
      {showList && (
      <>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 12px 6px',
        height: 48,
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}>
        <span style={{
          fontSize: 18,
          fontWeight: 500,
          color: 'var(--text)',
          fontFamily: "'Google Sans', sans-serif",
          letterSpacing: '-0.01em',
        }}>
          Chats
        </span>
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
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = isActive ? 'var(--accent-bg, color-mix(in srgb, var(--accent) 10%, transparent))' : 'transparent'; }}
            >
              {/* Status indicator column */}
              <div style={{ width: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 20, marginTop: 1 }}>
                {isActive && activeLoading ? (
                  <span
                    className="material-symbols-outlined chat-sidebar-spinner"
                    style={{ fontSize: 16, color: 'var(--accent)' }}
                  >
                    progress_activity
                  </span>
                ) : (() => {
                  const lastSeen = seenMap[conv.id];
                  const hasUnseen = conv.updatedAt && (!lastSeen || conv.updatedAt > lastSeen);
                  return hasUnseen ? (
                    <span style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'var(--accent)',
                      opacity: 0.65,
                      flexShrink: 0,
                    }} />
                  ) : null;
                })()}
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
                        fontWeight: 500,
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
      </>
      )}

      {/* Resize handle */}
      <div
        onMouseDown={handleResizeMouseDown}
        style={{
          position: 'absolute',
          top: 0,
          [side === 'left' ? 'left' : 'right']: 0,
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
