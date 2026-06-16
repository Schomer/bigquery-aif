'use client';
// src/components/GlobalSearch.tsx
// Cmd+K search modal — fuzzy-matches conversations, prompts, and tables.

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useConversation } from '@/lib/conversation-context';
import {
  getConversations,
  getPrompts,
  type SavedConversation,
  type SavedPrompt,
} from '@/lib/firestore-service';

type ResultItem =
  | { kind: 'conversation'; id: string; title: string; updatedAt: string }
  | { kind: 'prompt'; id: string; label: string; prompt: string; category: string };

function fuzzy(text: string, query: string): boolean {
  const t = text.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return true;
  return q.split('').every((ch) => t.includes(ch)) && t.includes(q.slice(0, 3));
}

export function GlobalSearch() {
  const { user } = useAuth();
  const { loadConversation } = useConversation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [conversations, setConversations] = useState<SavedConversation[]>([]);
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load data when opened
  useEffect(() => {
    if (!open || !user) return;
    getConversations(user.uid).then(setConversations).catch(() => {});
    getPrompts(user.uid).then(setPrompts).catch(() => {});
  }, [open, user]);

  // Cmd+K listener
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else setQuery('');
  }, [open]);

  const results: ResultItem[] = [
    ...conversations
      .filter((c) => fuzzy(c.title, query))
      .slice(0, 5)
      .map((c): ResultItem => ({ kind: 'conversation', id: c.id, title: c.title, updatedAt: c.updatedAt })),
    ...prompts
      .filter((p) => fuzzy(p.label + ' ' + p.prompt, query))
      .slice(0, 5)
      .map((p): ResultItem => ({ kind: 'prompt', id: p.id, label: p.label, prompt: p.prompt, category: p.category })),
  ];

  useEffect(() => setActiveIdx(0), [query]);

  function selectItem(item: ResultItem) {
    if (item.kind === 'conversation') {
      loadConversation(item.id);
    }
    setOpen(false);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[activeIdx]) selectItem(results[activeIdx]);
  }

  if (!open) return null;

  return (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 120,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560, maxWidth: '90vw',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
        }}
      >
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--text-dim)' }}>search</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search conversations, prompts…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: 15, color: 'var(--text)', fontFamily: 'inherit',
            }}
          />
          <kbd style={{ fontSize: 11, color: 'var(--text-dim)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px' }}>Esc</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 360, overflowY: 'auto', padding: '8px 0' }}>
          {results.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: 13, padding: '24px 0' }}>
              {query ? 'No results' : 'Start typing to search'}
            </p>
          )}
          {results.map((item, i) => (
            <button
              key={item.id}
              onClick={() => selectItem(item)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                width: '100%', padding: '10px 18px', border: 'none', textAlign: 'left',
                background: i === activeIdx ? 'var(--accent-dim)' : 'transparent',
                cursor: 'pointer', transition: 'background 0.1s',
              }}
              onMouseEnter={() => setActiveIdx(i)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--accent)', flexShrink: 0 }}>
                {item.kind === 'conversation' ? 'chat' : 'bookmark'}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.kind === 'conversation' ? item.title : item.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                  {item.kind === 'conversation'
                    ? `Chat · ${new Date(item.updatedAt).toLocaleDateString()}`
                    : `Prompt · ${item.category}`}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div style={{ padding: '8px 18px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 16 }}>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}><kbd>↑↓</kbd> navigate</span>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}><kbd>↵</kbd> open</span>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
