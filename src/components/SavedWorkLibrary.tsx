'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  getItems,
  deleteItem,
  updateItem,
  searchItems,
  type SavedItem,
} from '@/lib/saved-work';

// ── Types ────────────────────────────────────────────────────────────────────

interface SavedWorkLibraryProps {
  userId: string;
  onLoadItem: (item: SavedItem) => void;
  onNavigate: (page: string) => void;
}

// ── Constants ────────────────────────────────────────────────────────────────

const TABS: Array<{ label: string; type: SavedItem['type'] | 'all' }> = [
  { label: 'All', type: 'all' },
  { label: 'Queries', type: 'query' },
  { label: 'Views', type: 'view' },
  { label: 'Checks', type: 'check' },
  { label: 'Setups', type: 'setup' },
  { label: 'Pipelines', type: 'pipeline' },
];

const TYPE_ICONS: Record<string, string> = {
  query: 'query_stats',
  view: 'visibility',
  check: 'fact_check',
  setup: 'settings',
  pipeline: 'conversion_path',
};

const EMPTY_MESSAGES: Record<string, string> = {
  all: 'No saved items yet. Run a query, check, or pipeline and click Save to add it here.',
  query: 'No saved queries yet. Run a query and click Save to add it here.',
  view: 'No saved views yet.',
  check: 'No saved checks yet. Run a data quality check and click Save to add it here.',
  setup: 'No saved setups yet.',
  pipeline: 'No saved pipelines yet. Create a pipeline and click Save to add it here.',
};

type SortKey = 'recent' | 'name' | 'type';

// ── Component ────────────────────────────────────────────────────────────────

