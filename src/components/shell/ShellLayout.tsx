'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ConversationProvider } from '@/lib/conversation-context';
import { PageProvider } from '@/lib/page-context';
import { LayoutProvider } from '@/lib/layout-context';
import { TopBar } from './TopBar';
import { SideNav } from './SideNav';
import { SignedOutPage } from './SignedOutPage';
import { GlobalSearch } from '@/components/GlobalSearch';

interface ShellLayoutProps {
  children: React.ReactNode;
}

export function ShellLayout({ children }: ShellLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, bqAuthorized } = useAuth();

  if (!user || !bqAuthorized) {
    return <SignedOutPage />;
  }

  return (
    <ConversationProvider>
      <PageProvider>
        <LayoutProvider>
          <GlobalSearch />
          <TopBar onNavToggle={() => setCollapsed((c) => !c)} />
          <div className="gc-shell">
            <SideNav collapsed={collapsed} />
            <main
              className={`gc-content${collapsed ? ' gc-content--nav-collapsed' : ''}`}
              id="content"
            >
              {children}
            </main>
          </div>
        </LayoutProvider>
      </PageProvider>
    </ConversationProvider>
  );
}
