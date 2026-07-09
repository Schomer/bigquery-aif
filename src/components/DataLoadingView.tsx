'use client';

import type { DataLoadingResult } from '@/lib/types';
import { useState } from 'react';

interface Props { result: DataLoadingResult }

export function DataLoadingView({ result }: Props) {
  switch (result.operationType) {
    case 'EXPORT_CSV':
      return <CsvCard result={result} />;
    case 'EXPORT_SHEETS':
      return <SheetsCard result={result} />;
    case 'SCHEDULE_CREATED':
      return <ScheduleCreatedCard result={result} />;
    case 'QUERY_SAVED':
      return <QuerySavedCard result={result} />;
    case 'SHARE_CLIPBOARD':
      return <ShareCard result={result} />;
    case 'SCHEDULE_INFO':
      return <ScheduleCard result={result} />;
    default:
      return <NotSupportedCard result={result} />;
  }
}

// ---- CSV Export Card ---------------------------------------------------------

function CsvCard({ result }: Props) {
  const [copiedTable, setCopiedTable] = useState(false);

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

  function handleCopyAsTable() {
    if (!result.csvContent) return;
    const lines = result.csvContent.split('\n');
    if (lines.length < 2) return;

    const headers = parseCsvLine(lines[0]);
    const dataRows = lines.slice(1, 51).map(parseCsvLine);

    // Build markdown table
    const mdHeader = '| ' + headers.join(' | ') + ' |';
    const mdSep = '| ' + headers.map(() => '---').join(' | ') + ' |';
    const mdRows = dataRows.map(row => '| ' + row.map(c => c.replace(/\|/g, '\\|')).join(' | ') + ' |');
    const md = [mdHeader, mdSep, ...mdRows].join('\n');

    navigator.clipboard.writeText(md).then(() => {
      setCopiedTable(true);
      setTimeout(() => setCopiedTable(false), 2000);
    });
  }

  const canCopyTable = result.csvContent && (result.rowCount ?? 0) <= 50;

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
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <ActionButton onClick={handleDownload} disabled={!result.csvContent} icon="download">
          Download CSV
        </ActionButton>
        {canCopyTable && (
          <ActionButton
            onClick={handleCopyAsTable}
            variant="secondary"
            icon={copiedTable ? 'check' : 'content_copy'}
          >
            {copiedTable ? 'Copied' : 'Copy as Table'}
          </ActionButton>
        )}
        <LookerStudioButton result={result} />
      </div>
      <CreateViewSection result={result} />
    </div>
  );
}

// ---- Sheets Export Card -----------------------------------------------------

function SheetsCard({ result }: Props) {
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
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {result.sheetsUrl ? (
          <a
            href={result.sheetsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 20px',
              background: '#16a34a',
              borderRadius: 8,
              color: 'white',
              fontSize: 13,
              fontWeight: 500,
              textDecoration: 'none',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            <span className="material-symbols-outlined" style={{
              fontSize: 16,
              fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20",
            }}>open_in_new</span>
            Open in Google Sheets
          </a>
        ) : null}
        <LookerStudioButton result={result} />
      </div>
      <CreateViewSection result={result} />
    </div>
  );
}

// ---- Schedule Created Card --------------------------------------------------

function ScheduleCreatedCard({ result }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <Stat label="Status" value="Created" />
        {result.scheduleFrequency && (
          <Stat label="Frequency" value={result.scheduleFrequency} />
        )}
      </div>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        {result.message}
      </p>
      {result.scheduleName && (
        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
          {result.scheduleName}
        </p>
      )}
      <div>
        <a
          href={`https://console.cloud.google.com/bigquery/scheduled-queries`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            padding: '9px 20px',
            background: 'var(--accent, #2563eb)',
            borderRadius: 8,
            color: 'white',
            fontSize: 13,
            fontWeight: 500,
            textDecoration: 'none',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        >
          View in Console
        </a>
      </div>
    </div>
  );
}

// ---- Query Saved Card -------------------------------------------------------

function QuerySavedCard({ result }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <Stat label="Status" value="Saved" />
        {result.savedQueryLabel && (
          <Stat label="Name" value={result.savedQueryLabel} />
        )}
      </div>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        {result.message}
      </p>
      {result.sql && (
        <>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Saved SQL
          </p>
          <div className="sql-block">{result.sql}</div>
        </>
      )}
    </div>
  );
}

// ---- Share Card -------------------------------------------------------------

