// src/lib/skills/handle-query.ts
// Query handler: uses a Gemini tool-calling agent to adaptively fetch schema
// and execute SQL. The LLM decides what context it needs -- simple queries
// skip schema fetching entirely.

import { callGeminiWithTools, loadSkillDoc } from '../gemini-client';
import { getAvailableDatasets, resolveDefaultDatasetFromList, extractDatasetFromMessage, stepWithLink } from '../orchestrator-utils';
import { executeQuery } from '../bigquery-client';
import { fetchSchema } from './schema';
import { compose } from '../composer';
import { findReusablePlan, cachePlan } from '../plan-cache';
import { analyzeResultQuality } from '../result-quality';
import { BQ_TOOLS, BQ_TOOL_MAP } from '../bq-tools';
import type { ChatMessage, CompositionEnvelope, QueryResult, SkillManifest, StatusCallback, VisualizationType } from '../types';

// ─── Tool-calling query handler ──────────────────────────────────────────────

export async function handleQuery(
  message: string,
  history: ChatMessage[],
  context?: { project?: string; dataset?: string; lastTable?: string; resolvedDataset?: string; availableDatasets?: string[] },
  onStatus?: StatusCallback
): Promise<CompositionEnvelope[]> {
  const project = context?.project || '';

  // Parallelize: skill doc + dataset resolution (both are cheap / cached)
  const [skillDoc, available] = await Promise.all([
    loadSkillDoc('query'),
    context?.availableDatasets ?? getAvailableDatasets(project),
  ]);
  let dataset = context?.resolvedDataset ?? resolveDefaultDatasetFromList(available, context?.dataset, project);
  if (!dataset) {
    dataset = extractDatasetFromMessage(message, available) ?? '';
  }

  // -- Plan cache: check for reusable query plan --
  const cachedPlan = findReusablePlan(message, dataset);
  if (cachedPlan) {
    onStatus?.(`Reusing cached query plan for dataset ${dataset}...`);
    return executeCachedPlan(cachedPlan, project, dataset, onStatus);
  }

  // -- Build conversation messages --
  const messages = history.slice(-6).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  // -- System prompt: lightweight, no pre-fetched schema --
  const datasetLine = dataset
    ? `The active dataset is: ${dataset}`
    : 'No dataset is pre-selected. Infer the correct dataset from the user\'s prompt and the available datasets listed below.';
  const lastTableLine = context?.lastTable
    ? `\nThe user was most recently looking at table \`${project}.${dataset}.${context.lastTable}\`.`
    : '';

  const systemPrompt = `${skillDoc}

The BigQuery project is: ${project}
${datasetLine}
Available datasets in project ${project}: ${available.join(', ')}${lastTableLine}
Today's date: ${new Date().toISOString().split('T')[0]}

CRITICAL: Always wrap fully qualified table references in literal backticks: \`${project}.DATASET.tablename\` (e.g. \`${project}.ecomm.orders\`). This is CRITICAL to prevent syntax errors when project names contain dashes/hyphens.

You have tools to interact with BigQuery. Follow these rules strictly:

EFFICIENCY RULES (most important):
1. If the user names a specific table (e.g. "orders in ecomm"), go DIRECTLY to run_query or get_table_schema. Do NOT call list_tables first -- you already know the table.
2. For simple queries (SELECT *, LIMIT, COUNT, basic WHERE), call run_query directly without fetching schema. You do not need column names to write SELECT * FROM table LIMIT N.
3. Only call get_table_schema when you genuinely need column names to write a query (aggregations, JOINs, specific column references).
4. Only call list_tables when the user does NOT name a specific table and you need to find one.
5. Only call list_datasets when the user does NOT name a specific dataset.
6. STOP after run_query succeeds. Do not call additional tools after you have query results. Just summarize the results and respond.

After running the query, provide a brief one-line summary of what the results show.`;


  onStatus?.('Analyzing query...');

  // -- Capture the full BQ execution result for the UI --
  // The tool executor sends a concise summary to the LLM but we capture the
  // full result (all rows, column names, jobId) for the compose() pipeline.
  type CapturedExecution = {
    sql: string;
    columns: string[];
    rows: unknown[][];
    rowCount: number;
    jobId: string;
  };
  const capture: { value: CapturedExecution | null } = { value: null };

  const toolExecutor = async (name: string, args: Record<string, unknown>): Promise<unknown> => {
    const tool = BQ_TOOL_MAP.get(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);

    if (name === 'run_query') {
      const sql = args.sql as string;
      onStatus?.(stepWithLink(
        `Executing query on ${dataset || 'BigQuery'}...`,
        { project, dataset: dataset || undefined },
        'Open in BigQuery'
      ));
      const result = await executeQuery(sql, project);
      // Capture full result for the UI
      capture.value = { sql, ...result };
      // Return concise preview for the LLM
      const previewRows = result.rows.slice(0, 20);
      return {
        columns: result.columns,
        rowCount: result.rowCount,
        sampleRows: previewRows,
      };
    }

    if (name === 'get_table_schema') {
      onStatus?.(`Fetching schema for ${args.table}...`);
    } else if (name === 'list_tables') {
      onStatus?.(`Listing tables in ${args.dataset}...`);
    } else if (name === 'list_datasets') {
      onStatus?.('Listing datasets...');
    }

    return tool.execute(args, project);
  };

  // -- Run the tool-calling agent loop --
  const agentResult = await callGeminiWithTools({
    systemInstruction: systemPrompt,
    messages: [...messages, { role: 'user' as const, content: message }],
    toolDeclarations: BQ_TOOLS.map((t) => t.declaration),
    toolExecutor,
    project,
    onStatus,
  });

  // -- If the LLM never called run_query, return a text-only response --
  const captured = capture.value;
  if (!captured) {
    const textResult: QueryResult = {
      skill: 'query',
      sql: '',
      requiresConfirmation: false,
      costConfirm: null,
      columns: [],
      rows: [],
      rowCount: 0,
      totalBytesProcessed: 0,
      costTier: 0,
      suggestedVisualization: 'TABLE',
      resultSummary: agentResult.textResponse || 'No results to display.',
    };
    return [compose('query', textResult)];
  }

  // -- Cache the plan for future reuse --
  cachePlan(
    'query',
    dataset,
    captured.sql,
    'TABLE', // composer will determine actual viz
    null,
    null,
  );

  // -- Heuristic data quality analysis --
  const qualityFlags = analyzeResultQuality(
    captured.columns,
    captured.rows,
    captured.sql,
  );

  // -- Build QueryResult for the composer --
  const result: QueryResult = {
    skill: 'query',
    sql: captured.sql,
    requiresConfirmation: false,
    costConfirm: null,
    columns: captured.columns,
    rows: captured.rows,
    rowCount: captured.rowCount,
    jobId: captured.jobId || undefined,
    totalBytesProcessed: 0,
    costTier: 0,
    suggestedVisualization: 'TABLE', // composer overrides based on data shape
    notableFindings: null,
    resultSummary: agentResult.textResponse || null,
  };

  return [compose('query', result, qualityFlags)];
}

