// src/lib/skills/handle-schema.ts
// Schema handler: interprets schema requests, fetches metadata, handles enrichment.
// Extracted from chat-orchestrator.ts.

import { callGemini, SchemaResponseSchema, EnrichedSchemaQuerySchema, loadSkillDoc } from '../gemini-client';
import { getAvailableDatasets, resolveDefaultDataset, extractDatasetFromMessage, stepWithLink } from '../orchestrator-utils';
import { fetchSchema } from './schema';
import { executeQuery, detectBqRegion } from '../bigquery-client';
import { compose } from '../composer';
import type { ChatMessage, CompositionEnvelope, QueryResult, SkillManifest, StatusCallback } from '../types';

// Keyword-based scope classifier -- avoids a Gemini round-trip for obvious cases.
const DATASET_LIST_SIGNALS = [
  'list datasets', 'show datasets', 'list my datasets', 'what datasets',
  'list of datasets', 'list all datasets', 'show me datasets',
  'show me the datasets', 'list of all datasets', 'datasets in',
  'datasets of',
];
const TABLE_LIST_SIGNALS = [
  'list tables', 'show tables', 'what tables', 'list of tables',
  'list all tables', 'show me tables', 'show me the tables',
  'list of all tables', 'tables in', 'tables of',
];
const TABLE_DESCRIBE_SIGNALS = [
  'describe', 'schema', 'what fields', 'what columns', 'show columns',
  'list columns', 'column types', 'structure', 'what is in', "what's in",
  'tell me more', 'tell me about', 'show me more about', 'more about',
  'inspect', 'details about', 'explore', 'look at',
  'find the', 'find dataset',
];

// Enrichment detection: signals that the user wants more than a basic listing
const ENRICHMENT_PATTERNS = [
  /\bwith\b(?!out)/i,
  /\bsorted\b/i,
  /\border(?:ed)?\s+by\b/i,
  /\bonly\b/i,
  /\bthat\s+have\b/i,
  /\bmore\s+than\b/i,
  /\bless\s+than\b/i,
  /\bfor\s+each\b/i,
  /\band\s+(their|its|how|row|table|column|last|size|number|count)\b/i,
  /\bincluding\b/i,
  /\balong\b/i,
  /\blargest\b/i,
  /\bsmallest\b/i,
  /\bbiggest\b/i,
  /\bhow\s+many\b/i,
];

// ---- Fast-path enrichment: generate SQL directly for common patterns --------
// Avoids a Gemini round-trip for well-known enrichment requests.

interface FastEnrichResult {
  sql: string;
  resultSummary: string;
}

