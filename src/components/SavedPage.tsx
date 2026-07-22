'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { SavedArtifact, SavedArtifactType, Space } from '@/lib/types';
import { ThreadReplayView } from '@/components/ThreadReplayView';
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
  publishArtifact,
  unpublishArtifact,
  getSharedArtifacts,
} from '@/lib/saved-work';
import { useAuth } from '@/lib/auth-context';

// ── Constants ────────────────────────────────────────────────────────────────

type TabKey = 'all' | SavedArtifactType;
type SortMode = 'recent' | 'name' | 'most-used' | 'type';
type ViewMode = 'card' | 'list';
type VisibilityFilter = 'all' | 'public' | 'private';

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
    width: '100%',
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
    fontSize: 18,
    fontWeight: 500,
    color: '#1B2E5D',
    margin: 0,
    fontFamily: "'Google Sans', sans-serif",
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
    width: 40,
    height: 40,
    border: 'none',
    borderRadius: '50%',
    background: active ? '#d3e3fd' : 'none',
    color: active ? '#1a4077' : 'var(--gc-icon, #444746)',
    cursor: 'pointer',
    transition: 'background 0.15s',
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
    color: active ? 'var(--accent)' : 'var(--text-muted, #5f6368)',
    background: 'none',
    border: 'none',
    borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
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
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 16,
  } as React.CSSProperties,

  card: (_isSpace: boolean) => ({
    background: 'var(--surface, white)',
    border: '1px solid var(--border, #dadce0)',
    borderRadius: 16,
    overflow: 'hidden' as const,
    transition: 'box-shadow 0.2s ease, transform 0.2s ease',
    cursor: 'default',
    position: 'relative' as const,
    display: 'flex',
    flexDirection: 'column' as const,
  } as React.CSSProperties),

  cardHover: {
    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
    transform: 'translateY(-2px)',
  } as React.CSSProperties,

  cardHeaderPad: {
    padding: '16px 16px 12px',
  } as React.CSSProperties,

  cardIconAvatar: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: '#f1f3f4',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  } as React.CSSProperties,

  cardNameText: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text, #1a1a1a)',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    cursor: 'pointer',
    lineHeight: 1.3,
  } as React.CSSProperties,

  cardSubtype: {
    fontSize: 12,
    color: 'var(--text-dim, #80868b)',
    marginTop: 1,
  } as React.CSSProperties,

  cardThumbnail: {
    background: '#eef2fb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    minHeight: 160,
  } as React.CSSProperties,

  cardBody: {
    padding: '14px 16px 0',
    flex: 1,
  } as React.CSSProperties,

  cardFooter: {
    padding: '12px 16px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  } as React.CSSProperties,

  outlineBtn: {
    padding: '6px 16px',
    fontSize: 13,
    fontWeight: 500,
    border: '1px solid var(--border, #dadce0)',
    borderRadius: 20,
    background: 'white',
    color: 'var(--text, #1a1a1a)',
    cursor: 'pointer',
    fontFamily: "'Google Sans', sans-serif",
    transition: 'background 0.15s',
  } as React.CSSProperties,

  deleteIconBtn: {
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
    marginLeft: 'auto' as const,
    transition: 'color 0.15s',
    fontSize: 20,
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 0,
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
  sharedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 500,
    background: '#e8f0fe',
    color: '#1a4077',
    borderRadius: 10,
    border: '1px solid #c5d8fd',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  privateBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 500,
    background: '#f1f3f4',
    color: '#5f6368',
    borderRadius: 10,
    border: '1px solid #dadce0',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  filterChips: {
    display: 'flex',
    gap: 6,
    marginBottom: 20,
    alignItems: 'center',
  } as React.CSSProperties,

  filterChip: (active: boolean) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '5px 14px',
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    background: active ? '#d3e3fd' : 'white',
    color: active ? '#1a4077' : 'var(--text-muted, #5f6368)',
    border: `1px solid ${active ? '#a8c7fa' : 'var(--border, #dadce0)'}`,
    borderRadius: 20,
    cursor: 'pointer',
    fontFamily: "'Google Sans', sans-serif",
    transition: 'all 0.15s',
  } as React.CSSProperties),
} as const;

