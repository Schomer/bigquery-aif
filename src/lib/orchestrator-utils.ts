// src/lib/orchestrator-utils.ts
// Shared utility functions used across multiple skill handlers.
// Extracted from chat-orchestrator.ts to avoid circular dependencies.

import { fetchSchema } from './skills/schema';
import { executeQuery } from './bigquery-client';
import type { SkillName, StepInfo } from './types';

// ─── BQ Console URL builder ──────────────────────────────────────────────────

export function bqConsoleUrl(opts: { project: string; dataset?: string; table?: string; jobId?: string }): string {
  const base = 'https://console.cloud.google.com/bigquery';
  if (opts.jobId) return `${base}?project=${encodeURIComponent(opts.project)}&j=bq:US:${encodeURIComponent(opts.jobId)}&page=queryresults`;
  if (opts.table && opts.dataset) return `${base}?p=${encodeURIComponent(opts.project)}&d=${encodeURIComponent(opts.dataset)}&t=${encodeURIComponent(opts.table)}&page=table`;
  if (opts.dataset) return `${base}?p=${encodeURIComponent(opts.project)}&d=${encodeURIComponent(opts.dataset)}&page=dataset`;
  return `${base}?project=${encodeURIComponent(opts.project)}`;
}

export function stepWithLink(text: string, opts: { project: string; dataset?: string; table?: string; jobId?: string }, label?: string): StepInfo {
  return { text, link: { url: bqConsoleUrl(opts), label: label || 'Open in BigQuery' } };
}

// ─── Dataset resolution helpers ──────────────────────────────────────────────

export async function getAvailableDatasets(project: string): Promise<string[]> {
  try {
    const schema = await fetchSchema(undefined, undefined, project);
    return schema.columns
      .map((c) => c.name)
      .filter((name) => name && name.toLowerCase() !== project.toLowerCase());
  } catch {
    return [];
  }
}

export function resolveDefaultDatasetFromList(available: string[], contextDataset?: string, project?: string): string {
  if (contextDataset && project && contextDataset.toLowerCase() === project.toLowerCase()) {
    return ''; // context dataset is actually the project name -- ignore it
  }
  return contextDataset || '';
}

export async function resolveDefaultDataset(project: string, contextDataset?: string): Promise<string> {
  const available = await getAvailableDatasets(project);
  return resolveDefaultDatasetFromList(available, contextDataset, project);
}

/**
 * Scan the user's message for a known dataset name from the available list.
 * Matches case-insensitively using word boundaries to avoid substring false
 * positives. Returns the first matched dataset name (in its canonical casing)
 * or undefined if none found.
 */
export function extractDatasetFromMessage(message: string, available: string[]): string | undefined {
  if (!available.length) return undefined;
  // Sort by length descending so longer names match first (e.g., "formula_1_data"
  // is preferred over "formula_1" if both exist).
  const sorted = [...available].sort((a, b) => b.length - a.length);
  for (const ds of sorted) {
    const escaped = ds.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`, 'i');
    if (re.test(message)) return ds;
  }
  return undefined;
}

// ─── Conversation state summary ──────────────────────────────────────────────
// Produces a human-readable description of the current conversational state so
// the LLM classifier can treat follow-up prompts as continuations, not fresh
// requests. This is skill-agnostic -- it works for any prior output type.

export function buildConversationStateSummary(context?: { lastSkill?: SkillName; lastTable?: string; dataset?: string; resolvedDataset?: string; lastSavedArtifactSql?: string; lastSavedArtifactName?: string; lastTableSchema?: { name: string; type: string }[] }): string {
  if (!context?.lastSkill) {
    return 'This is the start of a new conversation. No prior output is on screen.';
  }

  // Saved artifact virtual-table context takes priority over generic query state
  if (context.lastSavedArtifactSql && context.lastSavedArtifactName) {
    const cols = context.lastTableSchema?.map((c) => c.name).join(', ') ?? 'unknown';
    const cteAlias = context.lastSavedArtifactName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    return (
      `The user ran saved query "${context.lastSavedArtifactName}". Its result is on screen. ` +
      `Columns: ${cols}. ` +
      `Any follow-up SQL MUST wrap it as a CTE: WITH ${cteAlias} AS (<saved_sql>) SELECT ... FROM ${cteAlias}. ` +
      `Route follow-up analytical prompts to the "query" skill.`
    );
  }

  const table = context.lastTable ? `table "${context.lastTable}"` : 'the current dataset';
  const dataset = context.dataset ?? context.resolvedDataset;
  const dsClause = dataset ? ` in dataset "${dataset}"` : '';

  switch (context.lastSkill) {
    case 'schema':
      return `The user is viewing the schema for ${table}${dsClause}. The schema is already loaded and visible.`;
    case 'query':
      return `The user is viewing query results from ${table}${dsClause}. The data is already on screen.`;
    case 'data-quality':
      return `The user is viewing a data quality report for ${table}${dsClause}.`;
    case 'data-management':
      return `The user just performed a data management operation on ${table}${dsClause}.`;
    case 'monitoring':
      return `The user is viewing monitoring/usage data${dsClause}.`;
    case 'discovery':
      return `The user is viewing discovery/search results${dsClause}.`;
    case 'data-loading':
      return `The user just performed an export or data loading operation${dsClause}.`;
    default:
      return `The user's last action was: ${context.lastSkill} on ${table}${dsClause}.`;
  }
}

