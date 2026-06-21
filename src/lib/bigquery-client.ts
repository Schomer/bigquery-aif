// src/lib/bigquery-client.ts
// Client-side BigQuery REST API client.
// Queries the BigQuery API directly from the browser using the user's OAuth access token.

import type { CostEstimate, CostTier } from './types';

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

export function handleAuthError() {
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem('google_access_token');
      sessionStorage.removeItem('google_access_token_expires_at');
      window.dispatchEvent(new Event('bq-auth-error'));
    } catch {}
  }
}

export function checkResponse(res: Response, data: any) {
  const errMsg = data?.error?.message ? String(data.error.message).toLowerCase() : '';
  const isAuthError =
    res.status === 401 ||
    (data?.error && (
      data.error.code === 401 ||
      errMsg.includes('invalid authentication credentials') ||
      errMsg.includes('unauthenticated') ||
      errMsg.includes('oauth 2 access token')
    ));

  if (isAuthError) {
    handleAuthError();
  }
}

function parseValue(val: any): any {
  if (val === null || val === undefined) return null;
  if (Array.isArray(val)) return val.map((v: any) => parseValue(v.v));
  if (typeof val === 'object' && val !== null) {
    if ('f' in val) return JSON.stringify(val.f);
    if ('v' in val) return parseValue(val.v);
  }
  return val;
}

// ─── Cost dry-run ─────────────────────────────────────────────────────────────

export interface DryRunResult {
  totalBytesProcessed: number;
  tier: CostTier;
  requiresConfirmation: boolean;
}

export async function dryRun(sql: string, project?: string): Promise<DryRunResult> {
  const proj = project || 'malloy-data';
  try {
    const res = await fetch(`${BQ_BASE}/projects/${proj}/jobs`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        configuration: {
          query: {
            query: sql,
            useLegacySql: false,
          },
        },
        dryRun: true,
      }),
    });

    const data = await res.json();
    checkResponse(res, data);
    if (data.error) {
      throw new Error(data.error.message);
    }

    const bytes = parseInt(
      String(data.statistics?.totalBytesProcessed || data.statistics?.query?.totalBytesProcessed || '0'),
      10
    );

    return {
      totalBytesProcessed: bytes,
      tier: bytesToTier(bytes),
      requiresConfirmation: bytesToTier(bytes) >= 3,
    };
  } catch (err: unknown) {
    throw new Error(`BigQuery dry run failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ─── Query execution ──────────────────────────────────────────────────────────

export interface QueryExecuteResult {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  jobId: string;
}

export async function executeQuery(sql: string, project?: string): Promise<QueryExecuteResult> {
  const proj = project || 'malloy-data';
  try {
    const res = await fetch(`${BQ_BASE}/projects/${proj}/queries`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        query: sql,
        useLegacySql: false,
        maximumBytesBilled: String(10 * 1024 * 1024 * 1024),
      }),
    });

    const data = await res.json();
    checkResponse(res, data);
    if (data.error) {
      throw new Error(data.error.message);
    }

    const columns = data.schema?.fields?.map((f: any) => f.name) || [];
    const rowArrays = (data.rows || []).map((row: any) =>
      columns.map((_col: string, idx: number) => parseValue(row.f[idx]?.v))
    );
    const jobId = data.jobReference?.jobId || 'client-job';

    return {
      columns,
      rows: rowArrays,
      rowCount: rowArrays.length,
      jobId,
    };
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
  const proj = project || 'malloy-data';
  try {
    const res = await fetch(`${BQ_BASE}/projects/${proj}/queries`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        query: sql,
        useLegacySql: false,
      }),
    });

    const data = await res.json();
    checkResponse(res, data);
    if (data.error) {
      throw new Error(data.error.message);
    }

    const rowsAffected = parseInt(String(data.numDmlAffectedRows || '0'), 10);
    const jobId = data.jobReference?.jobId || 'client-job';

    return {
      rowsAffected,
      jobId,
    };
  } catch (err: unknown) {
    throw new Error(`BigQuery DML failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bytesToTier(bytes: number): CostTier {
  if (bytes >= 1_099_511_627_776) return 4;
  if (bytes >= 107_374_182_400) return 3;
  if (bytes >= 1_073_741_824) return 2;
  if (bytes >= 104_857_600) return 1;
  return 0;
}

export function buildCostEstimate(dr: DryRunResult): CostEstimate {
  return {
    totalBytesProcessed: dr.totalBytesProcessed,
    tier: dr.tier,
    requiresConfirmation: dr.requiresConfirmation,
  };
}

export function setAccessToken(_token: string) { /* no-op */ }
export function getAccessToken(): string | null {
  return typeof window !== 'undefined' ? sessionStorage.getItem('google_access_token') : null;
}
