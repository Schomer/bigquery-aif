// src/lib/bq-tools.ts
// BigQuery tool definitions for the Gemini function-calling agent loop.
// Each tool has a Gemini function declaration and an executor.

import { fetchSchema } from './skills/schema';
import { executeQuery, createDataset, executeDml } from './bigquery-client';

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
        visualizationHint: {
          type: 'STRING',
          description:
            'The chart type that best fits this query\'s result. ' +
            'Provide this when the data shape strongly implies a specific visualization. ' +
            'One of: LINE_CHART, BAR_CHART, COLUMN_CHART, AREA_CHART, SCATTER, PIE_CHART, DONUT_CHART, ' +
            'HISTOGRAM, TREEMAP, FUNNEL, HEATMAP, COMPOSED_CHART, GAUGE, BOXPLOT, CANDLESTICK, ' +
            'SANKEY, GEO_POINT_MAP, USA_MAP, WORLD_MAP, TABLE.',
          enum: [
            'LINE_CHART', 'BAR_CHART', 'COLUMN_CHART', 'AREA_CHART', 'SCATTER',
            'PIE_CHART', 'DONUT_CHART', 'HISTOGRAM', 'TREEMAP', 'FUNNEL', 'HEATMAP',
            'COMPOSED_CHART', 'GAUGE', 'BOXPLOT', 'CANDLESTICK', 'SANKEY',
            'GEO_POINT_MAP', 'USA_MAP', 'WORLD_MAP', 'TABLE',
          ],
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
    try {
      const schema = await fetchSchema(args.dataset, args.table, project);
      return {
        columns: schema.columns.map((c) => ({
          name: c.name,
          type: c.type,
          ...(c.description ? { description: c.description } : {}),
        })),
      };
    } catch (err: any) {
      if (!err.message?.includes('Not found')) throw err;

      // Fuzzy match: find the closest table name in the dataset
      const dsSchema = await fetchSchema(args.dataset, undefined, project);
      const tableNames = dsSchema.columns.map((c) => c.name);
      const lower = (args.table as string).toLowerCase();
      const variants = [
        lower, `${lower}s`, lower.replace(/s$/, ''),
        `v_${lower}`, `v_completed_${lower}`,
      ];
      let match = tableNames.find((t) => variants.includes(t.toLowerCase()));
      if (!match) {
        const candidates = tableNames.filter((t) =>
          t.toLowerCase().includes(lower) || t.toLowerCase().includes(lower.replace(/s$/, ''))
        );
        if (candidates.length > 0) {
          candidates.sort((a, b) => a.length - b.length);
          match = candidates[0];
        }
      }
      if (match) {
        const schema = await fetchSchema(args.dataset, match, project);
        return {
          note: `Table "${args.table}" does not exist. The closest match is "${match}". Use "${match}" in your SQL.`,
          actualTableName: match,
          columns: schema.columns.map((c) => ({
            name: c.name,
            type: c.type,
            ...(c.description ? { description: c.description } : {}),
          })),
        };
      }
      // No match found -- return the available tables so the LLM can pick
      return {
        error: `Table "${args.table}" not found in dataset "${args.dataset}".`,
        availableTables: tableNames,
      };
    }
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

// --- Tool: create_dataset ---

const createDatasetTool: BqTool = {
  declaration: {
    name: 'create_dataset',
    description:
      'Create a new BigQuery dataset in the current project. ' +
      'Use this when the user wants to make, create, or set up a new dataset.',
    parameters: {
      type: 'OBJECT',
      properties: {
        datasetId: {
          type: 'STRING',
          description:
            'The ID for the new dataset. Must be unique within the project. ' +
            'Use letters, numbers, and underscores only.',
        },
        description: {
          type: 'STRING',
          description: 'Optional description for the dataset.',
        },
      },
      required: ['datasetId'],
    },
  },
  execute: async (args, project) => {
    const result = await createDataset(
      project,
      args.datasetId as string,
      args.description as string | undefined,
    );
    return { created: true, datasetId: result.datasetId, location: result.location };
  },
};

// --- Tool: execute_dml ---

const executeDmlTool: BqTool = {
  declaration: {
    name: 'execute_dml',
    description:
      'Execute a DML or DDL statement (INSERT, UPDATE, DELETE, CREATE TABLE, ALTER TABLE, DROP TABLE, etc.). ' +
      'Use this for statements that modify data or schema. ' +
      'Always wrap fully-qualified table references in backticks: `project.dataset.table`.',
    parameters: {
      type: 'OBJECT',
      properties: {
        sql: {
          type: 'STRING',
          description: 'The DML or DDL statement to execute.',
        },
      },
      required: ['sql'],
    },
  },
  execute: async (args, project) => {
    const result = await executeDml(args.sql as string, project);
    return {
      completed: true,
      numDmlAffectedRows: result.rowsAffected ?? 0,
    };
  },
};

// ─── Registry ────────────────────────────────────────────────────────────────

export const BQ_TOOLS: BqTool[] = [
  runQueryTool,
  getTableSchemaTool,
  listTablesTool,
  listDatasetsTool,
  createDatasetTool,
  executeDmlTool,
];

export const BQ_TOOL_MAP = new Map<string, BqTool>(
  BQ_TOOLS.map((t) => [t.declaration.name, t]),
);
