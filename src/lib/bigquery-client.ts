// src/lib/bigquery-client.ts
// Client-side BigQuery REST API calls using the user's OAuth access token.

import { getAccessToken, setAccessToken } from './gis-auth';
import type { CostEstimate, CostTier } from './types';

const BQ_BASE = 'https://bigquery.googleapis.com/bigquery/v2/projects';

// ── Cost tiers ───────────────────────────────────────────────────────────────

function classifyTier(bytes: number): CostTier {
  if (bytes <= 0) return 0;
  const mb = bytes / (1024 * 1024);
  if (mb < 10) return 1;
  if (mb < 500) return 2;
  if (mb < 5000) return 3;
  return 4;
}

// ── Shared fetch helper ──────────────────────────────────────────────────────

async function bqFetch(url: string, init?: RequestInit): Promise<any> {
  const token = getAccessToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    const msg = data?.error?.message || data?.error || `HTTP ${res.status}`;
    checkAuthError(res.status, data);
    throw new Error(String(msg));
  }
  return data;
}

function checkAuthError(status: number, data: any) {
  const errMsg = data?.error?.message ? String(data.error.message).toLowerCase() : '';
  const isAuth =
    status === 401 ||
    errMsg.includes('invalid authentication credentials') ||
    errMsg.includes('unauthenticated') ||
    errMsg.includes('oauth 2 access token');
  if (isAuth) {
    handleAuthError();
  }
}

export function handleAuthError() {
  // Clear the stale token so callers know to refresh.
  // Do NOT redirect -- let the error propagate to the UI layer
  // which will auto-refresh the token and retry.
  setAccessToken(null);
}

// ─── Region detection ─────────────────────────────────────────────────────────

const regionCache = new Map<string, string>();
let regionPromiseCache = new Map<string, Promise<string>>();

/**
 * Detect the BigQuery region for a project by inspecting its datasets.
 * Returns a lowercase location string (e.g. 'us', 'eu', 'us-central1').
 * Caches per project. Falls back to 'us' when no datasets exist.
 */
export async function detectBqRegion(project: string): Promise<string> {
  if (!project) return 'us';
  const cached = regionCache.get(project);
  if (cached) return cached;

  // Deduplicate in-flight requests for the same project
  const inflight = regionPromiseCache.get(project);
  if (inflight) return inflight;

  const promise = (async () => {
    try {
      const data = await bqFetch(
        `${BQ_BASE}/${encodeURIComponent(project)}/datasets?maxResults=1`
      );
      const datasets = data.datasets || [];
      const location = (datasets[0]?.location || 'us').toLowerCase();
      regionCache.set(project, location);
      return location;
    } catch {
      // If the API call fails, default to 'us'
      regionCache.set(project, 'us');
      return 'us';
    } finally {
      regionPromiseCache.delete(project);
    }
  })();

  regionPromiseCache.set(project, promise);
  return promise;
}

// ─── List datasets and tables via REST API ────────────────────────────────────

export async function listDatasets(project: string): Promise<Array<{ datasetId: string; id: string; location: string }>> {
  const data = await bqFetch(
    `${BQ_BASE}/${encodeURIComponent(project)}/datasets?maxResults=50`
  );
  return (data.datasets || []).map((ds: any) => ({
    datasetId: ds.datasetReference?.datasetId || '',
    id: ds.id || '',
    location: ds.location || 'US',
  }));
}

export async function listTables(project: string, datasetId: string): Promise<Array<{ tableId: string; numBytes: string; numRows: string; type: string }>> {
  const data = await bqFetch(
    `${BQ_BASE}/${encodeURIComponent(project)}/datasets/${encodeURIComponent(datasetId)}/tables?maxResults=200`
  );
  return (data.tables || []).map((t: any) => ({
    tableId: t.tableReference?.tableId || '',
    numBytes: t.numBytes || '0',
    numRows: t.numRows || '0',
    type: t.type || 'TABLE',
  }));
}

export async function createDataset(
  project: string,
  datasetId: string,
  description?: string,
  location?: string,
): Promise<{ datasetId: string; location: string }> {
  const loc = location || await detectBqRegion(project);
  const data = await bqFetch(
    `${BQ_BASE}/${encodeURIComponent(project)}/datasets`,
    {
      method: 'POST',
      body: JSON.stringify({
        datasetReference: { projectId: project, datasetId },
        location: loc,
        ...(description ? { description } : {}),
      }),
    },
  );
  return {
    datasetId: data.datasetReference?.datasetId || datasetId,
    location: data.location || loc,
  };
}

// ─── Parse BigQuery query response into flat rows ─────────────────────────────

