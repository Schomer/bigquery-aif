// src/lib/skills/schema.ts
// Client-side schema skill using direct BigQuery REST API calls.
//
// Every scope is split into a fast base fetch and a background enrichment:
//   PROJECT  base = dataset list            enrichment = per-dataset table counts
//   DATASET  base = table list              enrichment = column counts + 30-day query frequency
//   TABLE    base = table metadata/columns  enrichment = PK/FK constraints (INFORMATION_SCHEMA)
//
// Agent tools call fetchSchema(..., { enrich: false }) and get the base result as
// soon as it lands; the enrichment keeps running in the background so it overlaps
// with the next model call instead of blocking it. The UI path (schema cards)
// uses the default enrich: true, which waits for the enrichment -- bounded by
// ENRICH_WAIT_MS -- and renders with whatever has arrived. Enrichment always
// patches the cached result object in place when it completes, so later readers
// see the full data regardless of who waited.

import { getAccessToken } from '../gis-auth';
import {
  getCacheKey,
  getFromCache,
  setInCache,
} from '../schema-cache';
import { executeQuery } from '../bigquery-client';
import type { SchemaResult, SchemaColumn } from '../types';

const BQ_BASE = 'https://bigquery.googleapis.com/bigquery/v2/projects';

/** Upper bound the UI path waits for background enrichment before rendering without it. */
export const ENRICH_WAIT_MS = 2500;

/** Above this many datasets, per-dataset table counts are skipped (rate-limit protection). */
const TABLE_COUNT_DATASET_LIMIT = 50;

export interface FetchSchemaOptions {
  /**
   * true (default): wait (bounded by ENRICH_WAIT_MS) for enrichment data.
   * false: return the base result immediately; enrichment continues in the
   * background and is merged into the cached result when it completes.
   */
  enrich?: boolean;
}

async function bqGet(url: string): Promise<any> {
  const token = getAccessToken();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data?.error?.message || `HTTP ${res.status}`);
  }
  return data;
}

/**
 * Metadata queries go through the shared executeQuery fast path, which waits
 * server-side and long-polls slow INFORMATION_SCHEMA queries instead of
 * silently returning zero rows when they exceed the default 10 s wait.
 */
async function bqQuery(sql: string, project: string): Promise<{ columns: string[]; rows: unknown[][] }> {
  const result = await executeQuery(sql, project);
  return { columns: result.columns, rows: result.rows };
}

async function resolveDefaultDatasetForProject(project: string): Promise<string> {
  try {
    const data = await bqGet(`${BQ_BASE}/${encodeURIComponent(project)}/datasets`);
    const datasets = data.datasets || [];
    if (datasets.length > 0) {
      return datasets[0].datasetReference?.datasetId || '';
    }
  } catch {}
  return '';
}

// ─── Enrichment registry ──────────────────────────────────────────────────────
// One enrichment promise per cache key, shared by every caller. Base fetches are
// deduplicated the same way so concurrent agent + UI requests for the same key
// share a single network round trip.

interface FetchOutcome {
  result: SchemaResult;
  /** Optional background work that mutates `result` in place when it finishes. */
  enrich?: () => Promise<void>;
}

const inflightBase = new Map<string, Promise<SchemaResult>>();
const enrichmentPromises = new Map<string, Promise<void>>();

function startEnrichment(key: string, task: () => Promise<void>): void {
  // Enrichment is best-effort: failures leave the base result untouched.
  enrichmentPromises.set(key, task().catch(() => { /* non-fatal */ }));
}

/** Resolve when `promise` settles or `ms` elapses, whichever comes first. */
function settleWithin(promise: Promise<unknown>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    promise.then(
      () => { clearTimeout(timer); resolve(); },
      () => { clearTimeout(timer); resolve(); },
    );
  });
}

/** Wait (bounded) for the enrichment registered under `key`, if any. */
export async function awaitSchemaEnrichment(key: string, maxWaitMs: number = ENRICH_WAIT_MS): Promise<void> {
  const pending = enrichmentPromises.get(key);
  if (pending) await settleWithin(pending, maxWaitMs);
}

/** Test/reset hook: forget in-flight base fetches and enrichment promises. */
export function resetSchemaFetchState(): void {
  inflightBase.clear();
  enrichmentPromises.clear();
}

// ─── Public entrypoint ────────────────────────────────────────────────────────

