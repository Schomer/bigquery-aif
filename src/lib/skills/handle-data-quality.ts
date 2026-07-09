// src/lib/skills/handle-data-quality.ts
// Data quality handler: profile, nulls, duplicates, freshness, completeness, range, RI, drift.
// Extracted from chat-orchestrator.ts.

import { callGemini, DqIntentSchema } from '../gemini-client';
import { getAvailableDatasets, resolveDefaultDatasetFromList, extractDatasetFromMessage } from '../orchestrator-utils';
import { fetchSchema } from './schema';
import { dryRun, executeQuery } from '../bigquery-client';
import { compose } from '../composer';
import type { ChatMessage, CompositionEnvelope, DataQualityResult, DqFinding, QueryResult, SkillManifest, StatusCallback } from '../types';

export async function handleDataQuality(
  message: string,
  _history: ChatMessage[],
  context?: { project?: string; dataset?: string; lastTable?: string; resolvedDataset?: string; availableDatasets?: string[]; handoffContext?: Record<string, unknown> },
  onStatus?: StatusCallback
): Promise<CompositionEnvelope[]> {
  const project = context?.project || '';
  const hc = context?.handoffContext;

  // Parallelize dataset resolution
  const available = context?.availableDatasets ?? await getAvailableDatasets(project);
  let dataset = context?.resolvedDataset ?? resolveDefaultDatasetFromList(available, context?.dataset, project);
  if (!dataset) {
    dataset = extractDatasetFromMessage(message, available) ?? '';
  }

  // If handoff context carries a pre-classified check type, skip LLM classification
  let intent: { checkType: string; table?: string; dataset?: string };
  if (hc?.checkType && typeof hc.checkType === 'string') {
    intent = {
      checkType: hc.checkType as string,
      table: (hc.table as string) ?? undefined,
      dataset: (hc.dataset as string) ?? undefined,
    };
    onStatus?.(`Running ${intent.checkType} check (from handoff)...`);
  } else {
    onStatus?.(`Classifying quality check type for: "${message.slice(0, 60)}${message.length > 60 ? '...' : ''}"`);
    intent = await callGemini({
      systemInstruction: `You classify BigQuery data quality requests. Extract check type and table name. Available check types: PROFILE (general stats), NULLS (null analysis), DUPLICATES (find duplicate rows), FRESHNESS (when was the table last updated), COMPLETENESS (overall completeness percentage across all columns), RANGE_VALIDATION (check numeric columns for out-of-range values), REFERENTIAL_INTEGRITY (check foreign key relationships for orphaned rows), SCHEMA_DRIFT (compare current schema against expected structure). The active project is ${project}, default dataset is ${dataset}, available datasets are: ${available.join(', ')}.`,
      prompt: message,
      schema: DqIntentSchema,
      project,
    });
  }
  const tableName = intent.table ?? context?.lastTable ?? null;
  let ds = intent.dataset ?? dataset;
  if (ds && ds.toLowerCase() === project.toLowerCase()) {
    ds = dataset;
  }
  const checkedAt = new Date().toISOString();

  // FRESHNESS -- no query needed, use schema metadata
  if (intent.checkType === 'FRESHNESS') {
    const schema = await fetchSchema(ds, tableName ?? undefined, project);
    const lastMod = schema.lastModifiedTime ?? 'unknown';
    const ageMs = lastMod !== 'unknown' ? Date.now() - new Date(lastMod).getTime() : null;
    const ageHours = ageMs !== null ? Math.round(ageMs / 3_600_000) : null;
    const severity: DqFinding['severity'] = ageHours === null ? 'INFO' : ageHours > 48 ? 'ISSUE' : ageHours > 24 ? 'WARNING' : 'INFO';
    const result: DataQualityResult = {
      skill: 'data-quality',
      checkType: 'FRESHNESS',
      table: `${project}.${ds}.${tableName ?? ''}`,
      sql: '',
      findings: [{
        column: '_table',
        metric: 'last_modified',
        value: lastMod,
        severity,
      }],
      summary: { rowsScanned: 0, issuesFound: severity !== 'INFO' ? 1 : 0, checkedAt },
    };
    return [compose('data-quality', result)];
  }

  if (!tableName) {
    return [compose('data-quality', {
      skill: 'data-quality', checkType: intent.checkType,
      table: `${project}.${ds}.<table>`, sql: '',
      findings: [{ column: '_', metric: 'error', value: 'No table name found -- please specify a table', severity: 'INFO' }],
      summary: { rowsScanned: 0, issuesFound: 0, checkedAt },
    } as DataQualityResult)];
  }

  const fqTable = `\`${project}.${ds}.${tableName}\``;

  // Fetch schema to get column names + types
  const schema = await fetchSchema(ds, tableName, project);
  const columns = schema.columns.filter((c) => !['RECORD', 'REPEATED'].includes(c.type));

  let sql = '';
  const findings: DqFinding[] = [];

  if (intent.checkType === 'DUPLICATES') {
    // Find key-like columns
    const keyCol = columns.find((c) => c.name === 'id' || c.name.endsWith('_id') || c.name.endsWith('_key'))?.name ?? columns[0]?.name;
    if (!keyCol) {
      return [compose('data-quality', { skill: 'data-quality', checkType: 'DUPLICATES', table: fqTable, sql: '', findings: [], summary: { rowsScanned: 0, issuesFound: 0, checkedAt } } as DataQualityResult)];
    }
    sql = `SELECT ${keyCol}, COUNT(*) as duplicate_count FROM ${fqTable} GROUP BY ${keyCol} HAVING COUNT(*) > 1 ORDER BY duplicate_count DESC LIMIT 50`;
    onStatus?.(`Checking for duplicates in ${fqTable} using key column ${keyCol}...`);
    const executed = await executeQuery(sql, project);
    const dupCount = executed.rowCount;
    if (dupCount > 0) {
      findings.push({ column: keyCol, metric: 'duplicate_groups', value: dupCount, severity: 'ISSUE' });
    }
    const result: DataQualityResult = {
      skill: 'data-quality', checkType: 'DUPLICATES', table: fqTable, sql,
      findings,
      summary: { rowsScanned: executed.rowCount, issuesFound: dupCount > 0 ? 1 : 0, checkedAt },
    };
    return [compose('data-quality', result)];
  }

  // COMPLETENESS -- compute null rate across all columns, then aggregate
  if (intent.checkType === 'COMPLETENESS') {
    const nullExprs = columns.map((col) =>
      `COUNTIF(${col.name} IS NULL) AS \`${col.name}__nulls\``
    );
    sql = `SELECT COUNT(*) AS __total_rows, ${nullExprs.join(', ')} FROM ${fqTable}`;
    onStatus?.(`Computing completeness across ${columns.length} columns in ${fqTable}...`);
    const executed = await executeQuery(sql, project);
    const row = executed.rows[0] ?? [];
    const colMap = Object.fromEntries(executed.columns.map((c, i) => [c, row[i]]));
    const totalRows = Number(colMap['__total_rows'] ?? 0);

    let totalCells = 0;
    let totalFilled = 0;
    for (const col of columns) {
      const nullCount = Number(colMap[`${col.name}__nulls`] ?? 0);
      const fillRate = totalRows > 0 ? (totalRows - nullCount) / totalRows : 1;
      totalCells += totalRows;
      totalFilled += totalRows - nullCount;
      const severity: DqFinding['severity'] = fillRate < 0.5 ? 'ISSUE' : fillRate < 0.9 ? 'WARNING' : 'INFO';
      findings.push({ column: col.name, metric: 'fill_rate', value: parseFloat(fillRate.toFixed(4)), severity });
    }
    const overallCompleteness = totalCells > 0 ? totalFilled / totalCells : 1;
    findings.unshift({
      column: '_table',
      metric: 'overall_completeness',
      value: parseFloat(overallCompleteness.toFixed(4)),
      severity: overallCompleteness < 0.8 ? 'ISSUE' : overallCompleteness < 0.95 ? 'WARNING' : 'INFO',
    });

    const issueCount = findings.filter((f) => f.severity !== 'INFO').length;
    const result: DataQualityResult = {
      skill: 'data-quality', checkType: 'COMPLETENESS', table: fqTable, sql,
      findings,
      summary: { rowsScanned: totalRows, issuesFound: issueCount, checkedAt },
    };
    return [compose('data-quality', result)];
  }

  // RANGE_VALIDATION -- check numeric columns for min/max out-of-range values
  if (intent.checkType === 'RANGE_VALIDATION') {
    const numericCols = columns.filter((c) =>
      ['INT64', 'FLOAT64', 'NUMERIC', 'BIGNUMERIC', 'INTEGER', 'FLOAT'].includes(c.type)
    );
    if (numericCols.length === 0) {
      const result: DataQualityResult = {
        skill: 'data-quality', checkType: 'RANGE_VALIDATION', table: fqTable, sql: '',
        findings: [{ column: '_table', metric: 'info', value: 'No numeric columns found for range validation', severity: 'INFO' }],
        summary: { rowsScanned: 0, issuesFound: 0, checkedAt },
      };
      return [compose('data-quality', result)];
    }

    // Ask Gemini for expected ranges
    const RangeSchema = {
      type: 'OBJECT' as const,
      properties: {
        ranges: {
          type: 'ARRAY' as const,
          items: {
            type: 'OBJECT' as const,
            properties: {
              column: { type: 'STRING' as const },
              min: { type: 'NUMBER' as const },
              max: { type: 'NUMBER' as const },
            },
            required: ['column', 'min', 'max'],
          },
        },
      },
      required: ['ranges'],
    };
    const rangeResult = await callGemini({
      systemInstruction: `Given a BigQuery table ${fqTable} with numeric columns: ${numericCols.map((c) => `${c.name} (${c.type})`).join(', ')}, suggest reasonable expected min/max ranges for each column based on the column name and type. Be practical -- use domain knowledge (e.g. age: 0-150, percentage: 0-100, price: 0-1000000).`,
      prompt: `Return expected ranges for these numeric columns: ${numericCols.map((c) => c.name).join(', ')}`,
      schema: RangeSchema,
      project,
    });

    const ranges: Array<{ column: string; min: number; max: number }> = rangeResult?.ranges ?? [];
    if (ranges.length === 0) {
      // Fallback: just report min/max stats
      const statsExprs = numericCols.flatMap((col) => [
        `MIN(CAST(${col.name} AS FLOAT64)) AS \`${col.name}__min\``,
        `MAX(CAST(${col.name} AS FLOAT64)) AS \`${col.name}__max\``,
      ]);
      sql = `SELECT COUNT(*) AS __total_rows, ${statsExprs.join(', ')} FROM ${fqTable}`;
      onStatus?.(`Checking value ranges for ${numericCols.length} numeric columns in ${fqTable}...`);
      const executed = await executeQuery(sql, project);
      const row = executed.rows[0] ?? [];
      const colMap = Object.fromEntries(executed.columns.map((c, i) => [c, row[i]]));
      const totalRows = Number(colMap['__total_rows'] ?? 0);
      for (const col of numericCols) {
        findings.push({ column: col.name, metric: 'min_value', value: Number(colMap[`${col.name}__min`] ?? 0), severity: 'INFO' });
        findings.push({ column: col.name, metric: 'max_value', value: Number(colMap[`${col.name}__max`] ?? 0), severity: 'INFO' });
      }
      const result: DataQualityResult = {
        skill: 'data-quality', checkType: 'RANGE_VALIDATION', table: fqTable, sql,
        findings,
        summary: { rowsScanned: totalRows, issuesFound: 0, checkedAt },
      };
      return [compose('data-quality', result)];
    }

    // Build query to check ranges
    const rangeExprs = ranges.flatMap((r) => [
      `MIN(CAST(${r.column} AS FLOAT64)) AS \`${r.column}__min\``,
      `MAX(CAST(${r.column} AS FLOAT64)) AS \`${r.column}__max\``,
      `COUNTIF(CAST(${r.column} AS FLOAT64) < ${r.min} OR CAST(${r.column} AS FLOAT64) > ${r.max}) AS \`${r.column}__out_of_range\``,
    ]);
    sql = `SELECT COUNT(*) AS __total_rows, ${rangeExprs.join(', ')} FROM ${fqTable}`;
    onStatus?.(`Validating value ranges for ${ranges.length} columns in ${fqTable}...`);
    const executed = await executeQuery(sql, project);
    const row = executed.rows[0] ?? [];
    const colMap = Object.fromEntries(executed.columns.map((c, i) => [c, row[i]]));
    const totalRows = Number(colMap['__total_rows'] ?? 0);

    for (const r of ranges) {
      const outOfRange = Number(colMap[`${r.column}__out_of_range`] ?? 0);
      const actualMin = Number(colMap[`${r.column}__min`] ?? 0);
      const actualMax = Number(colMap[`${r.column}__max`] ?? 0);
      const severity: DqFinding['severity'] = outOfRange > 0 ? 'ISSUE' : 'INFO';
      findings.push({ column: r.column, metric: 'expected_range', value: `${r.min} - ${r.max}`, severity: 'INFO' });
      findings.push({ column: r.column, metric: 'actual_range', value: `${actualMin} - ${actualMax}`, severity: 'INFO' });
      findings.push({ column: r.column, metric: 'out_of_range_count', value: outOfRange, severity });
    }

    const issueCount = findings.filter((f) => f.severity !== 'INFO').length;
    const result: DataQualityResult = {
      skill: 'data-quality', checkType: 'RANGE_VALIDATION', table: fqTable, sql,
      findings,
      summary: { rowsScanned: totalRows, issuesFound: issueCount, checkedAt },
    };
    return [compose('data-quality', result)];
  }

  // REFERENTIAL_INTEGRITY -- check FK relationships for orphaned rows
  if (intent.checkType === 'REFERENTIAL_INTEGRITY') {
    // Ask Gemini to identify likely FK relationships
    const FkSchema = {
      type: 'OBJECT' as const,
      properties: {
        relationships: {
          type: 'ARRAY' as const,
          items: {
            type: 'OBJECT' as const,
            properties: {
              fkColumn: { type: 'STRING' as const },
              referencedTable: { type: 'STRING' as const },
              referencedColumn: { type: 'STRING' as const },
            },
            required: ['fkColumn', 'referencedTable', 'referencedColumn'],
          },
        },
      },
      required: ['relationships'],
    };
    const fkResult = await callGemini({
      systemInstruction: `Given a BigQuery table ${fqTable} in project ${project} dataset ${ds} with columns: ${columns.map((c) => `${c.name} (${c.type})`).join(', ')}, identify likely foreign key relationships. Look for columns ending in _id, _key, or matching common patterns. For referencedTable, use the format \`${project}.${ds}.table_name\`. If no likely FK relationships exist, return an empty array.`,
      prompt: `Identify foreign key relationships for ${fqTable}`,
      schema: FkSchema,
      project,
    });

    const relationships: Array<{ fkColumn: string; referencedTable: string; referencedColumn: string }> = fkResult?.relationships ?? [];
    if (relationships.length === 0) {
      const result: DataQualityResult = {
        skill: 'data-quality', checkType: 'REFERENTIAL_INTEGRITY', table: fqTable, sql: '',
        findings: [{ column: '_table', metric: 'info', value: 'No foreign key relationships identified', severity: 'INFO' }],
        summary: { rowsScanned: 0, issuesFound: 0, checkedAt },
      };
      return [compose('data-quality', result)];
    }

    // Check each relationship with LEFT JOIN ... WHERE IS NULL
    onStatus?.(`Checking ${relationships.length} FK relationships for orphaned rows in ${fqTable}...`);
    let totalOrphans = 0;
    const queries: string[] = [];
    for (const rel of relationships) {
      const refTable = rel.referencedTable.includes('.') ? `\`${rel.referencedTable}\`` : `\`${project}.${ds}.${rel.referencedTable}\``;
      const checkSql = `SELECT COUNT(*) AS orphan_count FROM ${fqTable} a LEFT JOIN ${refTable} b ON a.${rel.fkColumn} = b.${rel.referencedColumn} WHERE b.${rel.referencedColumn} IS NULL AND a.${rel.fkColumn} IS NOT NULL`;
      queries.push(checkSql);
      try {
        const executed = await executeQuery(checkSql, project);
        const orphanCount = Number(executed.rows[0]?.[0] ?? 0);
        totalOrphans += orphanCount;
        const severity: DqFinding['severity'] = orphanCount > 0 ? 'ISSUE' : 'INFO';
        findings.push({
          column: rel.fkColumn,
          metric: 'orphaned_rows',
          value: orphanCount,
          severity,
        });
        findings.push({
          column: rel.fkColumn,
          metric: 'references',
          value: `${rel.referencedTable}.${rel.referencedColumn}`,
          severity: 'INFO',
        });
      } catch {
        findings.push({
          column: rel.fkColumn,
          metric: 'check_error',
          value: `Could not verify against ${rel.referencedTable}`,
          severity: 'WARNING',
        });
      }
    }

    sql = queries.join(';\n');
    const issueCount = findings.filter((f) => f.severity !== 'INFO').length;
    const result: DataQualityResult = {
      skill: 'data-quality', checkType: 'REFERENTIAL_INTEGRITY', table: fqTable, sql,
      findings,
      summary: { rowsScanned: totalOrphans, issuesFound: issueCount, checkedAt },
    };
    return [compose('data-quality', result)];
  }

  // SCHEMA_DRIFT -- show current schema profile (no stored baseline yet)
  if (intent.checkType === 'SCHEMA_DRIFT') {
    sql = `SELECT column_name, data_type, is_nullable, ordinal_position FROM \`${project}.${ds}\`.INFORMATION_SCHEMA.COLUMNS WHERE table_name = '${tableName}' ORDER BY ordinal_position`;
    onStatus?.(`Fetching current schema for ${fqTable} to check for drift...`);
    const executed = await executeQuery(sql, project);

    for (const row of executed.rows) {
      const colName = String(row[0] ?? '');
      const dataType = String(row[1] ?? '');
      const nullable = String(row[2] ?? '');
      const position = Number(row[3] ?? 0);
      findings.push({
        column: colName,
        metric: 'data_type',
        value: dataType,
        severity: 'INFO',
      });
      findings.push({
        column: colName,
        metric: 'nullable',
        value: nullable,
        severity: 'INFO',
      });
      findings.push({
        column: colName,
        metric: 'ordinal_position',
        value: position,
        severity: 'INFO',
      });
    }

    // Add a note that no baseline is stored yet
    findings.unshift({
      column: '_table',
      metric: 'baseline_status',
      value: 'No stored baseline -- showing current schema as profile. Future runs can compare against this snapshot.',
      severity: 'INFO',
    });

    const result: DataQualityResult = {
      skill: 'data-quality', checkType: 'SCHEMA_DRIFT', table: fqTable, sql,
      findings,
      summary: { rowsScanned: executed.rowCount, issuesFound: 0, checkedAt },
    };
    return [compose('data-quality', result)];
  }

  // PROFILE or NULLS -- build a single batched query
  const exprs = columns.flatMap((col) => {
    const base = [
      `COUNTIF(${col.name} IS NULL) AS \`${col.name}__nulls\``,
    ];
    if (intent.checkType === 'PROFILE') {
      if (['INT64', 'FLOAT64', 'NUMERIC', 'BIGNUMERIC', 'INTEGER', 'FLOAT'].includes(col.type)) {
        base.push(
          `MIN(CAST(${col.name} AS FLOAT64)) AS \`${col.name}__min\``,
          `MAX(CAST(${col.name} AS FLOAT64)) AS \`${col.name}__max\``,
          `AVG(CAST(${col.name} AS FLOAT64)) AS \`${col.name}__avg\``,
        );
      }
      const noDistinctTypes = ['GEOGRAPHY', 'STRUCT', 'RECORD', 'ARRAY', 'JSON'];
      if (noDistinctTypes.includes(col.type.toUpperCase())) {
        base.push(`NULL AS \`${col.name}__distinct\``);
      } else {
        base.push(`APPROX_COUNT_DISTINCT(${col.name}) AS \`${col.name}__distinct\``);
      }
    }
    return base;
  });

  sql = `SELECT COUNT(*) AS __total_rows, ${exprs.join(', ')} FROM ${fqTable}`;
  onStatus?.(`Profiling ${columns.length} columns in ${fqTable}...`);

  // Cost gate: dry-run before profile/null scan to catch expensive tables
  try {
    const costResult = await dryRun(sql, project);
    if (costResult.requiresConfirmation) {
      const result: DataQualityResult = {
        skill: 'data-quality',
        checkType: intent.checkType as DataQualityResult['checkType'],
        table: fqTable,
        sql,
        findings: [],
        summary: { rowsScanned: 0, issuesFound: 0, checkedAt },
      };
      // Return cost confirmation envelope
      const envelope = compose('data-quality', result);
      envelope.requiresConfirmation = true;
      envelope.primaryArtifact = {
        type: 'COST_CONFIRM_CARD',
        data: {
          skill: 'query',
          sql,
          requiresConfirmation: true,
          costConfirm: {
            totalBytesProcessed: costResult.totalBytesProcessed,
            tier: costResult.tier,
            requiresConfirmation: true,
          },
          columns: [],
          rows: [],
          rowCount: 0,
          totalBytesProcessed: costResult.totalBytesProcessed,
          costTier: costResult.tier,
          suggestedVisualization: 'TABLE',
          notableFindings: null,
        } as QueryResult,
      };
      return [envelope];
    }
  } catch {
    // dry-run failed, proceed with execution (non-blocking)
  }

  let executed: Awaited<ReturnType<typeof executeQuery>>;
  try {
    executed = await executeQuery(sql, project);
  } catch (err) {
    // Auto-retry with safe query: null counts only (no DISTINCT/MIN/MAX)
    console.warn('[data-quality] Full profile query failed, retrying safe version:', err);
    onStatus?.(`Full profile query failed, retrying with null-counts only on ${fqTable}...`);
    const safeExprs = columns.map((col) =>
      `COUNTIF(${col.name} IS NULL) AS \`${col.name}__nulls\``
    );
    sql = `SELECT COUNT(*) AS __total_rows, ${safeExprs.join(', ')} FROM ${fqTable}`;
    executed = await executeQuery(sql, project);
  }

  const row = executed.rows[0] ?? [];
  const colMap = Object.fromEntries(executed.columns.map((c, i) => [c, row[i]]));
  const totalRows = Number(colMap['__total_rows'] ?? 0);

  for (const col of columns) {
    const nullCount = Number(colMap[`${col.name}__nulls`] ?? 0);
    const nullRate = totalRows > 0 ? nullCount / totalRows : 0;
    const nullSeverity: DqFinding['severity'] = nullRate > 0.5 ? 'ISSUE' : nullRate > 0.1 ? 'WARNING' : 'INFO';
    findings.push({ column: col.name, metric: 'null_rate', value: parseFloat(nullRate.toFixed(4)), severity: nullSeverity });

    if (intent.checkType === 'PROFILE') {
      const distinctKey = `${col.name}__distinct`;
      // Only add distinct count if the column exists in the result (may be absent in safe mode)
      if (distinctKey in colMap) {
        const distinct = Number(colMap[distinctKey] ?? 0);
        findings.push({ column: col.name, metric: 'distinct_count', value: distinct, severity: 'INFO' });
      }
    }
  }

  const issueCount = findings.filter((f) => f.severity !== 'INFO').length;
  const result: DataQualityResult = {
    skill: 'data-quality', checkType: intent.checkType as DataQualityResult['checkType'],
    table: fqTable, sql,
    findings,
    summary: { rowsScanned: totalRows, issuesFound: issueCount, checkedAt },
  };
  return [compose('data-quality', result)];
}

