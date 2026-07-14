'use client';

import { useState, useEffect, useRef } from 'react';
import type { SavedArtifactType, ParameterDef } from '@/lib/types';

const TYPE_LABELS: Record<SavedArtifactType, string> = {
  query: 'Query',
  workflow: 'Workflow',
  pipeline: 'Pipeline',
  app: 'App',
};

interface SaveModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, description: string, tags: string[], parameters?: ParameterDef[]) => void;
  defaultName?: string;
  defaultDescription?: string;
  artifactType: SavedArtifactType;
  sql?: string;  // W3-14: SQL to scan for @param patterns
}

export function SaveModal({
  open,
  onClose,
  onSave,
  defaultName = '',
  defaultDescription = '',
  artifactType,
  sql = '',
}: SaveModalProps) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState(defaultDescription);
  const [tagsInput, setTagsInput] = useState('');
  const [showParams, setShowParams] = useState(false);
  // W3-14: auto-detect @param patterns in SQL
  const [parameters, setParameters] = useState<ParameterDef[]>(() => {
    const found = new Set<string>();
    const re = /@([a-zA-Z_][a-zA-Z0-9_]*)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(sql)) !== null) found.add(m[1]);
    return Array.from(found).map(n => ({ name: n, type: 'string' as const, description: '', required: false }));
  });
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(defaultName);
    setDescription(defaultDescription);
    setTagsInput('');
    // Re-detect params when SQL changes
    const found = new Set<string>();
    const re = /@([a-zA-Z_][a-zA-Z0-9_]*)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(sql)) !== null) found.add(m[1]);
    setParameters(Array.from(found).map(n => ({ name: n, type: 'string' as const, description: '', required: false })));
  }, [defaultName, defaultDescription, open, sql]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      setTimeout(() => nameRef.current?.select(), 50);
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    onSave(trimmed, description.trim(), tags, parameters.length > 0 ? parameters : undefined);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      style={{
        border: 'none',
        borderRadius: 16,
        padding: 0,
        maxWidth: 480,
        width: '90vw',
        boxShadow: '0 24px 80px rgba(0,0,0,0.18)',
        fontFamily: "'Google Sans', sans-serif",
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        margin: 0,
      }}
    >
      <div style={{ padding: '24px 28px' }}>
        <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 600, color: 'var(--text, #1a1a1a)' }}>
          Save {TYPE_LABELS[artifactType]}
        </h2>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary, #5f6368)', marginBottom: 6 }}>Name</span>
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Weekly sales report"
            style={{
              width: '100%',
              padding: '10px 14px',
              fontSize: 14,
              border: '1px solid var(--border, #dadce0)',
              borderRadius: 8,
              outline: 'none',
              fontFamily: "'Google Sans', sans-serif",
              boxSizing: 'border-box',
            }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary, #5f6368)', marginBottom: 6 }}>Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this do?"
            rows={3}
            style={{
              width: '100%',
              padding: '10px 14px',
              fontSize: 14,
              border: '1px solid var(--border, #dadce0)',
              borderRadius: 8,
              outline: 'none',
              resize: 'vertical',
              fontFamily: "'Google Sans', sans-serif",
              boxSizing: 'border-box',
            }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary, #5f6368)', marginBottom: 6 }}>Tags (comma-separated)</span>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. sales, weekly, KPI"
            style={{
              width: '100%',
              padding: '10px 14px',
              fontSize: 14,
              border: '1px solid var(--border, #dadce0)',
              borderRadius: 8,
              outline: 'none',
              fontFamily: "'Google Sans', sans-serif",
              boxSizing: 'border-box',
            }}
          />
        </label>

        {/* W3-14: Parameters section — only shows when @params detected in SQL */}
        {parameters.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => setShowParams(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontSize: 13, fontWeight: 500, color: '#1967d2', fontFamily: "'Google Sans', sans-serif",
                marginBottom: showParams ? 10 : 0,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                {showParams ? 'expand_less' : 'expand_more'}
              </span>
              {parameters.length} parameter{parameters.length > 1 ? 's' : ''} detected
            </button>
            {showParams && parameters.map((p, i) => (
              <div key={p.name} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 1fr', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#1967d2', background: '#e8f0fe', padding: '2px 8px', borderRadius: 4 }}>@{p.name}</span>
                <select
                  value={p.type}
                  onChange={e => {
                    const updated = [...parameters];
                    updated[i] = { ...updated[i], type: e.target.value as ParameterDef['type'] };
                    setParameters(updated);
                  }}
                  style={{ fontSize: 12, padding: '4px 6px', border: '1px solid var(--border, #dadce0)', borderRadius: 6, fontFamily: "'Google Sans', sans-serif" }}
                >
                  {['string', 'number', 'date', 'table', 'dataset', 'column'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input
                  type="text"
                  placeholder="Default value"
                  value={p.default ?? ''}
                  onChange={e => {
                    const updated = [...parameters];
                    updated[i] = { ...updated[i], default: e.target.value };
                    setParameters(updated);
                  }}
                  style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--border, #dadce0)', borderRadius: 6, fontFamily: "'Google Sans', sans-serif" }}
                />
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary, #5f6368)' }}>Type:</span>
          <span style={{
            display: 'inline-block',
            padding: '3px 10px',
            fontSize: 12,
            fontWeight: 500,
            background: '#e8f0fe',
            color: '#1967d2',
            borderRadius: 12,
          }}>
            {TYPE_LABELS[artifactType]}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 500,
              border: '1px solid var(--border, #dadce0)',
              borderRadius: 8,
              background: 'white',
              color: 'var(--text, #1a1a1a)',
              cursor: 'pointer',
              fontFamily: "'Google Sans', sans-serif",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            style={{
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 500,
              border: 'none',
              borderRadius: 8,
              background: name.trim() ? '#1967d2' : '#dadce0',
              color: name.trim() ? 'white' : '#80868b',
              cursor: name.trim() ? 'pointer' : 'default',
              fontFamily: "'Google Sans', sans-serif",
            }}
          >
            Save
          </button>
        </div>
      </div>
    </dialog>
  );
}