export async function fetchSchema(
  dataset?: string,
  table?: string,
  projectOverride?: string,
  options?: FetchSchemaOptions,
): Promise<SchemaResult> {
  const PROJ = projectOverride || '';
  const enrich = options?.enrich ?? true;

  // Guard against confusing project name with dataset name
  let resolvedDataset = dataset;
  if (resolvedDataset && PROJ && resolvedDataset.toLowerCase() === PROJ.toLowerCase()) {
    resolvedDataset = table ? await resolveDefaultDatasetForProject(PROJ) : undefined;
  }

  const key = getCacheKey(PROJ, resolvedDataset, table);
  let result = getFromCache(key);

  if (!result) {
    let pending = inflightBase.get(key);
    if (!pending) {
      pending = (async () => {
        // A fresh base fetch produces a fresh result object, so any enrichment
        // registered for a previous (expired/invalidated) object is dropped.
        enrichmentPromises.delete(key);
        let outcome: FetchOutcome;
        if (table && resolvedDataset) {
          outcome = await fetchTableSchema(PROJ, resolvedDataset, table);
        } else if (resolvedDataset) {
          outcome = await fetchDatasetSchema(PROJ, resolvedDataset);
        } else {
          outcome = await fetchProjectSchema(PROJ);
        }
        setInCache(key, outcome.result);
        if (outcome.enrich) startEnrichment(key, outcome.enrich);
        return outcome.result;
      })();
      inflightBase.set(key, pending);
      pending.then(
        () => inflightBase.delete(key),
        () => inflightBase.delete(key),
      );
    }
    result = await pending;
  }

  if (enrich) {
    await awaitSchemaEnrichment(key, ENRICH_WAIT_MS);
  }

  return result;
}

// ─── Project-level: list all datasets ─────────────────────────────────────────

async function fetchProjectSchema(project: string): Promise<FetchOutcome> {
  // Paginate through all datasets
  let allDatasets: any[] = [];
  let pageToken: string | undefined;
  do {
    const url = `${BQ_BASE}/${encodeURIComponent(project)}/datasets?maxResults=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const data = await bqGet(url);
    allDatasets = allDatasets.concat(data.datasets || []);
    pageToken = data.nextPageToken;
  } while (pageToken);

  const datasetIds: string[] = allDatasets.map((ds: any) => ds.datasetReference?.datasetId ?? '');

  const columns: SchemaColumn[] = allDatasets.map((ds: any) => ({
    name: ds.datasetReference?.datasetId ?? '',
    type: 'DATASET',
    mode: 'NULLABLE' as const,
    description: null,
    fields: [],
    tableCount: null,
  }));

  const result: SchemaResult = {
    skill: 'schema', scope: 'PROJECT', project, dataset: null, table: null,
    columns, tableConstraints: { primaryKey: [], foreignKeys: [] },
    fetchedAt: new Date().toISOString(),
  };

  // Enrichment: table counts per dataset, in parallel -- but only for manageable
  // project sizes. For large projects (>50 datasets) the N parallel requests are
  // slow and likely to hit rate limits, and per-dataset counts add noise when
  // the user's primary goal is finding the right dataset via search.
  const enrich = datasetIds.length > 0 && datasetIds.length <= TABLE_COUNT_DATASET_LIMIT
    ? async () => {
        const counts = await Promise.all(
          datasetIds.map(async (dsId: string) => {
            if (!dsId) return 0;
            try {
              const url = `${BQ_BASE}/${encodeURIComponent(project)}/datasets/${encodeURIComponent(dsId)}/tables?maxResults=1000`;
              const data = await bqGet(url);
              return data.totalItems ? parseInt(data.totalItems, 10) : (data.tables?.length ?? 0);
            } catch {
              return 0;
            }
          })
        );
        result.columns.forEach((col, i) => { col.tableCount = counts[i]; });
      }
    : undefined;

  return { result, enrich };
}

// ─── Dataset-level: list all tables ───────────────────────────────────────────

async function fetchDatasetSchema(project: string, dataset: string): Promise<FetchOutcome> {
  // Paginate through all tables
  let allTables: any[] = [];
  let pageToken: string | undefined;
  do {
    const url = `${BQ_BASE}/${encodeURIComponent(project)}/datasets/${encodeURIComponent(dataset)}/tables?maxResults=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const data = await bqGet(url);
    allTables = allTables.concat(data.tables || []);
    pageToken = data.nextPageToken;
  } while (pageToken);

  const columns: SchemaColumn[] = allTables.map((t: any) => {
    const tableId: string = t.tableReference?.tableId ?? '';
    return {
      name: tableId,
      type: t.type ?? 'TABLE',
      mode: 'NULLABLE' as const,
      description: t.friendlyName || null,
      fields: [],
      rowCount: t.numRows ? parseInt(t.numRows, 10) : null,
      columnCount: null,
      sizeBytes: t.numBytes ? parseInt(t.numBytes, 10) : null,
      creationTime: t.creationTime
        ? new Date(parseInt(t.creationTime, 10)).toISOString()
        : null,
      queryFrequency: 0,
    };
  });

  const result: SchemaResult = {
    skill: 'schema', scope: 'DATASET', project, dataset, table: null,
    columns, tableConstraints: { primaryKey: [], foreignKeys: [] },
    fetchedAt: new Date().toISOString(),
  };

  // Enrichment: column counts and 30-day query frequency (W2-12), both from
  // INFORMATION_SCHEMA, fetched in parallel and merged into the cached result.
  const enrich = allTables.length > 0
    ? async () => {
        const [columnCountMap, queryFreqMap] = await Promise.all([
          loadColumnCounts(project, dataset),
          loadQueryFrequency(project, dataset),
        ]);
        for (const col of result.columns) {
          col.columnCount = columnCountMap.has(col.name) ? columnCountMap.get(col.name)! : null;
          col.queryFrequency = queryFreqMap.get(col.name) ?? 0;
        }
        // W2-12: Sort by frequency (desc), then row count (desc), then name (asc)
        if (queryFreqMap.size > 0) {
          result.columns.sort((a, b) => {
            const freqDiff = (b.queryFrequency ?? 0) - (a.queryFrequency ?? 0);
            if (freqDiff !== 0) return freqDiff;
            const rowDiff = (b.rowCount ?? 0) - (a.rowCount ?? 0);
            if (rowDiff !== 0) return rowDiff;
            return a.name.localeCompare(b.name);
          });
        }
      }
    : undefined;

  return { result, enrich };
}

