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

// ── Helpers ──────────────────────────────────────────────────────────────────

function getPreview(conv: SavedConversation): string {
  // Find the first user message for a preview
  const firstUser = conv.messages.find((m) => m.role === 'user');
  if (firstUser) {
    const text = typeof firstUser.content === 'string'
      ? firstUser.content
      : JSON.stringify(firstUser.content);
    return text.slice(0, 80);
  }
  return '';
}

function isUnread(_conv: SavedConversation): boolean {
  // Placeholder -- could track read state in Firestore
  return false;
}

// ── Component ────────────────────────────────────────────────────────────────

interface ChatSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function ChatSidebar({ open, onClose }: ChatSidebarProps) {
  const { user } = useAuth();
  const { conversationId, loadConversation, newConversation } = useConversation();

  const [conversations, setConversations] = useState<SavedConversation[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

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
    if (!menuId) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuId]);

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

  // Filter by search
  const filtered = search.trim()
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        getPreview(c).toLowerCase().includes(search.toLowerCase())
      )
    : conversations;

  const S = styles;

  return (
    <div style={{
      ...S.container,
      width: open ? 340 : 0,
      minWidth: open ? 340 : 0,
      opacity: open ? 1 : 0,
      overflow: open ? 'visible' : 'hidden',
    }}>
      <div style={S.inner}>
        {/* Header */}
        <div style={S.header}>
          <h2 style={S.title}>Chats</h2>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              style={S.headerBtn}
              title="Close panel"
              onClick={onClose}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
            </button>
          </div>
        </div>

        {/* New + filter row */}
        <div style={S.actionRow}>
          <button
            style={S.newBtn}
            onClick={() => newConversation()}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
            New
          </button>
          <span style={S.filterLabel}>All chats</span>
        </div>

        {/* Search */}
        <div style={S.searchWrap}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--text-dim)' }}>search</span>
          <input
            type="text"
            placeholder="Search chat"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={S.searchInput}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 0 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
            </button>
          )}
        </div>

        {/* Conversation list */}
        <div style={S.list}>
          {loading && (
            <>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} style={S.skeleton}>
                  <div style={{ ...S.skeletonLine, width: '60%' }} />
                  <div style={{ ...S.skeletonLine, width: '90%', height: 10, marginTop: 6 }} />
                </div>
              ))}
            </>
          )}

          {!loading && filtered.length === 0 && (
            <div style={S.empty}>
              <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--text-dim)', marginBottom: 8 }}>forum</span>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>
                {search ? 'No chats match your search' : 'No conversations yet'}
              </p>
            </div>
          )}

          {!loading && filtered.map((conv) => {
            const isActive = conv.id === conversationId;
            const preview = getPreview(conv);
            const unread = isUnread(conv);

            return (
              <div
                key={conv.id}
                style={{
                  ...S.convItem,
                  background: isActive ? 'var(--accent-bg, color-mix(in srgb, var(--accent) 10%, transparent))' : 'transparent',
                  borderRadius: 10,
                }}
                onClick={() => loadConversation(conv.id)}
                onContextMenu={(e) => { e.preventDefault(); setMenuId(conv.id); }}
              >
                {/* Unread dot */}
                {unread && <div style={S.unreadDot} />}

                {/* Loading indicator for active */}
                {isActive && (
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--accent)', flexShrink: 0 }}>progress_activity</span>
                )}

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
                      style={S.renameInput}
                    />
                  ) : (
                    <>
                      <div style={{
                        ...S.convTitle,
                        fontWeight: unread ? 600 : 500,
                      }}>
                        {conv.title}
                      </div>
                      {preview && (
                        <div style={S.convPreview}>{preview}</div>
                      )}
                    </>
                  )}
                </div>

                {/* Pin icon for active */}
                {isActive && (
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--text-dim)', flexShrink: 0 }}>push_pin</span>
                )}

                {/* Three-dot menu trigger */}
                <button
                  className="chat-sidebar-actions"
                  style={S.menuTrigger}
                  onClick={(e) => { e.stopPropagation(); setMenuId(menuId === conv.id ? null : conv.id); }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>more_horiz</span>
                </button>

                {/* Context menu */}
                {menuId === conv.id && (
                  <div ref={menuRef} style={S.menu}>
                    <button
                      style={S.menuItem}
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
                      style={{ ...S.menuItem, color: 'var(--issue)' }}
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
      </div>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  container: {
    height: '100%',
    borderRight: '1px solid var(--border)',
    background: 'var(--surface)',
    transition: 'width 0.2s ease, min-width 0.2s ease, opacity 0.15s ease',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column' as const,
  },
  inner: {
    width: 340,
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 16px 8px',
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--text)',
    fontFamily: "'Google Sans', sans-serif",
  },
  headerBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-muted)',
    padding: 4,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
  } as React.CSSProperties,
  actionRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 16px 8px',
  },
  newBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--accent)',
    fontSize: 14,
    fontWeight: 500,
    fontFamily: "'Google Sans', sans-serif",
    padding: '4px 0',
  } as React.CSSProperties,
  filterLabel: {
    fontSize: 13,
    color: 'var(--text-muted)',
    fontWeight: 500,
    fontFamily: "'Google Sans', sans-serif",
  } as React.CSSProperties,
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    margin: '0 12px 8px',
    padding: '8px 12px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'none',
    fontSize: 13,
    color: 'var(--text)',
    fontFamily: "'Google Sans', sans-serif",
  } as React.CSSProperties,
  list: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '0 8px 8px',
  },
  convItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '10px 12px',
    cursor: 'pointer',
    position: 'relative' as const,
    transition: 'background 0.12s',
  },
  convTitle: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text)',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontFamily: "'Google Sans', sans-serif",
  },
  convPreview: {
    fontSize: 12,
    color: 'var(--text-muted)',
    marginTop: 2,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontFamily: "'Google Sans', sans-serif",
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: 'var(--accent)',
    flexShrink: 0,
    marginTop: 5,
  },
  menuTrigger: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-dim)',
    padding: 2,
    borderRadius: 4,
    opacity: 0,
    transition: 'opacity 0.1s',
    flexShrink: 0,
    position: 'absolute' as const,
    right: 8,
    top: 10,
  } as React.CSSProperties,
  menu: {
    position: 'absolute' as const,
    right: 8,
    top: 36,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    zIndex: 100,
    padding: 4,
    minWidth: 140,
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '8px 12px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    color: 'var(--text)',
    borderRadius: 6,
    fontFamily: "'Google Sans', sans-serif",
    transition: 'background 0.1s',
  } as React.CSSProperties,
  renameInput: {
    width: '100%',
    padding: '4px 8px',
    fontSize: 13,
    border: '1px solid var(--accent)',
    borderRadius: 6,
    background: 'var(--surface)',
    color: 'var(--text)',
    outline: 'none',
    fontFamily: "'Google Sans', sans-serif",
  } as React.CSSProperties,
  skeleton: {
    padding: '12px 12px',
    borderRadius: 10,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 4,
    background: 'var(--border)',
    opacity: 0.5,
  } as React.CSSProperties,
  empty: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 16px',
    textAlign: 'center' as const,
  },
};
