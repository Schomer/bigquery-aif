'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { SavedArtifact, SavedArtifactType, Space } from '@/lib/types';
import {
  getArtifacts,
  deleteArtifact,
  updateArtifact,
  searchArtifacts,
  getSpaces,
  createSpace,
  renameSpace,
  deleteSpace,
  moveToSpace,
  duplicateArtifact,
} from '@/lib/saved-work';

// ── Constants ────────────────────────────────────────────────────────────────

type TabKey = 'all' | SavedArtifactType;
type SortMode = 'recent' | 'name' | 'most-used' | 'type';
type ViewMode = 'card' | 'list';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'query', label: 'Queries' },
  { key: 'workflow', label: 'Workflows' },
  { key: 'pipeline', label: 'Pipelines' },
  { key: 'app', label: 'Apps' },
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

const S = {
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

  titleRow: {
    display: 'flex',
    alignItems: 'center',
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

  viewToggle: {
    display: 'flex',
    gap: 2,
  } as React.CSSProperties,

  viewBtn: (active: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    border: '1px solid var(--border, #dadce0)',
    borderRadius: 6,
    background: active ? 'var(--accent, #1967d2)' : 'transparent',
    color: active ? '#fff' : 'var(--text-muted, #5f6368)',
    cursor: 'pointer',
  } as React.CSSProperties),

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
    color: active ? 'var(--accent, #1967d2)' : 'var(--text-muted, #5f6368)',
    background: 'none',
    border: 'none',
    borderBottom: active ? '2px solid var(--accent, #1967d2)' : '2px solid transparent',
    cursor: 'pointer',
    fontFamily: "'Google Sans', sans-serif",
    marginBottom: -1,
    transition: 'color 0.15s, border-color 0.15s',
  } as React.CSSProperties),

  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    fontSize: 14,
    color: 'var(--text-muted, #5f6368)',
    fontFamily: "'Google Sans', sans-serif",
  } as React.CSSProperties,

  breadcrumbLink: {
    color: 'var(--accent, #1967d2)',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    fontSize: 14,
    fontFamily: "'Google Sans', sans-serif",
    padding: '2px 6px',
    borderRadius: 4,
    transition: 'background 0.15s',
  } as React.CSSProperties,

  breadcrumbCurrent: {
    fontWeight: 600,
    color: 'var(--text, #1a1a1a)',
  } as React.CSSProperties,

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
    gap: 16,
  } as React.CSSProperties,

  card: (isSpace: boolean) => ({
    background: isSpace ? 'var(--surface-2, #f1f3f4)' : 'white',
    border: '1px solid var(--border, #dadce0)',
    borderRadius: 12,
    padding: '20px',
    transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
    cursor: isSpace ? 'pointer' : 'default',
    position: 'relative' as const,
  } as React.CSSProperties),

  cardHover: {
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
  } as React.CSSProperties,

  dragOver: {
    borderColor: 'var(--accent, #1967d2)',
    background: 'color-mix(in srgb, var(--accent, #1967d2) 5%, transparent)',
  } as React.CSSProperties,

  dragging: {
    opacity: 0.5,
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
    color: 'var(--accent, #1967d2)',
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
    cursor: 'pointer',
  } as React.CSSProperties,

  inlineInput: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text, #1a1a1a)',
    border: '1px solid var(--accent, #1967d2)',
    borderRadius: 4,
    padding: '1px 4px',
    outline: 'none',
    fontFamily: "'Google Sans', sans-serif",
    width: '100%',
    background: 'white',
  } as React.CSSProperties,

  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 12,
    color: 'var(--text-dim, #80868b)',
    marginBottom: 10,
  } as React.CSSProperties,

  cardDesc: {
    fontSize: 13,
    color: 'var(--text-muted, #5f6368)',
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
    color: 'var(--text-muted, #5f6368)',
    marginBottom: 10,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    maxHeight: 40,
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
    color: 'var(--text-muted, #5f6368)',
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
    background: 'var(--accent, #1967d2)',
    color: 'white',
    cursor: 'pointer',
    fontFamily: "'Google Sans', sans-serif",
  } as React.CSSProperties,

  moreBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: 'var(--text-dim, #80868b)',
    borderRadius: 6,
    flexShrink: 0,
    fontSize: 20,
  } as React.CSSProperties,

  contextMenu: {
    position: 'absolute' as const,
    right: 8,
    top: 48,
    background: 'white',
    border: '1px solid var(--border, #dadce0)',
    borderRadius: 8,
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    zIndex: 100,
    minWidth: 180,
    padding: '4px 0',
    fontFamily: "'Google Sans', sans-serif",
  } as React.CSSProperties,

  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 16px',
    fontSize: 13,
    color: 'var(--text, #1a1a1a)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left' as const,
    fontFamily: "'Google Sans', sans-serif",
  } as React.CSSProperties,

  menuItemDanger: {
    color: 'var(--issue, #d93025)',
  } as React.CSSProperties,

  menuDivider: {
    height: 1,
    background: 'var(--border, #dadce0)',
    margin: '4px 0',
  } as React.CSSProperties,

  subMenu: {
    position: 'absolute' as const,
    left: '100%',
    top: 0,
    background: 'white',
    border: '1px solid var(--border, #dadce0)',
    borderRadius: 8,
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    zIndex: 101,
    minWidth: 160,
    padding: '4px 0',
  } as React.CSSProperties,

  // List view
  listTable: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  } as React.CSSProperties,

  listRow: (isSpace: boolean) => ({
    borderBottom: '1px solid var(--border, #dadce0)',
    background: isSpace ? 'var(--surface-2, #f1f3f4)' : 'transparent',
    transition: 'background 0.15s',
    cursor: isSpace ? 'pointer' : 'default',
  } as React.CSSProperties),

  listCell: {
    padding: '12px 8px',
    fontSize: 13,
    color: 'var(--text, #1a1a1a)',
    verticalAlign: 'middle' as const,
    fontFamily: "'Google Sans', sans-serif",
  } as React.CSSProperties,

  listCellMuted: {
    padding: '12px 8px',
    fontSize: 12,
    color: 'var(--text-dim, #80868b)',
    verticalAlign: 'middle' as const,
    fontFamily: "'Google Sans', sans-serif",
  } as React.CSSProperties,

  typeBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 500,
    background: '#f1f3f4',
    color: 'var(--text-muted, #5f6368)',
    borderRadius: 10,
  } as React.CSSProperties,

  dragHandle: {
    cursor: 'grab',
    color: 'var(--text-dim, #80868b)',
    fontSize: 18,
    userSelect: 'none' as const,
  } as React.CSSProperties,

  emptyState: {
    textAlign: 'center' as const,
    padding: '60px 20px',
    color: 'var(--text-muted, #5f6368)',
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
    color: 'var(--text-muted, #5f6368)',
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

  newSpaceInput: {
    background: 'var(--surface-2, #f1f3f4)',
    border: '2px dashed var(--accent, #1967d2)',
    borderRadius: 12,
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  } as React.CSSProperties,
} as const;