async function loadColumnCounts(project: string, dataset: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const { rows } = await bqQuery(
      `SELECT table_name, COUNT(*) AS column_count FROM \`${project}.${dataset}\`.INFORMATION_SCHEMA.COLUMNS GROUP BY table_name`,
      project,
    );
    for (const row of rows) {
      const tableName = String(row[0] ?? '');
      const count = parseInt(String(row[1] ?? '0'), 10);
      if (tableName) map.set(tableName, count);
    }
  } catch { /* non-fatal */ }
  return map;
}

async function loadQueryFrequency(project: string, dataset: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const { rows } = await bqQuery(
      `SELECT REGEXP_EXTRACT(ref.project_id||'.'||ref.dataset_id||'.'||ref.table_id, r'[^.]+$') AS table_name, COUNT(*) AS freq
       FROM \`${project}\`.\`region-us\`.INFORMATION_SCHEMA.JOBS_BY_PROJECT, UNNEST(referenced_tables) AS ref
       WHERE creation_time > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
         AND ref.dataset_id = '${dataset}'
         AND ref.project_id = '${project}'
         AND statement_type = 'SELECT'
       GROUP BY table_name ORDER BY freq DESC LIMIT 50`,
      project,
    );
    for (const row of rows) {
      const tName = String(row[0] ?? '');
      const freq = Number(row[1] ?? 0);
      if (tName) map.set(tName, freq);
    }
  } catch { /* non-fatal -- query freq unavailable */ }
  return map;
}

// ─── Table-level: full schema ─────────────────────────────────────────────────

