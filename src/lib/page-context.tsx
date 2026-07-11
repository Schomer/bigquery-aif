'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

export type AppPage = 'chat' | 'prompts' | 'overview' | 'favorites' | 'spaces' | string;

interface PageContextValue {
  activePage: AppPage;
  setActivePage: (page: AppPage) => void;
}

const PageContext = createContext<PageContextValue | null>(null);

export function PageProvider({ children }: { children: ReactNode }) {
  const [activePage, setActivePage] = useState<AppPage>('chat');
  return (
    <PageContext.Provider value={{ activePage, setActivePage }}>
      {children}
    </PageContext.Provider>
  );
}

export function usePage() {
  const ctx = useContext(PageContext);
  if (!ctx) throw new Error('usePage must be used inside PageProvider');
  return ctx;
}
