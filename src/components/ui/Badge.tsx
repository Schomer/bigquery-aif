'use client';

interface BadgeProps {
  label: string;
  variant?: 'default' | 'info' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md';
}

const VARIANT_STYLES: Record<string, { bg: string; fg: string }> = {
  default: { bg: 'var(--surface-2, rgba(255,255,255,0.06))', fg: 'var(--text-muted)' },
  info:    { bg: 'rgba(59,130,246,0.12)', fg: '#60a5fa' },
  success: { bg: 'rgba(34,197,94,0.12)', fg: 'var(--positive, #22c55e)' },
  warning: { bg: 'rgba(245,158,11,0.12)', fg: 'var(--attention, #f59e0b)' },
  error:   { bg: 'rgba(239,68,68,0.12)', fg: '#dc3545' },
};

const SIZE_STYLES: Record<string, { fontSize: number; padding: string }> = {
  sm: { fontSize: 10, padding: '2px 6px' },
  md: { fontSize: 11, padding: '3px 8px' },
};

export function Badge({ label, variant = 'default', size = 'sm' }: BadgeProps) {
  const { bg, fg } = VARIANT_STYLES[variant];
  const { fontSize, padding } = SIZE_STYLES[size];

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      background: bg,
      color: fg,
      fontSize,
      fontWeight: 500,
      padding,
      borderRadius: 4,
      whiteSpace: 'nowrap',
      letterSpacing: 0.2,
    }}>
      {label}
    </span>
  );
}
