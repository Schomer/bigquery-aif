'use client';
// src/components/PromptsLibrary.tsx
// Slide-in panel for saved prompt templates.
// Supports {{variable}} substitution via inline popover.

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  getPrompts,
  savePrompt,
  deletePrompt,
  generateId,
  nowISO,
  type SavedPrompt,
} from '@/lib/firestore-service';

const CATEGORIES: SavedPrompt['category'][] = ['Reporting', 'Data Quality', 'Schema', 'Cost', 'Other'];

// ── Seed prompt library ───────────────────────────────────────────────────────
const SEED_PROMPTS: Omit<SavedPrompt, 'id' | 'createdAt'>[] = [
  // ── Reporting / Query
  { label: 'Daily row count by table', category: 'Reporting',
    prompt: 'Show me the row count for each table in the {{dataset}} dataset, ordered from largest to smallest.' },
  { label: 'Top 10 by metric', category: 'Reporting',
    prompt: 'What are the top 10 {{dimension}} by {{metric}} in {{table}} for the last 30 days?' },
  { label: 'Week-over-week trend', category: 'Reporting',
    prompt: 'Show me week-over-week totals for {{metric}} in {{table}} for the past 12 weeks.' },
  { label: 'Monthly rollup summary', category: 'Reporting',
    prompt: 'Summarize {{table}} by month for the past year, showing total {{metric}} and row count per month.' },
  { label: 'Compare two date ranges', category: 'Reporting',
    prompt: 'Compare the total {{metric}} in {{table}} between {{start_date_1}}–{{end_date_1}} and {{start_date_2}}–{{end_date_2}}.' },
  { label: 'Breakdown by dimension', category: 'Reporting',
    prompt: 'Break down {{metric}} in {{table}} by {{dimension}} and show the percentage share of each group.' },
  // ── Schema
  { label: 'Describe a table', category: 'Schema',
    prompt: 'Describe the schema for {{table}} — list each column with its type, description, and whether it is nullable.' },
  { label: 'List all tables in dataset', category: 'Schema',
    prompt: 'What tables are in the {{dataset}} dataset? Give me a summary of what each one contains.' },
  { label: 'Find columns matching a name', category: 'Schema',
    prompt: 'Find all columns across the {{dataset}} dataset whose name contains "{{keyword}}".' },
  { label: 'Show sample rows', category: 'Schema',
    prompt: 'Show me 10 sample rows from {{table}} so I can understand the data.' },
  // ── Data Quality
  { label: 'Null check on table', category: 'Data Quality',
    prompt: 'Check {{table}} for nulls — which columns have the highest null rate, and how many rows are affected?' },
  { label: 'Duplicate row detection', category: 'Data Quality',
    prompt: 'Find duplicate rows in {{table}} based on {{key_columns}}. Show count and examples.' },
  { label: 'Table freshness check', category: 'Data Quality',
    prompt: 'How recently was {{table}} last updated? Check the freshness and flag if it is more than {{hours}} hours stale.' },
  { label: 'Full data profile', category: 'Data Quality',
    prompt: 'Run a full data quality profile on {{table}} — include null rates, distinct counts, min/max, and any anomalies.' },
  { label: 'Validate referential integrity', category: 'Data Quality',
    prompt: 'Check whether every value of {{foreign_key}} in {{child_table}} exists in {{parent_table}}.{{primary_key}}.' },
  // ── Cost
  { label: 'Most expensive queries this week', category: 'Cost',
    prompt: 'Show me the 10 most expensive BigQuery queries run in the past 7 days, with bytes billed and estimated cost.' },
  { label: 'Slot usage by user', category: 'Cost',
    prompt: 'Which users consumed the most BigQuery slots in the past 30 days? Show slot hours and estimated cost per user.' },
  { label: 'Storage cost by dataset', category: 'Cost',
    prompt: 'What is the estimated monthly storage cost for each dataset in {{project}}? Include logical and physical bytes.' },
  { label: 'Query cost trend', category: 'Cost',
    prompt: 'Show me the daily BigQuery compute cost trend over the past 4 weeks.' },
  // ── Data Quality (monitoring)
  { label: 'Recent failed jobs', category: 'Data Quality',
    prompt: 'List all BigQuery jobs that failed in the last 24 hours. Include job ID, user, error message, and query preview.' },
  { label: 'Slow queries by duration', category: 'Data Quality',
    prompt: 'Which queries took the longest to run this week? Show duration, bytes processed, and the full query text.' },
  // ── Other / Data Management
  { label: 'Create view from query', category: 'Other',
    prompt: 'Create a view called {{view_name}} in {{dataset}} that shows {{description_of_logic}}.' },
  { label: 'Export query results to Sheets', category: 'Other',
    prompt: 'Export the results of my last query to a Google Sheet called "{{sheet_name}}".' },
  { label: 'Find tables related to topic', category: 'Other',
    prompt: 'Search the {{project}} project for tables related to "{{topic}}". List matches with a short description of each.' },
  { label: 'Deduplicate and overwrite table', category: 'Other',
    prompt: 'Deduplicate {{table}} on {{key_columns}}, keeping the row with the latest {{timestamp_column}}, and overwrite the table.' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onUsePrompt: (text: string) => void;
  inline?: boolean;
}

function extractVariables(prompt: string): string[] {
  const matches = prompt.match(/\{\{(\w+)\}\}/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(2, -2)))];
}

