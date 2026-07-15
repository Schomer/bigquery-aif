'use client';

import type { QueryResult } from '@/lib/types';
import { formatDisplayValue } from '@/lib/format-value';
import { useState } from 'react';
import { drillDownMessage } from './charts/chart-utils';

const PAGE_SIZE = 100;

interface Props {
  result: QueryResult;
  emphasis?: { highlight: string[]; deemphasize: string[] };
  onSendMessage?: (msg: string) => void;
}

export function DataTable({ result, emphasis, onSendMessage }: Props) {
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);

  const { columns, rows } = result;

  let sorted = rows;
  if (sortCol !== null) {
    sorted = [...sorted].sort((a, b) => {
      const av = a[sortCol];
      const bv = b[sortCol];
      const an = typeof av === 'number' ? av : Number(av);
      const bn = typeof bv === 'number' ? bv : Number(bv);
      const cmp =
        !isNaN(an) && !isNaN(bn)
          ? an - bn
          : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows = sorted.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const rangeStart = currentPage * PAGE_SIZE + 1;
  const rangeEnd = Math.min((currentPage + 1) * PAGE_SIZE, sorted.length);

  function toggleSort(i: number) {
    if (sortCol === i) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(i);
      setSortDir('asc');
    }
    setPage(0);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ overflowX: 'auto', borderRadius: totalPages > 1 ? '8px 8px 0 0' : 8, border: '1px solid var(--border)', borderBottom: totalPages > 1 ? 'none' : undefined }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
              {columns.map((col, i) => {
                const isHighlighted = emphasis?.highlight?.includes(col);
                const isDeemphasized = emphasis?.deemphasize?.includes(col);
                return (
                  <th
                    key={col}
                    onClick={() => toggleSort(i)}
                    style={{
                      padding: '8px 12px',
                      textAlign: 'left',
                      color: isHighlighted ? 'var(--accent, #1a73e8)' : isDeemphasized ? 'var(--text-dim, #94a3b8)' : 'var(--text-muted)',
                      fontWeight: isHighlighted ? 600 : 500,
                      opacity: isDeemphasized ? 0.6 : 1,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      userSelect: 'none',
                      transition: 'color 0.1s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = isHighlighted ? 'var(--accent, #1a73e8)' : isDeemphasized ? 'var(--text-dim, #94a3b8)' : 'var(--text-muted)')}
                  >
                    {col}
                    {sortCol === i && (
                      <span style={{ marginLeft: 4, opacity: 0.7 }}>
                        {sortDir === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length || 1}
                  style={{
                    padding: '24px 12px',
                    textAlign: 'center',
                    color: 'var(--text-dim)',
                    fontStyle: 'italic',
                    fontSize: 12,
                  }}
                >
                  No rows returned.
                </td>
              </tr>
            ) : (
              pageRows.map((row, ri) => (
                <tr
                  key={currentPage * PAGE_SIZE + ri}
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      onClick={() => {
                        if (cell !== null && cell !== undefined && onSendMessage) {
                          const colLower = columns[ci].toLowerCase();
                          const isEntityCol = /^(dataset|table|view|schema)[_\s]?(name|id)?$/.test(colLower)
                            || colLower === 'table_catalog'
                            || colLower === 'table_schema';
                          if (isEntityCol) {
                            onSendMessage(`Tell me more about ${cell}`);
                          } else {
                            onSendMessage(drillDownMessage(columns[ci], cell));
                          }
                        }
                      }}
                      style={{
                        padding: '7px 12px',
                        color: (typeof cell === 'number' || (typeof cell === 'string' && cell !== '' && !isNaN(Number(cell)))) ? 'var(--text)' : 'var(--text-muted)',
                        fontFamily: 'inherit',
                        whiteSpace: 'nowrap',
                        maxWidth: 300,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        cursor: 'pointer',
                        transition: 'background-color 0.1s, color 0.1s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--accent-dim)';
                        e.currentTarget.style.color = 'var(--accent-text)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = (typeof cell === 'number' || (typeof cell === 'string' && cell !== '' && !isNaN(Number(cell)))) ? 'var(--text)' : 'var(--text-muted)';
                      }}
                      title={cell !== null && cell !== undefined
                        ? (/^(dataset|table|view|schema)[_\s]?(name|id)?$/.test(columns[ci].toLowerCase()) || columns[ci].toLowerCase() === 'table_catalog' || columns[ci].toLowerCase() === 'table_schema'
                          ? `Click to learn more about ${cell}`
                          : `Click to filter where ${columns[ci]} = ${cell}`)
                        : undefined}
                    >
                      {cell === null || cell === undefined ? (
                        <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>null</span>
                      ) : typeof cell === 'object' ? JSON.stringify(cell) : formatDisplayValue(cell, columns[ci])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination footer — only shown when there is more than one page */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          border: '1px solid var(--border)',
          borderTop: '1px solid var(--border-subtle)',
          borderRadius: '0 0 8px 8px',
          background: 'var(--surface-2)',
          fontSize: 11,
          color: 'var(--text-muted)',
          gap: 8,
        }}>
          <span>{rangeStart}–{rangeEnd} of {sorted.length.toLocaleString()}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              style={{
                padding: '3px 10px',
                fontSize: 11,
                fontFamily: 'inherit',
                border: '1px solid var(--border)',
                borderRadius: 5,
                background: '#fff',
                color: currentPage === 0 ? 'var(--text-dim)' : 'var(--text)',
                cursor: currentPage === 0 ? 'default' : 'pointer',
                opacity: currentPage === 0 ? 0.4 : 1,
              }}
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage === totalPages - 1}
              style={{
                padding: '3px 10px',
                fontSize: 11,
                fontFamily: 'inherit',
                border: '1px solid var(--border)',
                borderRadius: 5,
                background: '#fff',
                color: currentPage === totalPages - 1 ? 'var(--text-dim)' : 'var(--text)',
                cursor: currentPage === totalPages - 1 ? 'default' : 'pointer',
                opacity: currentPage === totalPages - 1 ? 0.4 : 1,
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