// ── Component ────────────────────────────────────────────────────────────────

interface SpacesPageProps {
  userId: string;
  onRun: (artifact: SavedArtifact) => void;
  onNavigate: (page: string) => void;
  initialTab?: TabKey;
  refreshKey?: number;
}

export function SpacesPage({ userId, onRun, onNavigate, initialTab, refreshKey }: SpacesPageProps) {
  const { user } = useAuth();
  const [items, setItems] = useState<SavedArtifact[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab ?? 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortMode>('recent');
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [loading, setLoading] = useState(true);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');

  // Thread replay view
  const [replayArtifact, setReplayArtifact] = useState<SavedArtifact | null>(null);

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

  const menuRef = useRef<HTMLDivElement>(null);

  // Drag and drop
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverBreadcrumb, setDragOverBreadcrumb] = useState(false);

  // ── Data loading ─────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [spacesResult, myItemsResult, sharedResult] = await Promise.all([
        getSpaces(userId),
        searchQuery.trim()
          ? searchArtifacts(userId, searchQuery.trim())
          : getArtifacts(userId, activeTab === 'all' ? undefined : activeTab as SavedArtifactType),
        getSharedArtifacts(),
      ]);
      setSpaces(spacesResult);
      // Merge shared items from others into the list (de-duped by id).
      // The owner's copy already has isPublic=true, so we only add items
      // where the userId differs from the current user.
      const myIds = new Set(myItemsResult.map((i) => i.id));
      const othersShared = sharedResult
        .filter((s) => s.userId !== userId && !myIds.has(s.id))
        .map((s) => s as SavedArtifact);
      setItems([...myItemsResult, ...othersShared]);
    } catch (err) {
      console.error('Failed to load data:', err);
      setItems([]);
      setSpaces([]);
    } finally {
      setLoading(false);
    }
  }, [userId, activeTab, searchQuery, refreshKey]);

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

  // Publish / unpublish
  async function handleTogglePublic(item: SavedArtifact) {
    setMenuOpenId(null);
    const email = user?.email || '';
    try {
      if (item.isPublic) {
        await unpublishArtifact(userId, item.id);
        setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, isPublic: false } : i));
      } else {
        await publishArtifact(userId, item.id, email);
        setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, isPublic: true, ownerEmail: email } : i));
      }
    } catch (err) {
      console.error('Failed to toggle visibility:', err);
    }
  }

  // Move to space
  async function handleMoveToSpace(artifactId: string, spaceId: string | undefined) {
    setMenuOpenId(null);
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

  const ownedItems = items.filter((i) => i.userId === userId);
  const sharedByOthers = items.filter((i) => i.userId !== userId);

  // Apply the visibility filter.
  // For "all": show everything (own private + own public + others' public).
  // For "public": own items marked public + others' public items.
  // For "private": own items that are NOT public.
  const visibilityFiltered = (() => {
    if (visibilityFilter === 'public') {
      return items.filter((i) => i.isPublic === true);
    }
    if (visibilityFilter === 'private') {
      return ownedItems.filter((i) => !i.isPublic);
    }
    return items;
  })();

  const filteredItems = sortItems(
    activeSpaceId
      ? visibilityFiltered.filter((i) => i.spaceId === activeSpaceId && i.userId === userId)
      : visibilityFiltered.filter((i) => !i.spaceId || i.userId !== userId),
    sortBy,
  );

  // Count items in each space (kept for context menu compatibility)
  function spaceItemCount(_spaceId: string): number {
    return ownedItems.filter((i) => i.spaceId === _spaceId).length;
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
          onClick={() => startRename(id, itemName, 'item')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
          Rename
        </button>
        <button
          style={S.menuItem}
          onClick={() => handleDuplicate(id)}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>content_copy</span>
          Duplicate
        </button>

        {/* Visibility toggle -- only for items the current user owns */}
        {(() => {
          const item = items.find((i) => i.id === id);
          if (!item || item.userId !== userId) return null;
          return (
            <>
              <div style={S.menuDivider} />
              <button
                style={S.menuItem}
                onClick={() => handleTogglePublic(item)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  {item.isPublic ? 'lock' : 'lock_open'}
                </span>
                {item.isPublic ? 'Make private' : 'Make public'}
              </button>
            </>
          );
        })()}
        <div style={S.menuDivider} />
        <button
          style={{ ...S.menuItem, ...S.menuItemDanger }}
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

  // ── Render: artifact thumbnail ────────────────────────────────────────────

  function renderThumbnail(item: SavedArtifact) {
    // Prefer captured screenshot thumbnail over procedural SVG
    if (item.thumbnailUrl) {
      return (
        <img
          src={item.thumbnailUrl}
          alt=""
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            maxHeight: 160,
          }}
        />
      );
    }

    const vizType = item.steps?.[0]?.visualizationType || '';
    const isChart = /LINE_CHART|BAR_CHART|AREA_CHART|COLUMN_CHART|SCATTER|HISTOGRAM|SPARKLINE/.test(vizType);
    const isPie = /PIE_CHART|DONUT_CHART/.test(vizType);
    const isTable = vizType === 'TABLE' || item.type === 'query';
    const isWorkflow = item.type === 'workflow';
    const isPipeline = item.type === 'pipeline';

    // Color palette for thumbnails
    const colors = {
      primary: '#4f7af8',
      light: '#c7d9ff',
      muted: '#a8c0f8',
      bg: '#eef2fb',
    };

    if (isWorkflow) {
      // Workflow: connected node diagram
      return (
        <svg viewBox="0 0 260 160" width="100%" height="100%" style={{ display: 'block', maxHeight: 160 }}>
          {/* Nodes */}
          {[40, 130, 220].map((cx, i) => (
            <g key={i}>
              <rect x={cx - 28} y={60} width={56} height={40} rx={8} fill={i === 1 ? colors.primary : colors.muted} opacity={i === 1 ? 1 : 0.7} />
              <rect x={cx - 18} y={70} width={36} height={6} rx={3} fill="white" opacity={0.7} />
              <rect x={cx - 18} y={82} width={24} height={5} rx={2.5} fill="white" opacity={0.5} />
            </g>
          ))}
          {/* Arrows */}
          {[[68, 102], [158, 192]].map(([x1, x2], i) => (
            <g key={i}>
              <line x1={x1} y1={80} x2={x2} y2={80} stroke={colors.light} strokeWidth={2.5} />
              <polygon points={`${x2},76 ${x2 + 8},80 ${x2},84`} fill={colors.light} />
            </g>
          ))}
          {/* Decorative circles */}
          <circle cx={130} cy={30} r={10} fill={colors.light} opacity={0.5} />
          <circle cx={40} cy={130} r={6} fill={colors.light} opacity={0.4} />
          <circle cx={220} cy={130} r={6} fill={colors.light} opacity={0.4} />
        </svg>
      );
    }

    if (isPipeline) {
      // Pipeline: stacked horizontal bars like a schedule/gantt
      const bars = [
        { x: 30, w: 100, y: 40 },
        { x: 80, w: 130, y: 65 },
        { x: 30, w: 70, y: 90 },
        { x: 110, w: 120, y: 115 },
      ];
      return (
        <svg viewBox="0 0 260 160" width="100%" height="100%" style={{ display: 'block', maxHeight: 160 }}>
          {/* Grid lines */}
          {[40, 80, 120, 160, 200, 240].map((x) => (
            <line key={x} x1={x} y1={30} x2={x} y2={135} stroke={colors.light} strokeWidth={1} opacity={0.5} />
          ))}
          {bars.map((b, i) => (
            <rect key={i} x={b.x} y={b.y} width={b.w} height={18} rx={4}
              fill={i % 2 === 0 ? colors.primary : colors.muted} opacity={0.85} />
          ))}
        </svg>
      );
    }

    if (isPie) {
      // Donut chart
      const segments = [
        { pct: 0.42, color: colors.primary },
        { pct: 0.28, color: colors.muted },
        { pct: 0.2, color: colors.light },
        { pct: 0.1, color: '#cfe0ff' },
      ];
      let angle = -Math.PI / 2;
      const cx = 130, cy = 80, r = 52, ir = 30;
      const paths = segments.map((seg) => {
        const start = angle;
        const end = angle + seg.pct * 2 * Math.PI;
        angle = end;
        const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
        const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
        const xi1 = cx + ir * Math.cos(start), yi1 = cy + ir * Math.sin(start);
        const xi2 = cx + ir * Math.cos(end), yi2 = cy + ir * Math.sin(end);
        const large = seg.pct > 0.5 ? 1 : 0;
        return { d: `M${xi1},${yi1} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} L${xi2},${yi2} A${ir},${ir} 0 ${large},0 ${xi1},${yi1} Z`, color: seg.color };
      });
      return (
        <svg viewBox="0 0 260 160" width="100%" height="100%" style={{ display: 'block', maxHeight: 160 }}>
          {paths.map((p, i) => <path key={i} d={p.d} fill={p.color} />)}
        </svg>
      );
    }

    if (isChart) {
      // Bar chart
      const vals = isChart && /LINE_CHART|AREA_CHART|SPARKLINE/.test(vizType)
        ? null // use line below
        : [55, 80, 45, 95, 70, 60, 85];
      const isLine = /LINE_CHART|AREA_CHART|SPARKLINE/.test(vizType);
      if (isLine) {
        const pts = [[20, 120], [60, 85], [100, 100], [140, 60], [180, 75], [220, 45], [250, 65]];
        const polyline = pts.map((p) => p.join(',')).join(' ');
        const areaPath = `M${pts[0][0]},140 ` + pts.map((p) => `L${p[0]},${p[1]}`).join(' ') + ` L${pts[pts.length-1][0]},140 Z`;
        return (
          <svg viewBox="0 0 270 150" width="100%" height="100%" style={{ display: 'block', maxHeight: 160 }}>
            <path d={areaPath} fill={colors.light} opacity={0.5} />
            <polyline points={polyline} fill="none" stroke={colors.primary} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={4} fill={colors.primary} />)}
          </svg>
        );
      }
      if (vals) {
        const barW = 24, gap = 12, baseY = 130;
        return (
          <svg viewBox="0 0 260 160" width="100%" height="100%" style={{ display: 'block', maxHeight: 160 }}>
            {vals.map((v, i) => (
              <rect key={i} x={20 + i * (barW + gap)} y={baseY - v} width={barW} height={v} rx={4}
                fill={i % 3 === 0 ? colors.primary : i % 3 === 1 ? colors.muted : colors.light} />
            ))}
            <line x1={16} y1={baseY} x2={244} y2={baseY} stroke={colors.light} strokeWidth={1.5} />
          </svg>
        );
      }
    }

    // Default: table thumbnail
    const rowCount = 4;
    return (
      <svg viewBox="0 0 260 160" width="100%" height="100%" style={{ display: 'block', maxHeight: 160 }}>
        {/* Header row */}
        <rect x={20} y={25} width={220} height={22} rx={4} fill={colors.primary} opacity={0.85} />
        <rect x={30} y={31} width={50} height={9} rx={3} fill="white" opacity={0.6} />
        <rect x={100} y={31} width={40} height={9} rx={3} fill="white" opacity={0.6} />
        <rect x={160} y={31} width={60} height={9} rx={3} fill="white" opacity={0.6} />
        {/* Data rows */}
        {Array.from({ length: rowCount }).map((_, i) => (
          <g key={i}>
            <rect x={20} y={53 + i * 24} width={220} height={20} rx={3}
              fill={i % 2 === 0 ? '#f4f7ff' : 'white'} />
            <rect x={30} y={59 + i * 24} width={40 + (i % 3) * 10} height={7} rx={2} fill={colors.light} opacity={0.7} />
            <rect x={100} y={59 + i * 24} width={30 + (i % 2) * 8} height={7} rx={2} fill={colors.muted} opacity={0.5} />
            <rect x={160} y={59 + i * 24} width={45 + (i % 2) * 12} height={7} rx={2} fill={colors.light} opacity={0.6} />
          </g>
        ))}
        {/* Border */}
        <rect x={20} y={25} width={220} height={149} rx={4} fill="none" stroke={colors.light} strokeWidth={1} />
      </svg>
    );
  }

  // ── Render: item card ──────────────────────────────────────────────────

  function renderItemCard(item: SavedArtifact) {
    const isHovered = hoveredCard === item.id;
    const isDragging = draggingId === item.id;
    const vizType = item.steps?.[0]?.visualizationType || '';
    const subLabel = vizType
      ? vizType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      : TYPE_LABELS[item.type] || item.type;

    return (
      <div
        key={item.id}
        style={{
          ...S.card(false),
          ...(isHovered ? S.cardHover : {}),
          ...(isDragging ? S.dragging : {}),
        }}
        onMouseEnter={() => setHoveredCard(item.id)}
        onMouseLeave={() => setHoveredCard(null)}
        draggable
        onDragStart={(e) => handleDragStart(e, item.id)}
        onDragEnd={handleDragEnd}
      >
        {/* Card header: avatar + name/subtype + visibility badge */}
        <div style={{ ...S.cardHeaderPad, ...S.cardHeader }}>
          <div style={S.cardTitleRow}>
            <div style={S.cardIconAvatar}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--accent, #1967d2)' }}>
                {TYPE_ICONS[item.type] || 'description'}
              </span>
            </div>
            <div style={{ minWidth: 0 }}>
              {renderName(item.id, item.name, 'item')}
              <div style={S.cardSubtype}>{subLabel}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {item.isPublic && (
              <span
                style={S.sharedBadge}
                title={item.userId !== userId ? `Shared by ${item.ownerEmail || 'a teammate'}` : 'Shared with your team'}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>lock_open</span>
                {item.userId !== userId ? (item.ownerEmail?.split('@')[0] || 'shared') : 'shared'}
              </span>
            )}
            {item.userId === userId && (
              <button
                style={S.moreBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpenId(menuOpenId === item.id ? null : item.id);
                }}
              >
                <span className="material-symbols-outlined">more_vert</span>
              </button>
            )}
          </div>
        </div>

        {/* Thumbnail */}
        <div style={S.cardThumbnail}>
          {renderThumbnail(item)}
        </div>

        {/* Description / meta */}
        <div style={S.cardBody}>
          {item.description ? (
            <div style={S.cardDesc}>{item.description}</div>
          ) : (
            <div style={{ ...S.cardDesc, color: 'var(--text-dim, #80868b)', fontStyle: 'italic' }}>
              {item.updatedAt ? `Updated ${relativeTime(item.updatedAt)}` : 'No description'}
            </div>
          )}
        </div>

        {/* Footer: action buttons + delete */}
        <div style={S.cardFooter}>
          <button style={S.outlineBtn} onClick={() => {
            if (item.chatMessages && item.chatMessages.length > 0) {
              setReplayArtifact(item);
            } else {
              onRun(item);
            }
          }}>Open</button>
          {item.userId === userId && (
            <button
              style={S.outlineBtn}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpenId(menuOpenId === item.id ? null : item.id);
              }}
            >
              More
            </button>
          )}
          {item.userId === userId && (
            <button
              style={S.deleteIconBtn}
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteItem(item.id);
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>delete</span>
            </button>
          )}
        </div>

        {item.userId === userId && renderContextMenu(item.id, 'item', item.name)}
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
          {item.isPublic ? (
            <span style={S.sharedBadge}>
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>lock_open</span>
              {item.userId !== userId ? (item.ownerEmail?.split('@')[0] || 'shared') : 'shared'}
            </span>
          ) : (
            <span style={S.privateBadge}>
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>lock</span>
              private
            </span>
          )}
        </td>
        <td style={S.listCellMuted}>
          {item.runCount > 0 ? `${item.runCount}x` : ''}
        </td>
        <td style={S.listCellMuted}>{relativeTime(item.updatedAt)}</td>
        <td style={{ ...S.listCell, width: 40, position: 'relative' as const }}>
          {item.userId === userId && (
            <>
              <button
                style={S.moreBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpenId(menuOpenId === item.id ? null : item.id);
                }}
              >
                <span className="material-symbols-outlined">more_vert</span>
              </button>
              {renderContextMenu(item.id, 'item', item.name)}
            </>
          )}
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
    const EMPTY_ICONS: Record<string, string> = {
      all: 'home_storage',
      query: 'query_stats',
      workflow: 'conversion_path',
      pipeline: 'schedule',
      app: 'apps',
    };
    const icon = EMPTY_ICONS[activeTab] ?? 'folder_open';
    const tabLabel = activeTab === 'all' ? 'saved items' : activeTab === 'query' ? 'queries' : activeTab === 'workflow' ? 'workflows' : activeTab === 'pipeline' ? 'pipelines' : 'apps';
    return (
      <div style={S.emptyState}>
        <span className="material-symbols-outlined" style={S.emptyIcon}>
          {icon}
        </span>
        <div style={S.emptyTitle}>
          {activeSpaceId ? 'This space is empty' : `No ${tabLabel} yet`}
        </div>
        <div style={S.emptyDesc}>
          {activeSpaceId
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

  // If viewing a thread replay, show that instead of the catalog
  if (replayArtifact && replayArtifact.chatMessages) {
    return (
      <div style={S.container}>
        <ThreadReplayView
          name={replayArtifact.name}
          messages={replayArtifact.chatMessages}
          onBack={() => setReplayArtifact(null)}
        />
      </div>
    );
  }

  return (
    <div style={S.container}>
      {/* Header */}
      <div style={S.header}>
        <h1 style={S.title}>{TAB_TITLES[activeTab] ?? 'Content'}</h1>
        <div style={S.headerRight}>
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
          <div style={S.viewToggle}>
            <button
              className="gc-icon-btn"
              style={S.viewBtn(viewMode === 'card')}
              onClick={() => setViewMode('card')}
              title="Card view"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>grid_view</span>
            </button>
            <button
              className="gc-icon-btn"
              style={S.viewBtn(viewMode === 'list')}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>view_list</span>
            </button>
          </div>
        </div>
      </div>

      {/* Visibility filter chips */}
      <div style={S.filterChips}>
        {(['all', 'public', 'private'] as VisibilityFilter[]).map((f) => (
          <button
            key={f}
            style={S.filterChip(visibilityFilter === f)}
            onClick={() => setVisibilityFilter(f)}
          >
            {f === 'all' && <span className="material-symbols-outlined" style={{ fontSize: 14 }}>dashboard</span>}
            {f === 'public' && <span className="material-symbols-outlined" style={{ fontSize: 14 }}>lock_open</span>}
            {f === 'private' && <span className="material-symbols-outlined" style={{ fontSize: 14 }}>lock</span>}
            {f === 'all' ? 'All' : f === 'public' ? 'Shared' : 'Private'}
          </button>
        ))}
        {visibilityFilter === 'public' && sharedByOthers.length > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-dim, #80868b)', marginLeft: 4 }}>
            {sharedByOthers.length} from teammates
          </span>
        )}
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
