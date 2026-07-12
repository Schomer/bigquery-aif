'use client';
// src/lib/chat-run-state-context.tsx
// Tracks which conversation (if any) is currently loading.
// Written to by useChatOrchestration; read by ChatSidebar to show a running indicator.

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface ChatRunStateContextValue {
  runningId: string | null;
  setRunning: (id: string | null) => void;
}

const ChatRunStateContext = createContext<ChatRunStateContextValue | null>(null);

export function ChatRunStateProvider({ children }: { children: ReactNode }) {
  const [runningId, setRunningId] = useState<string | null>(null);

  const setRunning = useCallback((id: string | null) => {
    setRunningId(id);
  }, []);

  return (
    <ChatRunStateContext.Provider value={{ runningId, setRunning }}>
      {children}
    </ChatRunStateContext.Provider>
  );
}

export function useChatRunState(): ChatRunStateContextValue {
  const ctx = useContext(ChatRunStateContext);
  if (!ctx) throw new Error('useChatRunState must be used within ChatRunStateProvider');
  return ctx;
}
