// src/app/api/chat/route.ts
// Per-turn orchestration: receive message → router → skill dispatch → compose → return envelopes

import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

import { classifyIntent, resolveReferences } from '@/lib/router';
import { fetchSchema } from '@/lib/skills/schema';
import { compose } from '@/lib/composer';
import { invalidateCache } from '@/lib/schema-cache';
import { dryRun, executeQuery, executeDml } from '@/lib/bigquery-client';
import type {
  ChatMessage,
  CompositionEnvelope,
  DataManagementResult,
  DataQualityResult,
  DqFinding,
  MonitoringJob,
  MonitoringResult,
  DiscoveryResult,
  DiscoverySearchResult,
  DataLoadingResult,
  SkillName,
  QueryResult,
} from '@/lib/types';

// ─── Load skill docs ──────────────────────────────────────────────────────────

function loadSkillDoc(skillName: string): string {
  try {
    const path = join(process.cwd(), 'skills', `${skillName}.md`);
    return readFileSync(path, 'utf-8');
  } catch {
    return `You are the ${skillName} skill. Help the user with their data request.`;
  }
}

// ─── LLM response schemas ─────────────────────────────────────────────────────

const SchemaResponseSchema = z.object({
  scope: z.enum(['PROJECT', 'DATASET', 'TABLE']),
  dataset: z.string().optional().nullable(),
  table: z.string().optional().nullable(),
});

const QueryResponseSchema = z.object({
  sql: z.string(),
  suggestedVisualization: z.enum(['TABLE', 'LINE_CHART', 'BAR_CHART', 'AREA_CHART', 'SCATTER', 'PIE_CHART', 'KPI_CARD']),
  xAxis: z.string().optional().nullable(),
  yAxis: z.array(z.string()).optional().nullable(),
  notableFindings: z.string().optional().nullable(),
});

const DataManagementResponseSchema = z.object({
  operation: z.enum(['DEDUPE', 'DELETE', 'UPDATE', 'FILL_NULLS', 'CREATE_TABLE', 'ALTER_TABLE', 'CREATE_VIEW', 'RENAME', 'COPY_TABLE']),
  dataset: z.string(),
  table: z.string(),
  previewSql: z.string(),
  executionSql: z.string(),
  tiebreakerColumn: z.string().optional().nullable(),
  tiebreakerDirection: z.enum(['KEEP_LATEST', 'KEEP_EARLIEST']).optional().nullable(),
});

const DiscoveryResponseSchema = z.object({
  discoveryType: z.enum(['SEARCH', 'COMPARISON']),
  query: z.string(),
  secondTable: z.string().optional().nullable(),
});

// ─── POST /api/chat ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      message: string;
      history: ChatMessage[];
      context?: {
        lastSkill?: SkillName;
        lastResultRef?: string;
        lastTable?: string;
        project?: string;
        dataset?: string;
        confirmedPayload?: DataManagementResult;
      };
    };

    const { message, history, context } = body;

    // ── Handle confirmation responses ───────────────────────────────────────
    if (context?.confirmedPayload && 'executionSql' in context.confirmedPayload) {
      const confirmed = context.confirmedPayload;
      const project = context?.project || process.env.GOOGLE_PROJECT_ID || '';
      const envelopes = await executeConfirmedOperation(confirmed, project);
      return NextResponse.json({ envelopes });
    }

    // ── Resolve referential language ─────────────────────────────────────────
    const resolvedMessage = resolveReferences(message, context);

    // ── Classify intent ───────────────────────────────────────────────────────
    const routerOutput = classifyIntent(resolvedMessage, context);
    const skill = routerOutput.skill;

    // ── Dispatch to skill ─────────────────────────────────────────────────────
    let envelopes: CompositionEnvelope[] = [];

    switch (skill) {
      case 'schema':
        envelopes = await handleSchema(resolvedMessage, context);
        break;
      case 'query':
        envelopes = await handleQuery(resolvedMessage, history, context);
        break;
      case 'data-management':
        envelopes = await handleDataManagement(resolvedMessage, history, context);
        break;
      case 'data-quality':
        envelopes = await handleDataQuality(resolvedMessage, context);
        break;
      case 'monitoring':
        envelopes = await handleMonitoring(resolvedMessage, context);
        break;
      case 'discovery':
        envelopes = await handleDiscovery(resolvedMessage, context);
        break;
      case 'data-loading':
        envelopes = await handleDataLoading(resolvedMessage, context);
        break;
      default:
        envelopes = await handleQuery(resolvedMessage, history, context);
    }

    return NextResponse.json({ envelopes, skill });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[chat/route] Error:', msg);
    // Surface token/auth/permission errors as 401
    if (msg.includes('access token') || msg.includes('credentials') || msg.includes('access_denied') || msg.includes('UNAUTHENTICATED')) {
      return NextResponse.json(
        { error: 'Not authenticated', detail: msg },
        { status: 401 }
      );
    }
    // Surface quota/rate-limit errors as 429
    if (msg.includes('quota') || msg.includes('rate limit') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
      console.error('[chat/route] Rate limit detail:', msg);
      return NextResponse.json(
        { error: 'Rate limited', detail: `Gemini API rate limit: ${msg}` },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to process request', detail: msg },
      { status: 500 }
    );
  }
}

