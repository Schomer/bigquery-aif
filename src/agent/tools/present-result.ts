// src/agent/tools/present-result.ts
// Tool: present_result
// Lets the agent structure any response for rich UI rendering.
// Instead of returning free text that the UI can't parse, the agent
// calls this tool to describe what it wants to display and how.

import type { ToolDef, ToolResult } from './types';

export const presentResultTool: ToolDef = {
  declaration: {
    name: 'present_result',
    description:
      'Present structured information to the user with rich formatting. ' +
      'Use this instead of writing plain text when your response contains ' +
      'lists of entities, key-value summaries, step-by-step instructions, ' +
      'or any content that would be better displayed as an interactive UI. ' +
      'The UI will render items as clickable, formatted elements. ' +
      'Always use this for lists of datasets, tables, columns, jobs, or ' +
      'other BigQuery resources.',
    parameters: {
      type: 'OBJECT',
      properties: {
        format: {
          type: 'STRING',
          description:
            'How to lay out the content. ' +
            'entity_list: clickable rows with icons (for datasets, tables, columns, etc.). ' +
            'key_values: label/value grid (for summaries, stats, properties). ' +
            'summary: narrative text with supporting findings. ' +
            'steps: numbered instructions or procedures. ' +
            'info: informational text with highlighted terms.',
          enum: ['entity_list', 'key_values', 'summary', 'steps', 'info'],
        },
        title: {
          type: 'STRING',
          description:
            'A concise, user-facing headline summarizing what the output shows. ' +
            'Include enough context to stand on its own (project, dataset, scope). ' +
            'Examples: "13 datasets in project malloy-data", "Tables in ecomm", ' +
            '"Top sales by category in the USA", "Schema for orders table". ' +
            'Do NOT narrate the action ("I have retrieved...", "Here are..."). ' +
            'Describe the content, not how you got it.',
        },
        text: {
          type: 'STRING',
          description: 'Optional narrative text shown above or alongside the items.',
        },
        items: {
          type: 'ARRAY',
          description: 'Structured items to display.',
          items: {
            type: 'OBJECT',
            properties: {
              label: {
                type: 'STRING',
                description: 'Primary text for this item (e.g., dataset name, step title, property name).',
              },
              value: {
                type: 'STRING',
                description: 'Secondary text (e.g., "25 tables", "STRING", "120 GB").',
              },
              detail: {
                type: 'STRING',
                description: 'Additional context or description.',
              },
              entity_type: {
                type: 'STRING',
                description:
                  'What kind of entity this is. Drives icon and click behavior. ' +
                  'Values: dataset, table, view, column, job, schema, project, query, pipeline.',
              },
              entity_ref: {
                type: 'STRING',
                description:
                  'Fully qualified reference for click handling (e.g., "project.dataset" or "dataset.table"). ' +
                  'If omitted, the label is used.',
              },
            },
            required: ['label'],
          },
        },
        suggested_follow_ups: {
          type: 'ARRAY',
          description: 'Up to 3 follow-up questions.',
          items: { type: 'STRING' },
        },
      },
      required: ['format', 'title', 'items'],
    },
  },
  tier: 'read',

  execute: async (args): Promise<ToolResult> => {
    // This tool doesn't execute anything -- it captures the agent's
    // presentation intent. The data flows through tool_args in the
    // event system and gets picked up by the envelope builder.
    return {
      data: {
        presented: true,
        format: args.format,
        item_count: Array.isArray(args.items) ? args.items.length : 0,
      },
    };
  },
};
