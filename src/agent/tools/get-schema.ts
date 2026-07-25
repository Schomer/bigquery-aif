// src/agent/tools/get-schema.ts
// Phase 0 tool: get_schema
// Unified schema tool supporting project/dataset/table scope.
// Wraps the existing fetchSchema() with per-session caching.

import { fetchSchema } from '../../lib/skills/schema';
import type { ToolDef, ToolResult } from './types';

// ── Per-session schema cache ──────────────────────────────────────────────────
// Keyed by "project:dataset:table" (any component may be empty).

const schemaCache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function cacheKey(project: string, dataset?: string, table?: string): string {
  return `${project}:${dataset ?? ''}:${table ?? ''}`;
}

function getCached(key: string): unknown | null {
  const entry = schemaCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    schemaCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: unknown): void {
  schemaCache.set(key, { data, ts: Date.now() });
}

/** Clear the schema cache (for testing or session reset). */
export function clearSchemaCache(): void {
  schemaCache.clear();
}

// ── Tool definition ───────────────────────────────────────────────────────────

export const getSchemaTool: ToolDef = {
  declaration: {
    name: 'get_schema',
    description:
      'Get schema information at any scope. ' +
      'Without dataset: lists all datasets in the project. ' +
      'With dataset but no table: lists all tables in the dataset. ' +
      'With dataset and table: returns full column schema (names, types, descriptions).',
    parameters: {
      type: 'OBJECT',
      properties: {
        dataset: {
          type: 'STRING',
          description: 'The dataset name. Omit to list all datasets.',
        },
        table: {
          type: 'STRING',
          description: 'The table name. Omit to list all tables in the dataset.',
        },
      },
      required: [],
    },
  },
  tier: 'read',

  execute: async (args, project): Promise<ToolResult> => {
    const dataset = args.dataset as string | undefined;
    const table = args.table as string | undefined;
    const key = cacheKey(project, dataset, table);

    // Check cache
    const cached = getCached(key);
    if (cached) {
      return { data: cached };
    }

    try {
      const schema = await fetchSchema(dataset, table, project);

      let result: unknown;

      if (!dataset) {
        // Project scope: list datasets
        result = {
          scope: 'project',
          datasets: schema.columns
            .map(c => c.name)
            .filter(n => n && n.toLowerCase() !== project.toLowerCase()),
        };
      } else if (!table) {
        // Dataset scope: list tables
        result = {
          scope: 'dataset',
          dataset,
          tables: schema.columns.map(c => c.name),
        };
      } else {
        // Table scope: full column schema
        result = {
          scope: 'table',
          dataset,
          table: schema.table ?? table,
          columns: schema.columns.map(c => ({
            name: c.name,
            type: c.type,
            ...(c.description ? { description: c.description } : {}),
            ...(c.mode ? { mode: c.mode } : {}),
          })),
          row_count: schema.rowCount,
          size_bytes: schema.sizeBytes,
        };
      }

      setCache(key, result);
      return { data: result };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);

      // If table not found, try fuzzy matching
      if (table && dataset && msg.includes('Not found')) {
        try {
          const dsSchema = await fetchSchema(dataset, undefined, project);
          const tableNames = dsSchema.columns.map(c => c.name);
          const lower = table.toLowerCase();

          // Try common variants
          const variants = [
            lower, `${lower}s`, lower.replace(/s$/, ''),
            `v_${lower}`, `v_completed_${lower}`,
          ];
          let match = tableNames.find(t => variants.includes(t.toLowerCase()));

          if (!match) {
            // Substring match
            const candidates = tableNames.filter(t =>
              t.toLowerCase().includes(lower) || t.toLowerCase().includes(lower.replace(/s$/, ''))
            );
            if (candidates.length > 0) {
              candidates.sort((a, b) => a.length - b.length);
              match = candidates[0];
            }
          }

          if (match) {
            // Retry with the correct name
            const correctSchema = await fetchSchema(dataset, match, project);
            const result = {
              scope: 'table',
              dataset,
              table: match,
              note: `Table "${table}" not found. Using closest match: "${match}".`,
              columns: correctSchema.columns.map(c => ({
                name: c.name,
                type: c.type,
                ...(c.description ? { description: c.description } : {}),
                ...(c.mode ? { mode: c.mode } : {}),
              })),
              row_count: correctSchema.rowCount,
              size_bytes: correctSchema.sizeBytes,
            };
            setCache(cacheKey(project, dataset, match), result);
            return { data: result };
          }

          // No match found -- return available tables
          return {
            data: {
              error: `Table "${table}" not found in dataset "${dataset}".`,
              available_tables: tableNames,
            },
            error: `Table not found: ${table}`,
          };
        } catch {
          // Fuzzy match attempt failed -- return original error
        }
      }

      return { data: { error: msg }, error: msg };
    }
  },
};
