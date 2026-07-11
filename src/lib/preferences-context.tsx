'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface PreferencesContextValue {
  showProvenance: boolean;
  setShowProvenance: (show: boolean) => void;
  showSuggestions: boolean;
  setShowSuggestions: (show: boolean) => void;
}

const PreferencesContext = createContext<PreferencesContextValue>({
  showProvenance: true,
  setShowProvenance: () => {},
  showSuggestions: true,
  setShowSuggestions: () => {},
});

const PROVENANCE_KEY = 'hdn_show_provenance';
const SUGGESTIONS_KEY = 'hdn_show_suggestions';

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [showProvenance, setShowProvenanceState] = useState(true);
  const [showSuggestions, setShowSuggestionsState] = useState(true);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PROVENANCE_KEY);
      if (stored !== null) setShowProvenanceState(stored !== 'false');
    } catch { /* ignore */ }
    try {
      const stored = localStorage.getItem(SUGGESTIONS_KEY);
      if (stored !== null) setShowSuggestionsState(stored !== 'false');
    } catch { /* ignore */ }
  }, []);

  function setShowProvenance(show: boolean) {
    setShowProvenanceState(show);
    try { localStorage.setItem(PROVENANCE_KEY, String(show)); } catch { /* ignore */ }
  }

  function setShowSuggestions(show: boolean) {
    setShowSuggestionsState(show);
    try { localStorage.setItem(SUGGESTIONS_KEY, String(show)); } catch { /* ignore */ }
  }

  return (
    <PreferencesContext.Provider value={{ showProvenance, setShowProvenance, showSuggestions, setShowSuggestions }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  return useContext(PreferencesContext);
}
