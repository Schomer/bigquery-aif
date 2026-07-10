// src/lib/bq-tools.ts
// BigQuery tool definitions for the Gemini function-calling agent loop.
// Each tool has a Gemini function declaration and an executor.

import { fetchSchema } from './skills/schema';
import { executeQuery } from './bigquery-client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BqToolDeclaration {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

export interface BqTool {
  declaration: BqToolDeclaration;
  execute: (args: Record<string, any>, project: string) => Promise<unknown>;
}

// ─── Tool: run_query ─────────────────────────────────────────────────────────

const runQueryTool: BqTool = {
  declaration: {
    name: 'run_query',
    description:
      'Execute a GoogleSQL query against BigQuery and return rows. ' +
      'Always wrap fully-qualified table references in backticks: `project.dataset.table`.',
    parameters: {
      type: 'OBJECT',
      properties: {
        sql: {
          type: 'STRING',
          description: 'The GoogleSQL query to execute.',
        },
      },
      required: ['sql'],
    },
  },
  execute: async (args, project) => {
    const result = await executeQuery(args.sql, project);
    // Return a concise payload for the LLM. Full result is captured
    // separately by the handle-query caller via the interceptor.
    const previewRows = result.rows.slice(0, 20);
    return {
      columns: result.columns,
      rowCount: result.rowCount,
      sampleRows: previewRows,
    };
  },
};

// ─── Tool: get_table_schema ──────────────────────────────────────────────────

const getTableSchemaTool: BqTool = {
  declaration: {
    name: 'get_table_schema',
    description:
      'Get column names and data types for a specific table in a dataset. ' +
      'Use this when you need to know the columns before writing SQL.',
    parameters: {
      type: 'OBJECT',
      properties: {
        dataset: { type: 'STRING', description: 'The dataset name.' },
        table: { type: 'STRING', description: 'The table name.' },
      },
      required: ['dataset', 'table'],
    },
  },
  execute: async (args, project) => {
    const schema = await fetchSchema(args.dataset, args.table, project);
    return {
      columns: schema.columns.map((c) => ({
        name: c.name,
        type: c.type,
        ...(c.description ? { description: c.description } : {}),
      })),
    };
  },
};

// ─── Tool: list_tables ───────────────────────────────────────────────────────

const listTablesTool: BqTool = {
  declaration: {
    name: 'list_tables',
    description: 'List all tables in a dataset.',
    parameters: {
      type: 'OBJECT',
      properties: {
        dataset: { type: 'STRING', description: 'The dataset name.' },
      },
      required: ['dataset'],
    },
  },
  execute: async (args, project) => {
    const schema = await fetchSchema(args.dataset, undefined, project);
    return { tables: schema.columns.map((c) => c.name) };
  },
};

// ─── Tool: list_datasets ─────────────────────────────────────────────────────

const listDatasetsTool: BqTool = {
  declaration: {
    name: 'list_datasets',
    description: 'List all datasets available in the current project.',
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: [],
    },
  },
  execute: async (_args, project) => {
    const schema = await fetchSchema(undefined, undefined, project);
    return {
      datasets: schema.columns
        .map((c) => c.name)
        .filter((n) => n && n.toLowerCase() !== project.toLowerCase()),
    };
  },
};

// ─── Registry ────────────────────────────────────────────────────────────────

export const BQ_TOOLS: BqTool[] = [
  runQueryTool,
  getTableSchemaTool,
  listTablesTool,
  listDatasetsTool,
];

export const BQ_TOOL_MAP = new Map<string, BqTool>(
  BQ_TOOLS.map((t) => [t.declaration.name, t]),
);