// ─── Schema handler ────────────────────────────────────────────────────────────

async function handleSchema(
  message: string,
  context?: { project?: string; dataset?: string }
): Promise<CompositionEnvelope[]> {
  const skillDoc = loadSkillDoc('schema');
  const project = context?.project || process.env.GOOGLE_PROJECT_ID || '';

  const { object: intent } = await generateObject({ maxRetries: 2,
    model: google('gemini-3.5-flash'),
    system: `${skillDoc}\n\nExtract the requested scope from the user's message. Dataset and table should be the BigQuery identifiers mentioned. If none mentioned, return null. The active project is: ${project}${context?.dataset ? `. The active dataset context is: ${context.dataset}` : ''}.`,
    prompt: message,
    schema: SchemaResponseSchema,
  });

  const result = await fetchSchema(
    intent.dataset ?? context?.dataset ?? undefined,
    intent.table ?? undefined,
    project,
  );

  const envelope = compose('schema', result);
  return [envelope];
}

// ─── Query handler ────────────────────────────────────────────────────────────

async function handleQuery(
  message: string,
  history: ChatMessage[],
  context?: { project?: string; dataset?: string; lastTable?: string }
): Promise<CompositionEnvelope[]> {
  const skillDoc = loadSkillDoc('query');
  const project = context?.project ?? process.env.GOOGLE_PROJECT_ID ?? '';
  const dataset = context?.dataset ?? process.env.BQ_DATASET ?? '';

  const messages = history.slice(-6).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  const { object: queryPlan } = await generateObject({ maxRetries: 2,
    model: google('gemini-3.5-flash'),
    system: `${skillDoc}

The BigQuery project is: ${project}
The default dataset is: ${dataset}
Always use fully qualified table references: \`${project}.${dataset}.tablename\`
Today's date is: ${new Date().toISOString().split('T')[0]}`,
    messages: [...messages, { role: 'user' as const, content: message }],
    schema: QueryResponseSchema,
  });

  const costResult = await dryRun(queryPlan.sql, project);

  if (costResult.requiresConfirmation) {
    const result: QueryResult = {
      skill: 'query',
      sql: queryPlan.sql,
      requiresConfirmation: true,
      costConfirm: {
        totalBytesProcessed: costResult.totalBytesProcessed,
        tier: costResult.tier,
        requiresConfirmation: true,
      },
      columns: [],
      rows: [],
      rowCount: 0,
      totalBytesProcessed: costResult.totalBytesProcessed,
      costTier: costResult.tier,
      suggestedVisualization: 'TABLE',
      notableFindings: null,
    };
    return [compose('query', result)];
  }

  const executed = await executeQuery(queryPlan.sql, project);

  const result: QueryResult = {
    skill: 'query',
    sql: queryPlan.sql,
    requiresConfirmation: false,
    costConfirm: null,
    columns: executed.columns,
    rows: executed.rows,
    rowCount: executed.rowCount,
    totalBytesProcessed: costResult.totalBytesProcessed,
    costTier: costResult.tier,
    suggestedVisualization: queryPlan.suggestedVisualization,
    xAxis: queryPlan.xAxis ?? null,
    yAxis: queryPlan.yAxis ?? null,
    notableFindings: queryPlan.notableFindings ?? null,
  };

  return [compose('query', result)];
}

