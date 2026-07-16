// src/lib/conversation-state.ts
// Cumulative session state that persists across turns.
// Unlike ChatContext (which tracks only the "last" values), this accumulates
// every table queried, every filter applied, and the recent SQL history
// so the LLM has full session awareness even after messages scroll out.

import type { CompositionEnvelope } from './types';

// ---- Types ------------------------------------------------------------------

export interface QueriedTable {
  table: string;
  dataset: string;
  sql: string;
  columns: string[];
  rowCount: number;
  timestamp: string;
  vizType?: string;
}

export interface AppliedFilter {
  column: string;
  operator: string;
  value: string;
  table: string;
}

export interface ConversationState {
  queriedTables: QueriedTable[];
  appliedFilters: AppliedFilter[];
  mentionedEntities: string[];
  activeTable: string | null;
  activeDataset: string | null;
  queryHistory: string[];
  turnCount: number;
}

// ---- Factory ----------------------------------------------------------------

export function createEmptyState(): ConversationState {
  return {
    queriedTables: [],
    appliedFilters: [],
    mentionedEntities: [],
    activeTable: null,
    activeDataset: null,
    queryHistory: [],
    turnCount: 0,
  };
}

// ---- SQL filter extraction --------------------------------------------------

const FILTER_PATTERNS: Array<{ regex: RegExp; operator: string }> = [
  { regex: /(\w+)\s*=\s*'([^']+)'/gi, operator: '=' },
  { regex: /(\w+)\s*!=\s*'([^']+)'/gi, operator: '!=' },
  { regex: /(\w+)\s*>\s*(\d+[\d.]*)/gi, operator: '>' },
  { regex: /(\w+)\s*<\s*(\d+[\d.]*)/gi, operator: '<' },
  { regex: /(\w+)\s*>=\s*(\d+[\d.]*)/gi, operator: '>=' },
  { regex: /(\w+)\s*<=\s*(\d+[\d.]*)/gi, operator: '<=' },
  { regex: /(\w+)\s+LIKE\s+'([^']+)'/gi, operator: 'LIKE' },
  { regex: /(\w+)\s+IN\s*\(([^)]+)\)/gi, operator: 'IN' },
  { regex: /(\w+)\s+BETWEEN\s+(\S+\s+AND\s+\S+)/gi, operator: 'BETWEEN' },
];

export function extractFiltersFromSql(sql: string, table: string): AppliedFilter[] {
  // Only parse the WHERE clause
  const whereMatch = sql.match(/\bWHERE\b([\s\S]+?)(?:\bGROUP\b|\bORDER\b|\bLIMIT\b|\bHAVING\b|$)/i);
  if (!whereMatch) return [];

  const whereClause = whereMatch[1];
  const filters: AppliedFilter[] = [];

  for (const { regex, operator } of FILTER_PATTERNS) {
    // Reset lastIndex for global regexes
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(whereClause)) !== null) {
      const column = match[1];
      const value = match[2];
      // Skip common SQL keywords that look like column names
      if (/^(AND|OR|NOT|NULL|TRUE|FALSE|EXTRACT|DATE|YEAR|MONTH)$/i.test(column)) continue;
      filters.push({ column, operator, value, table });
    }
  }

  return filters;
}

// ---- State updater ----------------------------------------------------------

const MAX_QUERIED_TABLES = 20;
const MAX_QUERY_HISTORY = 5;
const MAX_ENTITIES = 50;

