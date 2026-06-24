'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type ChatLayout = 'unified' | 'chat-right' | 'chat-left';

interface LayoutContextValue {
  layout: ChatLayout;
  setLayout: (layout: ChatLayout) => void;
}

const LayoutContext = createContext<LayoutContextValue>({
  layout: 'unified',
  setLayout: () => {},
});

const STORAGE_KEY = 'hdn_chat_layout';

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [layout, setLayoutState] = useState<ChatLayout>('unified');

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'unified' || stored === 'chat-right' || stored === 'chat-left') {
        setLayoutState(stored);
      }
    } catch { /* ignore */ }
  }, []);

  function setLayout(next: ChatLayout) {
    setLayoutState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
  }

  return (
    <LayoutContext.Provider value={{ layout, setLayout }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  return useContext(LayoutContext);
}