// ─── Data Management handler ───────────────────────────────────────────────────

async function handleDataManagement(
  message: string,
  history: ChatMessage[],
  context?: { project?: string; dataset?: string }
): Promise<CompositionEnvelope[]> {
  const skillDoc = loadSkillDoc('data-management');
  const project = context?.project ?? process.env.GOOGLE_PROJECT_ID ?? '';
  const dataset = context?.dataset ?? process.env.BQ_DATASET ?? '';

  const messages = history.slice(-6).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  const { object: plan } = await generateObject({ maxRetries: 2,
    model: google('gemini-3.5-flash'),
    system: `${skillDoc}

The BigQuery project is: ${project}
The default dataset is: ${dataset}
Always use fully qualified table references: \`${project}.${dataset}.tablename\``,
    messages: [...messages, { role: 'user' as const, content: message }],
    schema: DataManagementResponseSchema,
  });

  // Run preview query
  const previewResult = await executeQuery(plan.previewSql, project);
  const affectedRowCount = previewResult.rows[0]?.[0]
    ? Number(previewResult.rows[0][0])
    : 0;

  // For DEDUPE: fetch one example group
  let exampleGroup = undefined;
  let snapshotRowIds: number[] = [];
  let affectedGroupCount = undefined;

  if (plan.operation === 'DEDUPE' && plan.tiebreakerColumn) {
    const exampleSql = `
      WITH ranked AS (
        SELECT *, ROW_NUMBER() OVER (
          PARTITION BY id
          ORDER BY ${plan.tiebreakerColumn} ${plan.tiebreakerDirection === 'KEEP_LATEST' ? 'DESC' : 'ASC'}
        ) AS rn
        FROM \`${project}.${dataset}.${plan.table}\`
        WHERE id IN (
          SELECT id FROM \`${project}.${dataset}.${plan.table}\`
          GROUP BY id HAVING COUNT(*) > 1
          LIMIT 1
        )
      )
      SELECT * FROM ranked
    `;

    try {
      const exampleResult = await executeQuery(exampleSql);
      if (exampleResult.rows.length > 0) {
        const toObj = (row: unknown[]) =>
          Object.fromEntries(exampleResult.columns.map((c, i) => [c, row[i]]));
        const keepRow = toObj(exampleResult.rows[0]);
        const removeRows = exampleResult.rows.slice(1).map(toObj);
        exampleGroup = {
          keyValue: { id: keepRow['id'] },
          keepRow,
          removeRows,
        };
      }
    } catch {
      // Non-fatal — confirmation card still works without example
    }

    // Count groups
    const groupCountSql = `
      SELECT COUNT(DISTINCT id) as group_count
      FROM \`${project}.${dataset}.${plan.table}\`
      GROUP BY id HAVING COUNT(*) > 1
    `;
    try {
      const groupResult = await executeQuery(
        `SELECT COUNT(*) as group_count FROM (${groupCountSql})`,
      );
      affectedGroupCount = Number(groupResult.rows[0]?.[0] ?? 0);
    } catch { /* ignore */ }
  }

  // Cost estimate
  const costResult = await dryRun(plan.executionSql, project);

  const confirmResult: DataManagementResult = {
    skill: 'data-management',
    requiresConfirmation: true,
    operation: plan.operation,
    previewSql: plan.previewSql,
    affectedRowCount,
    affectedGroupCount,
    exampleGroup,
    costEstimate: costResult,
    tiebreakerColumn: plan.tiebreakerColumn ?? undefined,
    tiebreakerDirection: plan.tiebreakerDirection ?? undefined,
    executionSql: plan.executionSql,
    snapshotRowIds,
  };

  return [compose('data-management', confirmResult)];
}

