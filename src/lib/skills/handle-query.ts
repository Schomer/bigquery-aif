// src/lib/skills/handle-query.ts
// Query handler: uses a Gemini tool-calling agent to adaptively fetch schema
// and execute SQL. The LLM decides what context it needs -- simple queries
// skip schema fetching entirely.

import { callGeminiWithTools, loadSkillDoc } from '../gemini-client';
import { getAvailableDatasets, resolveDefaultDatasetFromList, extractDatasetFromMessage, stepWithLink } from '../orchestrator-utils';
import { executeQuery } from '../bigquery-client';
import { checkAndFixTypes } from '../sql-guard';
import { formatStateForPrompt, type ConversationState } from '../conversation-state';
import { fetchSchema } from './schema';
import { compose } from '../composer';
import { findReusablePlan, cachePlan } from '../plan-cache';
import { analyzeResultQuality } from '../result-quality';
import { BQ_TOOLS, BQ_TOOL_MAP } from '../bq-tools';
import type { ChatMessage, CompositionEnvelope, QueryResult, SkillManifest, StatusCallback, VisualizationType, ArtifactType, InteractiveWidgetData } from '../types';

// ─── Tool-calling query handler ──────────────────────────────────────────────

export async function handleQuery(
  message: string,
  history: ChatMessage[],
  context?: { project?: string; dataset?: string; lastTable?: string; lastTableSchema?: { name: string; type: string; description?: string }[]; lastDatasetTables?: string[]; resolvedDataset?: string; availableDatasets?: string[]; userIntent?: ArtifactType | null; lastSavedArtifactSql?: string; lastSavedArtifactName?: string; lastSavedArtifactVizType?: string; conversationState?: ConversationState },
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

  // If no schema context from prior turn, try to extract table name from message
  // and pre-fetch its schema to eliminate a get_table_schema tool call
  if (lastTableSchema.length === 0 && tableList.length > 0 && dataset) {
    const lowerMsg = message.toLowerCase();
    const mentionedTable = tableList.find(t => lowerMsg.includes(t.toLowerCase()));
    if (mentionedTable) {
      try {
        const pre = await fetchSchema(dataset, mentionedTable, project);
        if (pre?.columns && pre.columns.length > 0) {
          lastTableSchema = pre.columns.map(c => ({
            name: c.name,
            type: c.type,
            description: c.description ?? undefined,
          }));
        }
      } catch { /* non-fatal */ }
    }
  }

  // -- Plan cache: check for reusable query plan --
  const cachedPlanHit = findReusablePlan(message, dataset);
  if (cachedPlanHit) {
    onStatus?.(`Picking up where we left off (cached plan for ${dataset})...`);
    return executeCachedPlan(cachedPlanHit, project, dataset, onStatus, context?.userIntent ?? null);
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

  // Inject few-shot examples from plan cache for similar prior queries
  const cachedPlan = findReusablePlan(message, dataset || '');
  const fewShotBlock = cachedPlan
    ? `\n\nPREVIOUS SUCCESSFUL QUERY (use as reference if relevant):\nSQL used: ${cachedPlan.entry.sql}\nNote: Adapt this pattern to the current question -- do not copy it blindly.`
    : '';

  const systemPrompt = `${skillDoc}

The BigQuery project is: ${project}
${datasetLine}
Available datasets in project ${project}: ${available.join(', ')}${lastTableLine}${tableListLine}${lastTableSchemaLine}${savedArtifactBlock}${fewShotBlock}
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
7. When filtering STRING columns and you are not certain of the exact stored value, prefer LIKE '%value%' or use LOWER() for case-insensitive comparison rather than exact = 'value'.
8. For geographic names (states, countries, cities), always use a case-insensitive comparison.

After running the query, provide a brief one-line summary of what the results show.`;

  // Append session history if available
  const stateBlock = context?.conversationState
    ? formatStateForPrompt(context.conversationState)
    : '';
  const fullSystemPrompt = stateBlock
    ? `${systemPrompt}\n\n${stateBlock}`
    : systemPrompt;



  const briefQuestion = message.length > 80 ? message.slice(0, 77) + '...' : message;
  onStatus?.(`Analyzing: "${briefQuestion}"`);

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
      let sql = args.sql as string;
      const vizHint = args.visualizationHint as string | undefined;

      // Auto-correct type mismatches if we have schema context
      if (lastTableSchema.length > 0) {
        const { sql: fixed, fixes } = checkAndFixTypes(sql, lastTableSchema);
        if (fixes.length > 0) {
          sql = fixed;
          onStatus?.(`Auto-corrected ${fixes.length} type mismatch(es)...`);
        }
      }

      onStatus?.(stepWithLink(
        `Executing query on ${dataset || 'BigQuery'}...`,
        { project, dataset: dataset || undefined },
        'Open in BigQuery'
      ));
      const result = await executeQuery(sql, project);

      // Zero-row retry: relax filters if no results found
      if (result.rowCount === 0 && sql.toUpperCase().includes('WHERE')) {
        // Check for implicit year filter
        const yearPattern = /EXTRACT\s*\(\s*YEAR\s+FROM\s+\w+\)\s*=\s*\d{4}/i;
        const yearMatch = sql.match(yearPattern);
        if (yearMatch) {
          const relaxedSql = sql.replace(yearMatch[0], 'TRUE');
          onStatus?.('No data matched the date filter -- trying without it...');
          try {
            const retryResult = await executeQuery(relaxedSql, project);
            if (retryResult.rowCount > 0) {
              capture.value = { sql: relaxedSql, ...retryResult, visualizationHint: vizHint };
              return { columns: retryResult.columns, rowCount: retryResult.rowCount, sampleRows: retryResult.rows.slice(0, 20) };
            }
          } catch { /* fall through to original result */ }
        }

        // Check for string exact match that could use LIKE
        const exactMatch = sql.match(/(\w+)\s*=\s*'([^']+)'/);
        if (exactMatch && !yearMatch) {
          const col = exactMatch[1];
          const val = exactMatch[2];
          const relaxedSql = sql.replace(
            `${col} = '${val}'`,
            `LOWER(${col}) LIKE LOWER('%${val}%')`
          );
          onStatus?.('No exact match found -- trying a broader search...');
          try {
            const retryResult = await executeQuery(relaxedSql, project);
            if (retryResult.rowCount > 0) {
              capture.value = { sql: relaxedSql, ...retryResult, visualizationHint: vizHint };
              return { columns: retryResult.columns, rowCount: retryResult.rowCount, sampleRows: retryResult.rows.slice(0, 20) };
            }
          } catch { /* fall through to original result */ }
        }
      }

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

  // Remove discovery tools when context is already available
  const filteredTools = BQ_TOOLS.filter(t => {
    if (t.declaration.name === 'list_datasets' && available.length > 0) return false;
    if (t.declaration.name === 'list_tables' && tableList.length > 0) return false;
    return true;
  });

  // -- Run the tool-calling agent loop --
  const agentResult = await callGeminiWithTools({
    systemInstruction: fullSystemPrompt,
    messages: [...messages, { role: 'user' as const, content: message }],
    toolDeclarations: filteredTools.map((t) => t.declaration),
    toolExecutor,
    project,
    onStatus,
    maxIterations: 8,
    terminateAfter: ['run_query'],
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

  // -- Interactive widget mode: parse widgetSpec from LLM text response --
  const textResponse = agentResult.textResponse || '';
  const widgetSpecMatch = textResponse.match(/WIDGET_SPEC_START\s*([\s\S]*?)\s*WIDGET_SPEC_END/);
  if (widgetSpecMatch && captured.visualizationHint === 'INTERACTIVE_WIDGET') {
    let widgetSpec: {
      controlType?: string;
      parameterizedSql?: string;
      baseSql?: string;
      visualization?: string;
      chartTitle?: string;
      // DATE_RANGE fields
      dateColumn?: string;
      defaultStart?: string | null;
      defaultEnd?: string | null;
      // DROPDOWN fields
      filterColumn?: string;
      filterParam?: string;
      optionsSql?: string;
      defaultValue?: string | null;
    } | null = null;

    try {
      widgetSpec = JSON.parse(widgetSpecMatch[1].trim());
    } catch {
      // Parsing failed -- fall through to normal query result
    }

    if (widgetSpec && widgetSpec.parameterizedSql && widgetSpec.baseSql) {
      const controlType = widgetSpec.controlType ?? 'DATE_RANGE';

      let controls: InteractiveWidgetData['controls'] = [];
      // initialResult starts as the baseSql capture; overridden below for DROPDOWN
      let initialColumns = captured.columns;
      let initialColumnTypes = captured.columnTypes;
      let initialRows = captured.rows;
      let initialRowCount = captured.rowCount;
      let initialJobId = captured.jobId || undefined;

      if ((controlType === 'DROPDOWN' || controlType === 'MULTI_SELECT') && widgetSpec.filterColumn && widgetSpec.filterParam && widgetSpec.optionsSql) {
        // Fetch options (shared between DROPDOWN and MULTI_SELECT)
        let options: string[] = [];
        try {
          onStatus?.(`Loading ${widgetSpec.filterColumn} options...`);
          const optResult = await executeQuery(widgetSpec.optionsSql, project);
          options = optResult.rows.map((r) => String((r as unknown[])[0] ?? '')).filter(Boolean);
        } catch {
          // Non-fatal
        }

        if (controlType === 'MULTI_SELECT') {
          const defaultValues = (widgetSpec as unknown as { defaultValues?: string[] | null }).defaultValues ?? null;
          controls = [{
            type: 'MULTI_SELECT',
            label: widgetSpec.filterColumn.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            param: widgetSpec.filterParam,
            column: widgetSpec.filterColumn,
            options,
            defaultValues,
          }];
        } else {
          // DROPDOWN
          const effectiveDefault = widgetSpec.defaultValue ?? null;

          if (effectiveDefault) {
            try {
              onStatus?.(`Loading ${effectiveDefault}...`);
              const safe = effectiveDefault.replace(/'/g, "''");
              const quotedLiteral = `'${safe}'`;
              const escapedParam = widgetSpec.filterParam.replace(/[{}]/g, '\\$&');
              let filteredSql = widgetSpec.parameterizedSql;
              const quotedPlaceholder = new RegExp(`'${escapedParam}'`, 'g');
              if (quotedPlaceholder.test(filteredSql)) {
                filteredSql = filteredSql.replace(quotedPlaceholder, quotedLiteral);
              } else {
                filteredSql = filteredSql.replace(new RegExp(escapedParam, 'g'), quotedLiteral);
              }
              const filteredResult = await executeQuery(filteredSql, project);
              initialColumns = filteredResult.columns;
              initialColumnTypes = filteredResult.columnTypes;
              initialRows = filteredResult.rows;
              initialRowCount = filteredResult.rowCount;
              initialJobId = filteredResult.jobId || undefined;
            } catch {
              // Non-fatal -- fall back to baseSql capture
            }
          }

          controls = [{
            type: 'DROPDOWN',
            label: widgetSpec.filterColumn.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            param: widgetSpec.filterParam,
            column: widgetSpec.filterColumn,
            options,
            defaultValue: effectiveDefault,
          }];
        }
      } else if (widgetSpec.dateColumn) {
        controls = [{
          type: 'DATE_RANGE',
          label: 'Date Range',
          startParam: '{{start_date}}',
          endParam: '{{end_date}}',
          dateColumn: widgetSpec.dateColumn,
        }];
      }


      if (controls.length > 0) {
        // Explicit user intent takes absolute priority over the LLM's visualization hint.
        // If the user said "show as a bar chart", we honor that even for geo data.
        const viz = (context?.userIntent && context.userIntent !== 'INTERACTIVE_WIDGET'
          ? context.userIntent
          : (widgetSpec.visualization as VisualizationType | undefined)
          ?? (result.suggestedVisualization !== 'INTERACTIVE_WIDGET' ? result.suggestedVisualization : 'LINE_CHART')
        ) as VisualizationType;

        const widgetData: InteractiveWidgetData = {
          baseSql: widgetSpec.baseSql,
          parameterizedSql: widgetSpec.parameterizedSql,
          controls,
          visualization: viz,
          xAxis: initialColumns[0] ?? null,
          yAxis: initialColumns.slice(1),
          chartTitle: widgetSpec.chartTitle ?? null,
          initialResult: {
            columns: initialColumns,
            columnTypes: initialColumnTypes,
            rows: initialRows,
            rowCount: initialRowCount,
            jobId: initialJobId,
          },
          defaultStart: widgetSpec.defaultStart ?? null,
          defaultEnd: widgetSpec.defaultEnd ?? null,
          project,
        };

        const widgetResult: QueryResult = {
          skill: 'query',
          sql: widgetSpec.baseSql,
          requiresConfirmation: false,
          costConfirm: null,
          columns: initialColumns,
          columnTypes: initialColumnTypes,
          rows: initialRows,
          rowCount: initialRowCount,
          jobId: initialJobId,
          totalBytesProcessed: 0,
          costTier: 0,
          suggestedVisualization: 'INTERACTIVE_WIDGET' as VisualizationType,
          notableFindings: null,
          resultSummary: null,
          widgetData,
        } as QueryResult & { widgetData: InteractiveWidgetData };

        return [compose('query', widgetResult, qualityFlags, 'INTERACTIVE_WIDGET')];
      }
    }
  }

  return [compose('query', result, qualityFlags, context?.userIntent ?? null)];
}


// ─── Execute a cached plan (unchanged from previous implementation) ───────────

async function executeCachedPlan(
  cachedPlan: { substitutedSql: string; entry: { visualization: VisualizationType; xAxis?: string | null; yAxis?: string[] | null } },
  project: string,
  dataset: string,
  onStatus?: StatusCallback,
  userIntent?: ArtifactType | null,
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

  return [compose('query', result, qualityFlags, userIntent ?? null)];
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
    // Interactive widget signals
    { phrase: 'date range', weight: 5 },
    { phrase: 'date filter', weight: 5 },
    { phrase: 'date picker', weight: 5 },
    { phrase: 'filter by date', weight: 5 },
    { phrase: 'with a filter', weight: 4 },
    { phrase: 'let me filter', weight: 4 },
    { phrase: 'add a filter', weight: 4 },
    { phrase: 'filter control', weight: 5 },
    { phrase: 'interactive', weight: 3 },
    { phrase: 'explore with', weight: 3 },
    { phrase: 'drill into', weight: 2 },
    // Common natural-language analytical patterns
    { phrase: 'summarize', weight: 2 },
    { phrase: 'summary', weight: 2 },
    { phrase: 'analyze', weight: 2 },
    { phrase: 'analysis', weight: 2 },
    { phrase: 'run a query', weight: 3 },
    { phrase: 'what happened', weight: 2 },
    { phrase: 'look up', weight: 2 },
    { phrase: 'look into', weight: 2 },
    { phrase: 'show me the top', weight: 3 },
    { phrase: 'give me', weight: 1 },
    { phrase: 'find out', weight: 2 },
    { phrase: 'calculate', weight: 2 },
    { phrase: 'what is the', weight: 1 },
    { phrase: 'how much', weight: 2 },
  ],
  handle: handleQuery,
};
