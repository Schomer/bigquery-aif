'use client';

import { useState, useRef, useCallback, type ReactNode } from 'react';

interface TooltipProps {
  /** The trigger element */
  children: ReactNode;
  /** Content to display in the tooltip */
  content: ReactNode;
  /** Preferred placement relative to trigger */
  placement?: 'top' | 'bottom';
  /** Delay in ms before showing (prevents flicker on fast mouse movement) */
  delay?: number;
}

/**
 * A lightweight tooltip that wraps a trigger element and shows content
 * on hover/focus. Positioned fixed relative to the viewport.
 */
export function Tooltip({
  children,
  content,
  placement = 'top',
  delay = 80,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = placement === 'top' ? rect.top - 8 : rect.bottom + 8;
        setPos({ x, y });
      }
      setVisible(true);
    }, delay);
  }, [delay, placement]);

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
  }, []);

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        style={{ display: 'inline-flex' }}
        tabIndex={0}
      >
        {children}
      </span>
      {visible && (
        <div
          role="tooltip"
          style={{
            position: 'fixed',
            left: pos.x,
            top: pos.y,
            transform: placement === 'top'
              ? 'translate(-50%, -100%)'
              : 'translate(-50%, 0)',
            background: 'var(--surface-3, #1e1e2e)',
            color: 'var(--text, #e0e0e0)',
            border: '1px solid var(--border, rgba(255,255,255,0.08))',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 11,
            lineHeight: 1.4,
            maxWidth: 280,
            zIndex: 9999,
            pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            whiteSpace: 'pre-line',
          }}
        >
          {content}
        </div>
      )}
    </>
  );
}