// ─── Execute confirmed operation ───────────────────────────────────────────────

async function executeConfirmedOperation(
  confirmed: DataManagementResult,
  project?: string
): Promise<CompositionEnvelope[]> {
  if (!confirmed.requiresConfirmation) return [];

  const dmlResult = await executeDml(
    confirmed.executionSql,
    project,
  );

  const mismatch = dmlResult.rowsAffected !== confirmed.affectedRowCount;

  const completeResult: DataManagementResult = {
    skill: 'data-management',
    requiresConfirmation: false,
    operation: confirmed.operation,
    rowsAffected: dmlResult.rowsAffected,
    rowsExpected: confirmed.affectedRowCount,
    mismatch,
    mismatchNote: mismatch
      ? `Removed ${dmlResult.rowsAffected} of the ${confirmed.affectedRowCount} rows — the other ${confirmed.affectedRowCount - dmlResult.rowsAffected} no longer matched by the time this ran.`
      : null,
    schemaInvalidated: [],
    jobId: dmlResult.jobId,
  };

  return [compose('data-management', completeResult)];
}

// ─── Monitoring handler ────────────────────────────────────────────────────────

async function handleMonitoring(
  _message: string,
  context?: { project?: string }
): Promise<CompositionEnvelope[]> {
  const project = context?.project ?? process.env.GOOGLE_PROJECT_ID ?? '';
  const sql = `SELECT job_id, user_email, statement_type, state, creation_time, total_bytes_processed, error_result, referenced_tables FROM \`region-us\`.INFORMATION_SCHEMA.JOBS_BY_PROJECT WHERE creation_time > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR) ORDER BY creation_time DESC LIMIT 50`;

  const executed = await executeQuery(sql, project);

  // Map column indices
  const idx = (name: string) => executed.columns.indexOf(name);
  const iJobId       = idx('job_id');
  const iEmail       = idx('user_email');
  const iType        = idx('statement_type');
  const iState       = idx('state');
  const iCreateTime  = idx('creation_time');
  const iBytes       = idx('total_bytes_processed');
  const iError       = idx('error_result');
  const iTables      = idx('referenced_tables');

  const items: MonitoringJob[] = executed.rows.map((row) => {
    const stateVal = String(row[iState] ?? '').toUpperCase();
    const status: MonitoringJob['status'] =
      stateVal === 'RUNNING' ? 'RUNNING'
      : stateVal === 'DONE' && row[iError] != null ? 'ERROR'
      : 'DONE';

    let errorMessage: string | null = null;
    if (row[iError] != null) {
      try {
        const parsed = typeof row[iError] === 'string' ? JSON.parse(row[iError] as string) : row[iError];
        errorMessage = parsed?.message ?? String(row[iError]);
      } catch {
        errorMessage = String(row[iError]);
      }
    }

    let referencedTables: string[] = [];
    if (row[iTables] != null) {
      try {
        const parsed = typeof row[iTables] === 'string' ? JSON.parse(row[iTables] as string) : row[iTables];
        if (Array.isArray(parsed)) {
          referencedTables = parsed.map((t: { projectId?: string; datasetId?: string; tableId?: string }) =>
            [t.projectId, t.datasetId, t.tableId].filter(Boolean).join('.')
          );
        }
      } catch {
        // non-fatal — leave as empty array
      }
    }

    return {
      jobId: String(row[iJobId] ?? ''),
      userEmail: String(row[iEmail] ?? ''),
      statementType: String(row[iType] ?? ''),
      status,
      createTime: String(row[iCreateTime] ?? ''),
      totalBytesProcessed: Number(row[iBytes] ?? 0),
      errorMessage,
      referencedTables,
    };
  });

  const now = new Date();
  const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const result: MonitoringResult = {
    skill: 'monitoring',
    monitoringType: 'JOB_LIST',
    timeRange: { start: start.toISOString(), end: now.toISOString() },
    items,
    summary: {
      totalJobs: items.length,
      totalBytesProcessed: items.reduce((acc, j) => acc + j.totalBytesProcessed, 0),
      errorCount: items.filter((j) => j.status === 'ERROR').length,
    },
  };

  return [compose('monitoring', result)];
}

