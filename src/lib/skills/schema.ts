// src/lib/skills/schema.ts
// Client-side Schema skill implementation using direct BigQuery REST API calls.

import {
  getCacheKey,
  getFromCache,
  setInCache,
} from '../schema-cache';
import type { SchemaResult, SchemaColumn } from '../types';
import { checkResponse } from '../bigquery-client';

const BQ_BASE = 'https://bigquery.googleapis.com/bigquery/v2';

function getHeaders(): Headers {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('google_access_token') : null;
  if (!token) {
    throw new Error('BigQuery access not authorized. Please sign in with Google.');
  }
  const headers = new Headers();
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');
  return headers;
}

// ─── Public entrypoint ────────────────────────────────────────────────────────

export async function fetchSchema(
  dataset?: string,
  table?: string,
  projectOverride?: string,
): Promise<SchemaResult> {
  const PROJ = projectOverride || 'malloy-data';
  const key = getCacheKey(PROJ, dataset, table);
  const cached = getFromCache(key);
  if (cached) return cached;

  let result: SchemaResult;

  if (table && dataset) {
    result = await fetchTableSchema(PROJ, dataset, table);
  } else if (dataset) {
    result = await fetchDatasetSchema(PROJ, dataset);
  } else {
    result = await fetchProjectSchema(PROJ);
  }

  setInCache(key, result);
  return result;
}

// ─── Project-level: list all datasets ─────────────────────────────────────────

async function fetchProjectSchema(project: string): Promise<SchemaResult> {
  const res = await fetch(`${BQ_BASE}/projects/${project}/datasets`, {
    headers: getHeaders()
  });
  const data = await res.json();
  checkResponse(res, data);
  if (data.error) throw new Error(data.error.message);

  const datasets = data.datasets || [];
  const columns: SchemaColumn[] = datasets.map((ds: any) => ({
    name: ds.datasetReference?.datasetId ?? '',
    type: 'DATASET',
    mode: 'NULLABLE' as const,
    description: null,
    fields: [],
  }));

  return {
    skill: 'schema', scope: 'PROJECT', project, dataset: null, table: null,
    columns, tableConstraints: { primaryKey: [], foreignKeys: [] },
    fetchedAt: new Date().toISOString(),
  };
}

// ─── Dataset-level: list all tables ───────────────────────────────────────────

async function fetchDatasetSchema(project: string, dataset: string): Promise<SchemaResult> {
  const res = await fetch(`${BQ_BASE}/projects/${project}/datasets/${dataset}/tables`, {
    headers: getHeaders()
  });
  const data = await res.json();
  checkResponse(res, data);
  if (data.error) throw new Error(data.error.message);

  const tables = data.tables || [];
  const columns: SchemaColumn[] = tables.map((t: any) => ({
    name: t.tableReference?.tableId ?? '',
    type: t.type ?? 'TABLE',
    mode: 'NULLABLE' as const,
    description: t.friendlyName ?? null,
    fields: [],
  }));

  return {
    skill: 'schema', scope: 'DATASET', project, dataset, table: null,
    columns, tableConstraints: { primaryKey: [], foreignKeys: [] },
    fetchedAt: new Date().toISOString(),
  };
}

// ─── Table-level: full schema ─────────────────────────────────────────────────

async function fetchTableSchema(
  project: string,
  dataset: string,
  table: string,
): Promise<SchemaResult> {
  const res = await fetch(`${BQ_BASE}/projects/${project}/datasets/${dataset}/tables/${table}`, {
    headers: getHeaders()
  });
  const metadata = await res.json();
  checkResponse(res, metadata);
  if (metadata.error) throw new Error(metadata.error.message);

  const columns = (metadata.schema?.fields ?? []).map(mapField);
  const constraints = await fetchTableConstraints(project, dataset, table);

  return {
    skill: 'schema', scope: 'TABLE', project, dataset, table,
    description: metadata.description ?? null,
    type: metadata.type ?? 'TABLE',
    columns,
    partitioning: metadata.timePartitioning
      ? { field: metadata.timePartitioning.field ?? '_PARTITIONTIME', type: metadata.timePartitioning.type ?? 'DAY' }
      : null,
    clustering: metadata.clustering?.fields ?? null,
    rowCount: metadata.numRows ? parseInt(metadata.numRows, 10) : null,
    sizeBytes: metadata.numBytes ? parseInt(metadata.numBytes, 10) : null,
    lastModifiedTime: metadata.lastModifiedTime
      ? new Date(parseInt(metadata.lastModifiedTime, 10)).toISOString()
      : null,
    tableConstraints: constraints,
    fetchedAt: new Date().toISOString(),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapField(field: {
  name: string;
  type: string;
  mode?: string;
  description?: string;
  fields?: unknown[];
}): SchemaColumn {
  return {
    name: field.name,
    type: field.type,
    mode: (field.mode as SchemaColumn['mode']) ?? 'NULLABLE',
    description: field.description ?? null,
    fields: (field.fields ?? []).map((f) =>
      mapField(f as Parameters<typeof mapField>[0])
    ),
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

    const res = await fetch(`${BQ_BASE}/projects/${project}/queries`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ query, useLegacySql: false })
    });
    const data = await res.json();
    checkResponse(res, data);
    if (data.error) throw new Error(data.error.message);

    const rows = data.rows || [];
    const fields = data.schema?.fields || [];
    const getVal = (row: any, fieldName: string) => {
      const idx = fields.findIndex((f: any) => f.name === fieldName);
      return idx !== -1 ? row.f[idx]?.v : null;
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
    // INFORMATION_SCHEMA may not be accessible — return empty gracefully
    return { primaryKey: [], foreignKeys: [] };
  }
}
