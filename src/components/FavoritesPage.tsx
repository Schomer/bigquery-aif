'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { getFavorites, removeFavorite } from '@/lib/firestore-service';
import type { FavoriteItem } from '@/lib/firestore-service';
import { getPinnedArtifacts, updateArtifact } from '@/lib/saved-work';
import type { SavedArtifact } from '@/lib/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, string> = {
  message: 'chat',
  query: 'query_stats',
  table: 'table_chart',
  chart: 'bar_chart',
  workflow: 'conversion_path',
  pipeline: 'schedule',
  app: 'apps',
};

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

type TabKey = 'all' | 'chats' | 'queries' | 'workflows' | 'pipelines';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'chats', label: 'Chats' },
  { key: 'queries', label: 'Queries' },
  { key: 'workflows', label: 'Workflows' },
  { key: 'pipelines', label: 'Pipelines' },
];

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: active ? 600 : 400,
    color: active ? 'var(--accent)' : 'var(--text-muted)',
    background: 'none',
    border: 'none',
    borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
    cursor: 'pointer',
    fontFamily: "'Google Sans', sans-serif",
    marginBottom: -1,
    transition: 'color 0.15s, border-color 0.15s',
  };
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: 'var(--surface-2)',
          animation: 'pulse 1.4s ease-in-out infinite',
        }}
      />
      <div
        style={{
          width: '70%',
          height: 16,
          borderRadius: 4,
          background: 'var(--surface-2)',
          animation: 'pulse 1.4s ease-in-out infinite',
        }}
      />
      <div
        style={{
          width: '40%',
          height: 12,
          borderRadius: 4,
          background: 'var(--surface-2)',
          animation: 'pulse 1.4s ease-in-out infinite',
        }}
      />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
        gap: 16,
      }}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

interface FavoritesPageProps {
  userId: string;
  onLoadConversation: (convId: string) => void;
  onRunArtifact: (artifact: SavedArtifact) => void;
}