// ─── Data Quality handler ──────────────────────────────────────────────────────

const DqIntentSchema = z.object({
  checkType: z.enum(['PROFILE', 'NULLS', 'DUPLICATES', 'FRESHNESS']),
  table: z.string().nullable().optional(),
  dataset: z.string().nullable().optional(),
});

async function handleDataQuality(
  message: string,
  context?: { project?: string; dataset?: string; lastTable?: string }
): Promise<CompositionEnvelope[]> {
  const project = context?.project ?? process.env.GOOGLE_PROJECT_ID ?? '';
  const dataset = context?.dataset ?? process.env.BQ_DATASET ?? '';

  const { object: intent } = await generateObject({ maxRetries: 2,
    model: google('gemini-3.5-flash'),
    system: `You classify BigQuery data quality requests. Extract check type and table name. Available check types: PROFILE (general stats), NULLS (null analysis), DUPLICATES (find duplicate rows), FRESHNESS (when was the table last updated). The active project is ${project}, default dataset is ${dataset}.`,
    prompt: message,
    schema: DqIntentSchema,
  });

  const tableName = intent.table ?? context?.lastTable ?? null;
  const ds = intent.dataset ?? dataset;
  const checkedAt = new Date().toISOString();

  // FRESHNESS — no query needed, use schema metadata
  if (intent.checkType === 'FRESHNESS') {
    const schema = await fetchSchema(ds, tableName ?? undefined, project);
    const lastMod = schema.lastModifiedTime ?? 'unknown';
    const ageMs = lastMod !== 'unknown' ? Date.now() - new Date(lastMod).getTime() : null;
    const ageHours = ageMs !== null ? Math.round(ageMs / 3_600_000) : null;
    const severity: DqFinding['severity'] = ageHours === null ? 'INFO' : ageHours > 48 ? 'ISSUE' : ageHours > 24 ? 'WARNING' : 'INFO';
    const result: DataQualityResult = {
      skill: 'data-quality',
      checkType: 'FRESHNESS',
      table: `${project}.${ds}.${tableName ?? ''}`,
      sql: '',
      findings: [{
        column: '_table',
        metric: 'last_modified',
        value: lastMod,
        severity,
      }],
      summary: { rowsScanned: 0, issuesFound: severity !== 'INFO' ? 1 : 0, checkedAt },
    };
    return [compose('data-quality', result)];
  }

  if (!tableName) {
    return [compose('data-quality', {
      skill: 'data-quality', checkType: intent.checkType,
      table: `${project}.${ds}.<table>`, sql: '',
      findings: [{ column: '_', metric: 'error', value: 'No table name found — please specify a table', severity: 'INFO' }],
      summary: { rowsScanned: 0, issuesFound: 0, checkedAt },
    } as DataQualityResult)];
  }

  const fqTable = `\`${project}.${ds}.${tableName}\``;

  // Fetch schema to get column names + types
  const schema = await fetchSchema(ds, tableName, project);
  const columns = schema.columns.filter((c) => !['RECORD', 'REPEATED'].includes(c.type));

  let sql = '';
  const findings: DqFinding[] = [];

  if (intent.checkType === 'DUPLICATES') {
    // Find key-like columns
    const keyCol = columns.find((c) => c.name === 'id' || c.name.endsWith('_id') || c.name.endsWith('_key'))?.name ?? columns[0]?.name;
    if (!keyCol) {
      return [compose('data-quality', { skill: 'data-quality', checkType: 'DUPLICATES', table: fqTable, sql: '', findings: [], summary: { rowsScanned: 0, issuesFound: 0, checkedAt } } as DataQualityResult)];
    }
    sql = `SELECT ${keyCol}, COUNT(*) as duplicate_count FROM ${fqTable} GROUP BY ${keyCol} HAVING COUNT(*) > 1 ORDER BY duplicate_count DESC LIMIT 50`;
    const executed = await executeQuery(sql, project);
    const dupCount = executed.rowCount;
    if (dupCount > 0) {
      findings.push({ column: keyCol, metric: 'duplicate_groups', value: dupCount, severity: 'ISSUE' });
    }
    const result: DataQualityResult = {
      skill: 'data-quality', checkType: 'DUPLICATES', table: fqTable, sql,
      findings,
      summary: { rowsScanned: executed.rowCount, issuesFound: dupCount > 0 ? 1 : 0, checkedAt },
    };
    return [compose('data-quality', result)];
  }

  // PROFILE or NULLS — build a single batched query
  const exprs = columns.flatMap((col) => {
    const base = [
      `COUNTIF(${col.name} IS NULL) AS \`${col.name}__nulls\``,
    ];
    if (intent.checkType === 'PROFILE') {
      if (['INT64', 'FLOAT64', 'NUMERIC', 'BIGNUMERIC', 'INTEGER', 'FLOAT'].includes(col.type)) {
        base.push(
          `MIN(CAST(${col.name} AS FLOAT64)) AS \`${col.name}__min\``,
          `MAX(CAST(${col.name} AS FLOAT64)) AS \`${col.name}__max\``,
          `AVG(CAST(${col.name} AS FLOAT64)) AS \`${col.name}__avg\``,
        );
      }
      base.push(`APPROX_COUNT_DISTINCT(${col.name}) AS \`${col.name}__distinct\``);
    }
    return base;
  });

  sql = `SELECT COUNT(*) AS __total_rows, ${exprs.join(', ')} FROM ${fqTable}`;
  const executed = await executeQuery(sql, project);
  const row = executed.rows[0] ?? [];
  const colMap = Object.fromEntries(executed.columns.map((c, i) => [c, row[i]]));
  const totalRows = Number(colMap['__total_rows'] ?? 0);

  for (const col of columns) {
    const nullCount = Number(colMap[`${col.name}__nulls`] ?? 0);
    const nullRate = totalRows > 0 ? nullCount / totalRows : 0;
    const nullSeverity: DqFinding['severity'] = nullRate > 0.5 ? 'ISSUE' : nullRate > 0.1 ? 'WARNING' : 'INFO';
    findings.push({ column: col.name, metric: 'null_rate', value: parseFloat(nullRate.toFixed(4)), severity: nullSeverity });

    if (intent.checkType === 'PROFILE') {
      const distinct = Number(colMap[`${col.name}__distinct`] ?? 0);
      findings.push({ column: col.name, metric: 'distinct_count', value: distinct, severity: 'INFO' });
    }
  }

  const issueCount = findings.filter((f) => f.severity !== 'INFO').length;
  const result: DataQualityResult = {
    skill: 'data-quality', checkType: intent.checkType as DataQualityResult['checkType'],
    table: fqTable, sql,
    findings,
    summary: { rowsScanned: totalRows, issuesFound: issueCount, checkedAt },
  };
  return [compose('data-quality', result)];
}



