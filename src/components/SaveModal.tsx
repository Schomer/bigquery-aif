'use client';

import { useState, useEffect, useRef } from 'react';
import type { SavedArtifactType } from '@/lib/types';

const TYPE_LABELS: Record<SavedArtifactType, string> = {
  query: 'Query',
  workflow: 'Workflow',
  pipeline: 'Pipeline',
  app: 'App',
};

interface SaveModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, description: string, tags: string[]) => void;
  defaultName?: string;
  defaultDescription?: string;
  artifactType: SavedArtifactType;
}

export function SaveModal({
  open,
  onClose,
  onSave,
  defaultName = '',
  defaultDescription = '',
  artifactType,
}: SaveModalProps) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState(defaultDescription);
  const [tagsInput, setTagsInput] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(defaultName);
    setDescription(defaultDescription);
    setTagsInput('');
  }, [defaultName, defaultDescription, open]);

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
    onSave(trimmed, description.trim(), tags);
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
