'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SavedArtifact, SavedArtifactType } from '@/lib/types';
import { getArtifacts, deleteArtifact, updateArtifact, searchArtifacts } from '@/lib/saved-work';

// ── Constants ────────────────────────────────────────────────────────────────

type TabKey = 'all' | SavedArtifactType;
type SortMode = 'recent' | 'name' | 'most-used' | 'type';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'query', label: 'Queries' },
  { key: 'workflow', label: 'Workflows' },
  { key: 'pipeline', label: 'Pipelines' },
];

const TYPE_ICONS: Record<string, string> = {
  query: 'query_stats',
  workflow: 'conversion_path',
  pipeline: 'schedule',
  app: 'apps',
};

const TYPE_LABELS: Record<string, string> = {
  query: 'Query',
  workflow: 'Workflow',
  pipeline: 'Pipeline',
  app: 'App',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function sortItems(items: SavedArtifact[], mode: SortMode): SavedArtifact[] {
  const copy = [...items];
  switch (mode) {
    case 'recent':
      return copy.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    case 'name':
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case 'most-used':
      return copy.sort((a, b) => (b.runCount || 0) - (a.runCount || 0));
    case 'type':
      return copy.sort((a, b) => {
        const typeCmp = a.type.localeCompare(b.type);
        if (typeCmp !== 0) return typeCmp;
        return a.name.localeCompare(b.name);
      });
    default:
      return copy;
  }
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  container: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '32px 24px',
    fontFamily: "'Google Sans', sans-serif",
  } as React.CSSProperties,

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    flexWrap: 'wrap' as const,
    gap: 16,
  } as React.CSSProperties,

  title: {
    fontSize: 24,
    fontWeight: 600,
    color: 'var(--text, #1a1a1a)',
    margin: 0,
  } as React.CSSProperties,

  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  } as React.CSSProperties,

  searchBox: {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid var(--border, #dadce0)',
    borderRadius: 8,
    padding: '6px 12px',
    background: 'white',
    gap: 8,
  } as React.CSSProperties,

  searchInput: {
    border: 'none',
    outline: 'none',
    fontSize: 14,
    fontFamily: "'Google Sans', sans-serif",
    background: 'transparent',
    width: 200,
    color: 'var(--text, #1a1a1a)',
  } as React.CSSProperties,

  sortSelect: {
    border: '1px solid var(--border, #dadce0)',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    fontFamily: "'Google Sans', sans-serif",
    background: 'white',
    color: 'var(--text, #1a1a1a)',
    cursor: 'pointer',
    outline: 'none',
  } as React.CSSProperties,

  tabs: {
    display: 'flex',
    gap: 4,
    marginBottom: 24,
    borderBottom: '1px solid var(--border, #dadce0)',
    paddingBottom: 0,
  } as React.CSSProperties,

  tab: (active: boolean) => ({
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: active ? 600 : 400,
    color: active ? '#1967d2' : 'var(--text-secondary, #5f6368)',
    background: 'none',
    border: 'none',
    borderBottom: active ? '2px solid #1967d2' : '2px solid transparent',
    cursor: 'pointer',
    fontFamily: "'Google Sans', sans-serif",
    marginBottom: -1,
    transition: 'color 0.15s, border-color 0.15s',
  } as React.CSSProperties),

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(340, 1fr))',
    gap: 16,
  } as React.CSSProperties,

  card: {
    background: 'white',
    border: '1px solid var(--border, #dadce0)',
    borderRadius: 12,
    padding: '20px',
    transition: 'box-shadow 0.15s ease',
    cursor: 'default',
    position: 'relative' as const,
  } as React.CSSProperties,

  cardHover: {
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
  } as React.CSSProperties,

  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  } as React.CSSProperties,

  cardTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,

  typeIcon: {
    fontSize: 20,
    color: '#1967d2',
    flexShrink: 0,
  } as React.CSSProperties,

  cardName: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text, #1a1a1a)',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  pinBtn: (pinned: boolean) => ({
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    color: pinned ? '#1967d2' : '#80868b',
    fontSize: 20,
    flexShrink: 0,
    lineHeight: 1,
  } as React.CSSProperties),

  cardDesc: {
    fontSize: 13,
    color: 'var(--text-secondary, #5f6368)',
    marginBottom: 10,
    lineHeight: 1.5,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
    overflow: 'hidden',
    minHeight: 0,
  } as React.CSSProperties,

  sqlPreview: {
    background: '#f8f9fa',
    borderRadius: 6,
    padding: '8px 10px',
    fontSize: 12,
    fontFamily: "'Roboto Mono', monospace",
    color: 'var(--text-secondary, #5f6368)',
    marginBottom: 10,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    maxHeight: 40,
  } as React.CSSProperties,

  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 12,
    color: '#80868b',
    marginBottom: 10,
  } as React.CSSProperties,

  tagsRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 6,
    marginBottom: 14,
  } as React.CSSProperties,

  tag: {
    display: 'inline-block',
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 500,
    background: '#f1f3f4',
    color: 'var(--text-secondary, #5f6368)',
    borderRadius: 10,
  } as React.CSSProperties,

  actions: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
  } as React.CSSProperties,

  runBtn: {
    padding: '7px 18px',
    fontSize: 13,
    fontWeight: 500,
    border: 'none',
    borderRadius: 6,
    background: '#1967d2',
    color: 'white',
    cursor: 'pointer',
    fontFamily: "'Google Sans', sans-serif",
  } as React.CSSProperties,

  deleteBtn: {
    padding: '7px 18px',
    fontSize: 13,
    fontWeight: 500,
    border: '1px solid #d93025',
    borderRadius: 6,
    background: 'white',
    color: '#d93025',
    cursor: 'pointer',
    fontFamily: "'Google Sans', sans-serif",
  } as React.CSSProperties,

  confirmRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'flex-end',
  } as React.CSSProperties,

  confirmLabel: {
    fontSize: 12,
    color: '#d93025',
    fontWeight: 500,
  } as React.CSSProperties,

  confirmBtn: {
    padding: '5px 14px',
    fontSize: 12,
    fontWeight: 500,
    border: 'none',
    borderRadius: 6,
    background: '#d93025',
    color: 'white',
    cursor: 'pointer',
    fontFamily: "'Google Sans', sans-serif",
  } as React.CSSProperties,

  cancelBtn: {
    padding: '5px 14px',
    fontSize: 12,
    fontWeight: 500,
    border: '1px solid var(--border, #dadce0)',
    borderRadius: 6,
    background: 'white',
    color: 'var(--text, #1a1a1a)',
    cursor: 'pointer',
    fontFamily: "'Google Sans', sans-serif",
  } as React.CSSProperties,

  emptyState: {
    textAlign: 'center' as const,
    padding: '60px 20px',
    color: 'var(--text-secondary, #5f6368)',
  } as React.CSSProperties,

  emptyIcon: {
    fontSize: 48,
    color: '#dadce0',
    marginBottom: 16,
  } as React.CSSProperties,

  emptyTitle: {
    fontSize: 16,
    fontWeight: 500,
    color: 'var(--text, #1a1a1a)',
    marginBottom: 8,
  } as React.CSSProperties,

  emptyDesc: {
    fontSize: 14,
    color: 'var(--text-secondary, #5f6368)',
  } as React.CSSProperties,

  skeletonCard: {
    background: 'white',
    border: '1px solid var(--border, #dadce0)',
    borderRadius: 12,
    padding: 20,
  } as React.CSSProperties,

  skeletonLine: (width: string, height: number = 14) => ({
    background: '#f1f3f4',
    borderRadius: 4,
    width,
    height,
    marginBottom: 10,
    animation: 'pulse 1.5s ease-in-out infinite',
  } as React.CSSProperties),
} as const;