export function FavoritesPage({ userId, onLoadConversation, onRunArtifact }: FavoritesPageProps) {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [pinnedArtifacts, setPinnedArtifacts] = useState<SavedArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [favs, pinned] = await Promise.all([
        getFavorites(userId),
        getPinnedArtifacts(userId),
      ]);
      setFavorites(favs);
      setPinnedArtifacts(pinned);
    } catch (err) {
      console.error('FavoritesPage: failed to load data', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleUnfavorite = async (id: string) => {
    setFavorites((prev) => prev.filter((f) => f.id !== id));
    try {
      await removeFavorite(userId, id);
    } catch (err) {
      console.error('Failed to remove favorite', err);
      load(); // re-sync on error
    }
  };

  const handleUnpin = async (id: string) => {
    setPinnedArtifacts((prev) => prev.filter((a) => a.id !== id));
    try {
      await updateArtifact(userId, id, { pinned: false });
    } catch (err) {
      console.error('Failed to unpin artifact', err);
      load();
    }
  };

  // ── Filtering ────────────────────────────────────────────────────────────

  const filteredFavorites = activeTab === 'all' || activeTab === 'chats'
    ? favorites
    : activeTab === 'queries'
      ? favorites.filter((f) => f.type === 'query')
      : [];

  const filteredArtifacts = activeTab === 'all'
    ? pinnedArtifacts
    : activeTab === 'chats'
      ? []
      : activeTab === 'queries'
        ? pinnedArtifacts.filter((a) => a.type === 'query')
        : activeTab === 'workflows'
          ? pinnedArtifacts.filter((a) => a.type === 'workflow')
          : pinnedArtifacts.filter((a) => a.type === 'pipeline');

  const totalCount = filteredFavorites.length + filteredArtifacts.length;

  // ── Card styles ──────────────────────────────────────────────────────────

  const cardBase: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 20,
    cursor: 'pointer',
    transition: 'box-shadow 0.2s, border-color 0.2s',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    position: 'relative',
  };

  const cardHover: React.CSSProperties = {
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    borderColor: 'var(--accent)',
  };

  function getCardStyle(id: string): React.CSSProperties {
    return hoveredCard === id ? { ...cardBase, ...cardHover } : cardBase;
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const isEmpty = !loading && totalCount === 0;

  return (
    <div
      style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '32px 24px',
        fontFamily: "'Google Sans', sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 28, color: 'var(--accent)' }}
        >
          star
        </span>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 600,
            color: 'var(--text)',
            margin: 0,
            fontFamily: "'Google Sans', sans-serif",
          }}
        >
          Favorites
        </h1>
        {!loading && (
          <span
            style={{
              fontSize: 13,
              color: 'var(--text-dim)',
              background: 'var(--surface-2)',
              borderRadius: 12,
              padding: '2px 10px',
              fontWeight: 500,
            }}
          >
            {totalCount}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          marginBottom: 24,
          gap: 0,
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={tabStyle(activeTab === t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && <LoadingSkeleton />}

      {/* Empty state */}
      {isEmpty && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 24px',
            gap: 16,
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 48, color: 'var(--text-dim)' }}
          >
            star
          </span>
          <p
            style={{
              fontSize: 16,
              color: 'var(--text-muted)',
              margin: 0,
              fontFamily: "'Google Sans', sans-serif",
            }}
          >
            No favorites yet
          </p>
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-dim)',
              margin: 0,
              fontFamily: "'Google Sans', sans-serif",
              textAlign: 'center',
              maxWidth: 360,
            }}
          >
            Star conversations or pin saved items to see them here.
          </p>
        </div>
      )}

      {/* Card grid */}
      {!loading && totalCount > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 16,
          }}
        >
          {/* Favorite chat cards */}
          {filteredFavorites.map((fav) => (
            <div
              key={`fav-${fav.id}`}
              style={getCardStyle(`fav-${fav.id}`)}
              onMouseEnter={() => setHoveredCard(`fav-${fav.id}`)}
              onMouseLeave={() => setHoveredCard(null)}
              onClick={() => onLoadConversation(fav.id)}
            >
              {/* Icon + type badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: 'var(--surface-2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 20, color: 'var(--accent)' }}
                  >
                    {TYPE_ICONS[fav.type] || 'chat'}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: 'var(--text-dim)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  {fav.type}
                </span>
              </div>

              {/* Label */}
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--text)',
                  margin: 0,
                  lineHeight: 1.4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {fav.label}
              </p>

              {/* Footer */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 'auto',
                }}
              >
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                  {relativeTime(fav.createdAt)}
                </span>
                <button
                  title="Remove from favorites"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUnfavorite(fav.id);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 4,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-dim)',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--issue)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    star
                  </span>
                </button>
              </div>
            </div>
          ))}

          {/* Pinned artifact cards */}
          {filteredArtifacts.map((artifact) => (
            <div
              key={`pin-${artifact.id}`}
              style={getCardStyle(`pin-${artifact.id}`)}
              onMouseEnter={() => setHoveredCard(`pin-${artifact.id}`)}
              onMouseLeave={() => setHoveredCard(null)}
              onClick={() => onRunArtifact(artifact)}
            >
              {/* Icon + type badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: 'var(--surface-2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 20, color: 'var(--accent)' }}
                  >
                    {TYPE_ICONS[artifact.type] || 'apps'}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: 'var(--text-dim)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  {artifact.type}
                </span>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: 11,
                    color: 'var(--positive)',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                    push_pin
                  </span>
                  Pinned
                </span>
              </div>

              {/* Name */}
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--text)',
                  margin: 0,
                  lineHeight: 1.4,
                }}
              >
                {artifact.name}
              </p>

              {/* Description */}
              {artifact.description && (
                <p
                  style={{
                    fontSize: 13,
                    color: 'var(--text-muted)',
                    margin: 0,
                    lineHeight: 1.4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {artifact.description}
                </p>
              )}

              {/* Footer */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 'auto',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                  {relativeTime(artifact.updatedAt || artifact.createdAt)}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    title="Unpin"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUnpin(artifact.id);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 4,
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-dim)',
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--issue)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                      push_pin
                    </span>
                  </button>
                  <button
                    title="Run"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRunArtifact(artifact);
                    }}
                    style={{
                      background: 'var(--accent)',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px 12px',
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 500,
                      fontFamily: "'Google Sans', sans-serif",
                      transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                      play_arrow
                    </span>
                    Run
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
