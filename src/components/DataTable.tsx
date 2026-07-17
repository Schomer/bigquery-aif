'use client';

import type { QueryResult } from '@/lib/types';
import { formatDisplayValue } from '@/lib/format-value';
import { useState, useMemo } from 'react';
import { drillDownMessage } from './charts/chart-utils';

const PAGE_SIZE_OPTIONS = [25, 50, 100, 500];
const DEFAULT_PAGE_SIZE = 50;
// Max rows before the table body becomes a fixed-height scroll area
const SCROLL_THRESHOLD = 25;

interface Props {
  result: QueryResult;
  emphasis?: { highlight: string[]; deemphasize: string[] };
  onSendMessage?: (msg: string) => void;
}

export function DataTable({ result, emphasis, onSendMessage }: Props) {
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [filter, setFilter] = useState('');

  const { columns, rows } = result;

  // Filter rows by search text across all columns
  const filtered = useMemo(() => {
    if (!filter.trim()) return rows;
    const q = filter.toLowerCase();
    return rows.filter((row) =>
      (row as unknown[]).some((cell) =>
        cell !== null && cell !== undefined && String(cell).toLowerCase().includes(q)
      )
    );
  }, [rows, filter]);

  // Sort filtered rows
  const sorted = useMemo(() => {
    if (sortCol === null) return filtered;
    return [...filtered].sort((a, b) => {
      const av = (a as unknown[])[sortCol];
      const bv = (b as unknown[])[sortCol];
      const an = typeof av === 'number' ? av : Number(av);
      const bn = typeof bv === 'number' ? bv : Number(bv);
      const cmp =
        !isNaN(an) && !isNaN(bn)
          ? an - bn
          : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows = sorted.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const rangeStart = sorted.length === 0 ? 0 : currentPage * pageSize + 1;
  const rangeEnd = Math.min((currentPage + 1) * pageSize, sorted.length);

  function toggleSort(i: number) {
    if (sortCol === i) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(i);
      setSortDir('asc');
    }
    setPage(0);
  }

  function handlePageSizeChange(newSize: number) {
    setPageSize(newSize);
    setPage(0);
  }

  function handleFilterChange(val: string) {
    setFilter(val);
    setPage(0);
  }

  const useScrollArea = rows.length > SCROLL_THRESHOLD;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Toolbar: filter + rows-per-page */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '6px 0 8px 0',
      }}>
        {/* Search filter */}
        <div style={{ position: 'relative', flex: '1 1 auto', maxWidth: 280 }}>
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            style={{
              position: 'absolute',
              left: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 13,
              height: 13,
              color: 'var(--text-dim)',
              pointerEvents: 'none',
            }}
          >
            <circle cx="8.5" cy="8.5" r="5.5" />
            <line x1="13" y1="13" x2="17" y2="17" />
          </svg>
          <input
            type="text"
            value={filter}
            onChange={(e) => handleFilterChange(e.target.value)}
            placeholder="Filter rows..."
            style={{
              width: '100%',
              paddingLeft: 28,
              paddingRight: filter ? 28 : 8,
              paddingTop: 5,
              paddingBottom: 5,
              fontSize: 12,
              fontFamily: 'inherit',
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--surface)',
              color: 'var(--text)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {filter && (
            <button
              onClick={() => handleFilterChange('')}
              style={{
                position: 'absolute',
                right: 6,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-dim)',
                fontSize: 14,
                lineHeight: 1,
                padding: 0,
              }}
              title="Clear filter"
            >
              &times;
            </button>
          )}
        </div>

      </div>

      {/* Table wrapper */}
      <div style={{
        borderRadius: totalPages > 1 ? '8px 8px 0 0' : 8,
        border: '1px solid var(--border)',
        borderBottom: totalPages > 1 ? 'none' : undefined,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Sticky header + scrollable body */}
        <div style={useScrollArea ? {
          maxHeight: 440,
          overflowY: 'auto',
          overflowX: 'auto',
        } : { overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ position: useScrollArea ? 'sticky' : undefined, top: 0, zIndex: 1 }}>
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
                        background: 'var(--surface-2)',
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
                    {filter ? 'No rows match the filter.' : 'No rows returned.'}
                  </td>
                </tr>
              ) : (
                pageRows.map((row, ri) => (
                  <tr
                    key={currentPage * pageSize + ri}
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {(row as unknown[]).map((cell, ci) => (
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
      </div>

      {/* Pagination footer — always shown for rows-per-page; nav only when multi-page */}
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
        {/* Left: rows-per-page select + row count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ whiteSpace: 'nowrap', color: 'var(--text-dim)' }}>Rows per page</span>
          <select
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            style={{
              fontSize: 11,
              fontFamily: 'inherit',
              border: '1px solid var(--border)',
              borderRadius: 5,
              background: 'var(--surface)',
              color: 'var(--text-muted)',
              padding: '3px 6px',
              cursor: 'pointer',
              outline: 'none',
            }}
            title="Rows per page"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <span style={{ whiteSpace: 'nowrap', color: 'var(--text-dim)' }}>
            {filter
              ? `${sorted.length.toLocaleString()} of ${rows.length.toLocaleString()} rows`
              : `${rows.length.toLocaleString()} rows`}
          </span>
        </div>
        {/* Right: page navigation (only when multi-page) */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => setPage(0)}
              disabled={currentPage === 0}
              style={{
                padding: '3px 8px',
                fontSize: 11,
                fontFamily: 'inherit',
                border: '1px solid var(--border)',
                borderRadius: 5,
                background: 'var(--surface)',
                color: currentPage === 0 ? 'var(--text-dim)' : 'var(--text)',
                cursor: currentPage === 0 ? 'default' : 'pointer',
                opacity: currentPage === 0 ? 0.4 : 1,
              }}
            >
              «
            </button>
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              title="Previous page"
              style={{
                padding: '3px 7px',
                fontSize: 11,
                fontFamily: 'inherit',
                border: '1px solid var(--border)',
                borderRadius: 5,
                background: 'var(--surface)',
                color: currentPage === 0 ? 'var(--text-dim)' : 'var(--text)',
                cursor: currentPage === 0 ? 'default' : 'pointer',
                opacity: currentPage === 0 ? 0.4 : 1,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 12, height: 12 }}><polyline points="10,3 5,8 10,13" /></svg>
            </button>
            <span style={{ padding: '0 6px', fontSize: 11 }}>
              {currentPage + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage === totalPages - 1}
              title="Next page"
              style={{
                padding: '3px 7px',
                fontSize: 11,
                fontFamily: 'inherit',
                border: '1px solid var(--border)',
                borderRadius: 5,
                background: 'var(--surface)',
                color: currentPage === totalPages - 1 ? 'var(--text-dim)' : 'var(--text)',
                cursor: currentPage === totalPages - 1 ? 'default' : 'pointer',
                opacity: currentPage === totalPages - 1 ? 0.4 : 1,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 12, height: 12 }}><polyline points="6,3 11,8 6,13" /></svg>
            </button>
            <button
              onClick={() => setPage(totalPages - 1)}
              disabled={currentPage === totalPages - 1}
              style={{
                padding: '3px 8px',
                fontSize: 11,
                fontFamily: 'inherit',
                border: '1px solid var(--border)',
                borderRadius: 5,
                background: 'var(--surface)',
                color: currentPage === totalPages - 1 ? 'var(--text-dim)' : 'var(--text)',
                cursor: currentPage === totalPages - 1 ? 'default' : 'pointer',
                opacity: currentPage === totalPages - 1 ? 0.4 : 1,
              }}
            >
              »
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
