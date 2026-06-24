'use client';
// src/lib/conversation-context.tsx
// Manages the active chat conversation ID and provides helpers
// for creating new conversations and switching between existing ones.
// The active conversation ID is persisted in sessionStorage so it
// survives page refreshes.

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { generateId } from './firestore-service';

const STORAGE_KEY = 'bqaif_conversationId';

function readStoredId(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeId(id: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, id);
  } catch {
    // sessionStorage unavailable
  }
}

interface ConversationContextValue {
  conversationId: string;
  newConversation: () => string;
  loadConversation: (id: string) => void;
}

const ConversationContext = createContext<ConversationContextValue | null>(null);

export function ConversationProvider({ children }: { children: ReactNode }) {
  const [conversationId, setConversationId] = useState<string>(() => {
    const stored = readStoredId();
    if (stored) return stored;
    const id = generateId();
    storeId(id);
    return id;
  });

  const newConversation = useCallback(() => {
    const id = generateId();
    setConversationId(id);
    storeId(id);
    return id;
  }, []);

  const loadConversation = useCallback((id: string) => {
    setConversationId(id);
    storeId(id);
  }, []);

  return (
    <ConversationContext.Provider value={{ conversationId, newConversation, loadConversation }}>
      {children}
    </ConversationContext.Provider>
  );
}

export function useConversation(): ConversationContextValue {
  const ctx = useContext(ConversationContext);
  if (!ctx) throw new Error('useConversation must be used within ConversationProvider');
  return ctx;
}
