'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type ChatLayout = 'unified' | 'chat-right' | 'chat-left';

interface LayoutContextValue {
  layout: ChatLayout;
  setLayout: (layout: ChatLayout) => void;
  historyVisible: boolean;
  setHistoryVisible: (visible: boolean) => void;
}

const LayoutContext = createContext<LayoutContextValue>({
  layout: 'unified',
  setLayout: () => {},
  historyVisible: true,
  setHistoryVisible: () => {},
});

const STORAGE_KEY = 'hdn_chat_layout';
const HISTORY_KEY = 'hdn_history_visible';

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [layout, setLayoutState] = useState<ChatLayout>('unified');
  const [historyVisible, setHistoryVisibleState] = useState(true);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'unified' || stored === 'chat-right' || stored === 'chat-left') {
        setLayoutState(stored);
      }
    } catch { /* ignore */ }
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored !== null) setHistoryVisibleState(stored !== 'false');
    } catch { /* ignore */ }
  }, []);

  function setLayout(next: ChatLayout) {
    setLayoutState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
  }

  function setHistoryVisible(visible: boolean) {
    setHistoryVisibleState(visible);
    try { localStorage.setItem(HISTORY_KEY, String(visible)); } catch { /* ignore */ }
  }

  return (
    <LayoutContext.Provider value={{ layout, setLayout, historyVisible, setHistoryVisible }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  return useContext(LayoutContext);
}
