// src/lib/app-executor.ts
// Parameter substitution engine, reactive query runner, and BigQuery metadata persistence
// for interactive data apps and dashboards.

import { executeQuery, executeDml } from './bigquery-client';
import type { BuilderDocument, BuilderTile, AppFilterControl, TileSnapshot } from './builder-types';

/**
 * Substitute reactive filter values into a parameterized SQL template.
 * Supports:
 * - Date ranges: {{start_date}}, {{end_date}}
 * - Dropdown & text parameters: {{param}}, '{{param}}', @param
 * - Numeric values: substituted unquoted to preserve BigQuery INT64/FLOAT typing
 * - Boolean values: substituted as TRUE/FALSE keywords
 * - Multi-select: substituted as comma-separated IN-list: 'a', 'b' or 1, 2
 * - Search terms: substituted safely with quotes
 */
export function substituteSqlParameters(
  templateSql: string,
  filterValues: Record<string, unknown>,
  globalFilters: AppFilterControl[] = [],
  bindings?: Record<string, string>,
): string {
  if (!templateSql) return '';
  let sql = templateSql;

  // Process standard date parameters if present
  const startDate = (filterValues['start_date'] ?? filterValues['startDate'] ?? '') as string;
  const endDate = (filterValues['end_date'] ?? filterValues['endDate'] ?? '') as string;

  if (startDate) {
    sql = sql.replace(/\{\{start_date\}\}/g, startDate);
  } else {
    sql = sql.replace(/\{\{start_date\}\}/g, '1900-01-01');
  }

  if (endDate) {
    sql = sql.replace(/\{\{end_date\}\}/g, endDate);
  } else {
    sql = sql.replace(/\{\{end_date\}\}/g, '2100-12-31');
  }

  // Iterate over all active filter values
  for (const [key, val] of Object.entries(filterValues)) {
    if (val === undefined || val === null || val === '') continue;
    if (key === 'start_date' || key === 'startDate' || key === 'end_date' || key === 'endDate') continue;

    // Find the param placeholder (can be key, {{key}}, or mapped via bindings)
    const targetParam = bindings?.[key] || key;
    const cleanParam = targetParam.replace(/^\{\{|\}\}$/g, '');
    const placeholder1 = `{{${cleanParam}}}`;
    const placeholder2 = `@${cleanParam}`;

    // Handle array / MULTI_SELECT values
    if (Array.isArray(val)) {
      if (val.length === 0) continue;
      const allNumeric = val.every((v) => typeof v === 'number' || (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())));
      const inList = allNumeric
        ? val.map((v) => String(v).trim()).join(', ')
        : val.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(', ');

      sql = sql.replaceAll(placeholder1, inList);
      sql = sql.replaceAll(placeholder2, inList);
      continue;
    }

    // Handle scalar values
    const strVal = String(val).trim();
    const isNumeric = typeof val === 'number' || (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(strVal) && !isNaN(Number(strVal)));
    const isBool = typeof val === 'boolean' || /^(true|false|TRUE|FALSE)$/.test(strVal);

    if (isNumeric) {
      // Unquoted substitution for numeric columns
      const bareNum = strVal;
      sql = sql.replaceAll(`'${placeholder1}'`, bareNum);
      sql = sql.replaceAll(placeholder1, bareNum);
      sql = sql.replaceAll(`'${placeholder2}'`, bareNum);
      sql = sql.replaceAll(placeholder2, bareNum);
    } else if (isBool) {
      // Unquoted substitution for booleans
      const bareBool = strVal.toUpperCase();
      sql = sql.replaceAll(`'${placeholder1}'`, bareBool);
      sql = sql.replaceAll(placeholder1, bareBool);
      sql = sql.replaceAll(`'${placeholder2}'`, bareBool);
      sql = sql.replaceAll(placeholder2, bareBool);
    } else {
      // String substitution with single quote escaping
      const escapedStr = strVal.replace(/'/g, "''");
      const quotedStr = `'${escapedStr}'`;

      // If placeholder is already enclosed in quotes, replace inner text
      sql = sql.replaceAll(`'${placeholder1}'`, quotedStr);
      sql = sql.replaceAll(`'${placeholder2}'`, quotedStr);
      // Otherwise replace bare placeholder with quoted literal
      sql = sql.replaceAll(placeholder1, quotedStr);
      sql = sql.replaceAll(placeholder2, quotedStr);
    }
  }

  return sql;
}

