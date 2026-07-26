'use client';

import React, { useState } from 'react';

export interface PresentationData {
  format: string;
  title?: string;
  text?: string;
  items: Array<{
    label: string;
    value?: string;
    detail?: string;
    entity_type?: string;
    entity_ref?: string;
  }>;
}

interface Props {
  data: PresentationData;
  onSendMessage: (msg: string) => void;
}

function ListAnimationStyle() {
  return (
    <style>{`
      @keyframes listRowSlideIn {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `}</style>
  );
}

function ClickableRow({ children, onClick, index = 0 }: { children: React.ReactNode; onClick: () => void; index?: number; }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 12px',
        background: hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
        borderRadius: 8,
        cursor: 'pointer',
        transition: 'background 0.12s ease',
        animationName: 'listRowSlideIn',
        animationDuration: '0.2s',
        animationTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
        animationFillMode: 'both',
        animationDelay: `${index * 25}ms`,
      }}
    >
      {children}
    </div>
  );
}

function getIconForType(type?: string) {
  switch (type?.toLowerCase()) {
    case 'dataset': return { name: 'database', color: '#6366f1' };
    case 'table': return { name: 'table_chart', color: '#3b82f6' };
    case 'view': return { name: 'visibility', color: '#14b8a6' };
    case 'column': return { name: 'data_object', color: '#64748b' };
    case 'job': return { name: 'schedule', color: '#f59e0b' };
    default: return { name: 'info', color: '#9ca3af' };
  }
}

export function PresentationView({ data, onSendMessage }: Props) {
  if (data.format === 'entity_list') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {data.items.map((item, i) => {
          const { name: iconName, color } = getIconForType(item.entity_type);
          const ref = item.entity_ref || item.label;
          const typeLabel = item.entity_type || 'entity';
          
          return (
            <ClickableRow 
              key={i} 
              index={i} 
              onClick={() => onSendMessage(`Tell me more about the ${ref} ${typeLabel}`)}
            >
              <div style={{ 
                width: 28, height: 28, borderRadius: '50%', background: `${color}15`, 
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color }}>{iconName}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.label}
                </span>
                {item.detail && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.detail}
                  </span>
                )}
              </div>
              {item.value && (
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>
                  {item.value}
                </span>
              )}
            </ClickableRow>
          );
        })}
        <ListAnimationStyle />
      </div>
    );
  }

  if (data.format === 'key_values') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
        {data.items.map((item, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.label}</span>
            <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{item.value || item.detail}</span>
          </div>
        ))}
      </div>
    );
  }

  if (data.format === 'summary') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {data.text && <div style={{ fontSize: 13, color: 'var(--text)' }}>{data.text}</div>}
        <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.items.map((item, i) => (
            <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{item.label}</strong>
              {item.value && <span>: {item.value}</span>}
              {item.detail && <span style={{ color: 'var(--text-muted)' }}> - {item.detail}</span>}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (data.format === 'steps') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {data.text && <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>{data.text}</div>}
        {data.items.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 12 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--border-subtle)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
              {i + 1}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{item.label}</span>
              {item.detail && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.detail}</span>}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // format === 'info'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {data.text && <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{data.text}</div>}
      {data.items.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {data.items.map((item, i) => (
            <span key={i} style={{ fontSize: 12, padding: '4px 8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-secondary)', borderRadius: 12, color: 'var(--text-secondary)' }}>
              {item.label} {item.value && <span style={{ opacity: 0.7 }}>({item.value})</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
