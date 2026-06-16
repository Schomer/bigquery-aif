'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ConversationProvider } from '@/lib/conversation-context';
import { PageProvider } from '@/lib/page-context';
import { TopBar } from './TopBar';
import { SideNav } from './SideNav';
import { SignedOutPage } from './SignedOutPage';
import { GlobalSearch } from '@/components/GlobalSearch';

interface ShellLayoutProps {
  children: React.ReactNode;
}

export function ShellLayout({ children }: ShellLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuth();

  if (!user) {
    return <SignedOutPage />;
  }

  return (
    <ConversationProvider>
      <PageProvider>
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
      </PageProvider>
    </ConversationProvider>
  );
}
