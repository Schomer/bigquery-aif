'use client';

import React, { useState } from 'react';

interface CollapsibleSectionProps {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection({ label, defaultOpen = false, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{
      borderTop: '1px solid var(--border-secondary, #333)',
      marginTop: '12px',
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: '100%',
          padding: '10px 0',
          background: 'none',
          border: 'none',
          color: 'var(--text-secondary, #aaa)',
          fontSize: '13px',
          fontWeight: 500,
          cursor: 'pointer',
          textAlign: 'left',
        }}
        aria-expanded={open}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style={{
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease',
            flexShrink: 0,
          }}
        >
          <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {label}
      </button>
      {open && (
        <div style={{ paddingBottom: '12px' }}>
          {children}
        </div>
      )}
    </div>
  );
}
