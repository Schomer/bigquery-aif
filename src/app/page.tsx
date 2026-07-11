'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { CrystalBallOracle } from '@/components/CrystalBallOracle';
import { useAuth } from '@/lib/auth-context';
import { useConversation } from '@/lib/conversation-context';
import { usePage } from '@/lib/page-context';
import { useLayout } from '@/lib/layout-context';
import { useChatOrchestration } from '@/hooks/useChatOrchestration';
import { PromptsLibrary } from '@/components/PromptsLibrary';
import { SettingsPage } from '@/components/SettingsPage';
import { HowItWorksPanel } from '@/components/HowItWorksPanel';
import { ChatThread } from '@/components/chat/ChatThread';
import { ChatInput } from '@/components/chat/ChatInput';
import { ResultsSidebar } from '@/components/chat/ResultsSidebar';
import { OverviewDashboard } from '@/components/OverviewDashboard';
import { SpacesPage } from '@/components/SavedPage';
import { FavoritesPage } from '@/components/FavoritesPage';
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
  const { activePage, setActivePage } = usePage();
  const { layout, historyVisible } = useLayout();

  // ---- Chat orchestration hook ----
  const chat = useChatOrchestration();

  // ---- Refs ----
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
      {/* -- Settings page -- */}
      {activePage === 'settings' && <SettingsPage />}

      {/* -- How it works page -- */}
      {activePage === 'how-it-works' && <HowItWorksPanel />}

      {/* -- Overview dashboard -- */}
      {activePage === 'overview' && activeProject && (
        <div style={{ height: '100%', overflow: 'auto', background: 'var(--chat-bg)' }}>
          <OverviewDashboard
            project={activeProject}
            accessToken={accessToken ?? ''}
            onNavigate={(page) => setActivePage(page)}
            onPrompt={(text) => { chat.setInput(text); setActivePage('chat'); setTimeout(() => inputRef.current?.focus(), 50); }}
          />
        </div>
      )}

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

      {/* -- Spaces page -- */}
      {activePage === 'spaces' && user && (
        <SpacesPage
          userId={user.uid}
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
        <div style={{ display: (activePage === 'prompts' || activePage === 'settings' || activePage === 'how-it-works' || activePage === 'overview' || activePage === 'spaces' || activePage === 'favorites') ? 'none' : 'flex', flexDirection: 'column', height: '100%', background: 'var(--chat-bg)' }}>

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
                            if (item.type === 'table' && item.dataset) {
                              chat.sendMessage(`Show me the schema for ${item.dataset}.${item.name}`);
                            } else if (item.type === 'table') {
                              chat.sendMessage(`Show me the schema for ${item.name}`);
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
                  onSend={chat.sendMessage}
                  onRemoveContext={chat.removeContextItem}
                  onKeyDown={chat.handleKeyDown}
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
              onRemoveContext={chat.removeContextItem}
              onKeyDown={chat.handleKeyDown}
              variant="floating"
            />
          )}
        </div>
      )}

      {/* ============================================================
         SPLIT LAYOUT (chat sidebar + results panel)
         ============================================================ */}
      {isSplit && (
        <div
          className={`layout-split ${layout === 'chat-right' ? 'layout-chat-right' : 'layout-chat-left'}`}
          style={{ display: (activePage === 'prompts' || activePage === 'settings' || activePage === 'overview' || activePage === 'how-it-works' || activePage === 'spaces' || activePage === 'favorites') ? 'none' : 'flex', height: '100%' }}
        >
          <ResultsSidebar
            messages={chat.messages}
            thinkingSteps={chat.thinkingSteps}
            loading={chat.loading}
            statusText={chat.statusText}
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
            onSend={chat.sendMessage}
            onRemoveContext={chat.removeContextItem}
            onKeyDown={chat.handleKeyDown}
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
          />
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
    </>
  );
}