// BigQuery field types that should be coerced to JS numbers.
const NUMERIC_TYPES = new Set([
  'INTEGER', 'INT64', 'FLOAT', 'FLOAT64', 'NUMERIC', 'BIGNUMERIC',
]);
const BOOLEAN_TYPES = new Set(['BOOLEAN', 'BOOL']);

function coerceValue(raw: string | null, fieldType: string): unknown {
  if (raw === null || raw === undefined) return null;
  // RECORD/STRUCT fields come back as nested objects, not strings.
  // Stringify them so downstream renderers never try to render a plain object.
  if (typeof raw === 'object') return JSON.stringify(raw);
  const upper = fieldType.toUpperCase();
  if (NUMERIC_TYPES.has(upper)) {
    const n = Number(raw);
    return isNaN(n) ? raw : n;
  }
  if (BOOLEAN_TYPES.has(upper)) {
    return raw === 'true' || raw === 'TRUE' || raw === 'True' || raw === '1';
  }
  return raw;
}

function parseQueryResponse(data: any): {
  columns: string[];
  columnTypes: string[];
  rows: unknown[][];
  rowCount: number;
  jobId: string;
} {
  const fields = data.schema?.fields ?? [];
  const columns = fields.map((f: any) => f.name);
  const fieldTypes: string[] = fields.map((f: any) => f.type ?? 'STRING');
  const rawRows = data.rows ?? [];
  const rows = rawRows.map((r: any) =>
    (r.f ?? []).map((cell: any, i: number) =>
      coerceValue(cell.v ?? null, fieldTypes[i] ?? 'STRING')
    )
  );
  return {
    columns,
    columnTypes: fieldTypes,
    rows,
    rowCount: parseInt(data.totalRows ?? '0', 10),
    jobId: data.jobReference?.jobId ?? '',
  };
}

// ─── Cost dry-run ─────────────────────────────────────────────────────────────

export interface DryRunResult {
  totalBytesProcessed: number;
  tier: CostTier;
  requiresConfirmation: boolean;
}

