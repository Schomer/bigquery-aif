'use client';

import { useAuth } from '@/lib/auth-context';
import { useConversation } from '@/lib/conversation-context';
import { usePage } from '@/lib/page-context';
import { useLayout } from '@/lib/layout-context';
import { useState } from 'react';

interface NavGroup {
  label: string;
  items: { label: string; icon: string; page: string }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Data',
    items: [
      { label: 'Datasets', icon: 'dataset', page: 'datasets' },
      { label: 'Tables', icon: 'table_chart', page: 'tables' },
      { label: 'Schema Explorer', icon: 'account_tree', page: 'schema' },
    ],
  },
  {
    label: 'Queries',
    items: [
      { label: 'Saved Queries', icon: 'manage_search', page: 'saved-queries' },
      { label: 'Query History', icon: 'history', page: 'query-history' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { label: 'Cost', icon: 'payments', page: 'cost' },
    ],
  },
];

interface SideNavProps {
  collapsed: boolean;
}

export function SideNav({ collapsed }: SideNavProps) {
  const { user } = useAuth();
  const { newConversation } = useConversation();
  const { activePage, setActivePage } = usePage();
  const { layout, chatListOpen, toggleChatList, setChatListOpen } = useLayout();
  const [navGroupsOpen, setNavGroupsOpen] = useState<Record<string, boolean>>(
    Object.fromEntries(NAV_GROUPS.map((g) => [g.label, true]))
  );

  function handleAiClick() {
    if (activePage !== 'chat') {
      setActivePage('chat');
      // In unified mode, also open the chat list when navigating to chat from another page
      if (layout === 'unified') setChatListOpen(true);
    } else if (layout === 'unified') {
      // Already on chat page in unified mode -- toggle the overlay
      toggleChatList();
    }
    // In split modes while already on chat page, do nothing (sidebar is always visible)
  }

  return (
    <nav className={`gc-side-nav${collapsed ? ' gc-side-nav--collapsed' : ''}`} id="side-nav" aria-label="Primary navigation">

      <div className="gc-nav-top">

        {/* Product header */}
        <div className="gc-nav-header">
          <img src="/crystal-ball.svg" width={26} height={26} aria-hidden="true" alt="" />
          <span className="gc-nav-header-text">BigQuery AIF</span>
        </div>

        {/* New CTA */}
        <div className="gc-nav-cta-wrap">
          <button
            className="gc-nav-cta"
            id="new-btn"
            aria-label="New conversation"
            onClick={() => newConversation()}
          >
            <span className="material-symbols-outlined">add</span>
            <span className="gc-nav-cta-label">New</span>
          </button>
        </div>

        {/* Top-level items */}
        <div className="gc-nav-section">
          {[
            { label: 'AI', icon: 'auto_awesome', page: 'chat' },
            { label: 'Favorites', icon: 'star', page: 'favorites' },
            { label: 'Prompts', icon: 'bookmarks', page: 'prompts' },
            { label: 'Spaces', icon: 'workspaces', page: 'spaces' },
          ].map((item) => (
            <div className="gc-nav-item-row" key={item.page}>
              <a
                className={`gc-nav-item${activePage === item.page ? ' gc-nav-item--active' : ''}${item.page === 'chat' && layout === 'unified' && chatListOpen ? ' gc-nav-item--active' : ''}`}
                href="#"
                data-page={item.page}
                onClick={(e) => {
                  e.preventDefault();
                  if (item.page === 'chat') {
                    handleAiClick();
                  } else {
                    setActivePage(item.page);
                  }
                }}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span className="gc-nav-label">{item.label}</span>
              </a>
            </div>
          ))}
        </div>

        {/* Grouped nav items */}
        {NAV_GROUPS.map((group) => (
          <div className="gc-nav-group" key={group.label}>
            <button className="gc-nav-group-header" onClick={() => setNavGroupsOpen((o) => ({ ...o, [group.label]: !o[group.label] }))}>
              <span className="gc-nav-group-label">{group.label}</span>
              <span className="material-symbols-outlined gc-nav-group-chevron">
                {navGroupsOpen[group.label] ? 'expand_less' : 'expand_more'}
              </span>
            </button>
            {navGroupsOpen[group.label] && (
              <div className="gc-nav-group-items">
                {group.items.map((item) => (
                  <div className="gc-nav-item-row" key={item.page}>
                    <a
                      className={`gc-nav-item${activePage === item.page ? ' gc-nav-item--active' : ''}`}
                      href="#"
                      data-page={item.page}
                      onClick={(e) => { e.preventDefault(); setActivePage(item.page); }}
                    >
                      <span className="material-symbols-outlined">{item.icon}</span>
                      <span className="gc-nav-label">{item.label}</span>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

      </div>

      {/* Bottom utility */}
      <div className="gc-nav-bottom">
        <a className={`gc-nav-item${activePage === 'how-it-works' ? ' gc-nav-item--active' : ''}`} href="#" data-page="how-it-works"
          onClick={(e) => { e.preventDefault(); setActivePage('how-it-works'); }}
        >
          <span className="material-symbols-outlined">info</span>
          <span className="gc-nav-label">How it works</span>
        </a>
        <a className={`gc-nav-item${activePage === 'settings' ? ' gc-nav-item--active' : ''}`} href="#" data-page="settings"
          onClick={(e) => { e.preventDefault(); setActivePage('settings'); }}
        >
          <span className="material-symbols-outlined">settings</span>
          <span className="gc-nav-label">Settings</span>
        </a>
      </div>

    </nav>
  );
}
