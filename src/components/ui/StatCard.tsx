'use client';

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  icon?: string;
  accent?: 'default' | 'positive' | 'attention' | 'issue';
  /** Render value in monospace font */
  mono?: boolean;
  /** Override value color */
  color?: string;
  /** Highlight label with accent color instead of muted */
  highlight?: boolean;
}

const ACCENT_COLORS: Record<string, string> = {
  default: 'var(--text)',
  positive: 'var(--positive, #22c55e)',
  attention: 'var(--attention, #f59e0b)',
  issue: '#dc3545',
};

const TREND_ARROWS: Record<string, string> = {
  up: '\u2191',
  down: '\u2193',
  flat: '\u2192',
};

export function StatCard({
  label,
  value,
  subtitle,
  trend,
  trendValue,
  mono,
  color,
  highlight,
  accent = 'default',
}: StatCardProps) {
  const valueColor = color ?? ACCENT_COLORS[accent];

  return (
    <div style={{
      background: 'var(--surface-2)',
      borderRadius: 8,
      padding: '12px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
      minWidth: 100,
    }}>
      <span style={{
        fontSize: 11,
        color: highlight ? 'var(--accent)' : 'var(--text-muted)',
        fontWeight: 500,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 16,
        fontWeight: 700,
        color: valueColor,
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
      }}>
        {value}
      </span>
      {(subtitle || trend) && (
        <span style={{ fontSize: 10, color: 'var(--text-dim)', display: 'flex', gap: 4, alignItems: 'center' }}>
          {trend && (
            <span style={{
              color: trend === 'up' ? 'var(--positive, #22c55e)' : trend === 'down' ? '#dc3545' : 'var(--text-dim)',
            }}>
              {TREND_ARROWS[trend]} {trendValue ?? ''}
            </span>
          )}
          {subtitle && <span>{subtitle}</span>}
        </span>
      )}
    </div>
  );
}
