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
import type { ChatMessage, CompositionEnvelope, QueryResult, SkillManifest, StatusCallback, VisualizationType, ArtifactType } from '../types';

// ─── Tool-calling query handler ──────────────────────────────────────────────

export async function handleQuery(
  message: string,
  history: ChatMessage[],
  context?: { project?: string; dataset?: string; lastTable?: string; lastTableSchema?: { name: string; type: string; description?: string }[]; lastDatasetTables?: string[]; resolvedDataset?: string; availableDatasets?: string[]; userIntent?: ArtifactType | null; lastSavedArtifactSql?: string; lastSavedArtifactName?: string; lastSavedArtifactVizType?: string },
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

  // Pre-fetch table list for the active dataset so the LLM doesn't burn
  // iterations calling list_tables. This is cached by fetchSchema.
  // When lastTable is set, also pre-fetch its full schema so the LLM can
  // skip get_table_schema and write SQL directly.
  // If the schema was already fetched in a prior turn and passed through
  // context.lastTableSchema, use it directly -- no network call needed.
  let tableList: string[] = [];
  let lastTableSchema: { name: string; type: string; description?: string }[] = [];
  if (dataset) {
    const fetches: Promise<void>[] = [];
    if (context?.lastDatasetTables && context.lastDatasetTables.length > 0) {
      // Table list already known from a prior turn -- use it directly.
      tableList = context.lastDatasetTables;
    } else {
      fetches.push(
        fetchSchema(dataset, undefined, project)
          .then((s) => { tableList = s.columns.map((c) => c.name); })
          .catch(() => {}),
      );
    }
    if (context?.lastTableSchema && context.lastTableSchema.length > 0) {
      // Schema already available from a prior turn -- use it directly.
      lastTableSchema = context.lastTableSchema;
    } else if (context?.lastTable) {
      fetches.push(
        fetchSchema(dataset, context.lastTable, project)
          .then((s) => {
            lastTableSchema = s.columns.map((c) => ({
              name: c.name,
              type: c.type,
              ...(c.description ? { description: c.description } : {}),
            }));
          })
          .catch(() => {}),
      );
    }
    if (fetches.length > 0) await Promise.all(fetches);
  }

  // -- Plan cache: check for reusable query plan --
  const cachedPlan = findReusablePlan(message, dataset);
  if (cachedPlan) {
    onStatus?.(`Picking up where we left off (cached plan for ${dataset})...`);
    return executeCachedPlan(cachedPlan, project, dataset, onStatus);
  }

  // -- Build conversation messages --
  const messages = history.slice(-20).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  // -- System prompt: includes table list and active table schema --
  const datasetLine = dataset
    ? `The active dataset is: ${dataset}`
    : 'No dataset is pre-selected. Infer the correct dataset from the user\'s prompt and the available datasets listed below.';
  const lastTableLine = context?.lastTable
    ? `\nThe user was most recently looking at table \`${project}.${dataset}.${context.lastTable}\`.`
    : '';
  const tableListLine = tableList.length > 0
    ? `\nTables in ${dataset}: ${tableList.join(', ')}`
    : '';
  const lastTableSchemaLine = lastTableSchema.length > 0
    ? `\nSchema for \`${context?.lastTable}\`:\n${lastTableSchema.map((c) => `  - ${c.name} (${c.type})${c.description ? ': ' + c.description : ''}`).join('\n')}`
    : '';

  const hasActiveTableSchema = lastTableSchema.length > 0;

  // -- Virtual table context: saved artifact as CTE --
  // When the user ran a saved query and is now asking a follow-up, we wrap
  // the saved SQL as a CTE so the LLM writes SQL against the derived result
  // rather than querying a real BigQuery table.
  const savedSql = context?.lastSavedArtifactSql;
  const savedName = context?.lastSavedArtifactName ?? 'saved_query';
  const cteAlias = savedName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'saved_query';
  const savedArtifactBlock = savedSql
    ? `\n\nVIRTUAL TABLE CONTEXT
---------------------
The user's current dataset is the result of saved query "${savedName}".
Do NOT query any BigQuery tables directly for this request.
The following SQL defines the virtual table; wrap it as a CTE named \`${cteAlias}\`:

WITH ${cteAlias} AS (
${savedSql}
)

Write your SQL using \`${cteAlias}\` as the source. Available columns: ${lastTableSchema.length > 0 ? lastTableSchema.map((c) => c.name).join(', ') : 'run the CTE to discover columns'}.`
    : '';

  const systemPrompt = `${skillDoc}

The BigQuery project is: ${project}
${datasetLine}
Available datasets in project ${project}: ${available.join(', ')}${lastTableLine}${tableListLine}${lastTableSchemaLine}${savedArtifactBlock}
Today's date: ${new Date().toISOString().split('T')[0]}

CRITICAL: Always wrap fully qualified table references in literal backticks: \`${project}.DATASET.tablename\` (e.g. \`${project}.ecomm.order_items\`). This is CRITICAL to prevent syntax errors when project names contain dashes/hyphens.
INFORMATION_SCHEMA exception: INFORMATION_SCHEMA views must be OUTSIDE the backtick-quoted identifier. Correct: \`${project}.dataset\`.INFORMATION_SCHEMA.COLUMNS. Wrong: \`${project}.dataset.INFORMATION_SCHEMA.COLUMNS\`.

You have tools to interact with BigQuery. Follow these rules strictly:

EFFICIENCY RULES (most important):
1. The table list for the active dataset is provided above. Do NOT call list_tables or list_datasets unless querying a different dataset.${hasActiveTableSchema ? `\n2. The schema for \`${context?.lastTable}\` is fully provided above -- it is complete and authoritative. Write your SQL and call run_query IMMEDIATELY. Do NOT call get_table_schema under any circumstances.` : '\n2. Pick the most relevant table from the list and call get_table_schema to get its columns before writing SQL.'}
3. If the user names a DIFFERENT table, call get_table_schema on it first. The tool will auto-correct common name mismatches (e.g., "orders" -> "order_items"). If the tool returns an "actualTableName" field, use THAT name in your SQL.
4. STOP after run_query succeeds. Do not call additional tools after you have query results. Just summarize the results and respond.
5. If run_query fails with a "Not found" error, call get_table_schema to verify the table name before retrying.
6. Do NOT run exploratory or summary queries. Answer the user's question directly.

