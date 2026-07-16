'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import { CrystalBallOracle } from '@/components/CrystalBallOracle';
import { useAuth } from '@/lib/auth-context';
import { useConversation } from '@/lib/conversation-context';
import { usePage } from '@/lib/page-context';
import { useLayout } from '@/lib/layout-context';
import { useChatOrchestration } from '@/hooks/useChatOrchestration';
import { PromptsLibrary } from '@/components/PromptsLibrary';
import { TabBar } from '@/components/TabBar';

import { ChatThread } from '@/components/chat/ChatThread';
import { ChatInput } from '@/components/chat/ChatInput';
import { ResultsSidebar } from '@/components/chat/ResultsSidebar';
import { ChatSidebar } from '@/components/ChatSidebar';
import { SpacesPage } from '@/components/SavedPage';
import { FavoritesPage } from '@/components/FavoritesPage';
import dynamic from 'next/dynamic';
const DashboardPage = dynamic(() => import('@/app/dashboard/page'), { ssr: false });
import { SaveModal } from '@/components/SaveModal';
import type { SavedArtifact } from '@/lib/types';
import {
  getConversations,
  getRecentDatasets,
  getFavoriteProjects,
} from '@/lib/firestore-service';
import type { RecentItem } from '@/lib/firestore-service';

export default function Home() {
  const { activeProject, user, projects, setActiveProject, accessToken } = useAuth();
  const { conversationId, loadConversation } = useConversation();
  const { activePage, setActivePage, tabs, activeTabId } = usePage();
  const { layout, chatListOpen, setChatListOpen, historyVisible } = useLayout();

  // ---- Chat orchestration hook ----
  const chat = useChatOrchestration();

  // ---- Refs ----
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ---- W1-14: Save as Workflow modal state ----
  const [workflowSaveOpen, setWorkflowSaveOpen] = useState(false);


  // ---- Favorite projects ----
  const FAVORITES_KEY = 'hdn_favorite_projects';
  const [favoriteProjectIds, setFavoriteProjectIds] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      if (raw) setFavoriteProjectIds(JSON.parse(raw));
    } catch { /* ignore */ }
    if (user?.uid) {
      getFavoriteProjects(user.uid).then((ids) => {
        if (ids.length > 0) {
          setFavoriteProjectIds(ids);
          try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids)); } catch {}
        }
      }).catch(() => {});
    }
  }, [user?.uid]);

  // ---- Recent projects ----
  const recentProjectIds = useMemo(() => {
    try {
      const raw = localStorage.getItem('hdn_recent_projects');
      if (raw) return (JSON.parse(raw) as string[]).slice(0, 5);
    } catch { /* ignore */ }
    return projects.slice(0, 5);
  }, [projects]);

  useEffect(() => {
    if (!activeProject) return;
    try {
      const raw = localStorage.getItem('hdn_recent_projects');
      const recent: string[] = raw ? JSON.parse(raw) : [];
      const updated = [activeProject, ...recent.filter(p => p !== activeProject)].slice(0, 10);
      localStorage.setItem('hdn_recent_projects', JSON.stringify(updated));
    } catch { /* ignore */ }
  }, [activeProject]);

  // ---- Recent datasets/tables ----
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  useEffect(() => {
    if (!user) return;
    getRecentDatasets(user.uid).then(setRecentItems).catch(() => {});
  }, [user]);

  // ---- Sidebar width (split layout) ----
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('hdn_sidebar_width');
      if (stored) return Math.max(280, Math.min(600, parseInt(stored, 10)));
    }
    return 380;
  });

  // ---- Load conversation on change ----
  useEffect(() => {
    if (!user) return;
    chat.setMessages([]);
    chat.setContext({});
    chat.setContextItems([]);
    chat.setPinnedEnvelopeId(null);
    chat.titleSetRef.current = false;

    getConversations(user.uid).then((convs) => {
      const match = convs.find((c) => c.id === conversationId);
      if (match) {
        chat.setMessages(match.messages);
        // Restore the project that was active when this conversation was saved
        if (match.project) {
          setActiveProject(match.project);
        }
      }
    }).catch(() => {});
  }, [conversationId, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Derived state ----
  const hasChat = chat.messages.length > 0;
  const isSplit = layout === 'chat-left' || layout === 'chat-right';

  const historyHiddenBefore = useMemo(() => {
    if (historyVisible || chat.messages.length <= 2) return 0;
    for (let i = chat.messages.length - 1; i >= 0; i--) {
      if (chat.messages[i].role === 'user') return i;
    }
    return 0;
  }, [chat.messages, historyVisible]);

  // In split layout, tracks whether the sidebar shows the chat list or the active thread
  const [splitView, setSplitView] = useState<'list' | 'thread'>('list');

  // Increments each time the user navigates to any spaces page, forcing SpacesPage to re-fetch.
  const [spacesVisitCount, setSpacesVisitCount] = useState(0);
  const prevActivePage = useRef(activePage);
  useEffect(() => {
    const isSpacesNow = activePage === 'spaces' || activePage.startsWith('spaces:');
    const wasSpacesBefore = prevActivePage.current === 'spaces' || prevActivePage.current.startsWith('spaces:');
    if (isSpacesNow && !wasSpacesBefore) {
      setSpacesVisitCount(n => n + 1);
    }
    prevActivePage.current = activePage;
  }, [activePage]);

  // When entering split layout with a chat already loaded, show the thread
  useEffect(() => {
    if (isSplit && hasChat) setSplitView('thread');
  }, [isSplit, hasChat]);
  // Focus input after send completes
  useEffect(() => {
    if (!chat.loading) {
      inputRef.current?.focus();
    }
  }, [chat.loading]);

  // Pin context with focus
  const handlePinContext = (env: import('@/lib/types').CompositionEnvelope) => {
    chat.pinEnvelopeContext(env, () => inputRef.current?.focus());
  };

  return (
    <>
      {/* Tab bar — shown when multiple tabs are open */}
      <TabBar />

      {/* -- How it works page -- */}


      {/* -- Overview removed -- */}

      {/* -- Favorites page -- */}
      {activePage === 'favorites' && user && (
        <div style={{ height: '100%', overflow: 'auto', background: 'var(--chat-bg)' }}>
          <FavoritesPage
            userId={user.uid}
            onLoadConversation={(convId) => { loadConversation(convId); setActivePage('chat'); }}
            onRunArtifact={(artifact: SavedArtifact) => {
              chat.setInput(`run my ${artifact.name}`);
              setActivePage('chat');
              setTimeout(() => {
                inputRef.current?.focus();
                chat.sendMessage(`run my ${artifact.name}`);
              }, 50);
            }}
          />
        </div>
      )}

      {/* -- Spaces page -- always mounted so sidebar nav clicks don't cause full reloads -- */}
      {user && (
        <div style={{ display: (activePage === 'spaces' || activePage.startsWith('spaces:')) ? 'flex' : 'none', height: '100%', flexDirection: 'column' }}>
          <SpacesPage
            userId={user.uid}
            initialTab={activePage.startsWith('spaces:') ? (activePage.slice('spaces:'.length) as import('@/lib/types').SavedArtifactType | 'all') : 'all'}
            refreshKey={chat.saveCount + spacesVisitCount}
            onRun={(artifact: SavedArtifact) => {
              chat.setInput(`run my ${artifact.name}`);
              setActivePage('chat');
              setTimeout(() => {
                inputRef.current?.focus();
                chat.sendMessage(`run my ${artifact.name}`);
              }, 50);
            }}
            onNavigate={(page) => setActivePage(page)}
          />
        </div>
      )}

      {/* -- Dashboard tabs (AI-generated, opened from chat artifact card) -- */}
      {tabs.filter((t) => t.id.startsWith('dashboard:')).map((tab) => (
        <div
          key={tab.id}
          style={{ display: activeTabId === tab.id ? 'flex' : 'none', height: '100%', overflow: 'hidden', flexDirection: 'column' }}
        >
          <DashboardPage initialDashboardId={tab.dashboardId} />
        </div>
      ))}

      {/* -- Legacy dashboard page (manual creation, kept for compatibility) -- */}
      {activePage === 'dashboard' && activeTabId === 'chat' && user && (
        <div style={{ height: '100%', overflow: 'hidden' }}>
          <DashboardPage />
        </div>
      )}

      {/* -- Templates page (placeholder) -- */}
      {activePage === 'templates' && (
        <div style={{ height: '100%', overflow: 'auto', background: 'var(--chat-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--text-dim, #80868b)' }}>dashboard</span>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 500, color: 'var(--text, #1a1a1a)', fontFamily: "'Google Sans', sans-serif" }}>Templates coming soon</p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted, #5f6368)', fontFamily: "'Google Sans', sans-serif" }}>Pre-built workflows and queries will appear here.</p>
        </div>
      )}

      {/* -- Prompts page (full inline view) -- */}
      {activePage === 'prompts' && (
        <PromptsLibrary
          open
          inline
          onClose={() => setActivePage('chat')}
          onUsePrompt={(text) => { chat.setInput(text); setActivePage('chat'); inputRef.current?.focus(); }}
        />
      )}

      {/* ============================================================
         UNIFIED LAYOUT (original single-pane)
         ============================================================ */}
      {!isSplit && (
        <div style={{ display: (activePage === 'prompts' || activePage === 'spaces' || activePage.startsWith('spaces:') || activePage === 'favorites' || activePage === 'dashboard' || activePage === 'templates' || activeTabId !== 'chat') ? 'none' : 'flex', height: '100%', background: 'var(--chat-bg)' }}>

          {/* Chat sidebar panel */}
          <ChatSidebar
            visible={chatListOpen}
            onSelectChat={() => setChatListOpen(false)}
            activeLoading={chat.loading}
            onSaveAsWorkflow={() => setWorkflowSaveOpen(true)}
          />

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>

          {/* -- EMPTY STATE: centered hero + prompt -- */}
          {!hasChat && (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              height: '100%',
            }}>
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <CrystalBallOracle ballSize={88} />

                {!activeProject && (
                  <div style={{
                    maxWidth: 640,
                    width: '100%',
                    marginTop: 24,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 24,
                  }}>
                    <p style={{
                      color: 'var(--text-muted)',
                      fontSize: 15,
                      margin: 0,
                      textAlign: 'center',
                    }}>
                      Select a project to get started
                    </p>

                    {favoriteProjectIds.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 8 }}>Favorites</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                          {favoriteProjectIds.map(p => (
                            <button
                              key={p}
                              onClick={() => setActiveProject(p)}
                              style={{
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                borderRadius: 8,
                                padding: '8px 14px',
                                cursor: 'pointer',
                                fontSize: 13,
                                color: 'var(--text)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                transition: 'border-color 0.15s, background 0.15s',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--surface-hover)'; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)'; }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#f59e0b' }}>star</span>
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {recentProjectIds.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 8 }}>Recent Projects</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                          {recentProjectIds.filter(p => !favoriteProjectIds.includes(p)).map(p => (
                            <button
                              key={p}
                              onClick={() => setActiveProject(p)}
                              style={{
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                borderRadius: 8,
                                padding: '8px 14px',
                                cursor: 'pointer',
                                fontSize: 13,
                                color: 'var(--text)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                transition: 'border-color 0.15s, background 0.15s',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--surface-hover)'; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)'; }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--text-muted)' }}>history</span>
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {favoriteProjectIds.length === 0 && recentProjectIds.length === 0 && (
                      <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0, textAlign: 'center' }}>
                        Use the project selector above to choose a GCP project.
                      </p>
                    )}
                  </div>
                )}

                {/* Recently-used datasets / tables */}
                {activeProject && recentItems.length > 0 && (
                  <div className="recent-items-section" style={{ marginTop: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div className="recent-items-label" style={{ textAlign: 'center' }}>Recent</div>
                    <div className="recent-items" style={{ justifyContent: 'center' }}>
                      {recentItems.map((item, idx) => (
                        <button
                          key={`${item.type}-${item.name}-${idx}`}
                          className="recent-item-chip"
                          onClick={() => {
                            setChatListOpen(false);
                            if (item.type === 'table' && item.dataset) {
                              chat.sendMessage(`Show me ${item.dataset}.${item.name}`);
                            } else if (item.type === 'table') {
                              chat.sendMessage(`Show me ${item.name}`);
                            } else {
                              chat.sendMessage(`What tables are in the ${item.name} dataset?`);
                            }
                          }}
                        >
                          <span className="material-symbols-outlined">
                            {item.type === 'table' ? 'table_chart' : 'dataset'}
                          </span>
                          {item.name}
                          {item.type === 'table' && item.dataset && (
                            <span className="recent-item-chip-sub">{item.dataset}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Prompt pinned to bottom */}
              <div style={{ width: '100%', maxWidth: 640, padding: '0 24px 28px' }}>
                <ChatInput
                  input={chat.input}
                  setInput={chat.setInput}
                  loading={chat.loading}
                  activeProject={activeProject}
                  contextItems={chat.contextItems}
                  onSend={(text?: string) => { setChatListOpen(false); return chat.sendMessage(text); }}
                  onSendWithFile={(text, file) => { setChatListOpen(false); chat.sendMessageWithFile(text, file); }}
                  onRemoveContext={chat.removeContextItem}
                  onKeyDown={chat.handleKeyDown}
                  onStop={chat.stopMessage}
                  queuedPrompt={chat.queuedPrompt}
                  onClearQueue={chat.clearQueuedPrompt}
                  variant="hero"
                />
              </div>
            </div>
          )}

          {/* -- ACTIVE CHAT: scrollable message thread -- */}
          {hasChat && (
            <ChatThread
              messages={chat.messages}
              thinkingSteps={chat.thinkingSteps}
              loading={chat.loading}
              statusText={chat.statusText}
              liveSteps={chat.liveSteps}
              loadingStartTime={chat.loadingStartTime}
              lastError={chat.lastError}
              setLastError={chat.setLastError}
              editingIdx={chat.editingIdx}
              editText={chat.editText}
              rerunningIdx={chat.rerunningIdx}
              pinnedEnvelopeId={chat.pinnedEnvelopeId}
              historyHiddenBefore={historyHiddenBefore}
              onConfirm={chat.handleConfirm}
              onCancel={chat.handleCancel}
              onChipClick={chat.handleChipClick}
              onRunSql={chat.handleRunSql}
              onInlineClick={chat.handleInlineClick}
              onPinContext={handlePinContext}
              onStartEdit={chat.startEdit}
              onCancelEdit={chat.cancelEdit}
              onSubmitEdit={chat.submitEdit}
              onEditTextChange={chat.setEditText}
              onRerun={chat.rerunMessage}
              extractContextItems={chat.extractContextItems}
              onSave={chat.saveEnvelopeAsArtifact}
              onReplan={chat.replanEnvelope}
              onExecutePlan={chat.executePlan}
            />
          )}

          {/* -- Floating prompt bar (active chat only) -- */}
          {hasChat && (
            <ChatInput
              input={chat.input}
              setInput={chat.setInput}
              loading={chat.loading}
              activeProject={activeProject}
              contextItems={chat.contextItems}
              onSend={chat.sendMessage}
              onSendWithFile={chat.sendMessageWithFile}
              onRemoveContext={chat.removeContextItem}
              onKeyDown={chat.handleKeyDown}
              onStop={chat.stopMessage}
              queuedPrompt={chat.queuedPrompt}
              onClearQueue={chat.clearQueuedPrompt}
              variant="floating"
            />
          )}
          </div>
        </div>
      )}

      {/* ============================================================
         SPLIT LAYOUT (single sidebar: chat list OR results thread)
         ============================================================ */}
      {isSplit && (
        <div
          className={`layout-split ${layout === 'chat-right' ? 'layout-chat-right' : 'layout-chat-left'}`}
          style={{ display: (activePage === 'prompts' || activePage === 'spaces' || activePage.startsWith('spaces:') || activePage === 'favorites' || activePage === 'dashboard' || activePage === 'templates' || activeTabId !== 'chat') ? 'none' : 'flex', height: '100%' }}
        >
          {/* Chat list view */}
          {splitView === 'list' && (
            <ChatSidebar
              visible
              side={layout === 'chat-right' ? 'left' : 'right'}
              activeLoading={chat.loading}
              onSelectChat={() => setSplitView('thread')}
              onNewChat={() => { setSplitView('thread'); }}
              onSaveAsWorkflow={() => setWorkflowSaveOpen(true)}
            />
          )}

          {/* Thread/results view (replaces the chat list when a chat is selected) */}
          {splitView === 'thread' && (
            <ResultsSidebar
              messages={chat.messages}
              thinkingSteps={chat.thinkingSteps}
              loading={chat.loading}
              statusText={chat.statusText}
              liveSteps={chat.liveSteps}
              loadingStartTime={chat.loadingStartTime}
              lastError={chat.lastError}
              setLastError={chat.setLastError}
              rerunningIdx={chat.rerunningIdx}
              pinnedEnvelopeId={chat.pinnedEnvelopeId}
              historyHiddenBefore={historyHiddenBefore}
              layout={layout}
              sidebarWidth={sidebarWidth}
              setSidebarWidth={setSidebarWidth}
              activeProject={activeProject}
              input={chat.input}
              setInput={chat.setInput}
              contextItems={chat.contextItems}
              onSend={(text?: string) => { setChatListOpen(false); return chat.sendMessage(text); }}
              onSendWithFile={(text, file) => { setChatListOpen(false); chat.sendMessageWithFile(text, file); }}
              onRemoveContext={chat.removeContextItem}
              onKeyDown={chat.handleKeyDown}
              onStop={chat.stopMessage}
              queuedPrompt={chat.queuedPrompt}
              onClearQueue={chat.clearQueuedPrompt}
              onConfirm={chat.handleConfirm}
              onCancel={chat.handleCancel}
              onChipClick={chat.handleChipClick}
              onRunSql={chat.handleRunSql}
              onInlineClick={chat.handleInlineClick}
              onPinContext={handlePinContext}
              onRerun={chat.rerunMessage}
              extractContextItems={chat.extractContextItems}
              favoriteProjectIds={favoriteProjectIds}
              recentProjectIds={recentProjectIds}
              recentItems={recentItems}
              setActiveProject={setActiveProject}
              onSave={chat.saveEnvelopeAsArtifact}
              onBackToChats={() => setSplitView('list')}
            />
          )}
        </div>
      )}

      {/* Save modal */}
      {chat.saveModalState && (
        <SaveModal
          open={chat.saveModalState.open}
          onClose={chat.handleSaveModalClose}
          onSave={chat.handleSaveConfirm}
          defaultName={chat.saveModalState.defaultName}
          defaultDescription={chat.saveModalState.defaultDescription}
          artifactType={chat.saveModalState.type}
        />
      )}
      {/* Save as Workflow modal */}
      {workflowSaveOpen && (
        <SaveModal
          open={workflowSaveOpen}
          onClose={() => setWorkflowSaveOpen(false)}
          onSave={async (name, desc, tags) => { await chat.saveChatAsWorkflow(name, desc, tags); setWorkflowSaveOpen(false); }}
          defaultName={`Workflow ${new Date().toLocaleDateString()}`}
          defaultDescription=""
          artifactType="workflow"
        />
      )}
    </>
  );
}
