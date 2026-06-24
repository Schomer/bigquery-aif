// src/lib/preview-client.ts
// Client-side table preview helper executing queries directly from the browser.

import { executeQuery } from './bigquery-client';
import type { PreviewResponse, PreviewColumn } from './types';

// Column types where DISTINCT / MIN / MAX are unsupported in BigQuery
const NO_DISTINCT_TYPES = new Set(['GEOGRAPHY', 'STRUCT', 'RECORD', 'ARRAY', 'JSON']);

function buildProfileSql(
  tableRef: string,
  columns: Array<{ name: string; type: string }>,
  safeMode: boolean
): string {
  const selects = columns.map((col) => {
    const q = `\`${col.name}\``;
    const isNumeric = ['INTEGER', 'INT64', 'FLOAT', 'FLOAT64', 'NUMERIC', 'BIGNUMERIC'].includes(col.type.toUpperCase());
    const isString = ['STRING', 'BYTES'].includes(col.type.toUpperCase());
    const canDistinct = !NO_DISTINCT_TYPES.has(col.type.toUpperCase());

    const parts: string[] = [
      `COUNTIF(${q} IS NULL) AS \`__null_${col.name}\``,
    ];

    // In safe mode, skip DISTINCT entirely to avoid unexpected type errors
    if (!safeMode && canDistinct) {
      parts.push(`COUNT(DISTINCT ${q}) AS \`__distinct_${col.name}\``);
    } else {
      parts.push(`NULL AS \`__distinct_${col.name}\``);
    }

    if (!safeMode && isNumeric) {
      parts.push(
        `CAST(MIN(${q}) AS STRING) AS \`__min_${col.name}\``,
        `CAST(MAX(${q}) AS STRING) AS \`__max_${col.name}\``,
      );
    } else if (!safeMode && isString) {
      parts.push(
        `MIN(${q}) AS \`__min_${col.name}\``,
        `MAX(${q}) AS \`__max_${col.name}\``,
      );
    } else {
      parts.push(
        `NULL AS \`__min_${col.name}\``,
        `NULL AS \`__max_${col.name}\``,
      );
    }

    return parts.join(',\n  ');
  });

  return `SELECT\n  COUNT(*) AS __total_rows,\n  ${selects.join(',\n  ')}\nFROM \`${tableRef}\``;
}

export async function fetchTablePreview(
  tableRef: string,
  columns: Array<{ name: string; type: string }>,
  project?: string
): Promise<PreviewResponse> {
  const sampleSql = `SELECT * FROM \`${tableRef}\` LIMIT 20`;

  // Build top-values queries for string columns (up to 6 columns to keep cost low)
  const stringCols = columns
    .filter((c) => ['STRING'].includes(c.type.toUpperCase()))
    .slice(0, 6);

  const topValueQueries = stringCols.map((col) =>
    executeQuery(
      `SELECT \`${col.name}\` AS value, COUNT(*) AS cnt
       FROM \`${tableRef}\`
       WHERE \`${col.name}\` IS NOT NULL
       GROUP BY 1 ORDER BY 2 DESC LIMIT 5`,
      project,
    ).catch(() => null)
  );

  // Run sample query independently so it always succeeds
  const samplePromise = executeQuery(sampleSql, project);

  // Profile query: try the full version first, fall back to safe mode on error
  let profileResult: Awaited<ReturnType<typeof executeQuery>>;
  try {
    profileResult = await executeQuery(buildProfileSql(tableRef, columns, false), project);
  } catch (err) {
    console.warn('[preview] Full profile query failed, retrying in safe mode:', err);
    try {
      profileResult = await executeQuery(buildProfileSql(tableRef, columns, true), project);
    } catch (fallbackErr) {
      console.warn('[preview] Safe-mode profile also failed:', fallbackErr);
      // Construct an empty profile so sample rows still render
      const sampleResult = await samplePromise;
      const emptyProfile: PreviewColumn[] = columns.map((col) => ({
        name: col.name,
        type: col.type,
        nullPct: null,
        distinctCount: null,
        min: null,
        max: null,
        topValues: [],
      }));
      return {
        sample: {
          columns: sampleResult.columns,
          rows: sampleResult.rows,
          rowCount: sampleResult.rowCount,
        },
        profile: emptyProfile,
      };
    }
  }

  const [sampleResult, ...topValueResults] = await Promise.all([
    samplePromise,
    ...topValueQueries,
  ]);

  // Parse profile result
  const profileRow = profileResult.rows[0] ?? [];
  const profileCols = profileResult.columns;
  const totalRows = Number(profileRow[profileCols.indexOf('__total_rows')] ?? 0);

  const profile: PreviewColumn[] = columns.map((col) => {
    const nullIdx = profileCols.indexOf(`__null_${col.name}`);
    const distinctIdx = profileCols.indexOf(`__distinct_${col.name}`);
    const minIdx = profileCols.indexOf(`__min_${col.name}`);
    const maxIdx = profileCols.indexOf(`__max_${col.name}`);

    const nullCount = nullIdx >= 0 ? Number(profileRow[nullIdx] ?? 0) : 0;
    const distinctCount = distinctIdx >= 0 ? Number(profileRow[distinctIdx] ?? 0) : null;
    const minVal = minIdx >= 0 ? String(profileRow[minIdx] ?? '') || null : null;
    const maxVal = maxIdx >= 0 ? String(profileRow[maxIdx] ?? '') || null : null;

    // Find top values for this column if it was a string col we queried
    const stringColIdx = stringCols.findIndex((sc) => sc.name === col.name);
    let topValues: Array<{ value: string; count: number }> = [];
    if (stringColIdx >= 0 && topValueResults[stringColIdx]) {
      const tvResult = topValueResults[stringColIdx];
      topValues = tvResult.rows.map((r) => ({
        value: String(r[0] ?? ''),
        count: Number(r[1] ?? 0),
      }));
    }

    return {
      name: col.name,
      type: col.type,
      nullPct: totalRows > 0 ? Math.round((nullCount / totalRows) * 1000) / 10 : null,
      distinctCount,
      min: minVal,
      max: maxVal,
      topValues,
    };
  });

  return {
    sample: {
      columns: sampleResult.columns,
      rows: sampleResult.rows,
      rowCount: sampleResult.rowCount,
    },
    profile,
  };
}
