'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ConversationProvider, useConversation } from '@/lib/conversation-context';
import { PageProvider, usePage } from '@/lib/page-context';
import { LayoutProvider, useLayout } from '@/lib/layout-context';
import { PreferencesProvider } from '@/lib/preferences-context';
import { BuilderProvider } from '@/lib/builder-context';
import { SignedOutPage } from './SignedOutPage';
import { GlobalSearch } from '@/components/GlobalSearch';
import { ProjectPickerDialog } from './ProjectPickerDialog';
import { AvatarMenu } from './AvatarMenu';
import { HeaderOptionsMenu } from './HeaderOptionsMenu';
import {
  ConsoleShell,
  type ConsoleSideNavItem,
  Icons,
  MaterialSymbols,
  ConsoleIcons,
  SnackbarHost,
  snackbar,
} from '@/kit';

interface ShellLayoutProps {
  children: React.ReactNode;
}

function ConsoleShellContent({ children }: { children: React.ReactNode }) {
  const { user, activeProject } = useAuth();
  const { newConversation } = useConversation();
  const { activePage, setActivePage, tabs, activeTabId, setActiveTab } = usePage();
  const { chatListOpen, setChatListOpen, toggleChatList, layout } = useLayout();

  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);

  const openGlobalSearch = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
  };

  const navItems = useMemo<ConsoleSideNavItem[]>(() => [
    {
      id: 'home',
      label: 'Home',
      icon: <MaterialSymbols.Home className="size-[18px]" />,
    },
    {
      id: 'chat',
      label: 'AI Chat',
      icon: <MaterialSymbols.AutoAwesome className="size-[18px]" />,
    },
    {
      id: 'ai-inbox',
      label: 'AI inbox / Tasks',
      icon: <MaterialSymbols.Inbox className="size-[18px]" />,
    },
    {
      id: 'automation',
      label: 'Automation',
      icon: <ConsoleIcons.Automation className="size-[18px]" />,
    },
    {
      id: 'catalog',
      label: 'Catalog',
      icon: <MaterialSymbols.MenuBook className="size-[18px]" />,
    },
    {
      id: 'manage-section',
      label: 'Manage',
      isSection: true,
      defaultOpen: true,
      children: [
        {
          id: 'security',
          label: 'Security & governance',
          icon: <MaterialSymbols.Shield className="size-[18px]" />,
        },
        {
          id: 'observability',
          label: 'Observability',
          icon: <MaterialSymbols.Monitoring className="size-[18px]" />,
        },
        {
          id: 'infrastructure',
          label: 'Infrastructure',
          icon: <MaterialSymbols.Dns className="size-[18px]" />,
        },
        {
          id: 'skills',
          label: 'Skills',
          icon: <MaterialSymbols.EditNote className="size-[18px]" />,
        },
      ],
    },
    {
      id: 'library-section',
      label: 'Library',
      isSection: true,
      defaultOpen: true,
      children: [
        { id: 'spaces:all', label: 'All', icon: <MaterialSymbols.Storage className="size-[18px]" /> },
        { id: 'spaces:dashboards', label: 'Dashboards', icon: <MaterialSymbols.QueryStats className="size-[18px]" /> },
        { id: 'spaces:apps', label: 'Apps', icon: <MaterialSymbols.Dashboard className="size-[18px]" /> },
        { id: 'spaces:reports', label: 'Reports', icon: <MaterialSymbols.Description className="size-[18px]" /> },
        { id: 'spaces:recipes', label: 'Recipes', icon: <MaterialSymbols.DashboardCustomize className="size-[18px]" /> },
        { id: 'favorites', label: 'Favorites', icon: <MaterialSymbols.Star className="size-[18px]" /> },
        { id: 'spaces:bookmarks', label: 'Bookmarks', icon: <MaterialSymbols.Bookmarks className="size-[18px]" /> },
        { id: 'prompts', label: 'Prompts', icon: <MaterialSymbols.Dashboard className="size-[18px]" /> },
      ],
    },
    {
      id: 'workspaces-section',
      label: 'Workspaces',
      isSection: true,
      defaultOpen: true,
      action: {
        icon: <MaterialSymbols.CreateNewFolder className="size-4" />,
        title: 'Add workspace',
        onClick: () => {
          snackbar('Workspace creation modal');
        },
      },
      children: [
        {
          id: 'workspace-churn',
          label: 'Customer churn analysis',
          icon: <MaterialSymbols.FolderOpen className="size-[18px]" />,
          onAddChat: () => {
            newConversation();
            setActivePage('chat');
            snackbar('Created new chat in "Customer churn analysis"');
          },
          children: [
            { id: 'chat-churn-1', label: 'Train churn classification...' },
            { id: 'chat-churn-2', label: 'Compare month to month...' },
            { id: 'chat-churn-3', label: 'Top 10 customers by spend...' },
          ],
        },
        {
          id: 'workspace-ecommerce',
          label: 'E-Commerce Analytics',
          icon: <MaterialSymbols.FolderOpen className="size-[18px]" />,
          onAddChat: () => {
            newConversation();
            setActivePage('chat');
            snackbar('Created new chat in "E-Commerce Analytics"');
          },
          children: [
            { id: 'chat-ecom-1', label: 'Q3 sales breakdown...' },
            { id: 'chat-ecom-2', label: 'Order velocity & cohorts...' },
          ],
        },
      ],
    },
    ...(tabs.filter((t) => t.id !== 'chat').length > 0
      ? [
          {
            id: 'open-section',
            label: 'Open Tabs',
            isSection: true,
            defaultOpen: true,
            children: tabs
              .filter((t) => t.id !== 'chat')
              .map((tab) => ({
                id: tab.id,
                label: tab.label,
                icon:
                  tab.page === 'builder' ? (
                    <MaterialSymbols.DashboardCustomize className="size-[18px]" />
                  ) : (
                    <MaterialSymbols.Dashboard className="size-[18px]" />
                  ),
              })),
          },
        ]
      : []),
  ], [tabs, newConversation, setActivePage]);

  const handleNavSelect = (id: string) => {
    // Tab match
    const foundTab = tabs.find((t) => t.id === id);
    if (foundTab) {
      setActiveTab(foundTab.id);
      return;
    }

    if (id === 'chat-churn-1' || id === 'chat-churn-2' || id === 'chat-churn-3' || id === 'chat-ecom-1' || id === 'chat-ecom-2') {
      setActivePage('chat');
      return;
    }

    if (id === 'chat') {
      if (activePage !== 'chat') {
        setActivePage('chat');
        if (layout === 'unified') setChatListOpen(true);
      } else if (layout === 'unified') {
        toggleChatList();
      }
      return;
    }

    setActivePage(id);
  };

  const displayName = user?.name || user?.email?.split('@')[0] || 'User';
  const avatarLabel = displayName.charAt(0).toUpperCase();

  return (
    <>
      <ConsoleShell
        projectName={activeProject || 'Select a project'}
        productName="BigQuery AIF"
        navIcon={<img src="/crystal-ball.svg" alt="BigQuery AIF" className="size-6 object-contain" />}
        avatarLabel={avatarLabel}
        avatarUrl={user?.picture || undefined}
        nav={navItems}
        activeNavId={activePage}
        onNavSelect={handleNavSelect}
        onProjectClick={() => setProjectPickerOpen(true)}
        onSearchClick={openGlobalSearch}
        onAvatarClick={() => setAvatarMenuOpen(true)}
        moreMenuContent={
          <HeaderOptionsMenu
            onOpenProjectPicker={() => setProjectPickerOpen(true)}
            onOpenAvatarMenu={() => setAvatarMenuOpen(true)}
          />
        }
        defaultNavExpanded
        bare
      >
        {children}
      </ConsoleShell>

      <ProjectPickerDialog
        open={projectPickerOpen}
        onOpenChange={setProjectPickerOpen}
      />

      <AvatarMenu
        open={avatarMenuOpen}
        onOpenChange={setAvatarMenuOpen}
      />

      <SnackbarHost />
    </>
  );
}

export function ShellLayout({ children }: ShellLayoutProps) {
  const { user, bqAuthorized, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--cm-sys-color-backdrop, #F0F5FE)',
        }}
      />
    );
  }

  if (!user || !bqAuthorized) {
    return <SignedOutPage />;
  }

  return (
    <ConversationProvider>
      <PageProvider>
        <BuilderProvider>
          <LayoutProvider>
            <PreferencesProvider>
              <GlobalSearch />
              <ConsoleShellContent>{children}</ConsoleShellContent>
            </PreferencesProvider>
          </LayoutProvider>
        </BuilderProvider>
      </PageProvider>
    </ConversationProvider>
  );
}
