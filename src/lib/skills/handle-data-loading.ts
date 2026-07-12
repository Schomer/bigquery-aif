// src/lib/skills/handle-data-loading.ts
// Data loading/export handler: CSV export, Sheets export, scheduling, saving queries.
// Extracted from chat-orchestrator.ts.

import { callGemini, DataLoadingIntentSchema } from '../gemini-client';
import { executeQuery, exportToSheets, createScheduledQuery } from '../bigquery-client';
import { compose } from '../composer';
import { saveQuery as firestoreSaveQuery } from '../firestore-service';
import type { ChatMessage, CompositionEnvelope, DataLoadingResult, SkillManifest, StatusCallback } from '../types';

export async function handleDataLoading(
  message: string,
  _history: ChatMessage[],
  context?: { project?: string; dataset?: string; lastTable?: string; uid?: string; handoffContext?: Record<string, unknown> },
  onStatus?: StatusCallback
): Promise<CompositionEnvelope[]> {
  const project = context?.project || '';
  const hc = context?.handoffContext;
  let dataset = context?.dataset || '';
  if (dataset && project && dataset.toLowerCase() === project.toLowerCase()) {
    dataset = '';
  }

  // If handoff context carries a pre-classified operation type, skip LLM
  let intent: { operationType: string; tableName?: string; dataset?: string; sql?: string; displayName?: string; schedule?: string };
  if (hc?.operationType && typeof hc.operationType === 'string') {
    intent = {
      operationType: hc.operationType as string,
      tableName: (hc.table as string) ?? (hc.tableName as string) ?? undefined,
      sql: (hc.sql as string) ?? undefined,
      displayName: (hc.displayName as string) ?? undefined,
      schedule: (hc.schedule as string) ?? undefined,
    };
    onStatus?.(`Running ${intent.operationType} (from handoff)...`);
  } else {
    onStatus?.(`Analyzing export request (project: ${project}, dataset: ${dataset || 'none'})...`);
    intent = await callGemini({
      systemInstruction: `Classify a BigQuery data loading request. EXPORT_CSV = download as CSV. EXPORT_SHEETS = send to Google Sheets. SCHEDULE = schedule a recurring query. SAVED_QUERY = save a query for later reuse. SHARE = share or copy query results. Extract the table name, dataset name, or full SQL. For SCHEDULE, extract a schedule frequency into 'schedule' and display name into 'displayName'. Project: ${project}, dataset: ${dataset}`,
      prompt: message,
      schema: DataLoadingIntentSchema,
      project,
    });
  }

  // Use extracted dataset as fallback when context dataset is empty
  if (!dataset && intent.dataset) dataset = intent.dataset;

  // SCHEDULE — create via Data Transfer API, fall back to guidance
  if (intent.operationType === 'SCHEDULE') {
    const sql = intent.sql ?? (intent.tableName ? `SELECT * FROM \`${project}.${dataset}.${intent.tableName}\`` : '');
    const displayName = intent.displayName || 'Scheduled Query';
    const schedule = intent.schedule || 'every 24 hours';

    try {
      onStatus?.(`Creating scheduled query "${displayName}" (${schedule})...`);
      const { transferConfigName } = await createScheduledQuery(project, displayName, sql, schedule);
      const result: DataLoadingResult = {
        skill: 'data-loading',
        operationType: 'SCHEDULE_CREATED',
        message: `Scheduled query created: "${displayName}" running ${schedule}.`,
        sql,
        scheduleName: transferConfigName,
        scheduleFrequency: schedule,
      };
      return [compose('data-loading', result)];
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const fallbackMsg = `Could not create scheduled query automatically (${errMsg}).\n\nTo schedule manually, run:\nbq query --schedule="${schedule}" --display_name="${displayName}" --destination_table=${project}:${dataset || 'dataset'}.scheduled_results --replace "${sql.replace(/"/g, '\\"')}"\n\nOr use the BigQuery Console: open bigquery.cloud.google.com, paste the SQL into the editor, and click More > Schedule.`;
      const result: DataLoadingResult = {
        skill: 'data-loading',
        operationType: 'SCHEDULE_INFO',
        message: fallbackMsg,
        sql,
      };
      return [compose('data-loading', result)];
    }
  }

  // SAVED_QUERY — save to Firestore Prompts Library
  if (intent.operationType === 'SAVED_QUERY') {
    const sqlToSave = intent.sql ?? (intent.tableName ? `SELECT * FROM \`${project}.${dataset}.${intent.tableName}\`` : '');
    const label = intent.displayName || 'Saved Query';
    const uid = context?.uid;

    if (uid && sqlToSave) {
      try {
        onStatus?.(`Saving query "${label}"...`);
        await firestoreSaveQuery(uid, label, sqlToSave);
        const result: DataLoadingResult = {
          skill: 'data-loading',
          operationType: 'QUERY_SAVED',
          message: `Query saved as "${label}". You can find it in the Prompts Library.`,
          sql: sqlToSave,
          savedQueryLabel: label,
        };
        return [compose('data-loading', result)];
      } catch {
        // Fall through to guidance
      }
    }

    const result: DataLoadingResult = {
      skill: 'data-loading',
      operationType: 'SCHEDULE_INFO',
      message: 'To save this query:\n\n1. Open the BigQuery Console at bigquery.cloud.google.com\n2. Paste the SQL below into the query editor\n3. Click "Save" > "Save query" in the toolbar\n4. Name it and optionally share with your team\n\nSaved queries appear under "Saved Queries" in the BigQuery Console sidebar.',
      sql: sqlToSave,
    };
    return [compose('data-loading', result)];
  }

  // EXPORT_SHEETS — create a Google Spreadsheet and write results
  if (intent.operationType === 'EXPORT_SHEETS') {
    const sheetsSql = intent.sql ?? (intent.tableName
      ? `SELECT * FROM \`${project}.${dataset}.${intent.tableName}\` LIMIT 50000`
      : null);

    if (sheetsSql) {
      try {
        onStatus?.(`Running query for Sheets export...`);
        const executed = await executeQuery(sheetsSql, project);
        onStatus?.(`Creating Google Spreadsheet with ${executed.rowCount} rows...`);
        const title = `BQ Export - ${new Date().toLocaleDateString()} - ${intent.tableName || 'query'}`;
        const { spreadsheetUrl } = await exportToSheets(title, executed.columns, executed.rows);
        const result: DataLoadingResult = {
          skill: 'data-loading',
          operationType: 'EXPORT_SHEETS',
          message: `Exported ${executed.rowCount} rows to Google Sheets.`,
          sheetsUrl: spreadsheetUrl,
          rowCount: executed.rowCount,
          columnCount: executed.columns.length,
          sql: sheetsSql,
        };
        return [compose('data-loading', result)];
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const result: DataLoadingResult = {
          skill: 'data-loading',
          operationType: 'SCHEDULE_INFO',
          message: `Could not export to Sheets automatically (${errMsg}).\n\nTo export manually:\n1. Run the query in the BigQuery Console\n2. Click "Explore Data" > "Explore with Sheets" in the results toolbar\n3. This opens a connected Sheet that stays linked to the query\n\nNote: Direct Sheets export is limited to 10 million cells.`,
          sql: sheetsSql,
        };
        return [compose('data-loading', result)];
      }
    }

    const result: DataLoadingResult = {
      skill: 'data-loading',
      operationType: 'NOT_SUPPORTED',
      message: 'No table or SQL found to export. Please specify a table name or run a query first.',
    };
    return [compose('data-loading', result)];
  }

  // SHARE — copy results as formatted text
  if (intent.operationType === 'SHARE') {
    const shareSql = intent.sql ?? (intent.tableName
      ? `SELECT * FROM \`${project}.${dataset}.${intent.tableName}\` LIMIT 100`
      : null);

    if (shareSql) {
      try {
        onStatus?.(`Running query for sharing...`);
        const executed = await executeQuery(shareSql, project);
        // Build a text table for clipboard
        const colWidths = executed.columns.map((col, ci) => {
          const vals = executed.rows.slice(0, 20).map(r => String(r[ci] ?? '').length);
          return Math.max(col.length, ...vals, 4);
        });
        const pad = (s: string, w: number) => s + ' '.repeat(Math.max(0, w - s.length));
        const header = executed.columns.map((c, i) => pad(c, colWidths[i])).join(' | ');
        const separator = colWidths.map(w => '-'.repeat(w)).join('-+-');
        const dataRows = executed.rows.slice(0, 50).map(row =>
          row.map((cell, i) => pad(String(cell ?? ''), colWidths[i])).join(' | ')
        );
        const shareText = [header, separator, ...dataRows].join('\n');

        const result: DataLoadingResult = {
          skill: 'data-loading',
          operationType: 'SHARE_CLIPBOARD',
          message: `Query results ready to share (${executed.rowCount} rows, showing first ${Math.min(50, executed.rowCount)}).`,
          shareText,
          sql: shareSql,
          rowCount: executed.rowCount,
          columnCount: executed.columns.length,
        };
        return [compose('data-loading', result)];
      } catch {
        // Fall through
      }
    }

    const result: DataLoadingResult = {
      skill: 'data-loading',
      operationType: 'NOT_SUPPORTED',
      message: 'No table or SQL found to share. Please specify a table name or run a query first.',
    };
    return [compose('data-loading', result)];
  }

  // EXPORT_CSV — run the query and convert to CSV
  const resolvedDataset = dataset || '';
  const sql = intent.sql ?? (intent.tableName
    ? resolvedDataset
      ? `SELECT * FROM \`${project}.${resolvedDataset}.${intent.tableName}\` LIMIT 1000`
      : `SELECT * FROM \`${project}.${intent.tableName}\` LIMIT 1000`
    : null);

  if (!sql) {
    const result: DataLoadingResult = {
      skill: 'data-loading', operationType: 'NOT_SUPPORTED',
      message: 'No table or SQL found to export. Please specify a table name.',
    };
    return [compose('data-loading', result)];
  }

  const executed = await executeQuery(sql, project);

  // Build CSV
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csvLines = [
    executed.columns.join(','),
    ...executed.rows.map((row) => row.map(escape).join(',')),
  ];
  const csvContent = csvLines.join('\n');

  const result: DataLoadingResult = {
    skill: 'data-loading',
    operationType: 'EXPORT_CSV',
    message: `Ready to download ${executed.rowCount} rows.`,
    csvContent,
    rowCount: executed.rowCount,
    columnCount: executed.columns.length,
    sql,
  };
  return [compose('data-loading', result)];
}

// ─── Skill manifest ───────────────────────────────────────────────────────────

export const manifest: SkillManifest = {
  skill: 'data-loading',
  label: 'data export',
  signals: [
    { phrase: 'export', weight: 2 },
    { phrase: 'download', weight: 2 },
    { phrase: 'schedule', weight: 2 },
    { phrase: 'recurring', weight: 2 },
    { phrase: 'save this query', weight: 3 },
    { phrase: 'save this', weight: 2 },
    { phrase: 'save query', weight: 3 },
    { phrase: 'send to sheets', weight: 3 },
    { phrase: 'google sheets', weight: 3 },
    { phrase: 'export to sheets', weight: 3 },
    { phrase: 'share this', weight: 3 },
    { phrase: 'share results', weight: 3 },
    { phrase: 'copy results', weight: 3 },
    { phrase: 'connect to', weight: 2 },
    { phrase: 'load from', weight: 2 },
    { phrase: 'upload', weight: 2 },
    { phrase: 'csv', weight: 2 },
    { phrase: 'json export', weight: 3 },
  ],
  handle: handleDataLoading,
};