// ── Component ────────────────────────────────────────────────────────────────

interface SavedPageProps {
  userId: string;
  onRun: (artifact: SavedArtifact) => void;
  onNavigate: (page: string) => void;
}

export function SavedPage({ userId, onRun, onNavigate }: SavedPageProps) {
  const [items, setItems] = useState<SavedArtifact[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortMode>('recent');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  // ── Data loading ─────────────────────────────────────────────────────────

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      let result: SavedArtifact[];
      if (searchQuery.trim()) {
        result = await searchArtifacts(userId, searchQuery.trim());
      } else {
        const typeFilter = activeTab === 'all' ? undefined : activeTab as SavedArtifactType;
        result = await getArtifacts(userId, typeFilter);
      }
      setItems(result);
    } catch (err) {
      console.error('Failed to load saved items:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [userId, activeTab, searchQuery]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleDelete(itemId: string) {
    try {
      await deleteArtifact(userId, itemId);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      setDeletingId(null);
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  }

  async function handleTogglePin(item: SavedArtifact) {
    const newPinned = !item.pinned;
    try {
      await updateArtifact(userId, item.id, { pinned: newPinned });
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, pinned: newPinned } : i))
      );
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  }

  function handleTabChange(tab: TabKey) {
    setActiveTab(tab);
    setSearchQuery('');
    setDeletingId(null);
  }

  // ── Filtering and sorting ────────────────────────────────────────────────

  const filteredItems = (() => {
    let filtered = items;
    // When searching, also filter by tab (unless "all")
    if (activeTab !== 'all' && searchQuery.trim()) {
      filtered = filtered.filter((i) => i.type === activeTab);
    }
    return sortItems(filtered, sortBy);
  })();

  // ── Render helpers ───────────────────────────────────────────────────────

  function renderSkeleton() {
    return (
      <div style={styles.grid}>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div key={n} style={styles.skeletonCard}>
            <div style={styles.skeletonLine('60%', 16)} />
            <div style={styles.skeletonLine('90%')} />
            <div style={styles.skeletonLine('40%')} />
            <div style={styles.skeletonLine('70%', 12)} />
          </div>
        ))}
      </div>
    );
  }

  function renderEmpty() {
    const tabLabel = activeTab === 'all' ? 'saved items' : TABS.find((t) => t.key === activeTab)?.label.toLowerCase() || 'items';
    return (
      <div style={styles.emptyState}>
        <span className="material-symbols-outlined" style={styles.emptyIcon}>
          bookmark_border
        </span>
        <div style={styles.emptyTitle}>
          {searchQuery.trim() ? 'No results found' : `No ${tabLabel} yet`}
        </div>
        <div style={styles.emptyDesc}>
          {searchQuery.trim()
            ? `No items match "${searchQuery}". Try a different search term.`
            : `Items you save will appear here. Use the save button on any result to add it.`}
        </div>
      </div>
    );
  }

  function renderCard(item: SavedArtifact) {
    const isDeleting = deletingId === item.id;
    const isHovered = hoveredCard === item.id;
    const firstSql = item.steps?.[0]?.cachedSql;
    const stepCount = item.steps?.length || 0;
    const paramCount = item.parameters?.length || 0;

    return (
      <div
        key={item.id}
        style={{
          ...styles.card,
          ...(isHovered ? styles.cardHover : {}),
        }}
        onMouseEnter={() => setHoveredCard(item.id)}
        onMouseLeave={() => setHoveredCard(null)}
      >
        {/* Header: icon, name, pin */}
        <div style={styles.cardHeader}>
          <div style={styles.cardTitleRow}>
            <span className="material-symbols-outlined" style={styles.typeIcon}>
              {TYPE_ICONS[item.type] || 'description'}
            </span>
            <h3 style={styles.cardName} title={item.name}>
              {item.name}
            </h3>
          </div>
          <button
            onClick={() => handleTogglePin(item)}
            style={styles.pinBtn(!!item.pinned)}
            title={item.pinned ? 'Unpin' : 'Pin'}
          >
            <span className="material-symbols-outlined">
              {item.pinned ? 'bookmark' : 'bookmark_border'}
            </span>
          </button>
        </div>

        {/* Description */}
        {item.description && (
          <div style={styles.cardDesc}>{item.description}</div>
        )}

        {/* SQL preview (queries and single-step items) */}
        {firstSql && (
          <div style={styles.sqlPreview} title={firstSql}>
            {firstSql}
          </div>
        )}

        {/* Metadata row */}
        <div style={styles.metaRow}>
          <span>{TYPE_LABELS[item.type] || item.type}</span>
          {stepCount > 1 && <span>{stepCount} steps</span>}
          {paramCount > 0 && <span>{paramCount} params</span>}
          {item.runCount > 0 && <span>Run {item.runCount}x</span>}
          {item.project && <span>{item.project}</span>}
          {item.updatedAt && <span>{relativeTime(item.updatedAt)}</span>}
        </div>

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <div style={styles.tagsRow}>
            {item.tags.map((tag) => (
              <span key={tag} style={styles.tag}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        {isDeleting ? (
          <div style={styles.confirmRow}>
            <span style={styles.confirmLabel}>Are you sure?</span>
            <button style={styles.confirmBtn} onClick={() => handleDelete(item.id)}>
              Delete
            </button>
            <button style={styles.cancelBtn} onClick={() => setDeletingId(null)}>
              Cancel
            </button>
          </div>
        ) : (
          <div style={styles.actions}>
            <button style={styles.deleteBtn} onClick={() => setDeletingId(item.id)}>
              Delete
            </button>
            <button style={styles.runBtn} onClick={() => onRun(item)}>
              Run
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Saved</h1>
        <div style={styles.headerRight}>
          <div style={styles.searchBox}>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 18, color: '#80868b' }}
            >
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search saved items..."
              style={styles.searchInput}
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortMode)}
            style={styles.sortSelect}
          >
            <option value="recent">Recent</option>
            <option value="name">Name</option>
            <option value="most-used">Most Used</option>
            <option value="type">Type</option>
          </select>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            style={styles.tab(activeTab === tab.key)}
            onClick={() => handleTabChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        renderSkeleton()
      ) : filteredItems.length === 0 ? (
        renderEmpty()
      ) : (
        <div style={styles.grid}>
          {filteredItems.map((item) => renderCard(item))}
        </div>
      )}

      {/* Skeleton animation keyframes */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