export async function dryRun(sql: string, project?: string): Promise<DryRunResult> {
  const projectId = project || '';
  try {
    const data = await bqFetch(`${BQ_BASE}/${encodeURIComponent(projectId)}/jobs`, {
      method: 'POST',
      body: JSON.stringify({
        configuration: {
          query: {
            query: sql,
            useLegacySql: false,
            dryRun: true,
          },
        },
      }),
    });
    const bytes = parseInt(data.statistics?.query?.totalBytesProcessed ?? '0', 10);
    const tier = classifyTier(bytes);
    return {
      totalBytesProcessed: bytes,
      tier,
      requiresConfirmation: tier >= 3,
    };
  } catch (err: unknown) {
    throw new Error(`BigQuery dry run failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ─── Query execution ──────────────────────────────────────────────────────────

export interface QueryExecuteResult {
  columns: string[];
  /** Authoritative BigQuery field types parallel to columns (e.g. 'STRING', 'INTEGER', 'DATE', 'TIMESTAMP'). */
  columnTypes: string[];
  rows: unknown[][];
  rowCount: number;
  jobId: string;
}

export async function executeQuery(sql: string, project?: string): Promise<QueryExecuteResult> {
  const projectId = project || '';
  try {
    const data = await bqFetch(`${BQ_BASE}/${encodeURIComponent(projectId)}/queries`, {
      method: 'POST',
      body: JSON.stringify({
        query: sql,
        useLegacySql: false,
        maxResults: 1000,
      }),
    });
    return parseQueryResponse(data);
  } catch (err: unknown) {
    throw new Error(`BigQuery query failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ─── DML execution ────────────────────────────────────────────────────────────

export interface DmlResult {
  rowsAffected: number;
  jobId: string;
}

export async function executeDml(sql: string, project?: string): Promise<DmlResult> {
  const projectId = project || '';
  try {
    const data = await bqFetch(`${BQ_BASE}/${encodeURIComponent(projectId)}/jobs`, {
      method: 'POST',
      body: JSON.stringify({
        configuration: {
          query: {
            query: sql,
            useLegacySql: false,
          },
        },
      }),
    });
    // Poll for completion if needed
    let job = data;
    const jobId = job.jobReference?.jobId ?? '';
    while (job.status?.state !== 'DONE') {
      await new Promise((r) => setTimeout(r, 1000));
      job = await bqFetch(
        `${BQ_BASE}/${encodeURIComponent(projectId)}/jobs/${encodeURIComponent(jobId)}`
      );
    }
    if (job.status?.errors?.length) {
      throw new Error(job.status.errors[0].message);
    }
    const affected = parseInt(job.statistics?.query?.numDmlAffectedRows ?? '0', 10);
    return { rowsAffected: affected, jobId };
  } catch (err: unknown) {
    throw new Error(`BigQuery DML failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function buildCostEstimate(dr: DryRunResult): CostEstimate {
  return {
    totalBytesProcessed: dr.totalBytesProcessed,
    tier: dr.tier,
    requiresConfirmation: dr.requiresConfirmation,
  };
}

export { getAccessToken } from './gis-auth';


export function checkResponse(res: Response, data: any) {
  checkAuthError(res.status, data);
}

// ─── Job details (W2-08: real QUERY_PLAN) ─────────────────────────────────────

export interface QueryPlanStage {
  name: string;
  status: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  inputSteps: number;
  outputRows: number;
  shuffleOutputBytes: number;
}

export interface JobDetails {
  jobId: string;
  status: string;
  createTime: string;
  startTime: string;
  endTime: string;
  totalBytesProcessed: number;
  totalSlotMs: number;
  statementType: string;
  queryPlan: QueryPlanStage[];
  referencedTables: string[];
  query?: string;
}

export async function getJobDetails(project: string, jobId: string): Promise<JobDetails | null> {
  try {
    // Job IDs from INFORMATION_SCHEMA are in format "project:location.jobId"
    // Extract just the bare jobId part for the REST API
    const bareJobId = jobId.includes('.') ? jobId.split('.').pop()! : jobId;
    const data = await bqFetch(
      `${BQ_BASE}/${encodeURIComponent(project)}/jobs/${encodeURIComponent(bareJobId)}?projection=full`
    );

    const stats = data.statistics ?? {};
    const qStats = stats.query ?? {};

    const stages: QueryPlanStage[] = (qStats.queryPlan ?? []).map((s: any) => {
      const startMs = Number(s.startMs ?? 0);
      const endMs = Number(s.endMs ?? 0);
      return {
        name: s.name ?? `Stage ${s.id}`,
        status: s.status ?? 'COMPLETE',
        startMs,
        endMs,
        durationMs: endMs - startMs,
        inputSteps: Number(s.inputSteps ?? 0),
        outputRows: Number(s.recordsWritten ?? 0),
        shuffleOutputBytes: Number(s.shuffleOutputBytes ?? 0),
      };
    });

    const refTables: string[] = (qStats.referencedTables ?? []).map(
      (t: any) => `${t.projectId}.${t.datasetId}.${t.tableId}`
    );

    return {
      jobId: data.jobReference?.jobId ?? jobId,
      status: data.status?.state ?? 'UNKNOWN',
      createTime: stats.creationTime ? new Date(Number(stats.creationTime)).toISOString() : '',
      startTime: stats.startTime ? new Date(Number(stats.startTime)).toISOString() : '',
      endTime: stats.endTime ? new Date(Number(stats.endTime)).toISOString() : '',
      totalBytesProcessed: Number(stats.query?.totalBytesProcessed ?? stats.totalBytesProcessed ?? 0),
      totalSlotMs: Number(stats.totalSlotMs ?? 0),
      statementType: qStats.statementType ?? 'SELECT',
      queryPlan: stages,
      referencedTables: refTables,
      query: data.configuration?.query?.query,
    };
  } catch (err) {
    console.warn('[getJobDetails]', err);
    return null;
  }
}


// ─── Google Sheets export ─────────────────────────────────────────────────────

export async function exportToSheets(
  title: string,
  columns: string[],
  rows: unknown[][],
): Promise<{ spreadsheetUrl: string }> {
  const totalCells = columns.length * (rows.length + 1);
  if (totalCells > 10_000_000) {
    throw new Error(`Result exceeds the 10 million cell limit for Google Sheets (${totalCells.toLocaleString()} cells). Use CSV export instead.`);
  }

  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated. Please sign in again.');

  // Create a new spreadsheet
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      properties: { title },
      sheets: [{ properties: { title: 'Query Results' } }],
    }),
  });
  const createData = await createRes.json();
  if (!createRes.ok) {
    const msg = createData?.error?.message || `HTTP ${createRes.status}`;
    throw new Error(`Failed to create spreadsheet: ${msg}`);
  }

  const spreadsheetId = createData.spreadsheetId;
  const spreadsheetUrl = createData.spreadsheetUrl;

  // Write data: header row + data rows
  const values = [
    columns,
    ...rows.map((row) => row.map((cell) => {
      if (cell === null || cell === undefined) return '';
      if (typeof cell === 'object') return JSON.stringify(cell);
      return cell;
    })),
  ];

  const writeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Query%20Results!A1?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ range: 'Query Results!A1', values }),
    },
  );
  if (!writeRes.ok) {
    const writeData = await writeRes.json();
    throw new Error(`Failed to write data to spreadsheet: ${writeData?.error?.message || `HTTP ${writeRes.status}`}`);
  }

  return { spreadsheetUrl };
}

// ─── Scheduled Query ──────────────────────────────────────────────────────────

export async function createScheduledQuery(
  project: string,
  displayName: string,
  sql: string,
  schedule: string,
  enableFailureEmail?: boolean,
): Promise<{ transferConfigName: string }> {
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated. Please sign in again.');

  const url = `https://bigquerydatatransfer.googleapis.com/v1/projects/${project}/locations/us/transferConfigs`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      dataSourceId: 'scheduled_query',
      displayName,
      schedule,
      params: { query: sql },
      ...(enableFailureEmail ? { emailPreferences: { enableFailureEmail: true } } : {}),
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    throw new Error(`Failed to create scheduled query: ${msg}`);
  }

  return { transferConfigName: data.name || displayName };
}

// ─── Extract Job (Server-side export to GCS) ──────────────────────────────────

export type ExportFormat = 'CSV' | 'NEWLINE_DELIMITED_JSON' | 'AVRO' | 'PARQUET';

export async function createExtractJob(
  project: string,
  datasetId: string,
  tableId: string,
  destinationUri: string,
  format: ExportFormat = 'CSV',
): Promise<{ jobId: string; destinationUri: string }> {
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated. Please sign in again.');

  const url = `${BQ_BASE}/${encodeURIComponent(project)}/jobs`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      configuration: {
        extract: {
          sourceTable: {
            projectId: project,
            datasetId,
            tableId,
          },
          destinationUris: [destinationUri],
          destinationFormat: format,
          compression: format === 'CSV' || format === 'NEWLINE_DELIMITED_JSON' ? 'GZIP' : 'NONE',
          ...(format === 'CSV' ? { printHeader: true, fieldDelimiter: ',' } : {}),
        },
      },
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    throw new Error(`Failed to create extract job: ${msg}`);
  }

  return {
    jobId: data.jobReference?.jobId || '',
    destinationUri,
  };
}

// ─── CSV Upload (Load Job) ────────────────────────────────────────────────────

export interface LoadCsvResult {
  jobId: string;
  rowCount: number;
  tableRef: string;
}

/**
 * Upload CSV content to a BigQuery table via the Jobs API multipart upload.
 * Creates the table if it doesn't exist (autodetect schema).
 * Runs entirely client-side using the user's OAuth token.
 */
export async function loadCsvToTable(
  project: string,
  datasetId: string,
  tableId: string,
  csvContent: string,
  writeDisposition: 'WRITE_APPEND' | 'WRITE_TRUNCATE' | 'WRITE_EMPTY' = 'WRITE_APPEND',
): Promise<LoadCsvResult> {
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated. Please sign in again.');

  const boundary = '=====bigqueryaif_upload_boundary=====';

  const jobConfig = {
    configuration: {
      load: {
        destinationTable: {
          projectId: project,
          datasetId,
          tableId,
        },
        sourceFormat: 'CSV',
        autodetect: true,
        skipLeadingRows: 1,
        writeDisposition,
        allowQuotedNewlines: true,
        allowJaggedRows: true,
      },
    },
  };

  // Build multipart/related body per BigQuery upload API spec
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(jobConfig),
    `--${boundary}`,
    'Content-Type: application/octet-stream',
    '',
    csvContent,
    `--${boundary}--`,
  ].join('\r\n');

  const uploadUrl = `https://bigquery.googleapis.com/upload/bigquery/v2/projects/${encodeURIComponent(project)}/jobs?uploadType=multipart`;

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    const msg = data?.error?.message || data?.error || `HTTP ${res.status}`;
    checkAuthError(res.status, data);
    throw new Error(String(msg));
  }

  // Poll for completion (same pattern as executeDml)
  let job = data;
  const jobId = job.jobReference?.jobId ?? '';
  while (job.status?.state !== 'DONE') {
    await new Promise((r) => setTimeout(r, 1500));
    job = await bqFetch(
      `${BQ_BASE}/${encodeURIComponent(project)}/jobs/${encodeURIComponent(jobId)}`
    );
  }
  if (job.status?.errors?.length) {
    throw new Error(job.status.errors[0].message);
  }

  const outputRows = parseInt(
    job.statistics?.load?.outputRows ?? job.statistics?.query?.numDmlAffectedRows ?? '0',
    10,
  );

  return {
    jobId,
    rowCount: outputRows,
    tableRef: `${project}.${datasetId}.${tableId}`,
  };
}
