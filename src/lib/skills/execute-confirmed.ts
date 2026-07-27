// src/lib/skills/execute-confirmed.ts
// Executes a confirmed DML operation after the user approves a confirmation card.
// Extracted from handle-data-management.ts -- the only surviving function from
// the legacy skill handler system.

import { executeDml } from '../bigquery-client';
import { compose } from '../composer';
import type { CompositionEnvelope, DataManagementResult } from '../types';

export async function executeConfirmedOperation(
  confirmed: DataManagementResult,
  project?: string
): Promise<CompositionEnvelope[]> {
  if (!confirmed.requiresConfirmation) return [];

  console.log('[executeConfirmedOperation] SQL:', confirmed.executionSql);
  console.log('[executeConfirmedOperation] Expected rows:', confirmed.affectedRowCount);

  const dmlResult = await executeDml(
    confirmed.executionSql,
    project,
  );

  console.log('[executeConfirmedOperation] Rows affected:', dmlResult.rowsAffected, 'Job:', dmlResult.jobId);

  // BigQuery's numDmlAffectedRows is unreliable for DELETE on some table configurations
  // (partitioned tables, certain storage formats). When it reports 0 but we expected rows,
  // re-run the preview COUNT to verify whether the rows are actually gone.
  let actualRowsAffected = dmlResult.rowsAffected;
  if (actualRowsAffected === 0 && confirmed.affectedRowCount > 0 && confirmed.previewSql) {
    try {
      const { executeQuery } = await import('../bigquery-client');
      const verifyResult = await executeQuery(confirmed.previewSql, project);
      const remainingRows = Number(verifyResult.rows[0]?.[0]);
      console.log('[executeConfirmedOperation] Verification count remaining:', remainingRows);
      if (Number.isFinite(remainingRows) && remainingRows === 0) {
        // Rows are gone -- numDmlAffectedRows was unreliable, trust the preview count
        actualRowsAffected = confirmed.affectedRowCount;
      }
    } catch {
      // Non-fatal -- fall back to 0
    }
  }

  const mismatch = actualRowsAffected !== confirmed.affectedRowCount;

  const completeResult: DataManagementResult = {
    skill: 'data-management',
    requiresConfirmation: false,
    operation: confirmed.operation,
    table: confirmed.table,
    rowsAffected: actualRowsAffected,
    rowsExpected: confirmed.affectedRowCount,
    mismatch,
    mismatchNote: mismatch
      ? `Removed ${actualRowsAffected.toLocaleString()} of the ${confirmed.affectedRowCount.toLocaleString()} rows — the other ${(confirmed.affectedRowCount - actualRowsAffected).toLocaleString()} no longer matched by the time this ran.`
      : null,
    schemaInvalidated: [],
    jobId: dmlResult.jobId,
  };

  return [compose('data-management', completeResult)];
}
