'use client';
// src/lib/conversation-context.tsx
// Manages the active chat conversation ID and provides helpers
// for creating new conversations and switching between existing ones.

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { generateId } from './firestore-service';

interface ConversationContextValue {
  conversationId: string;
  newConversation: () => string;
  loadConversation: (id: string) => void;
}

const ConversationContext = createContext<ConversationContextValue | null>(null);

export function ConversationProvider({ children }: { children: ReactNode }) {
  const [conversationId, setConversationId] = useState<string>(() => generateId());

  const newConversation = useCallback(() => {
    const id = generateId();
    setConversationId(id);
    return id;
  }, []);

  const loadConversation = useCallback((id: string) => {
    setConversationId(id);
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
