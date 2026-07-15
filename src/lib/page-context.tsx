'use client';

// Tab-aware page context.
// The main view shows a tab bar with "Chat" always first, plus any opened
// dashboard tabs. Clicking a tab switches the visible content without
// losing state in other tabs.

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type AppPage = 'chat' | 'prompts' | 'favorites' | 'spaces' | string;

export interface AppTab {
  id: string;            // unique key: 'chat' | 'dashboard:{dashboardId}'
  label: string;         // display text in the tab bar
  page: AppPage;         // which page/view this tab renders
  dashboardId?: string;  // set when page === 'dashboard'
  closeable: boolean;    // Chat tab is not closeable
}

interface PageContextValue {
  // Legacy single-page API (used by sidebar nav, prompts, spaces, etc.)
  activePage: AppPage;
  setActivePage: (page: AppPage) => void;

  // Tab API
  tabs: AppTab[];
  activeTabId: string;
  openDashboardTab: (dashboardId: string, label: string) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
}

const PageContext = createContext<PageContextValue | null>(null);

const CHAT_TAB: AppTab = { id: 'chat', label: 'Chat', page: 'chat', closeable: false };

export function PageProvider({ children }: { children: ReactNode }) {
  const [tabs, setTabs] = useState<AppTab[]>([CHAT_TAB]);
  const [activeTabId, setActiveTabIdState] = useState<string>('chat');
  // activePage tracks non-tab overlays (prompts, spaces, favorites)
  const [activePage, setActivePageState] = useState<AppPage>('chat');

  const setActivePage = useCallback((page: AppPage) => {
    setActivePageState(page);
    // If navigating to a tab-aware page, reset to chat tab
    if (page === 'chat') {
      setActiveTabIdState('chat');
    }
  }, []);

  const setActiveTab = useCallback((tabId: string) => {
    setActiveTabIdState(tabId);
    // Non-tab overlays should be cleared when switching tabs
    setActivePageState('chat');
  }, []);

  const openDashboardTab = useCallback((dashboardId: string, label: string) => {
    const tabId = `dashboard:${dashboardId}`;
    setTabs((prev) => {
      const exists = prev.find((t) => t.id === tabId);
      if (exists) return prev;
      return [
        ...prev,
        { id: tabId, label, page: 'dashboard', dashboardId, closeable: true },
      ];
    });
    setActiveTabIdState(tabId);
    setActivePageState('chat'); // clear overlays
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const filtered = prev.filter((t) => t.id !== tabId);
      return filtered.length > 0 ? filtered : [CHAT_TAB];
    });
    setActiveTabIdState((current) => {
      if (current !== tabId) return current;
      // Activate the tab to the left, or Chat
      return 'chat';
    });
  }, []);

  return (
    <PageContext.Provider value={{
      activePage,
      setActivePage,
      tabs,
      activeTabId,
      openDashboardTab,
      closeTab,
      setActiveTab,
    }}>
      {children}
    </PageContext.Provider>
  );
}

export function usePage() {
  const ctx = useContext(PageContext);
  if (!ctx) throw new Error('usePage must be used inside PageProvider');
  return ctx;
}