export function updateState(
  state: ConversationState,
  envelope: CompositionEnvelope,
): ConversationState {
  const next = { ...state, turnCount: state.turnCount + 1 };
  const data = envelope.primaryArtifact.data as Record<string, unknown> | null;
  if (!data) return next;

  // -- Extract table and dataset --
  let table: string | undefined;
  let dataset: string | undefined;

  if (data.table && typeof data.table === 'string') {
    const parts = (data.table as string).replace(/`/g, '').split('.');
    table = parts[parts.length - 1];
    if (parts.length >= 2) dataset = parts[parts.length - 2];
  }

  if (data.dataset && typeof data.dataset === 'string') {
    dataset = data.dataset as string;
  }

  const sql = (data.sql as string | undefined) || envelope.provenance?.sql;
  if (!table && sql) {
    const sqlMatch = sql.match(/\bFROM\s+`?([A-Za-z0-9_.-]+)`?/i);
    if (sqlMatch) {
      const parts = sqlMatch[1].split('.');
      table = parts[parts.length - 1];
      if (parts.length >= 2) dataset = parts[parts.length - 2];
    }
  }

  // Update active focus
  if (table) next.activeTable = table;
  if (dataset) next.activeDataset = dataset;

  // -- Track queried tables --
  if (envelope.skill === 'query' && sql && table) {
    const columns = Array.isArray(data.columns)
      ? (data.columns as Array<string | { name: string }>).map(c =>
          typeof c === 'string' ? c : c.name
        )
      : [];
    const rowCount = typeof data.rowCount === 'number' ? data.rowCount : 0;

    const entry: QueriedTable = {
      table,
      dataset: dataset || '',
      sql,
      columns,
      rowCount,
      timestamp: new Date().toISOString(),
      vizType: envelope.primaryArtifact.type,
    };

    next.queriedTables = [...state.queriedTables, entry].slice(-MAX_QUERIED_TABLES);
    next.queryHistory = [...state.queryHistory, sql].slice(-MAX_QUERY_HISTORY);

    // Extract filters from this query
    const newFilters = extractFiltersFromSql(sql, table);
    if (newFilters.length > 0) {
      next.appliedFilters = [...state.appliedFilters, ...newFilters].slice(-20);
    }
  }

  // -- Track mentioned entities --
  const entities = new Set(state.mentionedEntities);
  if (table) entities.add(table);
  if (dataset) entities.add(dataset);
  if (Array.isArray(data.columns)) {
    for (const c of data.columns as Array<string | { name: string }>) {
      const name = typeof c === 'string' ? c : c.name;
      entities.add(name);
    }
  }
  next.mentionedEntities = [...entities].slice(-MAX_ENTITIES);

  return next;
}

// ---- Prompt formatter -------------------------------------------------------

export function formatStateForPrompt(state: ConversationState): string {
  if (state.turnCount === 0) {
    return 'This is the start of a new conversation. No prior output is on screen.';
  }

  const lines: string[] = [];
  lines.push(`SESSION CONTEXT (${state.turnCount} turn${state.turnCount === 1 ? '' : 's'}):`);

  // Active focus
  const focus: string[] = [];
  if (state.activeDataset) focus.push(`dataset=${state.activeDataset}`);
  if (state.activeTable) focus.push(`table=${state.activeTable}`);
  if (focus.length > 0) lines.push(`Active: ${focus.join(', ')}`);

  // Tables queried this session
  if (state.queriedTables.length > 0) {
    lines.push('Tables queried this session:');
    // Show the most recent 5 in detail
    const recent = state.queriedTables.slice(-5);
    for (let i = 0; i < recent.length; i++) {
      const t = recent[i];
      const sqlPreview = t.sql.length > 80 ? t.sql.slice(0, 77) + '...' : t.sql;
      lines.push(`  ${i + 1}. ${t.dataset}.${t.table} (${t.columns.length} cols, ${t.rowCount.toLocaleString()} rows) -- ${sqlPreview}`);
    }
    // If there are older ones, just list the table names
    if (state.queriedTables.length > 5) {
      const older = state.queriedTables.slice(0, -5);
      const names = [...new Set(older.map(t => `${t.dataset}.${t.table}`))];
      lines.push(`  Earlier tables: ${names.join(', ')}`);
    }
  }

  // Recent filters
  if (state.appliedFilters.length > 0) {
    const recent = state.appliedFilters.slice(-5);
    const filterStrs = recent.map(f => `${f.column} ${f.operator} ${f.value}`);
    lines.push(`Recent filters: ${filterStrs.join(', ')}`);
  }

  // Query history
  if (state.queryHistory.length > 0) {
    lines.push(`Query history (last ${state.queryHistory.length}):`);
    for (const sql of state.queryHistory) {
      const preview = sql.length > 100 ? sql.slice(0, 97) + '...' : sql;
      lines.push(`  ${preview}`);
    }
  }

  return lines.join('\n');
}
