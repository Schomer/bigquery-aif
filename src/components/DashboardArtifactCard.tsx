'use client';

// DashboardArtifactCard.tsx
// Renders inside ArtifactCard when primaryArtifact.type === 'DASHBOARD_VIEW'.
// Shows the dashboard name, a preview of tile names, and an "Open Dashboard" button
// that adds a tab to the main view.

import { usePage } from '@/lib/page-context';
import type { CustomViewProps } from '@/lib/types';

interface DashboardCardData {
  dashboardId: string;
  name: string;
  tileCount: number;
  tileNames: string[];
}

export function DashboardArtifactCard({ envelope }: CustomViewProps) {
  const { openDashboardTab } = usePage();
  const data = envelope.primaryArtifact.data as DashboardCardData;

  if (!data.dashboardId) {
    return (
      <div style={{ padding: '12px 0', color: 'var(--text-muted)', fontSize: 13 }}>
        Dashboard could not be created. Please select a project first.
      </div>
    );
  }

  function handleOpen() {
    openDashboardTab(data.dashboardId, data.name);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: 'linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#fff' }}>dashboard</span>
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{data.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
            {data.tileCount} tile{data.tileCount !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Tile preview pills */}
      {data.tileNames.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {data.tileNames.map((name, i) => (
            <span
              key={i}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 20,
                background: 'var(--surface-2, #f3f4f6)',
                border: '1px solid var(--border)',
                fontSize: 11, color: 'var(--text)', fontWeight: 500,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 12, color: 'var(--text-muted)' }}>bar_chart</span>
              {name}
            </span>
          ))}
        </div>
      )}

      {/* Open button */}
      <div>
        <button
          id={`open-dashboard-${data.dashboardId}`}
          onClick={handleOpen}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '9px 18px',
            background: '#1a73e8', color: '#fff',
            border: 'none', borderRadius: 8,
            fontSize: 13, fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#1557b0'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#1a73e8'; }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
          Open Dashboard
        </button>
      </div>
    </div>
  );
}