function tryFastEnrichment(
  message: string,
  project: string,
  resolvedDataset: string | undefined,
  region: string,
): FastEnrichResult | null {
  const lower = message.toLowerCase();
  const isProjectScope = !resolvedDataset;

  // -- PROJECT scope: datasets with table counts, sizes, etc. --
  if (isProjectScope) {
    // "list datasets with the number of tables" / "datasets and their table count"
    if (/\b(table|tables)\b/i.test(lower) && /\b(count|number|how\s+many|each)\b/i.test(lower)) {
      return {
        sql: `SELECT table_schema AS dataset_name, COUNT(*) AS table_count FROM \`${project}\`.\`region-${region}\`.INFORMATION_SCHEMA.TABLES GROUP BY table_schema ORDER BY table_count DESC`,
        resultSummary: `Datasets in ${project} with number of tables in each`,
      };
    }
    // "datasets with size" / "datasets sorted by size" / "largest datasets"
    if (/\b(sizes?|bytes|storage|largest|biggest|smallest)\b/i.test(lower)) {
      return {
        sql: `SELECT table_schema AS dataset_name, COUNT(*) AS table_count, SUM(total_logical_bytes) AS total_size_bytes, SUM(total_rows) AS total_rows FROM \`${project}\`.\`region-${region}\`.INFORMATION_SCHEMA.TABLE_STORAGE GROUP BY table_schema ORDER BY total_size_bytes DESC`,
        resultSummary: `Datasets in ${project} with size and row counts`,
      };
    }
    // "datasets with row count" / "datasets and how many rows"
    if (/\b(row|rows|row.?count)\b/i.test(lower)) {
      return {
        sql: `SELECT table_schema AS dataset_name, COUNT(*) AS table_count, SUM(total_rows) AS total_rows FROM \`${project}\`.\`region-${region}\`.INFORMATION_SCHEMA.TABLE_STORAGE GROUP BY table_schema ORDER BY total_rows DESC`,
        resultSummary: `Datasets in ${project} with table and row counts`,
      };
    }
  }

  // -- DATASET scope: tables with row counts, sizes, etc. --
  if (!isProjectScope) {
    const dsRef = `\`${project}.${resolvedDataset}\``;
    // "tables with row count" / "how many rows in each table"
    if (/\b(row|rows|row.?count)\b/i.test(lower) && !/\b(size|bytes|storage)\b/i.test(lower)) {
      return {
        sql: `SELECT table_name, total_rows AS row_count FROM ${dsRef}.INFORMATION_SCHEMA.TABLE_STORAGE ORDER BY total_rows DESC`,
        resultSummary: `Tables in ${resolvedDataset} with row counts`,
      };
    }
    // "tables with size" / "largest tables"
    if (/\b(size|bytes|storage|largest|biggest|smallest)\b/i.test(lower)) {
      return {
        sql: `SELECT table_name, total_rows AS row_count, total_logical_bytes AS size_bytes FROM ${dsRef}.INFORMATION_SCHEMA.TABLE_STORAGE ORDER BY total_logical_bytes DESC`,
        resultSummary: `Tables in ${resolvedDataset} with sizes and row counts`,
      };
    }
    // "tables with column count" / "how many columns"
    if (/\b(column|columns|column.?count|field|fields)\b/i.test(lower)) {
      return {
        sql: `SELECT table_name, COUNT(*) AS column_count FROM ${dsRef}.INFORMATION_SCHEMA.COLUMNS GROUP BY table_name ORDER BY column_count DESC`,
        resultSummary: `Tables in ${resolvedDataset} with column counts`,
      };
    }
  }

  return null; // no fast-path match -- fall back to Gemini
}


