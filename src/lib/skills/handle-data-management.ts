// src/lib/skills/handle-data-management.ts
// Data management handler: plans and executes DML operations with preview/confirm flow.
// Extracted from chat-orchestrator.ts.

import { classifyIntent } from '../router';
import { callGemini, DataManagementResponseSchema, loadSkillDoc } from '../gemini-client';
import { getAvailableDatasets, resolveDefaultDatasetFromList, extractDatasetFromMessage, buildSchemaContext, stepWithLink } from '../orchestrator-utils';
import { fetchSchema } from './schema';
import { dryRun, executeQuery, executeDml } from '../bigquery-client';
import { compose } from '../composer';
import type { ChatMessage, CompositionEnvelope, DataManagementResult, SkillManifest, StatusCallback } from '../types';

export async function handleDataManagement(
  message: string,
  history: ChatMessage[],
  context?: { project?: string; dataset?: string; resolvedDataset?: string; availableDatasets?: string[]; handoffContext?: Record<string, unknown> },
  onStatus?: StatusCallback
): Promise<CompositionEnvelope[]> {
  const project = context?.project || '';

  // Safety net: re-check the message against the keyword router.
  // If the router does not independently confirm data-management intent,
  // this was likely misrouted (e.g., "analyze sales over time" is analytical,
  // not a mutation). Redirect to the query handler instead.
  const routerCheck = classifyIntent(message);
  if (routerCheck.skill !== 'data-management') {
    const { handleQuery } = await import('./handle-query');
    return handleQuery(message, history, context, onStatus);
  }

  const hc = context?.handoffContext;

  // Enrich message with handoff context so the LLM has full context
  let enrichedMessage = message;
  if (hc?.operationHint && typeof hc.operationHint === 'string') {
    enrichedMessage = `${message}. Operation type: ${hc.operationHint}.`;
    if (hc.table && typeof hc.table === 'string') {
      enrichedMessage += ` Target table: ${hc.table}.`;
    }
    if (hc.filter && typeof hc.filter === 'string') {
      enrichedMessage += ` Filter: ${hc.filter}.`;
    }
  }

  // Parallelize: skill doc and dataset resolution
  const [skillDoc, available] = await Promise.all([
    loadSkillDoc('data-management'),
    context?.availableDatasets ?? getAvailableDatasets(project),
  ]);
  let dataset = context?.resolvedDataset ?? resolveDefaultDatasetFromList(available, context?.dataset, project);
  if (!dataset) {
    dataset = extractDatasetFromMessage(enrichedMessage, available) ?? '';
  }

  const messages = history.slice(-6).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  // Extract target table from handoff context or message
  let dmTargetTable: string | undefined;
  if (hc?.table && typeof hc.table === 'string') {
    const parts = (hc.table as string).replace(/`/g, '').split('.');
    dmTargetTable = parts[parts.length - 1];
  }
  if (!dmTargetTable && dataset) {
    try {
      const dsSchema = await fetchSchema(dataset, undefined, project);
      const dsTableNames = dsSchema.columns.map((c) => c.name);
      const sorted = [...dsTableNames].sort((a, b) => b.length - a.length);
      for (const tbl of sorted) {
        const escaped = tbl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`\\b${escaped}\\b`, 'i');
        if (re.test(enrichedMessage)) {
          dmTargetTable = tbl;
          break;
        }
      }
    } catch {
      // Ignore
    }
  }

  const schemaContext = await buildSchemaContext(project, dataset, dmTargetTable);

  onStatus?.(stepWithLink(
    `Planning data management operation on ${dmTargetTable ? `table ${dmTargetTable} in ` : ''}dataset ${dataset}...`,
    { project, dataset, table: dmTargetTable },
    dmTargetTable ? 'Open table in BigQuery' : 'Open dataset in BigQuery'
  ));
  const dmDatasetLine = dataset
    ? `The active dataset is: ${dataset}`
    : 'No dataset is pre-selected. Infer the correct dataset from the user\'s prompt and the available datasets listed below.';
  const dmTargetTableLine = dmTargetTable
    ? `\nCRITICAL: The user is asking about table \`${project}.${dataset}.${dmTargetTable}\`. You MUST use this exact table in your SQL. Do NOT use any other table.`
    : '';
  const plan = await callGemini({
    systemInstruction: `${skillDoc}

The BigQuery project is: ${project}
${dmDatasetLine}
The available datasets in project ${project} are: ${available.join(', ')}
${schemaContext}${dmTargetTableLine}
Always wrap fully qualified table references in literal backticks: \`${project}.DATASET.tablename\` (e.g. \`${project}.ecomm.orders\`). This is CRITICAL to prevent syntax errors when project names contain dashes/hyphens.\``,
    messages: [...messages, { role: 'user' as const, content: enrichedMessage }],
    schema: DataManagementResponseSchema,
    project,
  });


  // ── Strategy-based execution ─────────────────────────────────────────────
  // Gemini decides the strategy based on the operation's risk level.
  const strategy = plan.executionStrategy || 'PREVIEW_AND_CONFIRM';

  // DIRECT_EXECUTE: no preview, no confirmation. Used for operations that
  // create new objects or are inherently safe (CREATE TABLE, CREATE VIEW, etc.).
  if (strategy === 'DIRECT_EXECUTE') {
    onStatus?.(stepWithLink(
      `Executing ${plan.operation} directly on ${plan.table || dataset}...`,
      { project, dataset, table: plan.table },
      plan.table ? 'Open table in BigQuery' : 'Open dataset in BigQuery'
    ));
    const dmlResult = await executeDml(plan.executionSql, project);
    const completeResult: DataManagementResult = {
      skill: 'data-management',
      requiresConfirmation: false,
      operation: plan.operation,
      rowsAffected: dmlResult.rowsAffected,
      rowsExpected: 0,
      mismatch: false,
      mismatchNote: null,
      schemaInvalidated: [`${project}.${dataset}.${plan.table}`],
      jobId: dmlResult.jobId,
      completionMessage: plan.completionMessage ?? null,
    };
    return [compose('data-management', completeResult)];
  }

  // PREVIEW_AND_CONFIRM_DEDUPE: preview + example group + group count + confirmation.
  if (strategy === 'PREVIEW_AND_CONFIRM_DEDUPE') {
    onStatus?.(stepWithLink(
      `Running dedupe preview on ${plan.table || dataset}...`,
      { project, dataset, table: plan.table },
      plan.table ? 'Open table in BigQuery' : 'Open dataset in BigQuery'
    ));
    const previewResult = await executeQuery(plan.previewSql, project);
    const rawCount = Number(previewResult.rows[0]?.[0]);
    const affectedRowCount = Number.isFinite(rawCount) ? Math.round(rawCount) : 0;

    let exampleGroup = undefined;
    const snapshotRowIds: number[] = [];
    let affectedGroupCount = undefined;

    if (plan.tiebreakerColumn) {
      const exampleSql = `
        WITH ranked AS (
          SELECT *, ROW_NUMBER() OVER (
            PARTITION BY id
            ORDER BY ${plan.tiebreakerColumn} ${plan.tiebreakerDirection === 'KEEP_LATEST' ? 'DESC' : 'ASC'}
          ) AS rn
          FROM \`${project}.${dataset}.${plan.table}\`
          WHERE id IN (
            SELECT id FROM \`${project}.${dataset}.${plan.table}\`
            GROUP BY id HAVING COUNT(*) > 1
            LIMIT 1
          )
        )
        SELECT * FROM ranked
      `;

      try {
        const exampleResult = await executeQuery(exampleSql, project);
        if (exampleResult.rows.length > 0) {
          const toObj = (row: unknown[]) =>
            Object.fromEntries(exampleResult.columns.map((c, i) => [c, row[i]]));
          const keepRow = toObj(exampleResult.rows[0]);
          const removeRows = exampleResult.rows.slice(1).map(toObj);
          exampleGroup = {
            keyValue: { id: keepRow['id'] },
            keepRow,
            removeRows,
          };
        }
      } catch {
        // Non-fatal -- confirmation card still works without example
      }

      const groupCountSql = `
        SELECT COUNT(DISTINCT id) as group_count
        FROM \`${project}.${dataset}.${plan.table}\`
        GROUP BY id HAVING COUNT(*) > 1
      `;
      try {
        const groupResult = await executeQuery(
          `SELECT COUNT(*) as group_count FROM (${groupCountSql})`,
          project,
        );
        affectedGroupCount = Number(groupResult.rows[0]?.[0] ?? 0);
      } catch { /* ignore */ }
    }

    onStatus?.(`Estimating cost for ${plan.operation} on ${plan.table || dataset}...`);
    const costResult = await dryRun(plan.executionSql, project);

    const confirmResult: DataManagementResult = {
      skill: 'data-management',
      requiresConfirmation: true,
      operation: plan.operation,
      previewSql: plan.previewSql,
      affectedRowCount,
      affectedGroupCount,
      exampleGroup,
      costEstimate: costResult,
      tiebreakerColumn: plan.tiebreakerColumn ?? undefined,
      tiebreakerDirection: plan.tiebreakerDirection ?? undefined,
      executionSql: plan.executionSql,
      snapshotRowIds,
    };
    return [compose('data-management', confirmResult)];
  }

  // PREVIEW_AND_CONFIRM (default): preview affected rows + confirmation card.
  // Used for DELETE, UPDATE, FILL_NULLS, destructive ALTER TABLE, etc.
  onStatus?.(`Running preview for ${plan.operation} on ${plan.table || dataset}...`);
  const previewResult = await executeQuery(plan.previewSql, project);
  const rawCount = Number(previewResult.rows[0]?.[0]);
  const affectedRowCount = Number.isFinite(rawCount) ? Math.round(rawCount) : 0;

  onStatus?.(`Estimating cost for ${plan.operation} on ${plan.table || dataset}...`);
  const costResult = await dryRun(plan.executionSql, project);

  const confirmResult: DataManagementResult = {
    skill: 'data-management',
    requiresConfirmation: true,
    operation: plan.operation,
    previewSql: plan.previewSql,
    affectedRowCount,
    costEstimate: costResult,
    executionSql: plan.executionSql,
    snapshotRowIds: [],
  };
  return [compose('data-management', confirmResult)];
}

// ─── Execute confirmed operation ───────────────────────────────────────────────

export async function executeConfirmedOperation(
  confirmed: DataManagementResult,
  project?: string
): Promise<CompositionEnvelope[]> {
  if (!confirmed.requiresConfirmation) return [];

  const dmlResult = await executeDml(
    confirmed.executionSql,
    project,
  );

  const mismatch = dmlResult.rowsAffected !== confirmed.affectedRowCount;

  const completeResult: DataManagementResult = {
    skill: 'data-management',
    requiresConfirmation: false,
    operation: confirmed.operation,
    rowsAffected: dmlResult.rowsAffected,
    rowsExpected: confirmed.affectedRowCount,
    mismatch,
    mismatchNote: mismatch
      ? `Removed ${dmlResult.rowsAffected} of the ${confirmed.affectedRowCount} rows — the other ${confirmed.affectedRowCount - dmlResult.rowsAffected} no longer matched by the time this ran.`
      : null,
    schemaInvalidated: [],
    jobId: dmlResult.jobId,
  };

  return [compose('data-management', completeResult)];
}

// ─── Skill manifest ───────────────────────────────────────────────────────────

export const manifest: SkillManifest = {
  skill: 'data-management',
  label: 'data management',
  signals: [],
  handle: handleDataManagement,
};
