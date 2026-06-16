'use client';

import type { DataLoadingResult } from '@/lib/types';

interface Props { result: DataLoadingResult }

export function DataLoadingView({ result }: Props) {
  switch (result.operationType) {
    case 'EXPORT_CSV':
      return <CsvCard result={result} />;
    case 'EXPORT_SHEETS':
      return <SheetsCard result={result} />;
    case 'SCHEDULE_INFO':
      return <ScheduleCard result={result} />;
    default:
      return <NotSupportedCard result={result} />;
  }
}

function CsvCard({ result }: Props) {
  function handleDownload() {
    if (!result.csvContent) return;
    const blob = new Blob([result.csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'export.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {result.rowCount !== undefined && (
          <Stat label="Rows" value={result.rowCount.toLocaleString()} />
        )}
        {result.columnCount !== undefined && (
          <Stat label="Columns" value={result.columnCount.toLocaleString()} />
        )}
      </div>
      {result.message && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{result.message}</p>
      )}
      <div>
        <button
          onClick={handleDownload}
          disabled={!result.csvContent}
          style={{
            padding: '9px 20px',
            background: 'var(--accent, #2563eb)',
            border: 'none',
            borderRadius: 8,
            color: 'white',
            fontSize: 13,
            fontWeight: 500,
            cursor: result.csvContent ? 'pointer' : 'not-allowed',
            opacity: result.csvContent ? 1 : 0.5,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => { if (result.csvContent) e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={(e) => { if (result.csvContent) e.currentTarget.style.opacity = '1'; }}
        >
          ↓ Download CSV
        </button>
      </div>
    </div>
  );
}

function SheetsCard({ result }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {result.message && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{result.message}</p>
      )}
      {result.sheetsUrl ? (
        <div>
          <a
            href={result.sheetsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              padding: '9px 20px',
              background: '#16a34a',
              borderRadius: 8,
              color: 'white',
              fontSize: 13,
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Open in Google Sheets ↗
          </a>
        </div>
      ) : null}
    </div>
  );
}

function ScheduleCard({ result }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        {result.message}
      </p>
      {result.sql && (
        <>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            SQL to schedule
          </p>
          <div className="sql-block">{result.sql}</div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            You can paste this SQL into BigQuery Scheduled Queries in the console.
          </p>
        </>
      )}
    </div>
  );
}

function NotSupportedCard({ result }: Props) {
  return (
    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
      {result.message}
    </p>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{value}</span>
    </div>
  );
}