// ─── Execute a cached plan (unchanged from previous implementation) ───────────

async function executeCachedPlan(
  cachedPlan: { substitutedSql: string; entry: { visualization: VisualizationType; xAxis?: string | null; yAxis?: string[] | null } },
  project: string,
  dataset: string,
  onStatus?: StatusCallback,
): Promise<CompositionEnvelope[]> {
  const sql = cachedPlan.substitutedSql;

  onStatus?.(stepWithLink(
    `Executing cached query on ${dataset}...`,
    { project, dataset },
    'Open in BigQuery'
  ));

  let executed: Awaited<ReturnType<typeof executeQuery>>;
  try {
    executed = await executeQuery(sql, project);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`Cached query failed: ${errMsg}`);
  }

  const qualityFlags = analyzeResultQuality(executed.columns, executed.rows, sql);

  const result: QueryResult = {
    skill: 'query',
    sql,
    requiresConfirmation: false,
    costConfirm: null,
    columns: executed.columns,
    rows: executed.rows,
    rowCount: executed.rowCount,
    jobId: executed.jobId || undefined,
    totalBytesProcessed: 0,
    costTier: 0,
    suggestedVisualization: cachedPlan.entry.visualization,
    xAxis: cachedPlan.entry.xAxis ?? null,
    yAxis: cachedPlan.entry.yAxis ?? null,
    notableFindings: null,
    resultSummary: null,
  };

  return [compose('query', result, qualityFlags)];
}

// ─── Skill manifest ───────────────────────────────────────────────────────────

export const manifest: SkillManifest = {
  skill: 'query',
  label: 'query builder',
  signals: [
    { phrase: 'how many', weight: 3 },
    { phrase: 'total', weight: 2 },
    { phrase: 'sum of', weight: 3 },
    { phrase: 'average', weight: 2 },
    { phrase: 'count of', weight: 3 },
    { phrase: 'biggest', weight: 2 },
    { phrase: 'smallest', weight: 2 },
    { phrase: 'highest', weight: 2 },
    { phrase: 'lowest', weight: 2 },
    { phrase: 'most', weight: 2 },
    { phrase: 'least', weight: 2 },
    { phrase: 'top', weight: 2 },
    { phrase: 'bottom', weight: 2 },
    { phrase: 'maximum', weight: 2 },
    { phrase: 'minimum', weight: 2 },
    { phrase: 'breakdown', weight: 2 },
    { phrase: 'group by', weight: 3 },
    { phrase: 'over time', weight: 2 },
    { phrase: 'trend', weight: 2 },
    { phrase: 'per month', weight: 3 },
    { phrase: 'per week', weight: 3 },
    { phrase: 'per year', weight: 3 },
    { phrase: 'per day', weight: 3 },
    { phrase: 'by month', weight: 3 },
    { phrase: 'by week', weight: 3 },
    { phrase: 'by year', weight: 3 },
    { phrase: 'predict', weight: 2 },
    { phrase: 'ML.PREDICT', weight: 3 },
    { phrase: 'forecast', weight: 2 },
    { phrase: 'classify', weight: 2 },
    { phrase: 'cluster', weight: 2 },
    { phrase: 'evaluate model', weight: 3 },
    { phrase: 'model accuracy', weight: 3 },
    { phrase: 'ML.EVALUATE', weight: 3 },
    { phrase: 'explain prediction', weight: 3 },
    { phrase: 'feature importance', weight: 3 },
    { phrase: 'ML.EXPLAIN_PREDICT', weight: 3 },
    { phrase: 'list models', weight: 3 },
    { phrase: 'show models', weight: 3 },
    { phrase: 'what models', weight: 3 },
    { phrase: 'AI.GENERATE_TEXT', weight: 3 },
    { phrase: 'AI.FORECAST', weight: 3 },
    { phrase: 'AI.DETECT_ANOMALIES', weight: 3 },
  ],
  handle: handleQuery,
};