function ShareCard({ result }: Props) {
  const [copied, setCopied] = useState(false);
  const [copiedTable, setCopiedTable] = useState(false);

  function handleCopy() {
    if (!result.shareText) return;
    navigator.clipboard.writeText(result.shareText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleCopyAsMarkdown() {
    if (!result.shareText) return;
    // Parse the text table back into markdown
    const lines = result.shareText.split('\n');
    if (lines.length < 3) return;

    const headers = lines[0].split(' | ').map(s => s.trim());
    const mdHeader = '| ' + headers.join(' | ') + ' |';
    const mdSep = '| ' + headers.map(() => '---').join(' | ') + ' |';
    const dataLines = lines.slice(2).map(line => {
      const cells = line.split(' | ').map(s => s.trim());
      return '| ' + cells.join(' | ') + ' |';
    });
    const md = [mdHeader, mdSep, ...dataLines].join('\n');

    navigator.clipboard.writeText(md).then(() => {
      setCopiedTable(true);
      setTimeout(() => setCopiedTable(false), 2000);
    });
  }

  const canCopyTable = result.shareText && (result.rowCount ?? 0) <= 50;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {result.rowCount !== undefined && (
          <Stat label="Rows" value={result.rowCount.toLocaleString()} />
        )}
        {result.columnCount !== undefined && (
          <Stat label="Columns" value={result.columnCount.toLocaleString()} />
        )}
      </div>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        {result.message}
      </p>
      {result.shareText && (
        <pre style={{
          margin: 0,
          padding: 12,
          background: 'var(--surface-2)',
          borderRadius: 8,
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)',
          overflow: 'auto',
          maxHeight: 300,
          whiteSpace: 'pre',
          border: '1px solid var(--border)',
        }}>
          {result.shareText}
        </pre>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <ActionButton
          onClick={handleCopy}
          icon={copied ? 'check' : 'content_copy'}
        >
          {copied ? 'Copied' : 'Copy to Clipboard'}
        </ActionButton>
        {canCopyTable && (
          <ActionButton
            onClick={handleCopyAsMarkdown}
            variant="secondary"
            icon={copiedTable ? 'check' : 'table_chart'}
          >
            {copiedTable ? 'Copied' : 'Copy as Markdown'}
          </ActionButton>
        )}
      </div>
    </div>
  );
}

// ---- Schedule Info Card -----------------------------------------------------

function ScheduleCard({ result }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
        {result.message}
      </p>
      {result.sql && (
        <>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            SQL
          </p>
          <div className="sql-block">{result.sql}</div>
        </>
      )}
    </div>
  );
}

// ---- Not Supported Card -----------------------------------------------------

function NotSupportedCard({ result }: Props) {
  return (
    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
      {result.message}
    </p>
  );
}

// ---- Shared: Create View from Query -----------------------------------------

function CreateViewSection({ result }: Props) {
  const [showDdl, setShowDdl] = useState(false);
  const [copiedDdl, setCopiedDdl] = useState(false);

  if (!result.sql) return null;

  // Generate a simple view DDL
  const viewName = 'my_view';
  const ddl = `CREATE OR REPLACE VIEW \`${viewName}\` AS\n${result.sql}`;

  function handleCopyDdl() {
    navigator.clipboard.writeText(ddl).then(() => {
      setCopiedDdl(true);
      setTimeout(() => setCopiedDdl(false), 2000);
    });
  }

  return (
    <div style={{
      borderTop: '1px solid var(--border)',
      paddingTop: 12,
      marginTop: 4,
    }}>
      <button
        onClick={() => setShowDdl(!showDdl)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          fontSize: 12,
          padding: 0,
        }}
      >
        <span className="material-symbols-outlined" style={{
          fontSize: 14,
          transition: 'transform 0.2s',
          transform: showDdl ? 'rotate(90deg)' : 'rotate(0deg)',
          fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20",
        }}>
          chevron_right
        </span>
        <span className="material-symbols-outlined" style={{
          fontSize: 14,
          fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20",
        }}>
          visibility
        </span>
        Create View from Query
      </button>
      {showDdl && (
        <div style={{ marginTop: 10 }}>
          <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--text-dim)' }}>
            Run this DDL to create a view from the source query. Edit the view name before running.
          </p>
          <div className="sql-block" style={{ fontSize: 11 }}>{ddl}</div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <ActionButton
              onClick={handleCopyDdl}
              variant="secondary"
              icon={copiedDdl ? 'check' : 'content_copy'}
              small
            >
              {copiedDdl ? 'Copied' : 'Copy DDL'}
            </ActionButton>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Shared: Looker Studio Link Button --------------------------------------

function LookerStudioButton({ result }: Props) {
  // We need a table reference to generate the link
  // Try to extract from sql or other fields
  const tableRef = extractTableRef(result);
  if (!tableRef) return null;

  const { project, dataset, table } = tableRef;
  const url = `https://lookerstudio.google.com/reporting/create?c.reportId=NEW&ds.connector=BIG_QUERY&ds.type=TABLE&ds.projectId=${encodeURIComponent(project)}&ds.datasetId=${encodeURIComponent(dataset)}&ds.tableId=${encodeURIComponent(table)}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '9px 16px',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        color: 'var(--text)',
        fontSize: 13,
        fontWeight: 500,
        textDecoration: 'none',
        transition: 'background 0.15s, border-color 0.15s',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--surface-hover, var(--surface-2))';
        e.currentTarget.style.borderColor = 'var(--accent, #2563eb)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--surface-2)';
        e.currentTarget.style.borderColor = 'var(--border)';
      }}
    >
      <span className="material-symbols-outlined" style={{
        fontSize: 16,
        fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20",
      }}>
        bar_chart
      </span>
      Open in Looker Studio
    </a>
  );
}

// ---- Shared: Export Format Selector -----------------------------------------
// This is available as a utility for GCS export contexts.
// The format affects the file extension shown to the user.

export type ExportFormatOption = 'CSV' | 'JSON' | 'AVRO' | 'PARQUET';

const FORMAT_EXTENSIONS: Record<ExportFormatOption, string> = {
  CSV: '.csv.gz',
  JSON: '.json.gz',
  AVRO: '.avro',
  PARQUET: '.parquet',
};

export function ExportFormatSelector({
  value,
  onChange,
}: {
  value: ExportFormatOption;
  onChange: (fmt: ExportFormatOption) => void;
}) {
  const formats: ExportFormatOption[] = ['CSV', 'JSON', 'AVRO', 'PARQUET'];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 500 }}>Format:</span>
      <div style={{
        display: 'inline-flex',
        border: '1px solid var(--border)',
        borderRadius: 6,
        overflow: 'hidden',
      }}>
        {formats.map((fmt) => (
          <button
            key={fmt}
            onClick={() => onChange(fmt)}
            style={{
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: value === fmt ? 600 : 400,
              background: value === fmt ? 'var(--accent-dim, rgba(37, 99, 235, 0.1))' : 'var(--surface)',
              color: value === fmt ? 'var(--accent, #2563eb)' : 'var(--text-muted)',
              border: 'none',
              borderRight: '1px solid var(--border)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {fmt}
          </button>
        ))}
      </div>
      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
        {FORMAT_EXTENSIONS[value]}
      </span>
    </div>
  );
}

// ---- Shared Components ------------------------------------------------------

function ActionButton({
  onClick,
  disabled,
  icon,
  variant = 'primary',
  small = false,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon?: string;
  variant?: 'primary' | 'secondary';
  small?: boolean;
  children: React.ReactNode;
}) {
  const isPrimary = variant === 'primary';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: small ? '5px 12px' : '9px 20px',
        background: isPrimary
          ? 'var(--accent, #2563eb)'
          : 'var(--surface-2)',
        border: isPrimary
          ? 'none'
          : '1px solid var(--border)',
        borderRadius: 8,
        color: isPrimary ? 'white' : 'var(--text)',
        fontSize: small ? 11 : 13,
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'opacity 0.15s, background 0.15s',
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.opacity = '0.85'; }}
      onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.opacity = '1'; }}
    >
      {icon && (
        <span className="material-symbols-outlined" style={{
          fontSize: small ? 13 : 16,
          fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20",
        }}>
          {icon}
        </span>
      )}
      {children}
    </button>
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

// ---- Utility Functions ------------------------------------------------------

function extractTableRef(result: DataLoadingResult): { project: string; dataset: string; table: string } | null {
  if (!result.sql) return null;

  // Try to find FROM `project.dataset.table`
  const m = result.sql.match(/\bFROM\s+`([^`]+)`/i) || result.sql.match(/\bFROM\s+([A-Za-z0-9_.-]+)/i);
  if (!m) return null;

  const parts = m[1].split('.');
  if (parts.length >= 3) {
    return { project: parts[0], dataset: parts[1], table: parts[2] };
  }
  if (parts.length === 2) {
    return { project: '', dataset: parts[0], table: parts[1] };
  }
  return null;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}