After running the query, provide a brief one-line summary of what the results show.`;



  onStatus?.('Working out your query...');

  // -- Capture the full BQ execution result for the UI --
  // The tool executor sends a concise summary to the LLM but we capture the
  // full result (all rows, column names, jobId) for the compose() pipeline.
  type CapturedExecution = {
    sql: string;
    columns: string[];
    columnTypes: string[];
    rows: unknown[][];
    rowCount: number;
    jobId: string;
    visualizationHint?: string;
  };
  const capture: { value: CapturedExecution | null } = { value: null };

  const toolExecutor = async (name: string, args: Record<string, unknown>): Promise<unknown> => {
    const tool = BQ_TOOL_MAP.get(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);

    if (name === 'run_query') {
      const sql = args.sql as string;
      const vizHint = args.visualizationHint as string | undefined;
      onStatus?.(stepWithLink(
        `Executing query on ${dataset || 'BigQuery'}...`,
        { project, dataset: dataset || undefined },
        'Open in BigQuery'
      ));
      const result = await executeQuery(sql, project);
      // Capture full result for the UI
      capture.value = { sql, ...result, visualizationHint: vizHint };
      // Return concise preview for the LLM
      const previewRows = result.rows.slice(0, 20);
      return {
        columns: result.columns,
        rowCount: result.rowCount,
        sampleRows: previewRows,
      };
    }

    if (name === 'get_table_schema') {
      onStatus?.(`Grabbing the schema for ${args.table}...`);
    } else if (name === 'list_tables') {
      onStatus?.(`Looking up tables in ${args.dataset}...`);
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
    maxIterations: 10,
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
    columnTypes: captured.columnTypes,
    rows: captured.rows,
    rowCount: captured.rowCount,
    jobId: captured.jobId || undefined,
    totalBytesProcessed: 0,
    costTier: 0,
    // Use the LLM's hint if provided; composer will override via heuristics if stronger match exists
    suggestedVisualization: (captured.visualizationHint as VisualizationType | undefined) ?? 'TABLE',
    notableFindings: null,
    resultSummary: agentResult.textResponse || null,
  };

  return [compose('query', result, qualityFlags, context?.userIntent ?? null)];
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
    // Visualization intent signals — must route to query, not schema
    { phrase: 'pie chart', weight: 4 },
    { phrase: 'bar chart', weight: 4 },
    { phrase: 'line chart', weight: 4 },
    { phrase: 'chart', weight: 3 },
    { phrase: 'visualize', weight: 3 },
    { phrase: 'graph', weight: 2 },
    { phrase: 'plot', weight: 2 },
    { phrase: 'histogram', weight: 3 },
    { phrase: 'map', weight: 3 },
    { phrase: 'map with pins', weight: 4 },
    { phrase: 'on a map', weight: 4 },
    { phrase: 'revenue', weight: 2 },
    { phrase: 'by status', weight: 2 },
    { phrase: 'busiest', weight: 2 },
  ],
  handle: handleQuery,
};