// ── Component ────────────────────────────────────────────────────────────────

interface SpacesPageProps {
  userId: string;
  onRun: (artifact: SavedArtifact) => void;
  onNavigate: (page: string) => void;
  initialTab?: TabKey;
}

export function SpacesPage({ userId, onRun, onNavigate, initialTab }: SpacesPageProps) {
  const [items, setItems] = useState<SavedArtifact[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab ?? 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortMode>('recent');
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [loading, setLoading] = useState(true);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  // Space navigation
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);

  // Create space
  const [creatingSpace, setCreatingSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const newSpaceInputRef = useRef<HTMLInputElement>(null);

  // Inline rename
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameType, setRenameType] = useState<'item' | 'space'>('item');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Context menu
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [moveSubMenuOpen, setMoveSubMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Drag and drop
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverBreadcrumb, setDragOverBreadcrumb] = useState(false);

  // ── Data loading ─────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [spacesResult, itemsResult] = await Promise.all([
        getSpaces(userId),
        searchQuery.trim()
          ? searchArtifacts(userId, searchQuery.trim())
          : getArtifacts(userId, activeTab === 'all' ? undefined : activeTab as SavedArtifactType),
      ]);
      setSpaces(spacesResult);
      setItems(itemsResult);
    } catch (err) {
      console.error('Failed to load data:', err);
      setItems([]);
      setSpaces([]);
    } finally {
      setLoading(false);
    }
  }, [userId, activeTab, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync tab when parent navigation changes (e.g. clicking Content > Queries in sidebar)
  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTab(initialTab);
      setSearchQuery('');
      setActiveSpaceId(null);
    }
  // intentionally exclude activeTab to avoid loop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab]);

  // Close context menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
        setMoveSubMenuOpen(false);
      }
    }
    if (menuOpenId) {
      document.addEventListener('click', handleClick, true);
      return () => document.removeEventListener('click', handleClick, true);
    }
  }, [menuOpenId]);

  // Focus new-space input when it appears
  useEffect(() => {
    if (creatingSpace && newSpaceInputRef.current) {
      newSpaceInputRef.current.focus();
    }
  }, [creatingSpace]);

  // Focus rename input when it appears
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleTabChange(tab: TabKey) {
    setActiveTab(tab);
    setSearchQuery('');
    setMenuOpenId(null);
  }

  // Create space
  async function handleCreateSpace() {
    const name = newSpaceName.trim();
    if (!name) {
      setCreatingSpace(false);
      setNewSpaceName('');
      return;
    }
    try {
      await createSpace(userId, name);
      setCreatingSpace(false);
      setNewSpaceName('');
      await loadData();
    } catch (err) {
      console.error('Failed to create space:', err);
    }
  }

  // Rename
  function startRename(id: string, currentName: string, type: 'item' | 'space') {
    setRenamingId(id);
    setRenameValue(currentName);
    setRenameType(type);
    setMenuOpenId(null);
    setMoveSubMenuOpen(false);
  }

  async function commitRename() {
    if (!renamingId) return;
    const name = renameValue.trim();
    if (!name) {
      setRenamingId(null);
      return;
    }
    try {
      if (renameType === 'space') {
        await renameSpace(userId, renamingId, name);
        setSpaces((prev) => prev.map((s) => s.id === renamingId ? { ...s, name } : s));
      } else {
        await updateArtifact(userId, renamingId, { name });
        setItems((prev) => prev.map((i) => i.id === renamingId ? { ...i, name } : i));
      }
    } catch (err) {
      console.error('Failed to rename:', err);
    }
    setRenamingId(null);
  }

  // Delete
  async function handleDeleteItem(id: string) {
    setMenuOpenId(null);
    try {
      await deleteArtifact(userId, id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  }

  async function handleDeleteSpace(spaceId: string) {
    setMenuOpenId(null);
    try {
      await deleteSpace(userId, spaceId);
      if (activeSpaceId === spaceId) setActiveSpaceId(null);
      await loadData();
    } catch (err) {
      console.error('Failed to delete space:', err);
    }
  }

  // Duplicate
  async function handleDuplicate(id: string) {
    setMenuOpenId(null);
    try {
      await duplicateArtifact(userId, id);
      await loadData();
    } catch (err) {
      console.error('Failed to duplicate:', err);
    }
  }

  // Move to space
  async function handleMoveToSpace(artifactId: string, spaceId: string | undefined) {
    setMenuOpenId(null);
    setMoveSubMenuOpen(false);
    try {
      await moveToSpace(userId, artifactId, spaceId);
      setItems((prev) => prev.map((i) => i.id === artifactId ? { ...i, spaceId } : i));
    } catch (err) {
      console.error('Failed to move:', err);
    }
  }

  // ── Drag and Drop ──────────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent, id: string) {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverId(null);
    setDragOverBreadcrumb(false);
  }

  function handleDragOverSpace(e: React.DragEvent, spaceId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(spaceId);
  }

  function handleDragLeaveSpace() {
    setDragOverId(null);
  }

  async function handleDropOnSpace(e: React.DragEvent, spaceId: string) {
    e.preventDefault();
    const artifactId = e.dataTransfer.getData('text/plain');
    setDragOverId(null);
    setDraggingId(null);
    if (artifactId) {
      await handleMoveToSpace(artifactId, spaceId);
    }
  }

  function handleDragOverBreadcrumb(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverBreadcrumb(true);
  }

  function handleDragLeaveBreadcrumb() {
    setDragOverBreadcrumb(false);
  }

  async function handleDropOnBreadcrumb(e: React.DragEvent) {
    e.preventDefault();
    const artifactId = e.dataTransfer.getData('text/plain');
    setDragOverBreadcrumb(false);
    setDraggingId(null);
    if (artifactId) {
      await handleMoveToSpace(artifactId, undefined);
    }
  }

  // ── Derived data ─────────────────────────────────────────────────────────

  const filteredItems = sortItems(items, sortBy);

  // Count items in each space (kept for context menu compatibility)
  function spaceItemCount(_spaceId: string): number {
    return items.filter((i) => i.spaceId === _spaceId).length;
  }

  // ── Render: inline name ──────────────────────────────────────────────────

  function renderName(id: string, name: string, type: 'item' | 'space') {
    if (renamingId === id) {
      return (
        <input
          ref={renameInputRef}
          style={S.inlineInput}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') setRenamingId(null);
          }}
          onClick={(e) => e.stopPropagation()}
        />
      );
    }
    return (
      <h3
        style={S.cardName}
        title={name}
        onClick={(e) => {
          e.stopPropagation();
          startRename(id, name, type);
        }}
      >
        {name}
      </h3>
    );
  }

  // ── Render: context menu ─────────────────────────────────────────────────

  function renderContextMenu(id: string, type: 'item' | 'space', itemName: string) {
    if (menuOpenId !== id) return null;

    if (type === 'space') {
      return (
        <div ref={menuRef} style={S.contextMenu} onClick={(e) => e.stopPropagation()}>
          <button
            style={S.menuItem}
            onMouseEnter={() => setMoveSubMenuOpen(false)}
            onClick={() => startRename(id, itemName, 'space')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
            Rename
          </button>
          <div style={S.menuDivider} />
          <button
            style={{ ...S.menuItem, ...S.menuItemDanger }}
            onClick={() => handleDeleteSpace(id)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
            Delete
          </button>
        </div>
      );
    }

    return (
      <div ref={menuRef} style={S.contextMenu} onClick={(e) => e.stopPropagation()}>
        <button
          style={S.menuItem}
          onMouseEnter={() => setMoveSubMenuOpen(false)}
          onClick={() => startRename(id, itemName, 'item')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
          Rename
        </button>
        <button
          style={S.menuItem}
          onMouseEnter={() => setMoveSubMenuOpen(false)}
          onClick={() => handleDuplicate(id)}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>content_copy</span>
          Duplicate
        </button>
        <div style={{ position: 'relative' as const }}>
          <button
            style={S.menuItem}
            onMouseEnter={() => setMoveSubMenuOpen(true)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>drive_file_move</span>
            Move to Space
            <span className="material-symbols-outlined" style={{ fontSize: 14, marginLeft: 'auto' }}>chevron_right</span>
          </button>
          {moveSubMenuOpen && (
            <div style={S.subMenu}>
              <button
                style={S.menuItem}
                onClick={() => handleMoveToSpace(id, undefined)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>home</span>
                Root (no space)
              </button>
              {spaces.map((sp) => (
                <button
                  key={sp.id}
                  style={S.menuItem}
                  onClick={() => handleMoveToSpace(id, sp.id)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>folder</span>
                  {sp.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={S.menuDivider} />
        <button
          style={{ ...S.menuItem, ...S.menuItemDanger }}
          onMouseEnter={() => setMoveSubMenuOpen(false)}
          onClick={() => handleDeleteItem(id)}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
          Delete
        </button>
      </div>
    );
  }

  // ── Render: space card ─────────────────────────────────────────────────

  function renderSpaceCard(space: Space) {
    const isHovered = hoveredCard === `space-${space.id}`;
    const isDragOver = dragOverId === space.id;
    return (
      <div
        key={`space-${space.id}`}
        style={{
          ...S.card(true),
          ...(isHovered ? S.cardHover : {}),
          ...(isDragOver ? S.dragOver : {}),
        }}
        onMouseEnter={() => setHoveredCard(`space-${space.id}`)}
        onMouseLeave={() => setHoveredCard(null)}
        onClick={() => setActiveSpaceId(space.id)}
        onDragOver={(e) => handleDragOverSpace(e, space.id)}
        onDragLeave={handleDragLeaveSpace}
        onDrop={(e) => handleDropOnSpace(e, space.id)}
      >
        <div style={S.cardHeader}>
          <div style={S.cardTitleRow}>
            <span className="material-symbols-outlined" style={{ ...S.typeIcon, color: 'var(--text-muted, #5f6368)' }}>
              folder
            </span>
            {renderName(space.id, space.name, 'space')}
          </div>
          <button
            style={S.moreBtn}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpenId(menuOpenId === space.id ? null : space.id);
              setMoveSubMenuOpen(false);
            }}
          >
            <span className="material-symbols-outlined">more_vert</span>
          </button>
        </div>
        <div style={S.metaRow}>
          <span>{spaceItemCount(space.id)} items</span>
          <span>{relativeTime(space.updatedAt)}</span>
        </div>
        {renderContextMenu(space.id, 'space', space.name)}
      </div>
    );
  }

  // ── Render: item card ──────────────────────────────────────────────────

  function renderItemCard(item: SavedArtifact) {
    const isHovered = hoveredCard === item.id;
    const isDragging = draggingId === item.id;
    const firstSql = item.steps?.[0]?.cachedSql;
    const stepCount = item.steps?.length || 0;
    const paramCount = item.parameters?.length || 0;
    const showTypeCorner = activeTab === 'all';

    return (
      <div
        key={item.id}
        style={{
          ...S.card(false),
          ...(isHovered ? S.cardHover : {}),
          ...(isDragging ? S.dragging : {}),
          position: 'relative',
        }}
        onMouseEnter={() => setHoveredCard(item.id)}
        onMouseLeave={() => setHoveredCard(null)}
        draggable
        onDragStart={(e) => handleDragStart(e, item.id)}
        onDragEnd={handleDragEnd}
      >
        {/* Type badge in top-right corner (All view only) */}
        {showTypeCorner && (
          <div style={{
            position: 'absolute',
            top: 14,
            right: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'var(--surface-2, #f1f3f4)',
            borderRadius: 6,
            padding: '3px 7px',
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--text-muted, #5f6368)',
            fontFamily: "'Google Sans', sans-serif",
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
              {TYPE_ICONS[item.type] || 'description'}
            </span>
            {TYPE_LABELS[item.type] || item.type}
          </div>
        )}

        <div style={S.cardHeader}>
          <div style={S.cardTitleRow}>
            {!showTypeCorner && (
              <span className="material-symbols-outlined" style={S.typeIcon}>
                {TYPE_ICONS[item.type] || 'description'}
              </span>
            )}
            {renderName(item.id, item.name, 'item')}
          </div>
          <button
            style={{ ...S.moreBtn, ...(showTypeCorner ? { marginRight: 72 } : {}) }}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpenId(menuOpenId === item.id ? null : item.id);
              setMoveSubMenuOpen(false);
            }}
          >
            <span className="material-symbols-outlined">more_vert</span>
          </button>
        </div>

        {item.description && (
          <div style={S.cardDesc}>{item.description}</div>
        )}

        {firstSql && (
          <div style={S.sqlPreview} title={firstSql}>{firstSql}</div>
        )}

        <div style={S.metaRow}>
          {stepCount > 1 && <span>{stepCount} steps</span>}
          {paramCount > 0 && <span>{paramCount} params</span>}
          {item.runCount > 0 && <span>Run {item.runCount}x</span>}
          {item.project && <span>{item.project}</span>}
          {item.updatedAt && <span>{relativeTime(item.updatedAt)}</span>}
        </div>

        {item.tags && item.tags.length > 0 && (
          <div style={S.tagsRow}>
            {item.tags.map((tag) => (
              <span key={tag} style={S.tag}>{tag}</span>
            ))}
          </div>
        )}

        <div style={S.actions}>
          <button style={S.runBtn} onClick={() => onRun(item)}>Run</button>
        </div>

        {renderContextMenu(item.id, 'item', item.name)}
      </div>
    );
  }

  // ── Render: list view ──────────────────────────────────────────────────

  function renderSpaceRow(space: Space) {
    const isDragOver = dragOverId === space.id;
    return (
      <tr
        key={`space-${space.id}`}
        style={{
          ...S.listRow(true),
          ...(isDragOver ? S.dragOver : {}),
        }}
        onClick={() => setActiveSpaceId(space.id)}
        onDragOver={(e) => handleDragOverSpace(e, space.id)}
        onDragLeave={handleDragLeaveSpace}
        onDrop={(e) => handleDropOnSpace(e, space.id)}
      >
        <td style={{ ...S.listCell, width: 32 }} />
        <td style={{ ...S.listCell, width: 32 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--text-muted, #5f6368)' }}>
            folder
          </span>
        </td>
        <td style={S.listCell}>
          {renderName(space.id, space.name, 'space')}
        </td>
        <td style={S.listCellMuted} />
        <td style={S.listCellMuted}>{spaceItemCount(space.id)} items</td>
        <td style={S.listCellMuted}>{relativeTime(space.updatedAt)}</td>
        <td style={{ ...S.listCell, width: 40, position: 'relative' as const }}>
          <button
            style={S.moreBtn}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpenId(menuOpenId === space.id ? null : space.id);
              setMoveSubMenuOpen(false);
            }}
          >
            <span className="material-symbols-outlined">more_vert</span>
          </button>
          {renderContextMenu(space.id, 'space', space.name)}
        </td>
      </tr>
    );
  }

  function renderItemRow(item: SavedArtifact) {
    const isDragging = draggingId === item.id;
    return (
      <tr
        key={item.id}
        style={{
          ...S.listRow(false),
          ...(isDragging ? S.dragging : {}),
        }}
        draggable
        onDragStart={(e) => handleDragStart(e, item.id)}
        onDragEnd={handleDragEnd}
      >
        <td style={{ ...S.listCell, width: 32 }}>
          <span className="material-symbols-outlined" style={S.dragHandle}>drag_indicator</span>
        </td>
        <td style={{ ...S.listCell, width: 32 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--accent, #1967d2)' }}>
            {TYPE_ICONS[item.type] || 'description'}
          </span>
        </td>
        <td style={S.listCell}>
          {renderName(item.id, item.name, 'item')}
        </td>
        <td style={S.listCellMuted}>
          <span style={S.typeBadge}>{TYPE_LABELS[item.type] || item.type}</span>
        </td>
        <td style={S.listCellMuted}>
          {item.runCount > 0 ? `${item.runCount}x` : ''}
        </td>
        <td style={S.listCellMuted}>{relativeTime(item.updatedAt)}</td>
        <td style={{ ...S.listCell, width: 40, position: 'relative' as const }}>
          <button
            style={S.moreBtn}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpenId(menuOpenId === item.id ? null : item.id);
              setMoveSubMenuOpen(false);
            }}
          >
            <span className="material-symbols-outlined">more_vert</span>
          </button>
          {renderContextMenu(item.id, 'item', item.name)}
        </td>
      </tr>
    );
  }

  // ── Render: skeleton / empty ───────────────────────────────────────────

  function renderSkeleton() {
    return (
      <div style={S.grid}>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div key={n} style={S.skeletonCard}>
            <div style={S.skeletonLine('60%', 16)} />
            <div style={S.skeletonLine('90%')} />
            <div style={S.skeletonLine('40%')} />
            <div style={S.skeletonLine('70%', 12)} />
          </div>
        ))}
      </div>
    );
  }

  function renderEmpty() {
    const tabLabel = activeTab === 'all' ? 'saved items' : TABS.find((t) => t.key === activeTab)?.label.toLowerCase() || 'items';
    return (
      <div style={S.emptyState}>
        <span className="material-symbols-outlined" style={S.emptyIcon}>
          folder_open
        </span>
        <div style={S.emptyTitle}>
          {searchQuery.trim() ? 'No results found' : activeSpaceId ? 'This space is empty' : `No ${tabLabel} yet`}
        </div>
        <div style={S.emptyDesc}>
          {searchQuery.trim()
            ? `No items match "${searchQuery}". Try a different search term.`
            : activeSpaceId
              ? 'Drag items here or use the context menu to move items into this space.'
              : 'Items you save will appear here. Use the save button on any result to add it.'}
        </div>
      </div>
    );
  }

  // ── Render: new space inline input ─────────────────────────────────────

  function renderNewSpaceInput() {
    if (!creatingSpace) return null;

    if (viewMode === 'list') {
      return (
        <tr>
          <td colSpan={7} style={S.listCell}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--accent, #1967d2)' }}>
                create_new_folder
              </span>
              <input
                ref={newSpaceInputRef}
                style={S.inlineInput}
                value={newSpaceName}
                placeholder="Space name..."
                onChange={(e) => setNewSpaceName(e.target.value)}
                onBlur={handleCreateSpace}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateSpace();
                  if (e.key === 'Escape') { setCreatingSpace(false); setNewSpaceName(''); }
                }}
              />
            </div>
          </td>
        </tr>
      );
    }

    return (
      <div style={S.newSpaceInput}>
        <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--accent, #1967d2)' }}>
          create_new_folder
        </span>
        <input
          ref={newSpaceInputRef}
          style={{ ...S.inlineInput, flex: 1 }}
          value={newSpaceName}
          placeholder="Space name..."
          onChange={(e) => setNewSpaceName(e.target.value)}
          onBlur={handleCreateSpace}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreateSpace();
            if (e.key === 'Escape') { setCreatingSpace(false); setNewSpaceName(''); }
          }}
        />
      </div>
    );
  }

  // ── Render: content ────────────────────────────────────────────────────

  function renderContent() {
    if (loading) return renderSkeleton();

    const hasContent = filteredItems.length > 0;

    if (!hasContent) return renderEmpty();

    if (viewMode === 'list') {
      return (
        <table style={S.listTable}>
          <tbody>
            {filteredItems.map((item) => renderItemRow(item))}
          </tbody>
        </table>
      );
    }

    return (
      <div style={S.grid}>
        {filteredItems.map((item) => renderItemCard(item))}
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────

  const TAB_TITLES: Record<string, string> = {
    all: 'All Content',
    query: 'Queries',
    workflow: 'Workflows',
    pipeline: 'Pipelines',
    app: 'Apps',
  };

  return (
    <div style={S.container}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.titleRow}>
          <h1 style={S.title}>{TAB_TITLES[activeTab] ?? 'Content'}</h1>
          <div style={S.viewToggle}>
            <button
              style={S.viewBtn(viewMode === 'card')}
              onClick={() => setViewMode('card')}
              title="Card view"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>grid_view</span>
            </button>
            <button
              style={S.viewBtn(viewMode === 'list')}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>view_list</span>
            </button>
          </div>
        </div>
        <div style={S.headerRight}>
          <div style={S.searchBox}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#80868b' }}>
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search saved items..."
              style={S.searchInput}
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortMode)}
            style={S.sortSelect}
          >
            <option value="recent">Recent</option>
            <option value="name">Name</option>
            <option value="most-used">Most Used</option>
            <option value="type">Type</option>
          </select>
        </div>
      </div>

      {/* Content */}
      {renderContent()}

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
