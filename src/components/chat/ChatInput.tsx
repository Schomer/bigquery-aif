'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import type { ContextItem } from '@/lib/types';

// ---- ChatInput Props --------------------------------------------------------

export interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  loading: boolean;
  activeProject: string;
  contextItems: ContextItem[];
  onSend: (text?: string) => Promise<void>;
  onSendWithFile?: (text: string, file: { name: string; content: string; size: number }) => void;
  onRemoveContext: (id: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  /** Called when the user clicks the Stop button during a loading request. */
  onStop?: () => void;
  /** Currently queued follow-up prompt (typed while another was in flight). */
  queuedPrompt?: string | null;
  /** Clears the queued prompt without sending it. */
  onClearQueue?: () => void;
  /** 'floating' for the fixed-position bar in unified chat, 'docked' for sidebar bottom */
  variant?: 'hero' | 'floating' | 'docked';
}

// ---- ChatInput Component ----------------------------------------------------

export function ChatInput({
  input,
  setInput,
  loading,
  activeProject,
  contextItems,
  onSend,
  onSendWithFile,
  onRemoveContext,
  onKeyDown,
  onStop,
  queuedPrompt,
  onClearQueue,
  variant = 'hero',
}: ChatInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string; size: number } | null>(null);

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    const maxHeight = Math.round(14 * 1.5 * 5 + 2);
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
  };

  useEffect(() => {
    if (inputRef.current) {
      autoResize(inputRef.current);
    }
  }, [input]);

  // Listen for csv-file-selected events from CsvUploadView's drop zone
  useEffect(() => {
    function handleCsvFile(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.name && detail?.content) {
        setAttachedFile({ name: detail.name, content: detail.content, size: detail.size || detail.content.length });
      }
    }
    document.addEventListener('csv-file-selected', handleCsvFile);
    return () => document.removeEventListener('csv-file-selected', handleCsvFile);
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAttachedFile({ name: file.name, content: reader.result as string, size: file.size });
    };
    reader.readAsText(file);
  }, []);

  const handleSendWithAttachment = useCallback(() => {
    if (attachedFile && onSendWithFile) {
      const text = input.trim() || `Upload ${attachedFile.name}`;
      onSendWithFile(text, attachedFile);
      setAttachedFile(null);
      setInput('');
    } else {
      onSend();
    }
  }, [attachedFile, onSendWithFile, input, onSend, setInput]);

  const hasContext = contextItems.length > 0;
  const hasQueue = loading && !!queuedPrompt;
  const hasFile = !!attachedFile;

  const placeholder = activeProject
    ? (loading
        ? 'Type a follow-up to queue it...'
        : (variant === 'floating' ? 'Ask a follow-up...' : 'Ask about your data...'))
    : 'Select a project first...';

  const contextChipsRow = (hasContext || hasFile) ? (
    <div className="context-chips-row">
      {contextItems.map((item) => (
        <span key={item.id} className="context-chip">
          <span className="material-symbols-outlined">{item.icon}</span>
          {item.label}
          <button
            className="context-chip-dismiss"
            onClick={() => onRemoveContext(item.id)}
            aria-label={`Remove ${item.label}`}
          >
            x
          </button>
        </span>
      ))}
      {attachedFile && (
        <span className="context-chip" style={{ background: 'rgba(34, 197, 94, 0.08)', borderColor: 'rgba(34, 197, 94, 0.25)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>description</span>
          {attachedFile.name}
          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 2 }}>
            ({attachedFile.size < 1024 * 1024 ? `${(attachedFile.size / 1024).toFixed(0)} KB` : `${(attachedFile.size / (1024 * 1024)).toFixed(1)} MB`})
          </span>
          <button
            className="context-chip-dismiss"
            onClick={() => setAttachedFile(null)}
            aria-label={`Remove ${attachedFile.name}`}
          >
            x
          </button>
        </span>
      )}
    </div>
  ) : null;

  // Queue banner: shown when a prompt is queued while loading
  const queueBanner = hasQueue ? (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '5px 8px',
      borderRadius: 8,
      background: 'rgba(191, 219, 254, 0.35)',
      border: '1px solid rgba(147, 197, 253, 0.5)',
      marginBottom: 4,
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#3b82f6', flexShrink: 0 }}>schedule</span>
      <span style={{ flex: 1, fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        Queued: {queuedPrompt}
      </span>
      <button
        onClick={onClearQueue}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 2px', fontSize: 13, lineHeight: 1, fontFamily: 'inherit' }}
        aria-label="Discard queued prompt"
      >
        x
      </button>
    </div>
  ) : null;

  // Action button: Stop (when loading) or Send (when idle)
  const actionButton = loading && onStop ? (
    <button
      id="chat-stop-button"
      onClick={onStop}
      title="Stop"
      style={{
        width: 34,
        height: 34,
        flexShrink: 0,
        borderRadius: '50%',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.15s',
        padding: 0,
      }}
    >
      {/* Square stop icon */}
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="1.5" y="1.5" width="9" height="9" rx="1.5" fill="var(--text-muted)"/>
      </svg>
    </button>
  ) : (
    <button
      id="chat-send-button"
      onClick={handleSendWithAttachment}
      disabled={!input.trim() && !attachedFile || !activeProject}
      title={loading ? 'Queue prompt' : (attachedFile ? 'Upload file' : 'Send')}
      style={{
        width: 34,
        height: 34,
        flexShrink: 0,
        borderRadius: '50%',
        background: (input.trim() || attachedFile) ? '#bfdbfe' : 'var(--surface)',
        border: `1px solid ${(input.trim() || attachedFile) ? '#93c5fd' : 'var(--border)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: (input.trim() || attachedFile) ? 'pointer' : 'default',
        transition: 'all 0.15s',
        padding: 0,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 13V3M8 3L3.5 7.5M8 3L12.5 7.5" stroke={(input.trim() || attachedFile) ? '#1d4ed8' : 'var(--text-muted)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );

  // Attach file button
  const attachButton = !loading ? (
    <>
      <button
        onClick={() => fileInputRef.current?.click()}
        title="Attach CSV file"
        disabled={!activeProject}
        style={{
          width: 30,
          height: 30,
          flexShrink: 0,
          borderRadius: '50%',
          background: 'transparent',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: activeProject ? 'pointer' : 'default',
          padding: 0,
          opacity: activeProject ? 0.6 : 0.3,
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={(e) => { if (activeProject) (e.currentTarget as HTMLElement).style.opacity = '1'; }}
        onMouseLeave={(e) => { if (activeProject) (e.currentTarget as HTMLElement).style.opacity = '0.6'; }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--text-muted)' }}>attach_file</span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
          e.target.value = '';
        }}
        style={{ display: 'none' }}
      />
    </>
  ) : null;

  const handleKeyDownWrapper = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // If file is attached and user hits Enter, trigger upload
    if (e.key === 'Enter' && !e.shiftKey && attachedFile && onSendWithFile) {
      e.preventDefault();
      handleSendWithAttachment();
      return;
    }
    onKeyDown(e);
  };

  const textarea = (
    <textarea
      ref={inputRef}
      value={input}
      onChange={(e) => { setInput(e.target.value); autoResize(e.target); }}
      onKeyDown={handleKeyDownWrapper}
      placeholder={placeholder}
      disabled={!activeProject}
      rows={1}
      style={{
        flex: 1,
        background: 'transparent',
        border: 'none',
        outline: 'none',
        color: 'var(--text)',
        fontSize: 14,
        resize: 'none',
        lineHeight: 1.5,
        fontFamily: 'inherit',
        alignSelf: 'center',
        opacity: activeProject ? 1 : 0.5,
        cursor: activeProject ? 'text' : 'not-allowed',
      }}
    />
  );

  // Hero variant: embedded in the empty-state centered layout
  if (variant === 'hero') {
    return (
      <div className="mystic-prompt-container" style={{
        width: '100%',
        borderRadius: (hasContext || hasQueue || hasFile) ? 20 : 999,
        padding: (hasContext || hasQueue || hasFile) ? '8px 10px 10px 14px' : '10px 10px 10px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: (hasContext || hasQueue || hasFile) ? 6 : 0,
        ...(activeProject ? { background: '#fff', backgroundImage: 'none' } : {}),
      }}>
        {queueBanner}
        {contextChipsRow}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
          {attachButton}
          {textarea}
          {actionButton}
        </div>
      </div>
    );
  }

  // Floating variant: fixed-position bar over chat thread
  if (variant === 'floating') {
    return (
      <div className="mystic-prompt-container" style={{
        position: 'fixed',
        bottom: 28,
        left: '50%',
        transform: 'translateX(-50%)',
        marginLeft: 110,
        width: 'min(680px, calc(100vw - 268px))',
        borderRadius: (hasContext || hasQueue || hasFile) ? 20 : 999,
        padding: (hasContext || hasQueue || hasFile) ? '8px 10px 10px 14px' : '10px 10px 10px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: (hasContext || hasQueue || hasFile) ? 6 : 0,
        backdropFilter: 'blur(12px)',
        zIndex: 50,
        border: '1px solid rgba(0, 0, 0, 0.10)',
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.10), 0 8px 32px rgba(0, 0, 0, 0.07)',
        ...(activeProject ? { background: '#fff', backgroundImage: 'none' } : {}),
      }}>
        {queueBanner}
        {contextChipsRow}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
          {attachButton}
          {textarea}
          {actionButton}
        </div>
      </div>
    );
  }

  // Docked variant: bottom of sidebar in split layout
  return (
    <div className="chat-sidebar-input">
      <div className="chat-sidebar-input-inner mystic-prompt-container" style={{
        borderRadius: (hasContext || hasQueue || hasFile) ? 16 : undefined,
        padding: (hasContext || hasQueue || hasFile) ? '8px 10px 10px 14px' : undefined,
        display: (hasContext || hasQueue || hasFile) ? 'flex' : undefined,
        flexDirection: (hasContext || hasQueue || hasFile) ? 'column' as const : undefined,
        gap: (hasContext || hasQueue || hasFile) ? 6 : undefined,
        ...(activeProject ? { background: '#fff', backgroundImage: 'none' } : {}),
      }}>
        {queueBanner}
        {contextChipsRow}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, width: '100%' }}>
          {attachButton}
          {textarea}
          {actionButton}
        </div>
      </div>
    </div>
  );
}
