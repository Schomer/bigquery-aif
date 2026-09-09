'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type OutputViewMode = 'all' | 'single';

interface PreferencesContextValue {
  showProvenance: boolean;
  setShowProvenance: (show: boolean) => void;
  showSuggestions: boolean;
  setShowSuggestions: (show: boolean) => void;
  outputViewMode: OutputViewMode;
  setOutputViewMode: (mode: OutputViewMode) => void;
}

const PreferencesContext = createContext<PreferencesContextValue>({
  showProvenance: false,
  setShowProvenance: () => {},
  showSuggestions: false,
  setShowSuggestions: () => {},
  outputViewMode: 'all',
  setOutputViewMode: () => {},
});

const PROVENANCE_KEY = 'hdn_show_provenance';
const SUGGESTIONS_KEY = 'hdn_show_suggestions';
const OUTPUT_VIEW_MODE_KEY = 'hdn_output_view_mode';

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [showProvenance, setShowProvenanceState] = useState(false);
  const [showSuggestions, setShowSuggestionsState] = useState(false);
  const [outputViewMode, setOutputViewModeState] = useState<OutputViewMode>('all');

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
    try {
      const stored = localStorage.getItem(OUTPUT_VIEW_MODE_KEY);
      if (stored === 'single' || stored === 'all') setOutputViewModeState(stored);
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

  function setOutputViewMode(mode: OutputViewMode) {
    setOutputViewModeState(mode);
    try { localStorage.setItem(OUTPUT_VIEW_MODE_KEY, mode); } catch { /* ignore */ }
  }

  return (
    <PreferencesContext.Provider value={{
      showProvenance,
      setShowProvenance,
      showSuggestions,
      setShowSuggestions,
      outputViewMode,
      setOutputViewMode,
    }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  return useContext(PreferencesContext);
}
