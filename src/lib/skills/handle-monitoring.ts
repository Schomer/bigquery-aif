// src/lib/skills/handle-monitoring.ts
// Monitoring handler: jobs history, storage, slots, alerts, cost analysis, freshness.
// Extracted from chat-orchestrator.ts.

import { callGemini, MonitoringIntentSchema } from '../gemini-client';
import { extractDatasetFromMessage } from '../orchestrator-utils';
import { executeQuery, detectBqRegion, createScheduledQuery, listDatasets } from '../bigquery-client';
import { compose } from '../composer';
import { saveCheck } from '../firestore-service';
import type {
  ChatMessage, CompositionEnvelope, MonitoringJob, MonitoringResult, AlertResult, SavedCheck, SkillManifest, StatusCallback,
  StorageItem, StorageBreakdownResult, AccessPatternEntry, AccessPatternResult,
  CostBucket, CostAnalysisResult, FreshnessEntry, FreshnessResult,
} from '../types';

export async function handleMonitoring(
  message: string,
  _history: ChatMessage[],
  context?: { project?: string; uid?: string; dataset?: string; resolvedDataset?: string; availableDatasets?: string[]; handoffContext?: Record<string, unknown> },
  onStatus?: StatusCallback
): Promise<CompositionEnvelope[]> {
  const project = context?.project || '';
  const region = await detectBqRegion(project);
  const uid = context?.uid;
  const hc = context?.handoffContext;

  // --- Handle save_check / schedule_check actions from alert chips ---
  if (hc?.action === 'save_check' && hc?.checkSql && uid) {
    const checkId = `chk_${Date.now()}`;
    const check: SavedCheck = {
      id: checkId,
      createdAt: new Date().toISOString(),
      label: `dq_check: ${String(hc.conditionDescription || 'Unnamed check')}`,
      sql: String(hc.checkSql),
      conditionDescription: String(hc.conditionDescription || ''),
      tier: 'TIER_0',
    };
    onStatus?.('Saving check...');
    try {
      await saveCheck(uid, check);
      const result: AlertResult = {
        skill: 'monitoring',
        monitoringType: 'ALERT',
        alertCategory: (hc.alertCategory as AlertResult['alertCategory']) || 'DATA_CONDITION',
        conditionDescription: `Check saved: ${check.label}`,
        savedCheckId: checkId,
        tier: 'TIER_0',
        guidance: `Saved as a reusable check (Tier 0). You can find it in your saved prompts and re-run it anytime.\n\nCheck ID: ${checkId}`,
        nextActions: [
          { label: 'Run it now', action: String(hc.checkSql) },
          { label: 'Schedule with email alert', action: 'schedule_check' },
        ],
      };
      return [compose('monitoring', result)];
    } catch (err) {
      const result: AlertResult = {
        skill: 'monitoring',
        monitoringType: 'ALERT',
        alertCategory: 'DATA_CONDITION',
        conditionDescription: 'Failed to save check',
        guidance: `Could not save the check: ${err instanceof Error ? err.message : String(err)}`,
      };
      return [compose('monitoring', result)];
    }
  }

  if (hc?.action === 'schedule_check' && hc?.checkSql) {
    const label = String(hc.conditionDescription || 'Scheduled check');
    const conditionSql = String(hc.checkSql);
    // Wrap in IF/ERROR pattern for failure-email alerting
    const wrappedSql = `DECLARE violation_count INT64;\nSET violation_count = (${conditionSql});\nIF violation_count > 0 THEN\n  SELECT ERROR(CONCAT('Alert: ', '${label.replace(/'/g, "''")}', ' -- ', CAST(violation_count AS STRING), ' violations found'));\nEND IF;`;
    const schedule = 'every 24 hours';
    onStatus?.('Creating scheduled check with failure email...');
    try {
      const { transferConfigName } = await createScheduledQuery(
        project,
        `Alert: ${label}`,
        wrappedSql,
        schedule,
        true, // enableFailureEmail
      );
      const checkId = `chk_${Date.now()}`;
      if (uid) {
        const check: SavedCheck = {
          id: checkId,
          createdAt: new Date().toISOString(),
          label: `dq_check: ${label}`,
          sql: conditionSql,
          conditionDescription: label,
          tier: 'TIER_1',
          schedule,
          transferConfigName,
        };
        await saveCheck(uid, check);
      }
      const result: AlertResult = {
        skill: 'monitoring',
        monitoringType: 'ALERT',
        alertCategory: (hc.alertCategory as AlertResult['alertCategory']) || 'DATA_CONDITION',
        conditionDescription: `Scheduled alert: ${label}`,
        savedCheckId: checkId,
        tier: 'TIER_1',
        guidance: `Scheduled check created (Tier 1). It will run ${schedule} and send an email notification when the condition is violated.\n\nTransfer config: ${transferConfigName}`,
        nextActions: [
          { label: 'Run it now', action: conditionSql },
          { label: 'Show job history', action: 'show my recent BigQuery job history' },
        ],
      };
      return [compose('monitoring', result)];
    } catch (err) {
      const result: AlertResult = {
        skill: 'monitoring',
        monitoringType: 'ALERT',
        alertCategory: 'DATA_CONDITION',
        conditionDescription: 'Failed to create scheduled check',
        guidance: `Could not create the scheduled check: ${err instanceof Error ? err.message : String(err)}\n\nYou may need to ensure the BigQuery Data Transfer API is enabled for project ${project}.`,
        nextActions: [
          { label: 'Save as check instead', action: 'save_check' },
        ],
      };
      return [compose('monitoring', result)];
    }
  }

  // If handoff context carries a pre-classified monitoring type, skip LLM
  let monitoringType: string;
  if (hc?.monitoringHint && typeof hc.monitoringHint === 'string') {
    const hintMap: Record<string, string> = {
      'JOB_LIST': 'JOBS', 'COST_ANALYSIS': 'COST_ANALYSIS', 'DIAGNOSE_FAILURES': 'JOBS',
      'STORAGE_ANALYSIS': 'STORAGE', 'STORAGE': 'STORAGE',
      'SLOTS': 'SLOTS', 'QUERY_PLAN': 'QUERY_PLAN', 'ALERT': 'ALERT',
      'STORAGE_BREAKDOWN': 'STORAGE_BREAKDOWN', 'ACCESS_PATTERNS': 'ACCESS_PATTERNS',
      'FRESHNESS': 'FRESHNESS',
    };
    monitoringType = hintMap[hc.monitoringHint as string] || 'JOBS';
    onStatus?.(`Running ${monitoringType} analysis (from handoff)...`);
  } else {
    // Keyword-based fast path for types the LLM sometimes misroutes to JOBS
    const lower = message.toLowerCase();
    const costKeywords = ['cost', 'spending', 'spend', 'expensive', 'cheapest', 'billing', 'price', 'pricing'];
    const freshnessKeywords = ['fresh', 'stale', 'outdated', 'last updated', 'not been updated', 'most recent update', 'when was .* updated'];
    const isCost = costKeywords.some(k => lower.includes(k)) && !lower.includes('job') && !lower.includes('history');
    const isFresh = freshnessKeywords.some(k => new RegExp(k).test(lower)) && !lower.includes('job') && !lower.includes('history');

    if (isCost) {
      monitoringType = 'COST_ANALYSIS';
      onStatus?.(`Running cost analysis (keyword match)...`);
    } else if (isFresh) {
      monitoringType = 'FRESHNESS';
      onStatus?.(`Running freshness check (keyword match)...`);
    } else {
      // Classify monitoring sub-type via Gemini
      onStatus?.(`Classifying monitoring request...`);
      const intent = await callGemini({
        systemInstruction: `You classify BigQuery monitoring requests. Available types: JOBS (job history, recent queries, errors, failed jobs), STORAGE (table sizes, storage usage, row counts), SLOTS (slot utilization, resource usage over time), QUERY_PLAN (query execution plan, dry run, explain), ALERT (set up alerts, watch a metric, threshold notifications), STORAGE_BREAKDOWN (storage treemap, disk usage breakdown, largest tables), ACCESS_PATTERNS (who queries which tables, table usage patterns, most queried), COST_ANALYSIS (query cost over time, spending breakdown, how much am I spending), FRESHNESS (data freshness, stale tables, when was a table last updated, outdated tables). Extract a jobId if the user mentions a specific job. Extract a table name if relevant. Extract a dataset name if relevant.`,
        prompt: message,
        schema: MonitoringIntentSchema,
        project,
      });
      monitoringType = intent.monitoringType || 'JOBS';
    }
  }

  // STORAGE -- query INFORMATION_SCHEMA.TABLE_STORAGE
  if (monitoringType === 'STORAGE') {
    const storageSql = `SELECT table_schema, table_name, total_rows, total_logical_bytes, active_logical_bytes FROM \`${project}\`.\`region-${region}\`.INFORMATION_SCHEMA.TABLE_STORAGE ORDER BY total_logical_bytes DESC LIMIT 50`;
    onStatus?.(`Fetching storage usage for project ${project}...`);
    const executed = await executeQuery(storageSql, project);

    const items: MonitoringJob[] = executed.rows.map((row) => ({
      jobId: `${row[0]}.${row[1]}`,
      userEmail: '',
      statementType: 'STORAGE',
      status: 'DONE' as const,
      createTime: new Date().toISOString(),
      totalBytesProcessed: Number(row[3] ?? 0),
      errorMessage: null,
      referencedTables: [`${project}.${row[0]}.${row[1]}`],
    }));

    const now = new Date();
    const result: MonitoringResult = {
      skill: 'monitoring',
      monitoringType: 'JOB_LIST',
      timeRange: { start: now.toISOString(), end: now.toISOString() },
      items,
      summary: {
        totalJobs: items.length,
        totalBytesProcessed: items.reduce((acc, j) => acc + j.totalBytesProcessed, 0),
        errorCount: 0,
      },
    };
    return [compose('monitoring', result)];
  }

  // SLOTS -- query INFORMATION_SCHEMA.JOBS_TIMELINE for slot usage
  if (monitoringType === 'SLOTS') {
    const slotsSql = `SELECT period_start, SUM(period_slot_ms) AS total_slot_ms, COUNT(DISTINCT job_id) AS concurrent_jobs FROM \`${project}\`.\`region-${region}\`.INFORMATION_SCHEMA.JOBS_TIMELINE_BY_PROJECT WHERE period_start > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR) GROUP BY period_start ORDER BY period_start DESC LIMIT 100`;
    onStatus?.(`Fetching slot utilization for project ${project}...`);
    const executed = await executeQuery(slotsSql, project);

    const items: MonitoringJob[] = executed.rows.map((row) => ({
      jobId: String(row[0] ?? ''),
      userEmail: '',
      statementType: 'SLOT_USAGE',
      status: 'DONE' as const,
      createTime: String(row[0] ?? ''),
      totalBytesProcessed: Number(row[1] ?? 0),
      errorMessage: `${row[2] ?? 0} concurrent jobs`,
      referencedTables: [],
    }));

    const now = new Date();
    const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const result: MonitoringResult = {
      skill: 'monitoring',
      monitoringType: 'JOB_LIST',
      timeRange: { start: start.toISOString(), end: now.toISOString() },
      items,
      summary: {
        totalJobs: items.length,
        totalBytesProcessed: items.reduce((acc, j) => acc + j.totalBytesProcessed, 0),
        errorCount: 0,
      },
    };
    return [compose('monitoring', result)];
  }

  // QUERY_PLAN -- placeholder guidance
  if (monitoringType === 'QUERY_PLAN') {
    const result: MonitoringResult = {
      skill: 'monitoring',
      monitoringType: 'JOB_LIST',
      timeRange: { start: new Date().toISOString(), end: new Date().toISOString() },
      items: [{
        jobId: 'query_plan_info',
        userEmail: '',
        statementType: 'INFO',
        status: 'DONE',
        createTime: new Date().toISOString(),
        totalBytesProcessed: 0,
        errorMessage: 'To analyze a query plan: use the dry-run feature by prefixing your query request with "dry run" or "explain". The system will show estimated bytes processed and cost tier without executing the query. For detailed execution plans, use the BigQuery Console Query Plan tab after running a query.',
        referencedTables: [],
      }],
      summary: { totalJobs: 0, totalBytesProcessed: 0, errorCount: 0 },
    };
    return [compose('monitoring', result)];
  }

  // ALERT -- three-way classification per shared-harness-policies SS C
  if (monitoringType === 'ALERT') {
    const AlertClassSchema = {
      type: 'OBJECT' as const,
      properties: {
        alertCategory: {
          type: 'STRING' as const,
          enum: ['PROJECT_WIDE', 'JOB_SPECIFIC', 'DATA_CONDITION'],
          description: 'PROJECT_WIDE: aggregate system metrics (total slot usage, overall error rate, storage growth). JOB_SPECIFIC: condition about a specific job, schedule, or query pattern. DATA_CONDITION: row-level or column-level data condition (nulls, duplicates, freshness, thresholds).',
        },
        conditionDescription: {
          type: 'STRING' as const,
          description: 'Plain-English description of what the user wants to be alerted about',
        },
        table: {
          type: 'STRING' as const,
          description: 'Fully qualified table reference (project.dataset.table) if the condition involves a specific table',
        },
        metric: {
          type: 'STRING' as const,
          description: 'The metric or column to check (e.g., null_rate, row_count, bytes_processed)',
        },
        threshold: {
          type: 'STRING' as const,
          description: 'The threshold value if specified (e.g., "> 1000", "< 0.95")',
        },
      },
      required: ['alertCategory', 'conditionDescription'],
    };

    onStatus?.('Classifying alert type...');
    const alertClass = await callGemini({
      systemInstruction: 'You classify BigQuery alert requests into one of three categories: PROJECT_WIDE (aggregate system metrics like slot usage, error rate, storage growth), JOB_SPECIFIC (conditions about specific jobs, schedules, or query patterns), or DATA_CONDITION (row-level or column-level data conditions like nulls, duplicates, freshness, thresholds). Extract the condition description, table, metric, and threshold if mentioned.',
      prompt: message,
      schema: AlertClassSchema,
      project,
    });
    const { alertCategory, conditionDescription, table, metric, threshold } = alertClass;

    // --- PROJECT_WIDE: guidance for Cloud Monitoring ---
    if (alertCategory === 'PROJECT_WIDE') {
      const result: AlertResult = {
        skill: 'monitoring',
        monitoringType: 'ALERT',
        alertCategory: 'PROJECT_WIDE',
        conditionDescription,
        guidance: `To set up a project-wide alert for "${conditionDescription}":\n\n` +
          `1. Go to Cloud Monitoring > Alerting > Create Policy\n` +
          `2. Resource type: BigQuery Project\n` +
          `3. Metric: ${metric || 'Choose the relevant BigQuery metric'}\n` +
          `4. Condition: ${threshold || 'Set your threshold'}\n\n` +
          `Or use gcloud:\n` +
          `gcloud alpha monitoring policies create \\\n` +
          `  --display-name="${conditionDescription}" \\\n` +
          `  --condition-filter='resource.type="bigquery.googleapis.com/Project"' \\\n` +
          `  --condition-threshold-value=${threshold || '<THRESHOLD>'} \\\n` +
          `  --notification-channels=<CHANNEL_ID>`,
        nextActions: [
          { label: 'Show current usage', action: 'show my current slot usage and query costs' },
        ],
      };
      return [compose('monitoring', result)];
    }

    // --- JOB_SPECIFIC: author SQL check against INFORMATION_SCHEMA.JOBS ---
    if (alertCategory === 'JOB_SPECIFIC') {
      const checkSql = `SELECT COUNT(*) as violation_count\nFROM \`${project}\`.\`region-${region}\`.INFORMATION_SCHEMA.JOBS_BY_PROJECT\nWHERE creation_time > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)\n  AND ${metric ? `${metric} ${threshold || '> 0'}` : `error_result IS NOT NULL`}`;

      const result: AlertResult = {
        skill: 'monitoring',
        monitoringType: 'ALERT',
        alertCategory: 'JOB_SPECIFIC',
        conditionDescription,
        checkSql,
        guidance: `This check queries INFORMATION_SCHEMA.JOBS to detect: ${conditionDescription}.\n\nYou can save this as a reusable check (Tier 0) or schedule it to run automatically with email alerts (Tier 1).`,
        nextActions: [
          { label: 'Save as check', action: 'save_check' },
          { label: 'Schedule with email alert', action: 'schedule_check' },
          { label: 'Run it now', action: checkSql },
        ],
      };
      return [compose('monitoring', result)];
    }

    // --- DATA_CONDITION: author DQ check SQL ---
    if (alertCategory === 'DATA_CONDITION') {
      const targetTable = table || '<project.dataset.table>';
      let checkSql: string;

      if (metric?.toLowerCase().includes('null')) {
        checkSql = `SELECT\n  '${metric}' as check_name,\n  COUNTIF(${metric} IS NULL) as null_count,\n  COUNT(*) as total_rows,\n  ROUND(COUNTIF(${metric} IS NULL) / COUNT(*) * 100, 2) as null_pct\nFROM \`${targetTable}\`\nHAVING null_pct ${threshold || '> 5'}`;
      } else if (metric?.toLowerCase().includes('duplicate') || conditionDescription.toLowerCase().includes('duplicate')) {
        checkSql = `SELECT COUNT(*) as duplicate_groups\nFROM (\n  SELECT ${metric || '*'}, COUNT(*) as cnt\n  FROM \`${targetTable}\`\n  GROUP BY ${metric || 'ALL'}\n  HAVING cnt > 1\n)\nHAVING duplicate_groups > 0`;
      } else if (conditionDescription.toLowerCase().includes('fresh') || conditionDescription.toLowerCase().includes('stale')) {
        checkSql = `SELECT\n  TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), MAX(${metric || 'created_at'}), HOUR) as hours_since_update\nFROM \`${targetTable}\`\nHAVING hours_since_update ${threshold || '> 24'}`;
      } else {
        checkSql = `SELECT COUNT(*) as violation_count\nFROM \`${targetTable}\`\nWHERE ${metric || '1=1'} ${threshold || ''}`;
      }

      const result: AlertResult = {
        skill: 'monitoring',
        monitoringType: 'ALERT',
        alertCategory: 'DATA_CONDITION',
        conditionDescription,
        checkSql,
        guidance: `This check monitors: ${conditionDescription}.\n\nSave it as a reusable check you can run anytime (Tier 0), or schedule it to run automatically with email notifications when the condition is violated (Tier 1).`,
        nextActions: [
          { label: 'Save as check', action: 'save_check' },
          { label: 'Schedule with email alert', action: 'schedule_check' },
          { label: 'Run it now', action: checkSql },
        ],
      };
      return [compose('monitoring', result)];
    }
  }

  // Helper: BigQuery timestamps may be epoch-ms numbers, {value:'...'} objects, or ISO strings
  // Returns a human-readable date string (e.g. "Jul 11, 2026 3:25 AM")
  function normalizeTimestamp(val: unknown): string {
    if (val == null) return '';
    // If it's an object with a .value property (BigQuery client format)
    if (typeof val === 'object' && val !== null && 'value' in val) {
      return normalizeTimestamp((val as { value: unknown }).value);
    }
    // If it's a number, treat as epoch milliseconds
    if (typeof val === 'number') {
      // BigQuery sometimes uses microseconds -- if >year 5000 in ms, assume micros
      const ms = val > 1e16 ? val / 1000 : val;
      return formatTimestamp(new Date(ms));
    }
    const s = String(val);
    // If it's a purely numeric string, parse as epoch
    if (/^\d{10,}$/.test(s)) {
      const num = Number(s);
      const ms = num > 1e16 ? num / 1000 : num;
      return formatTimestamp(new Date(ms));
    }
    // Try parsing as-is -- if valid, return formatted
    const d = new Date(s);
    if (!isNaN(d.getTime())) return formatTimestamp(d);
    return s;
  }

  function formatTimestamp(d: Date): string {
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  }

  // STORAGE_BREAKDOWN -- hierarchical treemap of storage by dataset and table
  if (monitoringType === 'STORAGE_BREAKDOWN') {
    const storageSql = `SELECT table_schema, table_name, total_rows, total_logical_bytes FROM \`${project}\`.\`region-${region}\`.INFORMATION_SCHEMA.TABLE_STORAGE ORDER BY total_logical_bytes DESC LIMIT 200`;
    onStatus?.(`Fetching storage breakdown for project ${project} (region: ${region})...`);
    try {
      const executed = await executeQuery(storageSql, project);
      if (executed.rows.length === 0) {
        // TABLE_STORAGE returned 0 rows -- fall back to __TABLES__ per dataset
        onStatus?.(`TABLE_STORAGE empty, querying per-dataset metadata...`);
        const datasets = await listDatasets(project);
        const items: StorageItem[] = [];
        let totalBytes = 0;
        for (const ds of datasets.slice(0, 20)) {
          const dsId = ds.datasetId || ds.id || '';
          try {
            const tablesMeta = await executeQuery(
              `SELECT table_id, row_count, size_bytes FROM \`${project}.${dsId}.__TABLES__\``,
              project
            );
            let dsBytes = 0;
            let dsRows = 0;
            const children: StorageItem[] = [];
            for (const row of tablesMeta.rows) {
              const tId = String(row[0] ?? '');
              const tRows = Number(row[1] ?? 0);
              const tBytes = Number(row[2] ?? 0);
              dsBytes += tBytes;
              dsRows += tRows;
              children.push({ ref: `${project}.${dsId}.${tId}`, label: tId, sizeBytes: tBytes, rowCount: tRows, type: 'TABLE' as const });
            }
            children.sort((a, b) => b.sizeBytes - a.sizeBytes);
            totalBytes += dsBytes;
            items.push({ ref: `${project}.${dsId}`, label: dsId, sizeBytes: dsBytes, rowCount: dsRows, type: 'DATASET' as const, children });
          } catch {
            // Skip datasets we can't query
            items.push({ ref: `${project}.${dsId}`, label: dsId, sizeBytes: 0, rowCount: 0, type: 'DATASET' as const });
          }
        }
        items.sort((a, b) => b.sizeBytes - a.sizeBytes);
        const result: StorageBreakdownResult = {
          skill: 'monitoring', monitoringType: 'STORAGE_BREAKDOWN',
          project, totalBytes, items,
        };
        return [compose('monitoring', result as unknown as MonitoringResult)];
      }
      const datasetMap = new Map<string, { sizeBytes: number; rowCount: number; tables: Array<{ ref: string; label: string; sizeBytes: number; rowCount: number }> }>();
      for (const row of executed.rows) {
        const ds = String(row[0] ?? '');
        const tbl = String(row[1] ?? '');
        const rows = Number(row[2] ?? 0);
        const bytes = Number(row[3] ?? 0);
        if (!datasetMap.has(ds)) datasetMap.set(ds, { sizeBytes: 0, rowCount: 0, tables: [] });
        const entry = datasetMap.get(ds)!;
        entry.sizeBytes += bytes;
        entry.rowCount += rows;
        entry.tables.push({ ref: `${project}.${ds}.${tbl}`, label: tbl, sizeBytes: bytes, rowCount: rows });
      }
      const items: StorageItem[] = Array.from(datasetMap.entries()).map(([ds, data]) => ({
        ref: `${project}.${ds}`,
        label: ds,
        sizeBytes: data.sizeBytes,
        rowCount: data.rowCount,
        type: 'DATASET' as const,
        children: data.tables.map(t => ({ ref: t.ref, label: t.label, sizeBytes: t.sizeBytes, rowCount: t.rowCount, type: 'TABLE' as const })),
      })).sort((a, b) => b.sizeBytes - a.sizeBytes);
      const result: StorageBreakdownResult = {
        skill: 'monitoring',
        monitoringType: 'STORAGE_BREAKDOWN',
        project,
        totalBytes: items.reduce((acc, i) => acc + i.sizeBytes, 0),
        items,
      };
      return [compose('monitoring', result as unknown as MonitoringResult)];
    } catch (err) {
      // TABLE_STORAGE query failed -- fall back to __TABLES__ per dataset
      onStatus?.(`Query failed: ${err instanceof Error ? err.message : String(err)}. Trying per-dataset metadata...`);
      try {
        const datasets = await listDatasets(project);
        const items: StorageItem[] = [];
        let totalBytes = 0;
        for (const ds of datasets.slice(0, 20)) {
          const dsId = ds.datasetId || ds.id || '';
          try {
            const tablesMeta = await executeQuery(
              `SELECT table_id, row_count, size_bytes FROM \`${project}.${dsId}.__TABLES__\``,
              project
            );
            let dsBytes = 0;
            let dsRows = 0;
            const children: StorageItem[] = [];
            for (const row of tablesMeta.rows) {
              const tId = String(row[0] ?? '');
              const tRows = Number(row[1] ?? 0);
              const tBytes = Number(row[2] ?? 0);
              dsBytes += tBytes;
              dsRows += tRows;
              children.push({ ref: `${project}.${dsId}.${tId}`, label: tId, sizeBytes: tBytes, rowCount: tRows, type: 'TABLE' as const });
            }
            children.sort((a, b) => b.sizeBytes - a.sizeBytes);
            totalBytes += dsBytes;
            items.push({ ref: `${project}.${dsId}`, label: dsId, sizeBytes: dsBytes, rowCount: dsRows, type: 'DATASET' as const, children });
          } catch {
            items.push({ ref: `${project}.${dsId}`, label: dsId, sizeBytes: 0, rowCount: 0, type: 'DATASET' as const });
          }
        }
        items.sort((a, b) => b.sizeBytes - a.sizeBytes);
        const result: StorageBreakdownResult = {
          skill: 'monitoring', monitoringType: 'STORAGE_BREAKDOWN',
          project, totalBytes, items,
        };
        return [compose('monitoring', result as unknown as MonitoringResult)];
      } catch {
        const result: StorageBreakdownResult = {
          skill: 'monitoring', monitoringType: 'STORAGE_BREAKDOWN',
          project, totalBytes: 0, items: [],
        };
        return [compose('monitoring', result as unknown as MonitoringResult)];
      }
    }
  }

  // ACCESS_PATTERNS -- who queries which tables
  if (monitoringType === 'ACCESS_PATTERNS') {
    const accessSql = `SELECT user_email, referenced_tables, COUNT(*) AS query_count, SUM(total_bytes_processed) AS total_bytes, MAX(creation_time) AS last_accessed FROM \`${project}\`.\`region-${region}\`.INFORMATION_SCHEMA.JOBS_BY_PROJECT WHERE creation_time > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY) AND statement_type = 'SELECT' AND referenced_tables IS NOT NULL GROUP BY user_email, referenced_tables ORDER BY query_count DESC LIMIT 200`;
    onStatus?.(`Analyzing access patterns for project ${project}...`);
    try {
      const executed = await executeQuery(accessSql, project);
      const entries: AccessPatternEntry[] = [];
      for (const row of executed.rows) {
        const email = String(row[0] ?? '');
        const refsRaw = row[1];
        const qCount = Number(row[2] ?? 0);
        const totalBytes = Number(row[3] ?? 0);
        const lastAccessed = String(row[4] ?? '');
        let tables: string[] = [];
        try {
          const parsed = typeof refsRaw === 'string' ? JSON.parse(refsRaw) : refsRaw;
          if (Array.isArray(parsed)) {
            tables = parsed.map((t: { projectId?: string; datasetId?: string; tableId?: string }) =>
              [t.projectId, t.datasetId, t.tableId].filter(Boolean).join('.')
            );
          }
        } catch { /* non-fatal */ }
        for (const tableRef of tables) {
          entries.push({ tableRef, userEmail: email, queryCount: qCount, totalBytesProcessed: totalBytes, lastAccessed });
        }
      }
      const now = new Date();
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const result: AccessPatternResult = {
        skill: 'monitoring',
        monitoringType: 'ACCESS_PATTERNS',
        timeRange: { start: start.toISOString(), end: now.toISOString() },
        entries,
      };
      return [compose('monitoring', result as unknown as MonitoringResult)];
    } catch {
      const now = new Date();
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const result: AccessPatternResult = {
        skill: 'monitoring', monitoringType: 'ACCESS_PATTERNS',
        timeRange: { start: start.toISOString(), end: now.toISOString() }, entries: [],
      };
      return [compose('monitoring', result as unknown as MonitoringResult)];
    }
  }

  // COST_ANALYSIS -- query costs over time by user
  if (monitoringType === 'COST_ANALYSIS') {
    const costSql = `SELECT DATE(creation_time) AS period, user_email, SUM(total_bytes_processed) AS total_bytes, COUNT(*) AS job_count FROM \`${project}\`.\`region-${region}\`.INFORMATION_SCHEMA.JOBS_BY_PROJECT WHERE creation_time > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY) AND total_bytes_processed > 0 GROUP BY period, user_email ORDER BY period DESC, total_bytes DESC LIMIT 500`;
    onStatus?.(`Analyzing query costs for project ${project}...`);
    try {
      const executed = await executeQuery(costSql, project);
      const costPerTb = 6.25; // BigQuery on-demand pricing per TB
      const buckets: CostBucket[] = executed.rows.map(row => {
        const bytes = Number(row[2] ?? 0);
        return {
          period: String(row[0] ?? ''),
          user: String(row[1] ?? ''),
          bytesProcessed: bytes,
          estimatedCostUsd: (bytes / 1e12) * costPerTb,
          jobCount: Number(row[3] ?? 0),
        };
      });
      const totalCost = buckets.reduce((acc, b) => acc + b.estimatedCostUsd, 0);
      const now = new Date();
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const result: CostAnalysisResult = {
        skill: 'monitoring',
        monitoringType: 'COST_ANALYSIS',
        timeRange: { start: start.toISOString(), end: now.toISOString() },
        totalEstimatedCostUsd: totalCost,
        buckets,
      };
      return [compose('monitoring', result as unknown as MonitoringResult)];
    } catch {
      const now = new Date();
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const result: CostAnalysisResult = {
        skill: 'monitoring', monitoringType: 'COST_ANALYSIS',
        timeRange: { start: start.toISOString(), end: now.toISOString() },
        totalEstimatedCostUsd: 0, buckets: [],
      };
      return [compose('monitoring', result as unknown as MonitoringResult)];
    }
  }

  // FRESHNESS -- data freshness by table in a dataset (or across a project)
  if (monitoringType === 'FRESHNESS') {
    // Resolve dataset: handoff context > context.resolvedDataset > context.dataset > message scan
    let dataset = (hc?.dataset as string) || context?.resolvedDataset || '';
    if (!dataset && context?.dataset && context.dataset.toLowerCase() !== project.toLowerCase()) {
      dataset = context.dataset;
    }
    if (!dataset && context?.availableDatasets) {
      dataset = extractDatasetFromMessage(message, context.availableDatasets) ?? '';
    }
    const isProjectScope = !dataset;
    onStatus?.(`Checking data freshness${dataset ? ` for dataset ${dataset}` : ` across project ${project}`}...`);
    try {
      // __TABLES__ has last_modified_time; INFORMATION_SCHEMA.TABLES does not.
      // __TABLES__ is per-dataset, so for project scope we need to list datasets first.
      let allRows: unknown[][] = [];
      if (dataset) {
        const sql = `SELECT table_id, last_modified_time, row_count, '${dataset}' AS dataset_id FROM \`${project}.${dataset}.__TABLES__\` ORDER BY last_modified_time ASC`;
        const exec = await executeQuery(sql, project);
        allRows = exec.rows;
      } else {
        // Project scope: query __TABLES__ for each dataset
        const dsResult = await executeQuery(
          `SELECT schema_name FROM \`${project}\`.\`region-${region}\`.INFORMATION_SCHEMA.SCHEMATA ORDER BY schema_name`,
          project,
        );
        const datasets = dsResult.rows.map(r => String(r[0] ?? '')).filter(Boolean);
        for (const ds of datasets.slice(0, 20)) {
          try {
            const sql = `SELECT table_id, last_modified_time, row_count, '${ds}' AS dataset_id FROM \`${project}.${ds}.__TABLES__\``;
            const exec = await executeQuery(sql, project);
            allRows.push(...exec.rows);
          } catch {
            // Skip datasets we can't access
          }
        }
        // Sort by last_modified ascending (oldest first)
        allRows.sort((a, b) => {
          const ta = Number(a[1] ?? 0);
          const tb = Number(b[1] ?? 0);
          return ta - tb;
        });
        allRows = allRows.slice(0, 100);
      }

      const now = Date.now();
      const freshHours = 24;
      const staleHours = 72;
      // Debug: log first raw row to diagnose NaN timestamp issue
      if (allRows.length > 0) console.log('[freshness] raw row[0]:', JSON.stringify(allRows[0]), 'row[1] type:', typeof allRows[0][1]);
      const entries: FreshnessEntry[] = allRows.map(row => {
        const tbl = String(row[0] ?? '');
        // __TABLES__ last_modified_time: BQ REST API can return as:
        //   - string of ms ("1719849000000")
        //   - string of seconds with decimal ("1.719849E9" or "1719849000.0")
        //   - nested object { v: "..." }
        //   - number
        //   - null
        const rawVal = row[1];
        let modTimeMs = 0;
        if (rawVal != null) {
          const str = typeof rawVal === 'object' ? String((rawVal as Record<string, unknown>).v ?? rawVal) : String(rawVal);
          const num = Number(str);
          if (!isNaN(num)) {
            // If value is < 1e12, it's likely seconds (TIMESTAMP format), not ms
            modTimeMs = num < 1e12 ? Math.round(num * 1000) : num;
          }
        }
        const rowCount = typeof row[2] === 'string' ? parseInt(String(row[2]), 10) : Number(row[2] ?? 0);
        const ds = String(row[3] ?? '');
        const lastMod = modTimeMs > 0 ? new Date(modTimeMs).toISOString() : '';
        const ageHours = modTimeMs > 0 ? Math.max(0, (now - modTimeMs) / (1000 * 60 * 60)) : 0;
        const status: FreshnessEntry['status'] =
          ageHours <= freshHours ? 'FRESH' : ageHours <= staleHours ? 'STALE' : 'VERY_STALE';
        return { tableRef: `${project}.${ds}.${tbl}`, lastModified: lastMod, ageHours, rowCount, status };
      });
      const result: FreshnessResult = {
        skill: 'monitoring',
        monitoringType: 'FRESHNESS',
        dataset: dataset || null,
        project: project,
        entries,
        thresholds: { freshHours, staleHours },
      };
      return [compose('monitoring', result as unknown as MonitoringResult)];
    } catch (err) {
      console.error('[freshness] Error:', err);
      const result: FreshnessResult = {
        skill: 'monitoring', monitoringType: 'FRESHNESS',
        dataset: dataset || null, project: project, entries: [],
        thresholds: { freshHours: 24, staleHours: 72 },
      };
      return [compose('monitoring', result as unknown as MonitoringResult)];
    }
  }

  // JOBS (default) -- existing INFORMATION_SCHEMA.JOBS query
  const sql = `SELECT job_id, user_email, statement_type, state, creation_time, total_bytes_processed, error_result, referenced_tables FROM \`${project}\`.\`region-${region}\`.INFORMATION_SCHEMA.JOBS_BY_PROJECT WHERE creation_time > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR) ORDER BY creation_time DESC LIMIT 50`;

  onStatus?.(`Fetching last 24h of job history for project ${project}...`);
  const executed = await executeQuery(sql, project);

  // Map column indices
  const idx = (name: string) => executed.columns.indexOf(name);
  const iJobId       = idx('job_id');
  const iEmail       = idx('user_email');
  const iType        = idx('statement_type');
  const iState       = idx('state');
  const iCreateTime  = idx('creation_time');
  const iBytes       = idx('total_bytes_processed');
  const iError       = idx('error_result');
  const iTables      = idx('referenced_tables');

  const items: MonitoringJob[] = executed.rows.map((row) => {
    const stateVal = String(row[iState] ?? '').toUpperCase();
    const status: MonitoringJob['status'] =
      stateVal === 'RUNNING' ? 'RUNNING'
      : stateVal === 'DONE' && row[iError] != null ? 'ERROR'
      : 'DONE';

    let errorMessage: string | null = null;
    if (row[iError] != null) {
      try {
        const parsed = typeof row[iError] === 'string' ? JSON.parse(row[iError] as string) : row[iError];
        errorMessage = parsed?.message ?? String(row[iError]);
      } catch {
        errorMessage = String(row[iError]);
      }
    }

    let referencedTables: string[] = [];
    if (row[iTables] != null) {
      try {
        const parsed = typeof row[iTables] === 'string' ? JSON.parse(row[iTables] as string) : row[iTables];
        if (Array.isArray(parsed)) {
          referencedTables = parsed.map((t: { projectId?: string; datasetId?: string; tableId?: string }) =>
            [t.projectId, t.datasetId, t.tableId].filter(Boolean).join('.')
          );
        }
      } catch {
        // non-fatal -- leave as empty array
      }
    }

    return {
      jobId: String(row[iJobId] ?? ''),
      userEmail: String(row[iEmail] ?? ''),
      statementType: String(row[iType] ?? ''),
      status,
      createTime: normalizeTimestamp(row[iCreateTime]),
      totalBytesProcessed: Number(row[iBytes] ?? 0),
      errorMessage,
      referencedTables,
    };
  });

  const now = new Date();
  const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const result: MonitoringResult = {
    skill: 'monitoring',
    monitoringType: 'JOB_LIST',
    timeRange: { start: start.toISOString(), end: now.toISOString() },
    items,
    summary: {
      totalJobs: items.length,
      totalBytesProcessed: items.reduce((acc, j) => acc + j.totalBytesProcessed, 0),
      errorCount: items.filter((j) => j.status === 'ERROR').length,
    },
  };

  return [compose('monitoring', result)];
}

