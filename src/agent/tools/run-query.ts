// src/agent/tools/run-query.ts
// Phase 0 tool: run_query
// Executes a GoogleSQL query, stores full result in IndexedDB,
// returns a summary to the model context.

import { executeQuery, dryRun, type QueryProgressEvent } from '../../lib/bigquery-client';
import type { ToolDef, ToolResult } from './types';
import { resultCache } from '../result-cache';

// ── Cost gate threshold (bytes) ───────────────────────────────────────────────
// Queries estimated to scan more than this trigger a cost confirmation.
const COST_GATE_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB

// ── Tool definition ───────────────────────────────────────────────────────────

export const runQueryTool: ToolDef = {
  declaration: {
    name: 'run_query',
    description:
      'Execute a GoogleSQL query against BigQuery and return results. ' +
      'Always wrap fully-qualified table references in backticks: `project.dataset.table`. ' +
      'Results are capped at 500 rows in context; full results are cached for interactive exploration.',
    parameters: {
      type: 'OBJECT',
      properties: {
        sql: {
          type: 'STRING',
          description: 'The GoogleSQL query to execute.',
        },
        dry_run: {
          type: 'BOOLEAN',
          description:
            'If true, estimate cost without executing. Returns bytes that would be scanned. ' +
            'Use this when you suspect a query might be expensive (large tables, no partition filter).',
        },
      },
      required: ['sql'],
    },
  },
  tier: 'read',

  execute: async (args, project): Promise<ToolResult> => {
    const sql = args.sql as string;

    // Note: destructive SQL (DELETE, DROP, TRUNCATE) is gated in the loop
    // via action-classes.ts, not here. This tool only handles SELECT/WITH queries
    // and dry runs.


    // Dry run mode -- estimate cost without executing
    if (args.dry_run) {
      try {
        const estimate = await dryRun(sql, project);
        const gb = estimate.totalBytesProcessed / (1024 * 1024 * 1024);
        return {
          data: {
            dry_run: true,
            estimated_bytes: estimate.totalBytesProcessed,
            estimated_gb: Math.round(gb * 100) / 100,
            tier: estimate.tier,
            requires_confirmation: estimate.totalBytesProcessed > COST_GATE_BYTES,
          },
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { data: { error: msg }, error: msg };
      }
    }

    // Execute the query
    try {
      const result = await executeQuery(sql, project);

      // Generate a stable result_id for caching
      const result_id = `res_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      // Store full result in IndexedDB cache
      try {
        await resultCache.put({
          result_id,
          sql,
          schema: result.columns.map((col, i) => ({
            name: col,
            type: result.columnTypes?.[i] ?? 'STRING',
          })),
          rows: result.rows as unknown[][],
          created: Date.now(),
          bytes: 0,
        });
      } catch {
        // Cache failure is non-fatal -- the query still succeeded
      }

      // Cap at 500 rows for model context
      const sampleRows = result.rows.slice(0, 20);

      return {
        data: {
          columns: result.columns,
          column_types: result.columnTypes,
          row_count: result.rowCount,
          total_rows_cached: result.rows.length,
          result_id,
          sample_rows: sampleRows,
        },
        result_id,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { data: { error: msg }, error: msg };
    }

  },
};
