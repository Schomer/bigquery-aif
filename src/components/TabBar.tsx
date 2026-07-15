'use client';

// TabBar.tsx
// Horizontal tab strip shown across the top of the main content area.
// Always shows a Chat tab. Dashboard tabs are added dynamically when the
// user clicks "Open Dashboard" from a chat artifact card.

import { usePage } from '@/lib/page-context';

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab } = usePage();

  // Don't render if only the Chat tab exists — nothing to switch between
  if (tabs.length <= 1) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        height: 40,
        flexShrink: 0,
        overflowX: 'auto',
        overflowY: 'hidden',
        scrollbarWidth: 'none',
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 14px',
              minWidth: 0,
              maxWidth: 200,
              flexShrink: 0,
              cursor: 'pointer',
              userSelect: 'none',
              borderRight: '1px solid var(--border)',
              borderBottom: isActive
                ? '2px solid #1a73e8'
                : '2px solid transparent',
              background: isActive ? 'var(--chat-bg, #f8f9fa)' : 'transparent',
              transition: 'background 0.12s',
              position: 'relative',
            }}
            onClick={() => setActiveTab(tab.id)}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = 'var(--surface-hover, #f0f0f0)';
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = 'transparent';
            }}
          >
            {/* Tab icon */}
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: 14,
                color: isActive ? '#1a73e8' : 'var(--text-muted)',
                flexShrink: 0,
              }}
            >
              {tab.id === 'chat' ? 'chat' : 'dashboard'}
            </span>

            {/* Tab label */}
            <span
              style={{
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--text)' : 'var(--text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flex: 1,
                minWidth: 0,
                fontFamily: "'Google Sans', sans-serif",
              }}
            >
              {tab.label}
            </span>

            {/* Close button (closeable tabs only) */}
            {tab.closeable && (
              <button
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                title="Close tab"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-dim)',
                  flexShrink: 0,
                  padding: 0,
                  lineHeight: 1,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--border)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>close</span>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