// ─── Schema context builder ──────────────────────────────────────────────────

export async function buildSchemaContext(project: string, dataset: string, priorityTable?: string): Promise<string> {
  if (!dataset) return '';
  try {
    const datasetSchema = await fetchSchema(dataset, undefined, project);
    const tables = datasetSchema.columns.map((col) => col.name);
    if (!tables.length) return '';

    // Ensure the priority table (the one the user is asking about) is always
    // included in the schema context sent to the LLM, even if the dataset has
    // many tables and the target would otherwise be outside the top-5 slice.
    let tablesToFetch: string[];
    if (priorityTable && tables.some((t) => t.toLowerCase() === priorityTable.toLowerCase())) {
      const canonical = tables.find((t) => t.toLowerCase() === priorityTable.toLowerCase())!;
      const rest = tables.filter((t) => t.toLowerCase() !== priorityTable.toLowerCase());
      tablesToFetch = [canonical, ...rest.slice(0, 4)];
    } else {
      tablesToFetch = tables.slice(0, 5);
    }

    const schemaPromises = tablesToFetch.map(async (tableId) => {
      try {
        const tableSchema = await fetchSchema(dataset, tableId, project);
        const colString = tableSchema.columns
          .map((col) => `${col.name} (${col.type})`)
          .join(', ');
        let schemaLine = `Table \`${project}.${dataset}.${tableId}\` columns: ${colString}`;

        // Fetch sample distinct values for string columns so the LLM can
        // see actual data patterns and generate correct SQL (matching
        // strategy, case handling, aggregation grouping, etc.).
        const stringCols = tableSchema.columns
          .filter((col) => col.type === 'STRING')
          .slice(0, 3);
        if (stringCols.length > 0) {
          try {
            const sampleParts = await Promise.all(
              stringCols.map(async (col) => {
                try {
                  const sampleResult = await executeQuery(
                    `SELECT DISTINCT \`${col.name}\` FROM \`${project}.${dataset}.${tableId}\` WHERE \`${col.name}\` IS NOT NULL LIMIT 3`,
                    project
                  );
                  const values = sampleResult.rows
                    .map((r) => r[0])
                    .filter(Boolean)
                    .map((v) => `"${v}"`);
                  if (values.length > 0) {
                    return `  ${col.name} sample values: ${values.join(', ')}`;
                  }
                } catch {
                  // Ignore per-column sample failures
                }
                return null;
              })
            );
            const validSamples = sampleParts.filter(Boolean);
            if (validSamples.length > 0) {
              schemaLine += `\n${validSamples.join('\n')}`;
            }
          } catch {
            // Ignore sample fetch failures -- schema context without
            // samples is still useful
          }
        }

        return schemaLine;
      } catch {
        return null;
      }
    });

    const schemaStrings = (await Promise.all(schemaPromises)).filter(Boolean);
    if (schemaStrings.length > 0) {
      return `\nTable Schemas in default dataset:\n${schemaStrings.join('\n')}\n`;
    }
  } catch (err) {
    console.warn('[buildSchemaContext failed]', err);
  }
  return '';
}
