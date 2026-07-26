// src/agent/tools/export-data.ts
// Tool: export_data
// Exports query results to CSV (download) or Google Sheets.

import { executeQuery, exportToSheets } from '../../lib/bigquery-client';
import type { ToolDef, ToolResult } from './types';

export const exportDataTool: ToolDef = {
  declaration: {
    name: 'export_data',
    description:
      'Export query results to CSV or Google Sheets. ' +
      'Provide the SQL query that produces the data to export. ' +
      'Use format="csv" for a downloadable CSV file. ' +
      'Use format="sheets" to create a Google Spreadsheet with the results.',
    parameters: {
      type: 'OBJECT',
      properties: {
        sql: {
          type: 'STRING',
          description: 'SQL query to execute and export results from.',
        },
        format: {
          type: 'STRING',
          description: 'Export format.',
          enum: ['csv', 'sheets'],
        },
        title: {
          type: 'STRING',
          description: 'Title for the export (Sheet name or CSV file name).',
        },
      },
      required: ['sql', 'format'],
    },
  },
  tier: 'reversible',

  execute: async (args, project): Promise<ToolResult> => {
    const sql = args.sql as string;
    const format = args.format as string;
    const title = (args.title as string) || `BQ Export - ${new Date().toLocaleDateString()}`;

    try {
      const result = await executeQuery(sql, project);

      if (format === 'sheets') {
        const { spreadsheetUrl } = await exportToSheets(
          title,
          result.columns,
          result.rows as string[][],
        );
        return {
          data: {
            format: 'sheets',
            exported: true,
            row_count: result.rowCount,
            column_count: result.columns.length,
            sheets_url: spreadsheetUrl,
          },
        };
      }

      // CSV format
      const escape = (v: unknown) => {
        const s = v === null || v === undefined ? '' : String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      };
      const csvLines = [
        result.columns.join(','),
        ...result.rows.map((row) => (row as unknown[]).map(escape).join(',')),
      ];
      const csvContent = csvLines.join('\n');

      return {
        data: {
          format: 'csv',
          exported: true,
          row_count: result.rowCount,
          column_count: result.columns.length,
          csv_content: csvContent,
        },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { data: { error: msg }, error: msg };
    }
  },
};