/**
 * Execute a single tile's query with parameter substitution.
 */
export async function executeTileQuery(
  tile: BuilderTile,
  filterValues: Record<string, unknown>,
  globalFilters: AppFilterControl[] = [],
  project: string,
): Promise<TileSnapshot> {
  const baseSql = tile.parameterizedSql || tile.cachedSql || '';
  if (!baseSql) {
    throw new Error('Tile has no SQL query.');
  }

  const resolvedSql = substituteSqlParameters(
    baseSql,
    filterValues,
    globalFilters,
    tile.parameterBindings,
  );

  const result = await executeQuery(resolvedSql, project);
  return {
    columns: result.columns,
    rows: result.rows as (string | number | boolean | null)[][],
    rowCount: result.rowCount,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Fetch distinct filter options dynamically from BigQuery.
 */
export async function fetchFilterOptionsFromBigQuery(
  optionsSql: string,
  project: string,
): Promise<string[]> {
  try {
    const result = await executeQuery(optionsSql, project);
    if (!result.rows || result.rows.length === 0) return [];
    return result.rows
      .map((r) => String(r[0] ?? ''))
      .filter((v) => v.length > 0);
  } catch (err) {
    console.warn('[app-executor] Failed to fetch filter options:', err);
    return [];
  }
}

/**
 * Persist an entire dashboard or interactive data app configuration directly into BigQuery.
 * Creates/uses `_metadata.dashboards` table in the selected dataset.
 */
export async function saveDocumentToBigQuery(
  doc: BuilderDocument,
  project: string,
  datasetName = '_metadata',
): Promise<{ success: boolean; table: string; message: string }> {
  if (!project) throw new Error('Google Cloud Project is required.');

  const targetTable = `\`${project}.${datasetName}._aif_dashboards\``;

  // Ensure dataset & table exist
  const createTableSql = `
    CREATE TABLE IF NOT EXISTS ${targetTable} (
      id STRING NOT NULL,
      type STRING NOT NULL,
      name STRING NOT NULL,
      description STRING,
      tiles_count INT64,
      created_at TIMESTAMP,
      updated_at TIMESTAMP,
      config JSON
    );
  `;

  try {
    await executeDml(createTableSql, project);
  } catch (err) {
    // If dataset doesn't exist, try creating dataset or save into first available dataset
    console.warn('[app-executor] Ensure table failed:', err);
  }

  // Sanitize and serialize config
  const serializedConfig = JSON.stringify(doc).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const now = new Date().toISOString();
  const safeName = doc.name.replace(/'/g, "''");
  const safeDesc = (doc.description || '').replace(/'/g, "''");
  const safeId = doc.id.replace(/'/g, "''");
  const safeType = (doc.type || 'dashboard').replace(/'/g, "''");

  const mergeSql = `
    MERGE ${targetTable} T
    USING (
      SELECT
        '${safeId}' AS id,
        '${safeType}' AS type,
        '${safeName}' AS name,
        '${safeDesc}' AS description,
        ${doc.tiles.length} AS tiles_count,
        TIMESTAMP('${doc.createdAt || now}') AS created_at,
        TIMESTAMP('${now}') AS updated_at,
        PARSE_JSON('${serializedConfig}') AS config
    ) S
    ON T.id = S.id
    WHEN MATCHED THEN
      UPDATE SET
        name = S.name,
        type = S.type,
        description = S.description,
        tiles_count = S.tiles_count,
        updated_at = S.updated_at,
        config = S.config
    WHEN NOT MATCHED THEN
      INSERT (id, type, name, description, tiles_count, created_at, updated_at, config)
      VALUES (S.id, S.type, S.name, S.description, S.tiles_count, S.created_at, S.updated_at, S.config);
  `;

  await executeDml(mergeSql, project);
  return {
    success: true,
    table: `${project}.${datasetName}._aif_dashboards`,
    message: `Saved "${doc.name}" to BigQuery table ${project}.${datasetName}._aif_dashboards`,
  };
}