async function fetchTableSchema(
  project: string,
  dataset: string,
  table: string,
): Promise<FetchOutcome> {
  const data = await bqGet(
    `${BQ_BASE}/${encodeURIComponent(project)}/datasets/${encodeURIComponent(dataset)}/tables/${encodeURIComponent(table)}`
  );

  const schema = data.schema || {};
  const columns = (schema.fields ?? []).map(mapField);

  const partitioning = data.timePartitioning
    ? { field: data.timePartitioning.field ?? '_PARTITIONTIME', type: data.timePartitioning.type ?? 'DAY' }
    : data.rangePartitioning
      ? { field: data.rangePartitioning.field ?? '', type: 'RANGE' }
      : null;

  const result: SchemaResult = {
    skill: 'schema', scope: 'TABLE', project, dataset, table,
    description: data.description ?? null,
    type: data.type ?? 'TABLE',
    columns,
    partitioning,
    clustering: data.clustering?.fields ?? null,
    rowCount: data.numRows ? parseInt(data.numRows, 10) : null,
    sizeBytes: data.numBytes ? parseInt(data.numBytes, 10) : null,
    lastModifiedTime: data.lastModifiedTime
      ? new Date(parseInt(data.lastModifiedTime, 10)).toISOString()
      : null,
    tableConstraints: { primaryKey: [], foreignKeys: [] },
    fetchedAt: new Date().toISOString(),
  };

  // Enrichment: PK/FK constraints. The agent never needs these; only the
  // schema card does, so they must not block the tool turn.
  const enrich = async () => {
    result.tableConstraints = await fetchTableConstraints(project, dataset, table);
  };

  return { result, enrich };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapField(field: {
  name: string;
  type: string;
  mode?: string;
  description?: string;
  fields?: unknown[];
  policyTags?: { names?: string[] };
}): SchemaColumn {
  return {
    name: field.name,
    type: field.type,
    mode: (field.mode as SchemaColumn['mode']) ?? 'NULLABLE',
    description: field.description ?? null,
    fields: (field.fields ?? []).map((f) =>
      mapField(f as Parameters<typeof mapField>[0])
    ),
    // W3-07: extract policy tag names if present
    policyTags: field.policyTags?.names?.length ? field.policyTags.names : undefined,
  };
}

async function fetchTableConstraints(
  project: string,
  dataset: string,
  table: string,
): Promise<SchemaResult['tableConstraints']> {
  try {
    const query = `
      SELECT
        tc.CONSTRAINT_TYPE,
        kcu.COLUMN_NAME,
        ccu.TABLE_CATALOG AS ref_project,
        ccu.TABLE_SCHEMA  AS ref_dataset,
        ccu.TABLE_NAME    AS ref_table,
        ccu.COLUMN_NAME   AS ref_column
      FROM \`${project}.${dataset}\`.INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      LEFT JOIN \`${project}.${dataset}\`.INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
        ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
      LEFT JOIN \`${project}.${dataset}\`.INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu
        ON tc.CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
        AND tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
      WHERE tc.TABLE_NAME = '${table}'
      ORDER BY tc.CONSTRAINT_TYPE, kcu.ORDINAL_POSITION
    `;

    const { columns: cols, rows } = await bqQuery(query, project);
    const getVal = (row: unknown[], fieldName: string): string | null => {
      const idx = cols.indexOf(fieldName);
      const v = idx !== -1 ? row[idx] : null;
      return v == null ? null : String(v);
    };

    const primaryKey: string[] = [];
    const foreignKeyMap = new Map<
      string,
      { columns: string[]; refTable: string; refColumns: string[] }
    >();

    for (const row of rows) {
      const constraintType = getVal(row, 'CONSTRAINT_TYPE');
      const columnName = getVal(row, 'COLUMN_NAME');
      const refProject = getVal(row, 'ref_project');
      const refDataset = getVal(row, 'ref_dataset');
      const refTable = getVal(row, 'ref_table');
      const refColumn = getVal(row, 'ref_column');

      if (constraintType === 'PRIMARY KEY' && columnName) {
        primaryKey.push(columnName);
      } else if (constraintType === 'FOREIGN KEY' && columnName) {
        const fullRefTable = `${refProject}.${refDataset}.${refTable}`;
        const existing = foreignKeyMap.get(fullRefTable) ?? {
          columns: [],
          refTable: fullRefTable,
          refColumns: [],
        };
        existing.columns.push(columnName);
        if (refColumn) existing.refColumns.push(refColumn);
        foreignKeyMap.set(fullRefTable, existing);
      }
    }

    return {
      primaryKey,
      foreignKeys: Array.from(foreignKeyMap.values()).map((fk) => ({
        columns: fk.columns,
        referencedTable: fk.refTable,
        referencedColumns: fk.refColumns,
      })),
    };
  } catch {
    // INFORMATION_SCHEMA may not be accessible -- return empty gracefully
    return { primaryKey: [], foreignKeys: [] };
  }
}
