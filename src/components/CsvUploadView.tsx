'use client';

import { useState, useRef, useCallback } from 'react';
import type { DataLoadingResult, CsvUploadPreview } from '@/lib/types';

interface Props {
  result: DataLoadingResult;
  onSendMessage?: (msg: string) => void;
  onConfirm?: () => void;
}

export function CsvUploadView({ result, onSendMessage }: Props) {
  if (result.needsFile && !result.uploadPreview) {
    return <FileDropZone result={result} onSendMessage={onSendMessage} />;
  }
  if (result.uploadPreview) {
    return <PreviewCard result={result} onSendMessage={onSendMessage} />;
  }
  return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{result.message}</p>;
}

// ---- File Drop Zone (Phase 1: no file attached yet) -------------------------

function FileDropZone({ result, onSendMessage }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      // Send file via the onSendMessage callback which the orchestration hook picks up
      // We encode the file data as a special message format
      if (onSendMessage) {
        // Trigger file upload flow by dispatching a custom event the ChatInput can catch
        const event = new CustomEvent('csv-file-selected', {
          detail: { name: file.name, content, size: file.size },
          bubbles: true,
        });
        document.dispatchEvent(event);
      }
    };
    reader.readAsText(file);
  }, [onSendMessage]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {result.targetDataset && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Target dataset: <code style={{ fontSize: 11, background: 'var(--surface-dim)', padding: '1px 5px', borderRadius: 4 }}>{result.targetDataset}</code>
        </div>
      )}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(false)}
        onClick={() => inputRef.current?.click()}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '32px 24px',
          border: `2px dashed ${dragOver ? '#3b82f6' : 'var(--border)'}`,
          borderRadius: 12,
          background: dragOver ? 'rgba(59, 130, 246, 0.04)' : 'var(--surface)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 28, color: dragOver ? '#3b82f6' : 'var(--text-muted)' }}>
          upload_file
        </span>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
          Drop a CSV file here or click to browse
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          .csv files up to 100 MB
        </span>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
}

// ---- Preview Card (Phase 2: file parsed, showing preview before upload) -----

function PreviewCard({ result, onSendMessage }: Props) {
  const preview = result.uploadPreview!;
  const [tableName, setTableName] = useState(result.targetTable || '');
  const [datasetName, setDatasetName] = useState(result.targetDataset || '');
  const [writeMode, setWriteMode] = useState<'WRITE_APPEND' | 'WRITE_TRUNCATE'>('WRITE_APPEND');
  const [uploading, setUploading] = useState(false);

  function handleUpload() {
    if (!tableName.trim() || !datasetName.trim()) return;
    setUploading(true);
    // Dispatch upload execution via custom event
    const event = new CustomEvent('csv-upload-confirm', {
      detail: {
        csvContent: result.csvContent,
        tableName: tableName.trim(),
        dataset: datasetName.trim(),
        writeDisposition: writeMode,
      },
      bubbles: true,
    });
    document.dispatchEvent(event);
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Stats row */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <Stat label="File" value={preview.fileName} />
        <Stat label="Size" value={formatSize(preview.fileSize)} />
        <Stat label="Rows" value={preview.totalRows.toLocaleString()} />
        <Stat label="Columns" value={preview.columns.length.toString()} />
      </div>

      {/* Target configuration */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <FieldInput label="Dataset" value={datasetName} onChange={setDatasetName} placeholder="dataset_name" />
        <FieldInput label="Table" value={tableName} onChange={setTableName} placeholder="table_name" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Mode</span>
          <select
            value={writeMode}
            onChange={(e) => setWriteMode(e.target.value as 'WRITE_APPEND' | 'WRITE_TRUNCATE')}
            style={{
              padding: '5px 8px',
              fontSize: 12,
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--surface)',
              color: 'var(--text)',
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            <option value="WRITE_APPEND">Append rows</option>
            <option value="WRITE_TRUNCATE">Replace table</option>
          </select>
        </div>
      </div>

      {/* Data preview table */}
      <div style={{ overflow: 'auto', maxHeight: 260, borderRadius: 8, border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-mono, monospace)' }}>
          <thead>
            <tr>
              {preview.columns.map((col, i) => (
                <th key={i} style={{
                  position: 'sticky',
                  top: 0,
                  padding: '6px 10px',
                  background: 'var(--surface-dim)',
                  borderBottom: '1px solid var(--border)',
                  textAlign: 'left',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  color: 'var(--text)',
                  fontSize: 11,
                }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.sampleRows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{
                    padding: '4px 10px',
                    borderBottom: '1px solid var(--border-light, rgba(0,0,0,0.05))',
                    whiteSpace: 'nowrap',
                    maxWidth: 200,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    color: 'var(--text-muted)',
                  }}>
                    {String(cell ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {preview.totalRows > 10 && (
        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Showing 10 of {preview.totalRows.toLocaleString()} rows
        </p>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleUpload}
          disabled={!tableName.trim() || !datasetName.trim() || uploading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 16px',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'inherit',
            color: '#fff',
            background: uploading ? '#93c5fd' : '#2563eb',
            border: 'none',
            borderRadius: 8,
            cursor: uploading ? 'wait' : (!tableName.trim() || !datasetName.trim()) ? 'not-allowed' : 'pointer',
            opacity: (!tableName.trim() || !datasetName.trim()) ? 0.5 : 1,
            transition: 'all 0.15s',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
            {uploading ? 'hourglass_empty' : 'cloud_upload'}
          </span>
          {uploading ? 'Uploading...' : 'Upload to BigQuery'}
        </button>
      </div>
    </div>
  );
}

// ---- Shared sub-components --------------------------------------------------

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{value}</span>
    </div>
  );
}

function FieldInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          padding: '5px 8px',
          fontSize: 12,
          fontFamily: 'var(--font-mono, monospace)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          background: 'var(--surface)',
          color: 'var(--text)',
          width: 140,
        }}
      />
    </div>
  );
}