// ─── Skill manifest ───────────────────────────────────────────────────────────

export const manifest: SkillManifest = {
  skill: 'data-quality',
  label: 'data quality check',
  signals: [
    { phrase: 'data quality', weight: 3 },
    { phrase: 'data profile', weight: 3 },
    { phrase: 'column profile', weight: 3 },
    { phrase: 'null rate', weight: 3 },
    { phrase: 'null analysis', weight: 3 },
    { phrase: 'how many nulls', weight: 3 },
    { phrase: 'check for nulls', weight: 3 },
    { phrase: 'find duplicates', weight: 3 },
    { phrase: 'check for duplicates', weight: 3 },
    { phrase: 'duplicate rows', weight: 3 },
    { phrase: 'duplicate detection', weight: 3 },
    { phrase: 'are there duplicates', weight: 3 },
    { phrase: 'referential integrity', weight: 3 },
    { phrase: 'schema drift', weight: 3 },
    { phrase: 'schema change', weight: 3 },
    { phrase: 'value range', weight: 3 },
    { phrase: 'out of range', weight: 3 },
    { phrase: 'range validation', weight: 3 },
    { phrase: 'completeness audit', weight: 3 },
    { phrase: 'data completeness', weight: 3 },
    { phrase: 'how complete', weight: 3 },
    { phrase: 'profile the', weight: 2 },
    { phrase: 'profile this', weight: 2 },
    { phrase: 'quality', weight: 2 },
    { phrase: 'freshness', weight: 2 },
    { phrase: 'validate', weight: 2 },
    { phrase: 'completeness', weight: 2 },
    { phrase: 'drift', weight: 2 },
    { phrase: 'integrity', weight: 2 },
    { phrase: 'nulls', weight: 1 },
    { phrase: 'outlier', weight: 1 },
    { phrase: 'anomaly', weight: 1 },
    { phrase: 'invalid', weight: 1 },
  ],
  handle: handleDataQuality,
};
