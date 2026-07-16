// src/lib/skills/handle-data-loading.ts
// Data loading/export handler: CSV export, Sheets export, scheduling, saving queries.
// Extracted from chat-orchestrator.ts.

import { callGemini, DataLoadingIntentSchema } from '../gemini-client';
import { executeQuery, exportToSheets, createScheduledQuery, loadCsvToTable } from '../bigquery-client';
import { compose } from '../composer';
import { saveQuery as firestoreSaveQuery } from '../firestore-service';
import type { ChatMessage, CompositionEnvelope, DataLoadingResult, CsvUploadPreview, SkillManifest, StatusCallback } from '../types';

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
    onStatus?.(`Analyzing data loading request (project: ${project}, dataset: ${dataset || 'none'})...`);
    intent = await callGemini({
      systemInstruction: `Classify a BigQuery data loading request. EXPORT_CSV = download as CSV. EXPORT_SHEETS = send to Google Sheets. SCHEDULE = schedule a recurring query. SAVED_QUERY = save a query for later reuse. SHARE = share or copy query results. UPLOAD_CSV = upload / import / load a CSV file into BigQuery. Extract the table name, dataset name, or full SQL. For SCHEDULE, extract a schedule frequency into 'schedule' and display name into 'displayName'. Project: ${project}, dataset: ${dataset}`,
      prompt: message,
      schema: DataLoadingIntentSchema,
      project,
    });
  }

  // Prefer the explicitly extracted dataset over context — user may name a specific
  // dataset in the request (e.g. "orders table in ecomm") that differs from context.
  if (intent.dataset) dataset = intent.dataset;

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

  // UPLOAD_CSV — import a CSV file into BigQuery
  if (intent.operationType === 'UPLOAD_CSV' || hc?.operationType === 'UPLOAD_CSV_EXECUTE') {
    const targetDataset = intent.dataset || dataset;
    const targetTable = intent.tableName || (hc?.tableName as string) || '';

    // Phase 3: Execute the upload (confirmation callback from UI)
    if (hc?.operationType === 'UPLOAD_CSV_EXECUTE' && hc.csvContent) {
      const csvData = hc.csvContent as string;
      const tbl = (hc.tableName as string) || targetTable;
      const ds = (hc.dataset as string) || targetDataset;
      const disposition = (hc.writeDisposition as string) || 'WRITE_APPEND';

      if (!ds || !tbl) {
        const result: DataLoadingResult = {
          skill: 'data-loading',
          operationType: 'NOT_SUPPORTED',
          message: 'Please specify a dataset and table name for the upload.',
        };
        return [compose('data-loading', result)];
      }

      try {
        onStatus?.(`Uploading CSV to \`${project}.${ds}.${tbl}\`...`);
        const loadResult = await loadCsvToTable(
          project, ds, tbl, csvData,
          disposition as 'WRITE_APPEND' | 'WRITE_TRUNCATE' | 'WRITE_EMPTY',
        );
        const result: DataLoadingResult = {
          skill: 'data-loading',
          operationType: 'UPLOAD_CSV',
          message: `Uploaded ${loadResult.rowCount.toLocaleString()} rows to \`${loadResult.tableRef}\`.`,
          rowCount: loadResult.rowCount,
          targetTable: tbl,
          targetDataset: ds,
        };
        return [compose('data-loading', result)];
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const result: DataLoadingResult = {
          skill: 'data-loading',
          operationType: 'NOT_SUPPORTED',
          message: `Upload failed: ${errMsg}`,
        };
        return [compose('data-loading', result)];
      }
    }

    // Phase 2: CSV content provided via handoff — parse and show preview
    if (hc?.csvContent) {
      const csvData = hc.csvContent as string;
      const fileName = (hc.csvFileName as string) || 'upload.csv';
      const fileSize = (hc.csvFileSize as number) || csvData.length;
      const preview = parseCsvPreview(csvData, fileName, fileSize);
      const inferredTable = targetTable || sanitizeTableName(fileName);

      const result: DataLoadingResult = {
        skill: 'data-loading',
        operationType: 'UPLOAD_PREVIEW',
        message: `Preview of ${preview.fileName}: ${preview.totalRows.toLocaleString()} rows, ${preview.columns.length} columns. Ready to upload to \`${project}.${targetDataset || '(select dataset)'}.${inferredTable}\`.`,
        uploadPreview: preview,
        targetTable: inferredTable,
        targetDataset: targetDataset || '',
        csvContent: csvData,
      };
      return [compose('data-loading', result)];
    }

    // Phase 1: No file yet — ask the UI to prompt for one
    const result: DataLoadingResult = {
      skill: 'data-loading',
      operationType: 'UPLOAD_PREVIEW',
      message: targetDataset
        ? `Ready to upload a CSV file into the \`${targetDataset}\` dataset. Attach a CSV file to continue.`
        : 'Ready to upload a CSV file. Attach a CSV file to continue.',
      needsFile: true,
      targetTable: targetTable || '',
      targetDataset: targetDataset || '',
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
    { phrase: 'schedule', weight: 1 },
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
    { phrase: 'import', weight: 2 },
    { phrase: 'load into', weight: 3 },
    { phrase: 'upload csv', weight: 3 },
    { phrase: 'upload a csv', weight: 3 },
    { phrase: 'import csv', weight: 3 },
  ],
  handle: handleDataLoading,
};

// ─── CSV parsing helpers ──────────────────────────────────────────────────────

/** Parse a CSV line handling quoted fields. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

/** Parse CSV content into a preview structure (columns + first N sample rows). */
function parseCsvPreview(csvContent: string, fileName: string, fileSize: number): CsvUploadPreview {
  const lines = csvContent.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 1) {
    return { columns: [], sampleRows: [], totalRows: 0, fileName, fileSize };
  }
  const columns = parseCsvLine(lines[0]);
  const dataLines = lines.slice(1);
  const sampleRows = dataLines.slice(0, 10).map(parseCsvLine);
  return {
    columns,
    sampleRows,
    totalRows: dataLines.length,
    fileName,
    fileSize,
  };
}

/** Convert a filename like 'my-data (2).csv' into a valid BQ table ID like 'my_data_2'. */
function sanitizeTableName(fileName: string): string {
  return fileName
    .replace(/\.csv$/i, '')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase()
    || 'uploaded_table';
}