// ─── Data Loading handler ──────────────────────────────────────────────────────

const DataLoadingIntentSchema = z.object({
  operationType: z.enum(['EXPORT_CSV', 'EXPORT_SHEETS', 'SCHEDULE']),
  tableName: z.string().nullable().optional(),
  sql: z.string().nullable().optional(),
});

async function handleDataLoading(
  message: string,
  context?: { project?: string; dataset?: string; lastTable?: string }
): Promise<CompositionEnvelope[]> {
  const project = context?.project ?? process.env.GOOGLE_PROJECT_ID ?? '';
  const dataset = context?.dataset ?? process.env.BQ_DATASET ?? '';

  const { object: intent } = await generateObject({ maxRetries: 2,
    model: google('gemini-3.5-flash'),
    system: `Classify a BigQuery data loading request. EXPORT_CSV = download as CSV. EXPORT_SHEETS = send to Google Sheets. SCHEDULE = schedule a recurring query. Extract the table name or SQL to use. Project: ${project}, dataset: ${dataset}`,
    prompt: message,
    schema: DataLoadingIntentSchema,
  });

  if (intent.operationType === 'SCHEDULE') {
    const sql = intent.sql ?? (intent.tableName ? `SELECT * FROM \`${project}.${dataset}.${intent.tableName}\`` : '');
    const result: DataLoadingResult = {
      skill: 'data-loading',
      operationType: 'SCHEDULE_INFO',
      message: 'Scheduling requires the BigQuery Data Transfer API. Copy the SQL below into BigQuery → Scheduled Queries in the Google Cloud Console.',
      sql,
    };
    return [compose('data-loading', result)];
  }

  if (intent.operationType === 'EXPORT_SHEETS') {
    const result: DataLoadingResult = {
      skill: 'data-loading',
      operationType: 'SCHEDULE_INFO',
      message: 'Google Sheets export requires additional OAuth scopes (spreadsheets) that are not yet configured. Use CSV export instead, or connect to Sheets manually from the Google Cloud Console.',
      sql: intent.sql ?? null,
    };
    return [compose('data-loading', result)];
  }

  // EXPORT_CSV — run the query and convert to CSV
  const sql = intent.sql ?? (intent.tableName
    ? `SELECT * FROM \`${project}.${dataset}.${intent.tableName}\` LIMIT 1000`
    : null);

  if (!sql) {
    const result: DataLoadingResult = {
      skill: 'data-loading', operationType: 'NOT_SUPPORTED',
      message: 'No table or SQL found to export. Please specify a table name.',
    };
    return [compose('data-loading', result)];
  }

  const executed = await executeQuery(sql, project);

  // Build CSV
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csvLines = [
    executed.columns.join(','),
    ...executed.rows.map((row) => row.map(escape).join(',')),
  ];
  const csvContent = csvLines.join('\n');

  const result: DataLoadingResult = {
    skill: 'data-loading',
    operationType: 'EXPORT_CSV',
    message: `Ready to download ${executed.rowCount} rows.`,
    csvContent,
    rowCount: executed.rowCount,
    columnCount: executed.columns.length,
    sql,
  };
  return [compose('data-loading', result)];
}

