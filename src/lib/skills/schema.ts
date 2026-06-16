// src/lib/skills/schema.ts
// Schema skill implementation — BigQuery SDK with ADC and caching
// Uses Application Default Credentials (ADC) for authentication.

import { BigQuery } from '@google-cloud/bigquery';
import {
  getCacheKey,
  getFromCache,
  setInCache,
} from '../schema-cache';
import type { SchemaResult, SchemaColumn } from '../types';

const PROJECT = process.env.GOOGLE_PROJECT_ID ?? 'malloy-data';
const bqClient = new BigQuery({ projectId: PROJECT });

function getProject(): string {
  return PROJECT;
}

function getClient(project?: string): BigQuery {
  return project && project !== PROJECT ? new BigQuery({ projectId: project }) : bqClient;
}

// ─── Public entrypoint ────────────────────────────────────────────────────────

export async function fetchSchema(
  dataset?: string,
  table?: string,
  projectOverride?: string,
): Promise<SchemaResult> {
  const PROJ = projectOverride || getProject();
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
  const client = getClient(project);
  const [datasets] = await client.getDatasets();
  const columns: SchemaColumn[] = datasets.map((ds) => ({
    name: ds.id ?? '',
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
  const client = getClient(project);
  const bqDataset = client.dataset(dataset);
  const [tables] = await bqDataset.getTables();
  const columns: SchemaColumn[] = tables.map((t) => ({
    name: t.id ?? '',
    type: (t.metadata?.type as string) ?? 'TABLE',
    mode: 'NULLABLE' as const,
    description: t.metadata?.friendlyName ?? null,
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
  const client = getClient(project);
  const [metadata] = await client.dataset(dataset).table(table).getMetadata();
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
    const client = getClient(project);
    const [rows] = await client.query({ query, location: 'US' });

    const primaryKey: string[] = [];
    const foreignKeyMap = new Map<
      string,
      { columns: string[]; refTable: string; refColumns: string[] }
    >();

    for (const row of rows) {
      if (row.CONSTRAINT_TYPE === 'PRIMARY KEY' && row.COLUMN_NAME) {
        primaryKey.push(row.COLUMN_NAME);
      } else if (row.CONSTRAINT_TYPE === 'FOREIGN KEY' && row.COLUMN_NAME) {
        const refTable = `${row.ref_project}.${row.ref_dataset}.${row.ref_table}`;
        const existing = foreignKeyMap.get(refTable) ?? {
          columns: [],
          refTable,
          refColumns: [],
        };
        existing.columns.push(row.COLUMN_NAME);
        if (row.ref_column) existing.refColumns.push(row.ref_column);
        foreignKeyMap.set(refTable, existing);
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
