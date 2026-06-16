// src/lib/bigquery-client.ts
// BigQuery client using Google Cloud SDK.
// Authenticates using Google Application Default Credentials (ADC) by default,
// or falls back to an environment-provided GOOGLE_ACCESS_TOKEN if present (e.g. for local dev).

import { BigQuery } from '@google-cloud/bigquery';
import { OAuth2Client } from 'google-auth-library';
import type { CostEstimate, CostTier } from './types';

const PROJECT = process.env.GOOGLE_PROJECT_ID ?? 'malloy-data';

function getClient(project?: string): BigQuery {
  const proj = project || PROJECT;

  // Use the access token from the environment if available (for local dev environments)
  if (process.env.GOOGLE_ACCESS_TOKEN) {
    const authClient = new OAuth2Client();
    authClient.setCredentials({
      access_token: process.env.GOOGLE_ACCESS_TOKEN,
    });
    return new BigQuery({
      projectId: proj,
      authClient,
    });
  }

  // Fallback to standard Application Default Credentials (ADC)
  return new BigQuery({ projectId: proj });
}

// ─── Cost dry-run ─────────────────────────────────────────────────────────────

export interface DryRunResult {
  totalBytesProcessed: number;
  tier: CostTier;
  requiresConfirmation: boolean;
}

export async function dryRun(sql: string, project?: string): Promise<DryRunResult> {
  const proj = project || PROJECT;
  try {
    const client = getClient(proj);
    const [job] = await client.createQueryJob({ query: sql, dryRun: true, location: 'US' });
    const bytes = parseInt(String(job.metadata?.statistics?.totalBytesProcessed ?? '0'), 10);
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
  const proj = project || PROJECT;
  try {
    const client = getClient(proj);
    const [rows, queryResponse] = await client.query({
      query: sql,
      location: 'US',
      maximumBytesBilled: String(10 * 1024 * 1024 * 1024),
    });
    const columns = rows.length > 0 ? Object.keys(rows[0] as Record<string, unknown>) : [];
    const rowArrays = rows.map((row: Record<string, unknown>) => columns.map((col) => row[col] ?? null));
    const jobId = (queryResponse as { jobReference?: { jobId?: string } })?.jobReference?.jobId ?? 'adc-job';
    return { columns, rows: rowArrays, rowCount: rowArrays.length, jobId };
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
  const proj = project || PROJECT;
  try {
    const client = getClient(proj);
    const [job] = await client.createQueryJob({ query: sql, location: 'US' });
    await job.getQueryResults();
    const rowsAffected = parseInt(String(job.metadata?.statistics?.query?.numDmlAffectedRows ?? '0'), 10);
    return { rowsAffected, jobId: job.id ?? 'adc-job' };
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

// ─── Legacy exports (kept for compatibility) ──────────────────────────────────
export function setAccessToken(_token: string) { /* no-op */ }
export function getAccessToken(): string | null { return null; }