// ─── Skill manifest ───────────────────────────────────────────────────────────

export const manifest: SkillManifest = {
  skill: 'monitoring',
  label: 'monitoring',
  signals: [
    { phrase: 'slow query', weight: 3 },
    { phrase: 'expensive query', weight: 3 },
    { phrase: 'expensive job', weight: 3 },
    { phrase: 'expensive queries', weight: 3 },
    { phrase: 'slot', weight: 2 },
    { phrase: 'slot usage', weight: 3 },
    { phrase: 'failed job', weight: 3 },
    { phrase: 'failed jobs', weight: 3 },
    { phrase: 'job failed', weight: 3 },
    { phrase: 'who ran', weight: 3 },
    { phrase: 'job status', weight: 3 },
    { phrase: 'query cost', weight: 3 },
    { phrase: 'storage cost', weight: 3 },
    { phrase: 'storage analysis', weight: 3 },
    { phrase: 'table storage', weight: 3 },
    { phrase: 'how much storage', weight: 3 },
    { phrase: 'performance', weight: 2 },
    { phrase: 'recent queries', weight: 3 },
    { phrase: 'recent jobs', weight: 3 },
    { phrase: 'recent job', weight: 3 },
    { phrase: 'what failed', weight: 3 },
    { phrase: 'did that job', weight: 2 },
    { phrase: 'show jobs', weight: 3 },
    { phrase: 'job history', weight: 3 },
    { phrase: 'job list', weight: 3 },
    { phrase: "what's running", weight: 3 },
    { phrase: 'is running', weight: 2 },
    { phrase: 'did it finish', weight: 2 },
    { phrase: 'did the job', weight: 2 },
    { phrase: 'tell me more about job', weight: 3 },
    { phrase: 'diagnose', weight: 2 },
    { phrase: 'query plan', weight: 3 },
    { phrase: 'optimize', weight: 2 },
    { phrase: 'alert', weight: 2 },
    { phrase: 'threshold', weight: 2 },
    { phrase: 'notify', weight: 2 },
    { phrase: 'notification', weight: 2 },
    { phrase: 'watch', weight: 2 },
    { phrase: 'storage breakdown', weight: 3 },
    { phrase: 'disk usage', weight: 3 },
    { phrase: 'largest tables', weight: 3 },
    { phrase: 'storage treemap', weight: 3 },
    { phrase: 'which tables are largest', weight: 3 },
    { phrase: 'access patterns', weight: 3 },
    { phrase: 'who uses', weight: 3 },
    { phrase: 'most queried', weight: 3 },
    { phrase: 'who queries', weight: 3 },
    { phrase: 'table usage', weight: 3 },
    { phrase: 'cost analysis', weight: 3 },
    { phrase: 'how much am i spending', weight: 3 },
    { phrase: 'query costs over time', weight: 3 },
    { phrase: 'cost breakdown', weight: 3 },
    { phrase: 'spending', weight: 2 },
    { phrase: 'freshness', weight: 3 },
    { phrase: 'stale tables', weight: 3 },
    { phrase: 'when was table last updated', weight: 3 },
    { phrase: 'data freshness', weight: 3 },
    { phrase: 'outdated tables', weight: 3 },
  ],
  handle: handleMonitoring,
};