export function SavedWorkLibrary({ userId, onLoadItem, onNavigate }: SavedWorkLibraryProps) {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [activeTab, setActiveTab] = useState<SavedItem['type'] | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('recent');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const typeFilter = activeTab === 'all' ? undefined : activeTab;
      if (searchQuery.trim()) {
        const results = await searchItems(userId, searchQuery.trim());
        setItems(typeFilter ? results.filter((i) => i.type === typeFilter) : results);
      } else {
        const results = await getItems(userId, typeFilter);
        setItems(results);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [userId, activeTab, searchQuery]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  async function handleDelete(itemId: string) {
    try {
      await deleteItem(userId, itemId);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch {
      // Silently fail -- the item may already be deleted
    } finally {
      setDeletingId(null);
    }
  }

  async function handleTogglePin(item: SavedItem) {
    try {
      await updateItem(userId, item.id, { pinned: !item.pinned });
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, pinned: !i.pinned } : i))
      );
    } catch {
      // Ignore
    }
  }

  // Sort items
  const sorted = [...items].sort((a, b) => {
    // Pinned items always first
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'type':
        return a.type.localeCompare(b.type);
      case 'recent':
      default:
        return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    }
  });

  function formatDate(iso: string): string {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffHours = Math.floor(diffMs / 3_600_000);
      if (diffHours < 1) return 'Just now';
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return d.toLocaleDateString();
    } catch {
      return '';
    }
  }

  function truncateSql(sql: string, maxLen = 120): string {
    const oneLine = sql.replace(/\s+/g, ' ').trim();
    return oneLine.length > maxLen ? oneLine.slice(0, maxLen) + '...' : oneLine;
  }

  return (
    <div className="saved-work-library" style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--chat-bg)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '24px 32px 0',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h1 style={{
            fontSize: 22,
            fontWeight: 600,
            margin: 0,
            color: 'var(--text)',
          }}>
            Saved Work
          </h1>
          <button
            onClick={() => onNavigate('chat')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: 6,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
            }}
            title="Back to chat"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        {/* Search + Sort row */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '6px 12px',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--text-muted)' }}>search</span>
            <input
              type="text"
              placeholder="Search saved items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                border: 'none',
                background: 'none',
                outline: 'none',
                fontSize: 13,
                color: 'var(--text)',
                fontFamily: 'inherit',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
              </button>
            )}
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '6px 10px',
              fontSize: 12,
              color: 'var(--text)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <option value="recent">Most recent</option>
            <option value="name">Name</option>
            <option value="type">Type</option>
          </select>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 0 }}>
          {TABS.map((tab) => (
            <button
              key={tab.type}
              onClick={() => setActiveTab(tab.type)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.type ? '2px solid var(--accent)' : '2px solid transparent',
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: activeTab === tab.type ? 600 : 400,
                color: activeTab === tab.type ? 'var(--accent)' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'color 0.15s, border-color 0.15s',
                fontFamily: 'inherit',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '16px 32px 32px',
      }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            Loading...
          </div>
        ) : sorted.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '64px 0',
            color: 'var(--text-muted)',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 48, display: 'block', marginBottom: 16, opacity: 0.4 }}>
              bookmark
            </span>
            <p style={{ fontSize: 14, margin: 0, maxWidth: 400, marginInline: 'auto', lineHeight: 1.6 }}>
              {EMPTY_MESSAGES[activeTab] || EMPTY_MESSAGES.all}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sorted.map((item) => (
              <div
                key={item.id}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '14px 16px',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Row 1: type badge + name + actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span className="material-symbols-outlined" style={{
                    fontSize: 18,
                    color: 'var(--accent)',
                    flexShrink: 0,
                  }}>
                    {TYPE_ICONS[item.type] || 'bookmark'}
                  </span>
                  <span style={{
                    display: 'inline-block',
                    background: 'var(--surface-hover, rgba(255,255,255,0.06))',
                    borderRadius: 4,
                    padding: '2px 7px',
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--text-muted)',
                    flexShrink: 0,
                  }}>
                    {item.type}
                  </span>
                  <span style={{
                    flex: 1,
                    fontSize: 14,
                    fontWeight: 500,
                    color: 'var(--text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {item.name}
                  </span>
                  {item.pinned && (
                    <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--accent)', flexShrink: 0 }}>
                      push_pin
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}>
                    {formatDate(item.updatedAt)}
                  </span>
                </div>

                {/* Row 2: description */}
                {item.description && (
                  <p style={{
                    margin: '0 0 6px 28px',
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    lineHeight: 1.5,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {item.description}
                  </p>
                )}

                {/* Row 3: SQL preview */}
                {item.data.sql && (
                  <div style={{
                    margin: '0 0 8px 28px',
                    background: 'var(--chat-bg)',
                    borderRadius: 6,
                    padding: '6px 10px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--text-dim)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {truncateSql(item.data.sql)}
                  </div>
                )}

                {/* Row 4: action buttons */}
                <div style={{ display: 'flex', gap: 6, marginLeft: 28 }}>
                  <button
                    onClick={() => onLoadItem(item)}
                    style={{
                      background: 'var(--accent)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '5px 12px',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontFamily: 'inherit',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>play_arrow</span>
                    Load
                  </button>
                  <button
                    onClick={() => handleTogglePin(item)}
                    title={item.pinned ? 'Unpin' : 'Pin'}
                    style={{
                      background: 'none',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '5px 8px',
                      cursor: 'pointer',
                      color: item.pinned ? 'var(--accent)' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      fontFamily: 'inherit',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                      {item.pinned ? 'push_pin' : 'push_pin'}
                    </span>
                  </button>
                  {deletingId === item.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                      <span>Delete?</span>
                      <button
                        onClick={() => handleDelete(item.id)}
                        style={{
                          background: 'var(--error, #e53935)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 4,
                          padding: '3px 8px',
                          fontSize: 11,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        style={{
                          background: 'none',
                          border: '1px solid var(--border)',
                          borderRadius: 4,
                          padding: '3px 8px',
                          fontSize: 11,
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          fontFamily: 'inherit',
                        }}
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeletingId(item.id)}
                      title="Delete"
                      style={{
                        background: 'none',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        padding: '5px 8px',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        fontFamily: 'inherit',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
