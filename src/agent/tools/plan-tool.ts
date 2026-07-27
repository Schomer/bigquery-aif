// src/agent/tools/plan-tool.ts
// Tool: plan_analysis
// Lets the agent decompose complex questions before writing SQL.
// When ambiguities are detected, the envelope builder produces
// a clarification card instead of a query result.

import type { ToolDef, ToolResult } from './types';

export const planAnalysisTool: ToolDef = {
  declaration: {
    name: 'plan_analysis',
    description:
      'Decompose a complex question into sub-parts and plan your approach before writing SQL. ' +
      'Call this BEFORE run_query when the user\'s request involves multiple tables, compound questions, ' +
      'vague or ambiguous terms, or when you need to decide on the best visualization. ' +
      'If you detect ambiguities that would affect the query, list them in the ambiguities array -- ' +
      'the system will show the user a clarification card to resolve them before proceeding. ' +
      'Skip this tool for simple, single-table queries where the intent is clear.',
    parameters: {
      type: 'OBJECT',
      properties: {
        sub_questions: {
          type: 'ARRAY',
          description: 'Break the user\'s question into atomic sub-questions that can each be answered with SQL.',
          items: { type: 'STRING' },
        },
        tables_needed: {
          type: 'ARRAY',
          description: 'Fully qualified BigQuery table names needed to answer the question.',
          items: { type: 'STRING' },
        },
        ambiguities: {
          type: 'ARRAY',
          description:
            'Detected ambiguities that should be resolved before writing SQL. ' +
            'If this array has entries, the system will show a clarification card to the user. ' +
            'Only include genuine ambiguities where you are less than 99% confident.',
          items: {
            type: 'OBJECT',
            properties: {
              category: {
                type: 'STRING',
                description: 'Type of ambiguity.',
                enum: ['column_reference', 'vague_filter', 'date_range', 'open_intent', 'table_ambiguity'],
              },
              question: {
                type: 'STRING',
                description: 'The clarifying question to ask the user.',
              },
              options: {
                type: 'ARRAY',
                description: 'Possible interpretations the user can choose from.',
                items: {
                  type: 'OBJECT',
                  properties: {
                    label: { type: 'STRING', description: 'Display text for the option.' },
                    value: { type: 'STRING', description: 'The text sent as the user\'s response if they pick this option.' },
                  },
                  required: ['label', 'value'],
                },
              },
            },
            required: ['category', 'question', 'options'],
          },
        },
        visualization_intent: {
          type: 'STRING',
          description: 'What visualization type this query result should produce, decided during planning.',
          enum: ['chart', 'table', 'kpi', 'map', 'none'],
        },
        plan_summary: {
          type: 'STRING',
          description:
            'Brief natural-language summary of your analysis plan. ' +
            'This is shown to the user before the query executes. ' +
            'Example: "I\'ll compare quarterly revenue from the orders table, grouped by region."',
        },
      },
      required: ['sub_questions', 'tables_needed', 'plan_summary'],
    },
  },
  tier: 'read',

  execute: async (args): Promise<ToolResult> => {
    // This tool captures the agent's planning intent.
    // Data flows through tool_args in the event system.
    // If ambiguities were detected, the envelope builder in index.ts
    // will produce a CLARIFICATION_CARD instead of proceeding to query.
    const ambiguityCount = Array.isArray(args.ambiguities) ? args.ambiguities.length : 0;
    return {
      data: {
        planned: true,
        sub_question_count: Array.isArray(args.sub_questions) ? args.sub_questions.length : 0,
        tables_identified: Array.isArray(args.tables_needed) ? args.tables_needed.length : 0,
        ambiguities_detected: ambiguityCount,
        instruction: ambiguityCount > 0
          ? 'Ambiguities detected. STOP here -- do NOT call run_query. The system will show the user a clarification card.'
          : 'Plan confirmed. Proceed to run_query with the planned approach.',
      },
    };
  },
};
