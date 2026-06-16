'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

interface PromptsContextValue {
  promptsOpen: boolean;
  openPrompts: () => void;
  closePrompts: () => void;
}

const PromptsContext = createContext<PromptsContextValue | null>(null);

export function PromptsProvider({ children }: { children: ReactNode }) {
  const [promptsOpen, setPromptsOpen] = useState(false);
  return (
    <PromptsContext.Provider
      value={{
        promptsOpen,
        openPrompts: () => setPromptsOpen(true),
        closePrompts: () => setPromptsOpen(false),
      }}
    >
      {children}
    </PromptsContext.Provider>
  );
}

export function usePrompts() {
  const ctx = useContext(PromptsContext);
  if (!ctx) throw new Error('usePrompts must be used inside PromptsProvider');
  return ctx;
}
