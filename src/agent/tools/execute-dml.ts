// src/agent/tools/execute-dml.ts
// Tool: execute_dml
// Executes DML/DDL statements (INSERT, UPDATE, DELETE, MERGE, CREATE TABLE, etc.).
// Destructive operations (DELETE, DROP, TRUNCATE) are gated by the loop
// via action-classes.ts confirmation checks.

import { executeDml } from '../../lib/bigquery-client';
import type { ToolDef, ToolResult } from './types';

export const executeDmlTool: ToolDef = {
  declaration: {
    name: 'execute_dml',
    description:
      'Execute a DML or DDL statement against BigQuery. ' +
      'Use this for INSERT, UPDATE, DELETE, MERGE, CREATE TABLE, ALTER TABLE, ' +
      'CREATE VIEW, DROP TABLE, and other data-modifying or schema-modifying statements. ' +
      'For SELECT queries, use run_query instead. ' +
      'Always wrap fully-qualified table references in backticks: `project.dataset.table`.',
    parameters: {
      type: 'OBJECT',
      properties: {
        sql: {
          type: 'STRING',
          description: 'The DML or DDL statement to execute.',
        },
        task_intent: {
          type: 'STRING',
          description:
            'What task this operation performs. ' +
            'Values: DATA_MODIFICATION, DATA_DELETION, SCHEMA_CHANGE.',
        },
        result_title: {
          type: 'STRING',
          description:
            'A concise, user-facing headline for the operation result ' +
            '(e.g. "Created reporting_summary table", "Deleted 47 duplicate rows").',
        },
        suggested_follow_ups: {
          type: 'ARRAY',
          description:
            'Up to 3 natural-language follow-up actions the user might want next.',
          items: { type: 'STRING' },
        },
      },
      required: ['sql'],
    },
  },
  tier: 'reversible',

  execute: async (args, project): Promise<ToolResult> => {
    const sql = args.sql as string;

    // Note: destructive SQL (DELETE, DROP, TRUNCATE) is gated in the loop
    // via action-classes.ts, not here. The loop checks ALL sql-bearing tool
    // calls against requiresConfirmation().

    try {
      const result = await executeDml(sql, project);
      return {
        data: {
          completed: true,
          rows_affected: result.rowsAffected,
          job_id: result.jobId,
        },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { data: { error: msg }, error: msg };
    }
  },
};