// ── Prompt Editor Dialog ──────────────────────────────────────────────────────
interface EditorDialogProps {
  initial?: SavedPrompt | null;
  onSave: (p: SavedPrompt) => void;
  onClose: () => void;
}

function PromptEditorDialog({ initial, onSave, onClose }: EditorDialogProps) {
  const isEdit = Boolean(initial);
  const [label, setLabel] = useState(initial?.label ?? '');
  const [prompt, setPrompt] = useState(initial?.prompt ?? '');
  const [category, setCategory] = useState<SavedPrompt['category']>(initial?.category ?? 'Reporting');
  const labelRef = useRef<HTMLInputElement>(null);

  // Auto-focus label field on mount
  useEffect(() => { labelRef.current?.focus(); }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  function handleSave() {
    if (!label.trim() || !prompt.trim()) return;
    const p: SavedPrompt = {
      id: initial?.id ?? generateId(),
      createdAt: initial?.createdAt ?? nowISO(),
      label: label.trim(),
      prompt: prompt.trim(),
      category,
    };
    onSave(p);
  }

  const canSave = label.trim().length > 0 && prompt.trim().length > 0;

  return (
    // Backdrop
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.15s ease',
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '28px 32px 24px',
          width: 520,
          maxWidth: 'calc(100vw - 40px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          animation: 'slideUp 0.18s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        {/* Dialog header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--accent)' }}>
              {isEdit ? 'edit' : 'add_circle'}
            </span>
            {isEdit ? 'Edit Prompt' : 'New Prompt'}
          </h2>
          <button
            onClick={onClose}
            title="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        {/* Label */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
            Label
          </label>
          <input
            ref={labelRef}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Revenue by month"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '9px 13px', fontSize: 14,
              border: '1px solid var(--border)', borderRadius: 8,
              background: 'var(--surface-2)', color: 'var(--text)',
              fontFamily: 'inherit', outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; }}
          />
        </div>

        {/* Prompt text */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
            Prompt
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={'Prompt text. Use {{variable}} for fill-ins.'}
            rows={5}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '9px 13px', fontSize: 14, lineHeight: 1.55,
              border: '1px solid var(--border)', borderRadius: 8,
              background: 'var(--surface-2)', color: 'var(--text)',
              fontFamily: 'inherit', resize: 'vertical', outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; }}
          />
          <p style={{ margin: '5px 0 0', fontSize: 11, color: 'var(--text-dim)' }}>
            Wrap variable names in <code style={{ fontFamily: 'monospace', background: 'var(--surface-3,var(--surface-2))', padding: '1px 4px', borderRadius: 3 }}>{'{{double braces}}'}</code> for fill-in prompts.
          </p>
        </div>

        {/* Category */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as SavedPrompt['category'])}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '9px 13px', fontSize: 14,
              border: '1px solid var(--border)', borderRadius: 8,
              background: 'var(--surface-2)', color: 'var(--text)',
              cursor: 'pointer', outline: 'none',
            }}
          >
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{
              flex: 1, padding: '10px 0',
              background: canSave ? 'var(--accent)' : 'var(--surface-2)',
              color: canSave ? 'white' : 'var(--text-dim)',
              border: 'none', borderRadius: 8,
              fontSize: 14, fontWeight: 600, cursor: canSave ? 'pointer' : 'default',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {isEdit ? 'Save Changes' : 'Save'}
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '10px 0',
              background: 'var(--surface-2)', color: 'var(--text-muted)',
              border: '1px solid var(--border)', borderRadius: 8,
              fontSize: 14, fontWeight: 500, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function PromptsLibrary({ open, onClose, onUsePrompt, inline = false }: Props) {
  const { user } = useAuth();
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [loading, setLoading] = useState(false);
  const [editorTarget, setEditorTarget] = useState<SavedPrompt | null | 'new'>(null);
  const [varPrompt, setVarPrompt] = useState<SavedPrompt | null>(null);
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<string>('All');
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    getPrompts(user.uid).then(setPrompts).catch(() => {}).finally(() => setLoading(false));
  }, [open, user]);

  async function handleSeedPrompts() {
    if (!user || seeding) return;
    setSeeding(true);
    const now = new Date();
    const seeded: SavedPrompt[] = SEED_PROMPTS.map((s, i) => ({
      ...s,
      id: generateId(),
      // stagger timestamps so ordering is stable (most recent first)
      createdAt: new Date(now.getTime() - i * 1000).toISOString(),
    }));
    await Promise.all(seeded.map((p) => savePrompt(user.uid, p)));
    setPrompts((prev) => [...seeded, ...prev]);
    setSeeding(false);
  }

  async function handleEditorSave(p: SavedPrompt) {
    if (!user) return;
    await savePrompt(user.uid, p);
    setPrompts((prev) => {
      const idx = prev.findIndex((x) => x.id === p.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = p;
        return updated;
      }
      return [p, ...prev];
    });
    setEditorTarget(null);
  }

  async function handleDelete(id: string) {
    if (!user) return;
    await deletePrompt(user.uid, id);
    setPrompts((prev) => prev.filter((p) => p.id !== id));
  }

  function handleUse(p: SavedPrompt) {
    const vars = extractVariables(p.prompt);
    if (vars.length > 0) {
      setVarPrompt(p);
      setVarValues(Object.fromEntries(vars.map((v) => [v, ''])));
    } else {
      onUsePrompt(p.prompt);
      onClose();
    }
  }

  function handleVarSubmit() {
    if (!varPrompt) return;
    let text = varPrompt.prompt;
    for (const [k, v] of Object.entries(varValues)) {
      text = text.replaceAll(`{{${k}}}`, v);
    }
    onUsePrompt(text);
    setVarPrompt(null);
    onClose();
  }

  const filtered = filter === 'All' ? prompts : prompts.filter((p) => p.category === filter);

  if (!open) return null;

  // Editor dialog (shown above everything when open)
  const editorDialog = editorTarget !== null && (
    <PromptEditorDialog
      initial={editorTarget === 'new' ? null : editorTarget}
      onSave={handleEditorSave}
      onClose={() => setEditorTarget(null)}
    />
  );

  // ── Inline (full-page) mode ──────────────────────────────────────────────
  if (inline) {
    return (
      <>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--surface)' }}>
          {/* Header — matches FavoritesPage */}
          <div style={{ padding: '32px 24px 0', maxWidth: 1200, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--accent)' }}>bookmarks</span>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: 'var(--text)', fontFamily: "'Google Sans', sans-serif" }}>
                  Prompts
                </h1>
                {!loading && (
                  <span style={{ fontSize: 13, color: 'var(--text-dim)', background: 'var(--surface-2)', borderRadius: 12, padding: '2px 10px', fontWeight: 500 }}>
                    {filtered.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => setEditorTarget('new')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'Google Sans', sans-serif" }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                New Prompt
              </button>
            </div>

            {/* Tabs — underline style matching FavoritesPage */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: 0 }}>
              {['All', ...CATEGORIES].map((cat) => {
                const active = filter === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setFilter(cat)}
                    style={{
                      padding: '10px 20px',
                      fontSize: 14,
                      fontWeight: active ? 600 : 400,
                      color: active ? 'var(--accent)' : 'var(--text-muted)',
                      background: 'none',
                      border: 'none',
                      borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                      cursor: 'pointer',
                      fontFamily: "'Google Sans', sans-serif",
                      marginBottom: -1,
                      transition: 'color 0.15s, border-color 0.15s',
                    }}
                  >{cat}</button>
                );
              })}
            </div>
          </div>

          {/* Card grid */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', maxWidth: 1200, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
            {loading && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ width: '60%', height: 16, borderRadius: 4, background: 'var(--surface-2)', animation: 'pulse 1.4s ease-in-out infinite' }} />
                    <div style={{ width: '90%', height: 12, borderRadius: 4, background: 'var(--surface-2)', animation: 'pulse 1.4s ease-in-out infinite' }} />
                    <div style={{ width: '40%', height: 12, borderRadius: 4, background: 'var(--surface-2)', animation: 'pulse 1.4s ease-in-out infinite' }} />
                  </div>
                ))}
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', gap: 16 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--text-dim)' }}>bookmarks</span>
                <p style={{ margin: 0, fontSize: 16, color: 'var(--text-muted)', fontFamily: "'Google Sans', sans-serif" }}>
                  {filter === 'All' ? 'No prompts yet' : `No ${filter} prompts`}
                </p>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)', fontFamily: "'Google Sans', sans-serif", textAlign: 'center', maxWidth: 360 }}>
                  Click New Prompt to create one, or load the built-in sample library.
                </p>
                <button
                  onClick={handleSeedPrompts}
                  disabled={seeding}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13, fontWeight: 500, cursor: seeding ? 'default' : 'pointer', opacity: seeding ? 0.6 : 1 }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_awesome</span>
                  {seeding ? 'Loading...' : 'Load Sample Prompts'}
                </button>
              </div>
            )}
            {!loading && filtered.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {filtered.map((p) => (
                  <div
                    key={p.id}
                    onMouseEnter={() => setHoveredCard(p.id)}
                    onMouseLeave={() => setHoveredCard(null)}
                    style={{
                      background: 'var(--surface)',
                      border: `1px solid ${hoveredCard === p.id ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 12,
                      padding: 20,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                      boxShadow: hoveredCard === p.id ? '0 4px 16px rgba(0,0,0,0.08)' : 'none',
                      cursor: 'default',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{p.label}</p>
                      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                        <button onClick={() => setEditorTarget(p)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 3, borderRadius: 4, display: 'flex', alignItems: 'center' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>edit</span>
                        </button>
                        <button onClick={() => handleDelete(p.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 3, borderRadius: 4, display: 'flex', alignItems: 'center' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete</span>
                        </button>
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, flexGrow: 1, whiteSpace: 'pre-wrap' }}>{p.prompt}</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '2px 8px' }}>{p.category}</span>
                      <button onClick={() => handleUse(p)} style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Use</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {editorDialog}

        {/* Variable substitution popover */}
        {varPrompt && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, width: 360, boxShadow: '0 16px 48px rgba(0,0,0,0.2)' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600 }}>Fill in variables</h3>
              <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--text-muted)' }}>{varPrompt.label}</p>
              {Object.keys(varValues).map((k) => (
                <div key={k} style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{k}</label>
                  <input value={varValues[k]} onChange={(e) => setVarValues((v) => ({ ...v, [k]: e.target.value }))} placeholder={`Enter ${k}`} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={handleVarSubmit} style={{ flex: 1, padding: '9px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Use Prompt</button>
                <button onClick={() => setVarPrompt(null)} style={{ flex: 1, padding: '9px', background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ── Sidebar (overlay) mode ────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.3)' }} />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 901,
        width: 420, background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500, color: 'var(--text)' }}>Prompts</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Saved prompt templates</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        {/* Category filter */}
        <div style={{ padding: '10px 16px', display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid var(--border)' }}>
          {['All', ...CATEGORIES].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                fontWeight: 500,
                background: filter === cat ? 'var(--accent)' : 'var(--surface-2)',
                color: filter === cat ? 'white' : 'var(--text-muted)',
                border: '1px solid ' + (filter === cat ? 'var(--accent)' : 'var(--border)'),
              }}
            >{cat}</button>
          ))}
        </div>

        {/* Prompt list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 13 }}>No prompts yet. Click + New to create one.</p>
              <button
                onClick={handleSeedPrompts}
                disabled={seeding}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '6px 14px', border: '1px solid var(--border)',
                  borderRadius: 7, background: 'var(--surface-2)',
                  color: 'var(--text)', fontSize: 12, fontWeight: 500,
                  cursor: seeding ? 'default' : 'pointer', opacity: seeding ? 0.6 : 1,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_awesome</span>
                {seeding ? 'Loading…' : 'Load samples'}
              </button>
            </div>
          )}
          {filtered.map((p) => (
            <div
              key={p.id}
              style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{p.label}</p>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{p.prompt}</p>
                  <span style={{ marginTop: 6, display: 'inline-block', fontSize: 10, color: 'var(--text-dim)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '1px 8px' }}>{p.category}</span>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => handleUse(p)} title="Use prompt" style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                    Use
                  </button>
                  <button onClick={() => setEditorTarget(p)} title="Edit" style={{ background: 'none', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-dim)', padding: '5px 7px', borderRadius: 6, display: 'flex', alignItems: 'center' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                  </button>
                  <button onClick={() => handleDelete(p.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={() => setEditorTarget('new')} style={{ width: '100%', padding: '9px', background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span> New Prompt
          </button>
          {prompts.length === 0 && (
            <button
              onClick={handleSeedPrompts}
              disabled={seeding}
              style={{ width: '100%', padding: '7px', background: 'none', color: 'var(--text-dim)', border: '1px dashed var(--border)', borderRadius: 8, fontSize: 12, cursor: seeding ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, opacity: seeding ? 0.6 : 1 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_awesome</span>
              {seeding ? 'Loading…' : 'Load sample prompts'}
            </button>
          )}
        </div>
      </div>

      {editorDialog}

      {/* Variable substitution popover */}
      {varPrompt && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, width: 360, boxShadow: '0 16px 48px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600 }}>Fill in variables</h3>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--text-muted)' }}>{varPrompt.label}</p>
            {Object.keys(varValues).map((k) => (
              <div key={k} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{k}</label>
                <input value={varValues[k]} onChange={(e) => setVarValues((v) => ({ ...v, [k]: e.target.value }))} placeholder={`Enter ${k}`} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={handleVarSubmit} style={{ flex: 1, padding: '9px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Use Prompt</button>
              <button onClick={() => setVarPrompt(null)} style={{ flex: 1, padding: '9px', background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