// ─── Discovery handler ─────────────────────────────────────────────────────────

async function handleDiscovery(
  message: string,
  context?: { project?: string; dataset?: string }
): Promise<CompositionEnvelope[]> {
  const project = context?.project ?? process.env.GOOGLE_PROJECT_ID ?? '';

  const { object: intent } = await generateObject({ maxRetries: 2,
    model: google('gemini-3.5-flash'),
    system: `You are a BigQuery discovery assistant. Classify the user's request as either SEARCH (find tables/views matching a term) or COMPARISON (compare two specific tables' schemas). Extract the search term or first table name into 'query'. For COMPARISON, extract the second table into 'secondTable'.`,
    prompt: message,
    schema: DiscoveryResponseSchema,
  });

  if (intent.discoveryType === 'COMPARISON') {
    const leftRef = intent.query;
    const rightRef = intent.secondTable ?? '';

    const parseRef = (ref: string) => {
      const parts = ref.replace(/`/g, '').split('.');
      return { dataset: parts[parts.length - 2] ?? '', table: parts[parts.length - 1] ?? '' };
    };

    const leftParsed = parseRef(leftRef);
    const rightParsed = parseRef(rightRef);

    const [leftSchema, rightSchema] = await Promise.all([
      fetchSchema(leftParsed.dataset || undefined, leftParsed.table || undefined, project).catch(() => null),
      fetchSchema(rightParsed.dataset || undefined, rightParsed.table || undefined, project).catch(() => null),
    ]);

    const leftCols = new Map((leftSchema?.columns ?? []).map((c) => [c.name, c.type]));
    const rightCols = new Map((rightSchema?.columns ?? []).map((c) => [c.name, c.type]));

    const addedColumns: Array<{ name: string; type: string }> = [];
    const removedColumns: Array<{ name: string; type: string }> = [];
    const changedColumns: Array<{ name: string; fromType: string; toType: string }> = [];

    for (const [name, type] of rightCols) {
      if (!leftCols.has(name)) {
        addedColumns.push({ name, type });
      } else if (leftCols.get(name) !== type) {
        changedColumns.push({ name, fromType: leftCols.get(name)!, toType: type });
      }
    }
    for (const [name, type] of leftCols) {
      if (!rightCols.has(name)) {
        removedColumns.push({ name, type });
      }
    }

    const result: DiscoveryResult = {
      skill: 'discovery',
      discoveryType: 'COMPARISON',
      query: intent.query,
      results: [],
      comparison: {
        left: leftRef,
        right: rightRef,
        addedColumns,
        removedColumns,
        changedColumns,
      },
    };
    return [compose('discovery', result)];
  }

  // SEARCH: query INFORMATION_SCHEMA across all datasets
  const projectSchema = await fetchSchema(undefined, undefined, project);
  const datasets = projectSchema.columns.map((c) => c.name);

  const term = intent.query.toLowerCase();
  const resultsMap = new Map<string, DiscoverySearchResult>();

  await Promise.all(
    datasets.map(async (dataset) => {
      try {
        // Match table names
        const tablesSql = [
          `SELECT t.table_name, t.table_type, o.option_value AS description`,
          `FROM \`${project}.${dataset}\`.INFORMATION_SCHEMA.TABLES t`,
          `LEFT JOIN \`${project}.${dataset}\`.INFORMATION_SCHEMA.TABLE_OPTIONS o`,
          `  ON t.table_name = o.table_name AND o.option_name = 'description'`,
          `WHERE LOWER(t.table_name) LIKE '%${term}%'`,
        ].join(' ');

        const tablesResult = await executeQuery(tablesSql, project).catch(() => null);
        if (tablesResult) {
          for (const row of tablesResult.rows) {
            const name = String(row[0] ?? '');
            const rawType = String(row[1] ?? 'TABLE').toUpperCase();
            const type: DiscoverySearchResult['type'] =
              rawType === 'VIEW' ? 'VIEW' : 'TABLE';
            const ref = `${project}.${dataset}.${name}`;
            if (!resultsMap.has(ref)) {
              resultsMap.set(ref, {
                type,
                ref,
                matchedOn: 'table_name',
                description: row[2] ? String(row[2]).replace(/^"|"+$/g, '') : null,
              });
            }
          }
        }

        // Match column names
        const colsSql = [
          `SELECT DISTINCT table_name`,
          `FROM \`${project}.${dataset}\`.INFORMATION_SCHEMA.COLUMNS`,
          `WHERE LOWER(column_name) LIKE '%${term}%'`,
        ].join(' ');

        const colsResult = await executeQuery(colsSql, project).catch(() => null);
        if (colsResult) {
          for (const row of colsResult.rows) {
            const name = String(row[0] ?? '');
            const ref = `${project}.${dataset}.${name}`;
            if (!resultsMap.has(ref)) {
              resultsMap.set(ref, {
                type: 'TABLE',
                ref,
                matchedOn: 'column_name',
                description: null,
              });
            } else {
              const existing = resultsMap.get(ref)!;
              if (existing.matchedOn === 'table_name') {
                existing.matchedOn = 'table_name, column_name';
              }
            }
          }
        }
      } catch {
        // Non-fatal — skip inaccessible datasets
      }
    })
  );

  const result: DiscoveryResult = {
    skill: 'discovery',
    discoveryType: 'SEARCH',
    query: intent.query,
    results: Array.from(resultsMap.values()),
    comparison: null,
  };
  return [compose('discovery', result)];
}
