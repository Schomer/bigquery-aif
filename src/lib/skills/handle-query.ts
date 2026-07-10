// src/lib/skills/handle-query.ts
// Query handler: generates SQL via Gemini, executes with auto-retry, returns composed result.
// Extracted from chat-orchestrator.ts.

import { callGemini, QueryResponseSchema, loadSkillDoc } from '../gemini-client';
import { getAvailableDatasets, resolveDefaultDatasetFromList, extractDatasetFromMessage, buildSchemaContext, stepWithLink } from '../orchestrator-utils';
import { fetchSchema } from './schema';
import { dryRun, executeQuery } from '../bigquery-client';
import { compose } from '../composer';
import { findReusablePlan, cachePlan } from '../plan-cache';
import { analyzeResultQuality } from '../result-quality';
import type { ChatMessage, CompositionEnvelope, ParameterDef, QueryResult, SkillManifest, StatusCallback, VisualizationType } from '../types';

export async function handleQuery(
  message: string,
  history: ChatMessage[],
  context?: { project?: string; dataset?: string; lastTable?: string; resolvedDataset?: string; availableDatasets?: string[] },
  onStatus?: StatusCallback
): Promise<CompositionEnvelope[]> {
  const project = context?.project || '';

  // Parallelize: skill doc, dataset resolution, and available datasets
  const [skillDoc, available] = await Promise.all([
    loadSkillDoc('query'),
    context?.availableDatasets ?? getAvailableDatasets(project),
  ]);
  let dataset = context?.resolvedDataset ?? resolveDefaultDatasetFromList(available, context?.dataset, project);
  // If no dataset was pre-selected, try to extract one from the user's message
  // to avoid the LLM misinterpreting natural language (e.g., "the formula_1 dataset").
  if (!dataset) {
    dataset = extractDatasetFromMessage(message, available) ?? '';
  }

  // -- Extract target table from message or context --
  // When the user explicitly references a table name ("filter liquor_backup",
  // "show sales from orders"), we must ensure the LLM knows EXACTLY which table
  // to query. Without this, the LLM may hallucinate a different table entirely.
  let targetTable: string | undefined = context?.lastTable;
  if (!targetTable) {
    // Try to extract a table name from the user's message.
    // Look for backtick-quoted refs first, then bare table names that match
    // known patterns like project.dataset.table or just a table identifier.
    const fqMatch = message.match(/`([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_]+)`/);
    if (fqMatch) {
      targetTable = fqMatch[3];
      if (!dataset) dataset = fqMatch[2];
    } else if (dataset) {
      // Try to match a table name from the dataset's tables list.
      // Fetch the dataset's tables if we have a dataset context.
      try {
        const dsSchema = await fetchSchema(dataset, undefined, project);
        const dsTableNames = dsSchema.columns.map((c) => c.name);
        // Sort by length descending so longer names match first
        const sorted = [...dsTableNames].sort((a, b) => b.length - a.length);
        for (const tbl of sorted) {
          const escaped = tbl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const re = new RegExp(`\\b${escaped}\\b`, 'i');
          if (re.test(message)) {
            targetTable = tbl;
            break;
          }
        }
      } catch {
        // Ignore -- will proceed without target table
      }
    }
  }

  const messages = history.slice(-6).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  // -- Plan cache: check for reusable query plan --
  const cachedPlan = findReusablePlan(message, dataset);
  let queryPlan: { sql: string; suggestedVisualization: VisualizationType; xAxis?: string; yAxis?: string[]; notableFindings?: string; resultSummary?: string; parameters?: any[] };

  if (cachedPlan) {
    onStatus?.(`Reusing cached query plan for dataset ${dataset}...`);
    queryPlan = {
      sql: cachedPlan.substitutedSql,
      suggestedVisualization: cachedPlan.entry.visualization,
      xAxis: cachedPlan.entry.xAxis ?? undefined,
      yAxis: cachedPlan.entry.yAxis ?? undefined,
    };
  } else {
  const schemaContext = await buildSchemaContext(project, dataset, targetTable);

  onStatus?.(stepWithLink(
    `Building SQL for ${targetTable ? `table ${targetTable} in ` : ''}dataset ${dataset} in project ${project}...`,
    { project, dataset, table: targetTable },
    targetTable ? 'Open table in BigQuery' : 'Open dataset in BigQuery'
  ));
  const datasetLine = dataset
    ? `The active dataset is: ${dataset}`
    : 'No dataset is pre-selected. Infer the correct dataset from the user\'s prompt and the available datasets listed below.';
  const targetTableLine = targetTable
    ? `\nCRITICAL: The user is asking about table \`${project}.${dataset}.${targetTable}\`. You MUST use this exact table in your SQL query. Do NOT use any other table.`
    : '';
  queryPlan = await callGemini({
    systemInstruction: `${skillDoc}

The BigQuery project is: ${project}
${datasetLine}
The available datasets in project ${project} are: ${available.join(', ')}
${schemaContext}${targetTableLine}
Always wrap fully qualified table references in literal backticks: \`${project}.DATASET.tablename\` (e.g. \`${project}.ecomm.orders\`). This is CRITICAL to prevent syntax errors when project names contain dashes/hyphens.
Today's date is: ${new Date().toISOString().split('T')[0]}
Also generate a resultSummary field: a brief, contextual one-line summary of what the query results likely show (e.g., 'Revenue by month for the last 12 months' or 'Top 10 customers by order count'). This will be used as the headline shown to the user.
Also generate a parameters array: identify the key values in the SQL that a user might want to change when re-running this query. For each parameter, provide a name (snake_case), type (string/number/date/table/dataset/column), default value (the current literal used in the SQL), and a short description. Common parameters include: date ranges, LIMIT values, WHERE filter values, and metric columns. Only include 1-5 of the most important parameters.

VISUALIZATION SELECTION: Pick the suggestedVisualization that best matches both the data shape AND the user's explicit request. If the user asks for a specific chart type, you MUST use that exact type -- do not substitute a similar one. In particular, "column chart" means COLUMN_CHART (vertical bars) and "bar chart" means BAR_CHART (horizontal bars); these are different chart types and must not be confused. Otherwise use these guidelines:
- TABLE: default for raw data, lists, or when no chart fits.
- KPI_CARD: single aggregate value (count, sum, average).
- LINE_CHART: trends over time, time series.
- BAR_CHART: horizontal bars comparing categories. NOT the same as COLUMN_CHART.
- COLUMN_CHART: vertical bars comparing 5-15 discrete categories. NOT the same as BAR_CHART.
- AREA_CHART: volume/magnitude changes over time, stacked areas.
- SCATTER: correlation between two numeric variables.
- PIE_CHART: part-to-whole composition (3-7 slices).
- DONUT_CHART: part-to-whole with a summary metric in the center.
- HISTOGRAM: frequency distribution of a single numeric column. Query should return individual values or pre-binned ranges.
- SPARKLINE: tiny inline trend for a single metric over time.
- RADAR: multivariate comparison across 3-8 dimensions.
- FUNNEL: sequential stage drop-off (pipeline, conversion).
- TREEMAP: hierarchical part-to-whole by area.
- SANKEY: flow/transition between categories. Query must return source, target, and value columns.
- COMPOSED_CHART: mixed series types (e.g., bars + lines on same axes).
- GAUGE: single KPI value against a target or range.
- HEATMAP: intensity across two categorical dimensions. Query must return row_label, column_label, and value.
- BOXPLOT: distribution comparison showing median, quartiles, outliers.
- CANDLESTICK: OHLC financial data. Query must return date, open, high, low, close columns.
- VIOLIN: distribution shape comparison across categories.
- DENSITY_PLOT: continuous probability distribution of a single variable.
- RIDGELINE: multiple distributions stacked for comparison across groups.
- NETWORK_GRAPH: entity relationships. Query must return source and target columns.
- TILE_MAP: abstract geographic grid with colored tiles.
- GEO_POINT_MAP: data points on a map. Query must return latitude and longitude columns.
- USA_MAP: US state-level data. Query must return a state name or abbreviation column.
- WORLD_MAP: country-level data. Query must return a country name or code column.`,
    messages: [...messages, { role: 'user' as const, content: message }],
    schema: QueryResponseSchema,
    project,
  });

  // Cache the plan for future reuse
  cachePlan(
    'query',
    dataset,
    queryPlan.sql,
    queryPlan.suggestedVisualization,
    queryPlan.xAxis ?? null,
    queryPlan.yAxis ?? null,
  );
  } // end else (no cached plan)

  // Run dry-run first for cost check
  onStatus?.(stepWithLink(
    `Dry-running query to estimate cost (${dataset})...`,
    { project, dataset },
    'Open dataset in BigQuery'
  ));
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

  // Execute query with auto-retry: if BigQuery returns a query-content error
  // (syntax, unsupported type, etc.), send the error back to Gemini to fix the
  // SQL and retry once.
  let finalSql = queryPlan.sql;
  let executed: Awaited<ReturnType<typeof executeQuery>>;
  try {
    executed = await executeQuery(finalSql, project);
  } catch (firstErr: unknown) {
    const errMsg = firstErr instanceof Error ? firstErr.message : String(firstErr);
    // Only auto-fix query-content errors, not auth/quota/network issues
    const isQueryError = errMsg.includes('query failed') || errMsg.includes('Syntax error');
    if (!isQueryError) throw firstErr;

    onStatus?.(`Query failed, asking LLM to fix SQL error...`);
    try {
      const fixResult = await callGemini({
        systemInstruction: `You are a BigQuery SQL repair agent. The user ran a query and BigQuery returned an error. Your job is to fix the SQL so it runs successfully. Return ONLY valid GoogleSQL. Do not change the intent of the query -- only fix the error.

Common fixes:
- GEOGRAPHY columns cannot be used with DISTINCT, GROUP BY, or ORDER BY. Cast to ST_ASTEXT() or exclude them.
- STRUCT/ARRAY/JSON columns cannot be used with DISTINCT. Exclude or flatten them.
- Ambiguous column names need table aliases.
- Backtick-wrap project/dataset names containing hyphens.

Return the corrected SQL and a short explanation of what you changed.`,
        prompt: `Original SQL:\n\`\`\`sql\n${finalSql}\n\`\`\`\n\nBigQuery error:\n${errMsg}`,
        schema: {
          type: 'OBJECT',
          properties: {
            sql: { type: 'STRING' },
            explanation: { type: 'STRING' },
          },
          required: ['sql'],
        },
        project,
      });

      if (fixResult?.sql) {
        finalSql = fixResult.sql;
        onStatus?.(`Retrying with corrected SQL...`);
        executed = await executeQuery(finalSql, project);
      } else {
        throw firstErr;
      }
    } catch (fixErr: unknown) {
      // If the fix attempt itself fails, throw the original error
      const fixErrMsg = fixErr instanceof Error ? fixErr.message : String(fixErr);
      if (fixErrMsg === errMsg || fixErrMsg.includes('Gemini')) throw firstErr;
      throw fixErr;
    }
  }

  // -- Heuristic data quality analysis on the result set --
  const qualityFlags = analyzeResultQuality(executed.columns, executed.rows, finalSql);

  const result: QueryResult = {
    skill: 'query',
    sql: finalSql,
    requiresConfirmation: false,
    costConfirm: null,
    columns: executed.columns,
    rows: executed.rows,
    rowCount: executed.rowCount,
    jobId: executed.jobId || undefined,
    totalBytesProcessed: costResult.totalBytesProcessed,
    costTier: costResult.tier,
    suggestedVisualization: queryPlan.suggestedVisualization,
    xAxis: queryPlan.xAxis ?? null,
    yAxis: queryPlan.yAxis ?? null,
    notableFindings: queryPlan.notableFindings ?? null,
    resultSummary: queryPlan.resultSummary ?? null,
    extractedParameters: queryPlan.parameters?.map((p: any) => ({
      name: p.name,
      type: p.type || 'string',
      default: p.default,
      description: p.description || '',
      required: false,
    })) ?? undefined,
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