// Try to extract a dataset or table identifier from the message.
// Handles patterns like "tables in ecomm", "describe orders", "schema of users",
// and backtick-quoted refs like `project.dataset.table`.
function extractSchemaIdentifiers(
  message: string,
  contextDataset?: string,
  availableDatasets?: string[],
): { scope: 'PROJECT' | 'DATASET' | 'TABLE'; dataset?: string; table?: string } | null {
  const lower = message.toLowerCase();

  // Common pronouns that should never be treated as identifiers
  const PRONOUNS = new Set(['it', 'them', 'that', 'this', 'those', 'these', 'its', 'they']);

  // PROJECT scope: listing datasets
  if (DATASET_LIST_SIGNALS.some((s) => lower.includes(s))) {
    return { scope: 'PROJECT' };
  }

  // Named dataset lookup: "find the iowa_liquor_sales dataset", "find dataset ecomm"
  // Check this early so "find the X dataset and show me what's in it" resolves X
  // as a dataset before the TABLE_DESCRIBE_SIGNALS path captures the pronoun "it".
  const findDatasetMatch = message.match(
    /\bfind\s+(?:the\s+)?(?:dataset\s+)?[`]?(\w[\w-]*)[`]?(?:\s+dataset)?\b/i
  );
  if (findDatasetMatch) {
    const name = findDatasetMatch[1];
    if (!PRONOUNS.has(name.toLowerCase()) && name.toLowerCase() !== 'the') {
      // Check if it matches a known dataset
      if (availableDatasets && availableDatasets.some((ds) => ds.toLowerCase() === name.toLowerCase())) {
        return { scope: 'DATASET', dataset: name };
      }
      // Even if not in the cached list, treat it as a dataset lookup
      // (the user explicitly said "dataset")
      if (/\bdataset\b/i.test(message)) {
        return { scope: 'DATASET', dataset: name };
      }
    }
  }

  // DATASET scope: listing tables -- try to extract dataset name
  if (TABLE_LIST_SIGNALS.some((s) => lower.includes(s))) {
    // "tables in ecomm", "list tables in my_dataset", "tables in the formula_1 dataset"
    // Allow optional filler words (e.g., "are", "available", "exist") between "tables" and the preposition
    const dsMatch = message.match(/\btables?\s+(?:\w+\s+)*?(?:in|of|from)\s+(?:the\s+|a\s+|an\s+)?[`]?(\w[\w-]*)[`]?/i);
    let extracted = dsMatch?.[1];
    // Filter out noise words that the regex might capture instead of a dataset name
    if (extracted && ['dataset', 'project', 'the', 'this', 'my'].includes(extracted.toLowerCase())) {
      extracted = undefined;
    }
    // Validate against known datasets; fall back to context dataset if not recognized
    if (extracted && availableDatasets?.some((ds) => ds.toLowerCase() === extracted!.toLowerCase())) {
      return { scope: 'DATASET', dataset: extracted };
    }
    // If regex didn't capture a dataset name, try scanning for known dataset names in the message
    if (!extracted && availableDatasets) {
      const scanned = extractDatasetFromMessage(message, availableDatasets);
      if (scanned) {
        return { scope: 'DATASET', dataset: scanned };
      }
    }
    return { scope: 'DATASET', dataset: extracted ?? contextDataset };
  }

  // TABLE scope: describing a specific table
  if (TABLE_DESCRIBE_SIGNALS.some((s) => lower.includes(s))) {
    // Guard: if the message contains a column = value comparison,
    // it's a filter request, not a table lookup. Bail out.
    if (/[`']?\w+[`']?\s*=\s*(?:'[^']*'|\d+)/i.test(message)) {
      return null;
    }

    // Backtick-quoted fully qualified ref: `project.dataset.table`
    const fqMatch = message.match(/`(\w[\w-]*)\.(\w[\w-]*)\.(\w[\w]*)`/);
    if (fqMatch) {
      return { scope: 'TABLE', dataset: fqMatch[2], table: fqMatch[3] };
    }
    // Dotted dataset.table ref (no backticks): "show me more about iowa_liquor_sales.sales_deduped"
    // Must be checked BEFORE the single-name regex, which would stop at the dot.
    const dottedMatch = message.match(
      /(?:describe|schema\s+(?:of|for)|(?:tell|more|details)\s+(?:me\s+)?(?:more\s+)?about|inspect|explore|look\s+at|what'?s?\s+in|find\s+(?:the\s+)?)\s*(?:the\s+)?[`]?(\w[\w-]*)\.(\w[\w-]*)[`]?/i
    );
    if (dottedMatch) {
      return { scope: 'TABLE', dataset: dottedMatch[1], table: dottedMatch[2] };
    }
    // "describe orders", "schema of users", "tell me about orders"
    const tblMatch = message.match(
      /(?:describe|schema\s+(?:of|for)|(?:tell|more|details)\s+(?:me\s+)?(?:more\s+)?about|inspect|explore|look\s+at|what'?s?\s+in|find\s+(?:the\s+)?)\s*(?:the\s+)?[`]?(\w[\w-]*)[`]?/i
    );
    if (tblMatch) {
      const name = tblMatch[1];
      // Skip pronouns -- these are referential ("what's in it") not identifiers
      if (PRONOUNS.has(name.toLowerCase())) {
        return null; // fall back to Gemini for pronoun resolution
      }
      if (availableDatasets && availableDatasets.some((ds) => ds.toLowerCase() === name.toLowerCase())) {
        return { scope: 'DATASET', dataset: name };
      }
      // Look for an "in/from/of DATASET" qualifier after the table name
      // e.g. "describe the orders table in ecomm"
      let resolvedDs = contextDataset;
      const dsQualifier = message.match(
        /\b(?:in|from|of)\s+(?:the\s+)?(?:dataset\s+)?[`]?(\w[\w-]*)[`]?(?:\s+dataset)?/i
      );
      if (dsQualifier) {
        const candidate = dsQualifier[1];
        // Only use it if it matches a known dataset (and isn't the table name itself)
        if (candidate.toLowerCase() !== name.toLowerCase()
          && availableDatasets?.some((ds) => ds.toLowerCase() === candidate.toLowerCase())) {
          resolvedDs = candidate;
        }
      }
      return { scope: 'TABLE', dataset: resolvedDs, table: name };
    }
  }

  return null; // ambiguous -- fall back to Gemini
}

export async function handleSchema(
  message: string,
  _history: ChatMessage[],
  context?: { project?: string; dataset?: string; availableDatasets?: string[] },
  onStatus?: StatusCallback
): Promise<CompositionEnvelope[]> {
  const project = context?.project || '';

  const available = context?.availableDatasets ?? await getAvailableDatasets(project);

  // Try fast keyword extraction first
  const fast = extractSchemaIdentifiers(message, context?.dataset, available);

  let resolvedDataset: string | undefined;
  let table: string | undefined;

  if (fast) {
    resolvedDataset = fast.dataset ?? context?.dataset ?? undefined;
    table = fast.table;
    if (fast.scope === 'PROJECT') {
      resolvedDataset = undefined; // project-level: no dataset
      table = undefined;
    }
  } else {
    // Fall back to Gemini for ambiguous messages
    const skillDoc = await loadSkillDoc('schema');
    onStatus?.(`Analyzing schema request using LLM (project: ${project}${context?.dataset ? `, dataset: ${context.dataset}` : ''})...`);
    const intent = await callGemini({
      systemInstruction: `${skillDoc}\n\nExtract the requested scope from the user's message. Dataset and table should be the BigQuery identifiers mentioned. If none mentioned, return null. The active project is: ${project}${context?.dataset ? `. The active dataset context is: ${context.dataset}` : ''}.`,
      prompt: message,
      schema: SchemaResponseSchema,
      project,
    });
    resolvedDataset = intent.dataset ?? context?.dataset ?? undefined;
    table = intent.table ?? undefined;
  }

  // If the extracted/inferred table name is actually an available dataset in the project,
  // treat it as a dataset scope lookup instead of a table lookup.
  if (table) {
    const matchedDataset = available.find((ds) => ds.toLowerCase() === table!.toLowerCase());
    if (matchedDataset) {
      resolvedDataset = matchedDataset;
      table = undefined;
    }
  }

  if (table && !resolvedDataset) {
    resolvedDataset = await resolveDefaultDataset(project, undefined);
  }

  // Enriched listing: when the user asks for more than a basic list,
  // try a fast-path first (direct SQL), then fall back to Gemini for unusual requests.
  // This applies to both project-scope (datasets with sizes/rows) and dataset-scope.
  if (!table && ENRICHMENT_PATTERNS.some((p) => p.test(message))) {
    // Fast-path: generate SQL directly for common enrichment patterns
    const bqRegion = await detectBqRegion(project);
    const fastResult = tryFastEnrichment(message, project, resolvedDataset, bqRegion);
    if (fastResult) {
      onStatus?.(stepWithLink(
        `Running INFORMATION_SCHEMA query against ${resolvedDataset || project}...`,
        { project, dataset: resolvedDataset },
        resolvedDataset ? 'Open dataset in BigQuery' : 'Open project in BigQuery'
      ));
      const executed = await executeQuery(fastResult.sql, project);

      const queryResult: QueryResult = {
        skill: 'query',
        sql: fastResult.sql,
        requiresConfirmation: false,
        costConfirm: null,
        columns: executed.columns,
        rows: executed.rows,
        rowCount: executed.rowCount,
        jobId: executed.jobId || undefined,
        totalBytesProcessed: 0,
        costTier: 1,
        suggestedVisualization: 'TABLE',
        notableFindings: null,
        resultSummary: fastResult.resultSummary,
      };

      const envelope = compose('query', queryResult);
      envelope.skipSelfReview = true;
      return [envelope];
    }

    // Slow path: ask Gemini to generate the SQL for complex enrichment requests
    onStatus?.(`Building enriched query for ${resolvedDataset ? `dataset ${resolvedDataset}` : `project ${project}`}...`);

    const isProjectScope = !resolvedDataset;
    const dsRef = isProjectScope
      ? `\`${project}\`.\`region-${bqRegion}\``
      : `\`${project}.${resolvedDataset}\``;
    const scopeLabel = isProjectScope ? `project \`${project}\`` : `dataset \`${resolvedDataset}\``;

    const enrichPrompt = `Generate a BigQuery INFORMATION_SCHEMA SQL query that fulfills the user's request.

The user is requesting a listing within ${scopeLabel} with additional requirements.

Project: ${project}
${resolvedDataset ? `Dataset: ${resolvedDataset}` : `Scope: project-wide (all datasets)`}

INFORMATION_SCHEMA reference:
- Tables: SELECT * FROM ${dsRef}.INFORMATION_SCHEMA.TABLES
- Storage: SELECT table_name, total_rows, total_logical_bytes FROM ${dsRef}.INFORMATION_SCHEMA.TABLE_STORAGE
- Columns: SELECT table_name, column_name, data_type, is_nullable FROM ${dsRef}.INFORMATION_SCHEMA.COLUMNS
${isProjectScope ? `- For project-scope, use table_schema column to identify datasets.` : ''}

Rules:
- The FIRST column MUST be the primary entity identifier: alias as '${isProjectScope ? 'dataset_name' : 'table_name'}'.
- Use descriptive aliases for all other columns (e.g., 'table_count', 'total_size_bytes', 'row_count', 'last_modified').
- Always wrap identifiers containing hyphens in backticks.
- Return valid GoogleSQL only.`;

    const plan = await callGemini({
      systemInstruction: enrichPrompt,
      prompt: message,
      schema: EnrichedSchemaQuerySchema,
      project,
    });

    onStatus?.(`Running enriched INFORMATION_SCHEMA query against ${resolvedDataset || project}...`);
    const executed = await executeQuery(plan.sql, project);

    const queryResult: QueryResult = {
      skill: 'query',
      sql: plan.sql,
      requiresConfirmation: false,
      costConfirm: null,
      columns: executed.columns,
      rows: executed.rows,
      rowCount: executed.rowCount,
      jobId: executed.jobId || undefined,
      totalBytesProcessed: 0,
      costTier: 1,
      suggestedVisualization: 'TABLE',
      notableFindings: null,
      resultSummary: plan.resultSummary,
    };

    return [compose('query', queryResult)];
  }

  onStatus?.(table
    ? stepWithLink(
        `Fetching schema for table ${resolvedDataset ? `${resolvedDataset}.` : ''}${table}...`,
        { project, dataset: resolvedDataset, table },
        'Open table in BigQuery'
      )
    : resolvedDataset
      ? stepWithLink(
          `Listing tables in dataset ${resolvedDataset}...`,
          { project, dataset: resolvedDataset },
          'Open dataset in BigQuery'
        )
      : stepWithLink(
          `Listing datasets in project ${project}...`,
          { project },
          'Open project in BigQuery'
        )
  );

  // For table-level lookups, if the table isn't found in the assumed dataset,
  // search other datasets in parallel.
  if (table) {
    try {
      const result = await fetchSchema(resolvedDataset, table, project);
      return [compose('schema', result)];
    } catch (err: any) {
      if (err.message?.includes('Not found')) {
        // First: try fuzzy-matching in the same dataset.
        // Users often say "orders" when the table is "order_items" or "v_completed_orders".
        if (resolvedDataset) {
          try {
            const dsResult = await fetchSchema(resolvedDataset, undefined, project);
            const tableNames = dsResult.columns.map((c) => c.name.toLowerCase());
            const lower = table.toLowerCase();

            // Try exact plural/singular variants
            const variants = [
              lower, `${lower}s`, lower.replace(/s$/, ''),
              `v_${lower}`, `v_completed_${lower}`,
            ];
            let matchedTable = tableNames.find((t) => variants.includes(t));

            // Try substring matching: "orders" matches "order_items", "completed_orders"
            if (!matchedTable) {
              const candidates = tableNames.filter((t) =>
                t.includes(lower) || t.includes(lower.replace(/s$/, ''))
              );
              if (candidates.length === 1) {
                matchedTable = candidates[0];
              } else if (candidates.length > 1) {
                // Prefer exact-ish matches (shortest name that contains the search term)
                candidates.sort((a, b) => a.length - b.length);
                matchedTable = candidates[0];
              }
            }

            if (matchedTable) {
              // Re-fetch with the corrected table name
              const actualName = dsResult.columns.find(
                (c) => c.name.toLowerCase() === matchedTable
              )?.name ?? matchedTable;
              onStatus?.(`Matched "${table}" to table "${actualName}" in ${resolvedDataset}`);
              const corrected = await fetchSchema(resolvedDataset, actualName, project);
              return [compose('schema', corrected)];
            }
          } catch {
            // Fuzzy matching failed, continue to cross-dataset search
          }
        }

        onStatus?.(`Table ${table} not found in ${resolvedDataset}, searching other datasets...`);
        const allDatasets = await getAvailableDatasets(project);
        const otherDatasets = allDatasets.filter((ds) => ds !== resolvedDataset);
        const results = await Promise.all(
          otherDatasets.map((ds) =>
            fetchSchema(ds, table, project).catch(() => null)
          )
        );
        const found = results.find((r) => r !== null);
        if (found) return [compose('schema', found)];
      }
      throw err;
    }
  }

  const result = await fetchSchema(
    resolvedDataset,
    table,
    project,
  );

  const envelope = compose('schema', result);
  return [envelope];
}

// ─── Skill manifest ───────────────────────────────────────────────────────────

export const manifest: SkillManifest = {
  skill: 'schema',
  label: 'schema lookup',
  signals: [
    { phrase: 'schema', weight: 3 },
    { phrase: 'describe', weight: 3 },
    { phrase: 'what fields', weight: 3 },
    { phrase: 'what tables', weight: 3 },
    { phrase: 'what datasets', weight: 3 },
    { phrase: 'what is in', weight: 3 },
    { phrase: "what's in", weight: 3 },
    { phrase: 'structure', weight: 2 },
    { phrase: 'type of', weight: 2 },
    { phrase: 'data type', weight: 3 },
    { phrase: 'list tables', weight: 3 },
    { phrase: 'show tables', weight: 3 },
    { phrase: 'list datasets', weight: 3 },
    { phrase: 'show columns', weight: 3 },
    { phrase: 'list columns', weight: 3 },
    { phrase: 'what columns', weight: 3 },
    { phrase: 'column types', weight: 3 },
    { phrase: 'list of datasets', weight: 3 },
    { phrase: 'list of tables', weight: 3 },
    { phrase: 'show datasets', weight: 3 },
    { phrase: 'datasets in', weight: 3 },
    { phrase: 'tables in', weight: 3 },
    { phrase: 'datasets of', weight: 2 },
    { phrase: 'tables of', weight: 2 },
    { phrase: 'list all datasets', weight: 3 },
    { phrase: 'list all tables', weight: 3 },
    { phrase: 'show me datasets', weight: 3 },
    { phrase: 'show me the datasets', weight: 3 },
    { phrase: 'show me tables', weight: 3 },
    { phrase: 'show me the tables', weight: 3 },
    { phrase: 'list of all datasets', weight: 3 },
    { phrase: 'list of all tables', weight: 3 },
    { phrase: 'tell me more', weight: 2 },
    { phrase: 'show me more about', weight: 2 },
    { phrase: 'more about', weight: 1 },
    { phrase: 'tell me about', weight: 2 },
    { phrase: 'inspect', weight: 2 },
    { phrase: 'details about', weight: 2 },
    { phrase: 'explore', weight: 1 },
    { phrase: 'look at', weight: 1 },
    { phrase: 'show me', weight: 2 },
    { phrase: 'find the', weight: 1 },
    { phrase: 'find dataset', weight: 2 },
  ],
  handle: handleSchema,
};
