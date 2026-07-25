// src/agent/tools/list-resources.ts
// Phase 0 tool: list_resources
// Unified resource listing: datasets, tables, views, routines.
// Consolidates list_datasets and list_tables into one parameterized tool.

import { fetchSchema } from '../../lib/skills/schema';
import type { ToolDef, ToolResult } from './types';

export const listResourcesTool: ToolDef = {
  declaration: {
    name: 'list_resources',
    description:
      'List BigQuery resources at a given scope. ' +
      'scope="datasets": lists all datasets in the project. ' +
      'scope="tables": lists all tables/views in a dataset (requires dataset parameter). ' +
      'Returns names and basic metadata.',
    parameters: {
      type: 'OBJECT',
      properties: {
        scope: {
          type: 'STRING',
          description: 'What to list: "datasets" or "tables".',
          enum: ['datasets', 'tables'],
        },
        dataset: {
          type: 'STRING',
          description: 'Required when scope is "tables". The dataset to list tables from.',
        },
      },
      required: ['scope'],
    },
  },
  tier: 'read',

  execute: async (args, project): Promise<ToolResult> => {
    const scope = args.scope as string;
    const dataset = args.dataset as string | undefined;

    try {
      if (scope === 'datasets') {
        const schema = await fetchSchema(undefined, undefined, project);
        const datasets = schema.columns
          .map(c => c.name)
          .filter(n => n && n.toLowerCase() !== project.toLowerCase());
        return {
          data: {
            scope: 'datasets',
            datasets,
            count: datasets.length,
          },
        };
      }

      if (scope === 'tables') {
        if (!dataset) {
          return {
            data: { error: 'dataset parameter is required when scope is "tables".' },
            error: 'Missing dataset parameter',
          };
        }
        const schema = await fetchSchema(dataset, undefined, project);
        const tables = schema.columns.map(c => c.name);
        return {
          data: {
            scope: 'tables',
            dataset,
            tables,
            count: tables.length,
          },
        };
      }

      return {
        data: { error: `Unknown scope: ${scope}. Use "datasets" or "tables".` },
        error: `Unknown scope: ${scope}`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { data: { error: msg }, error: msg };
    }
  },
};
