// src/lib/composer.ts
// Transforms a skill's normalized result into a CompositionEnvelope
// Implements bigquery-response-composition.md
import { formatBytes } from '@/lib/format';

function randomUUID(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
import type {
  CompositionEnvelope,
  SchemaResult,
  QueryResult,
  DataManagementResult,
  MonitoringResult,
  AlertResult,
  DiscoveryResult,
  DataQualityResult,
  DataLoadingResult,
  StorageBreakdownResult,
  AccessPatternResult,
  CostAnalysisResult,
  FreshnessResult,
  GovernanceResult,
  Tone,
  HeadlineBasis,
  ArtifactType,
  HandoffEnvelope,
  SkillName,
  QualityFlag,
  PipelineResult,
} from './types';

// ─── Main compose function ────────────────────────────────────────────────────

export function compose(
  skill: SkillName,
  result: SchemaResult | QueryResult | DataManagementResult | MonitoringResult | AlertResult | DiscoveryResult | DataQualityResult | DataLoadingResult | StorageBreakdownResult | AccessPatternResult | CostAnalysisResult | FreshnessResult | GovernanceResult | PipelineResult,
  qualityFlags?: QualityFlag[],
): CompositionEnvelope {
  switch (skill) {
    case 'schema':
      return composeSchema(result as SchemaResult);
    case 'query':
      return composeQuery(result as QueryResult, qualityFlags);
    case 'data-management':
      return composeDataManagement(result as DataManagementResult);
    case 'monitoring': {
      const monRes = result as MonitoringResult | AlertResult | StorageBreakdownResult | AccessPatternResult | CostAnalysisResult | FreshnessResult;
      if ('alertCategory' in monRes) return composeAlert(monRes as AlertResult);
      if ('monitoringType' in monRes) {
        const mt = (monRes as { monitoringType: string }).monitoringType;
        if (mt === 'STORAGE_BREAKDOWN') return composeStorageBreakdown(monRes as StorageBreakdownResult);
        if (mt === 'ACCESS_PATTERNS') return composeAccessPatterns(monRes as AccessPatternResult);
        if (mt === 'COST_ANALYSIS') return composeCostAnalysis(monRes as CostAnalysisResult);
        if (mt === 'FRESHNESS') return composeFreshness(monRes as FreshnessResult);
      }
      return composeMonitoring(monRes as MonitoringResult);
    }
    case 'discovery':
      return composeDiscovery(result as DiscoveryResult);
    case 'data-quality':
      return composeDataQuality(result as DataQualityResult);
    case 'data-loading':
      return composeDataLoading(result as DataLoadingResult);
    case 'governance':
      return composeGovernance(result as GovernanceResult);
    case 'pipeline':
      return composePipeline(result as unknown as PipelineResult);
    default:
      return composeGeneric(skill, result);
  }
}

// ─── Schema composition ───────────────────────────────────────────────────────

function composeSchema(result: SchemaResult): CompositionEnvelope {
  const id = randomUUID();
  let headlineText = '';
  const tone: Tone = 'NEUTRAL';
  let basis: HeadlineBasis = 'STATUS';
  const artifactType: ArtifactType = 'SCHEMA_VIEW';
  const nextActions: HandoffEnvelope[] = [];

  if (result.scope === 'PROJECT') {
    const count = result.columns.length;
    headlineText = `Found ${count} dataset${count !== 1 ? 's' : ''}`;
    // Add a chip for each dataset (up to 4) so the user can drill in immediately
    result.columns.slice(0, 4).forEach((ds) => {
      nextActions.push({
        targetSkill: 'schema',
        label: `Explore ${ds.name}`,
        context: { dataset: ds.name, project: result.project },
        sourceSkill: 'schema',
        sourceResultRef: id,
      });
    });
    // Always offer a search option
    nextActions.push({
      targetSkill: 'discovery',
      label: 'Search across all tables',
      context: { project: result.project },
      sourceSkill: 'schema',
      sourceResultRef: id,
    });
  } else if (result.scope === 'DATASET') {
    const count = result.columns.length;
    headlineText = `${result.dataset} has ${count} table${count !== 1 ? 's' : ''}`;
    // Add a chip for each table (up to 4) so the user can inspect one immediately
    result.columns.slice(0, 4).forEach((t) => {
      nextActions.push({
        targetSkill: 'schema',
        label: `Inspect ${t.name}`,
        context: { dataset: result.dataset, table: t.name, project: result.project },
        sourceSkill: 'schema',
        sourceResultRef: id,
      });
    });
    // Offer to profile the dataset
    nextActions.push({
      targetSkill: 'data-quality',
      label: `Profile ${result.dataset}`,
      context: { dataset: result.dataset, project: result.project, checkType: 'PROFILE' },
      sourceSkill: 'schema',
      sourceResultRef: id,
    });
  } else {
    // TABLE scope — lead with the most actionable structural fact
    const parts: string[] = [];
    if (result.partitioning) {
      parts.push(`partitioned by \`${result.partitioning.field}\``);
    }
    if (result.clustering?.length) {
      parts.push(`clustered by ${result.clustering.map((c) => `\`${c}\``).join(', ')}`);
    }

    if (parts.length > 0) {
      headlineText = `\`${result.table}\` is ${parts.join(' and ')} — filter on these to keep queries efficient`;
      basis = 'DIRECT_ANSWER';
    } else {
      const colCount = result.columns.length;
      const rowCount = result.rowCount?.toLocaleString() ?? 'unknown';
      headlineText = `\`${result.table}\` — ${colCount} columns, ${rowCount} rows`;
    }

    // Contextual next-action chips for TABLE scope
    nextActions.push({
      targetSkill: 'query',
      label: `Query ${result.table}`,
      context: { dataset: result.dataset, table: result.table, project: result.project },
      sourceSkill: 'schema',
      sourceResultRef: id,
    });
    nextActions.push({
      targetSkill: 'data-quality',
      label: `Profile ${result.table}`,
      context: { dataset: result.dataset, table: result.table, project: result.project, checkType: 'PROFILE' },
      sourceSkill: 'schema',
      sourceResultRef: id,
    });
    nextActions.push({
      targetSkill: 'monitoring',
      label: 'Check data freshness',
      context: { dataset: result.dataset, table: result.table, project: result.project, monitoringType: 'FRESHNESS' },
      sourceSkill: 'schema',
      sourceResultRef: id,
    });
  }

  return {
    id,
    skill: 'schema',
    headline: { text: headlineText, tone, basis },
    primaryArtifact: { type: artifactType, data: result },
    provenance: { visibility: 'COLLAPSED' },
    nextActions,
  };
}

// ─── Query composition ────────────────────────────────────────────────────────

function composeQuery(result: QueryResult, qualityFlags?: QualityFlag[]): CompositionEnvelope {
  const id = randomUUID();

  // Cost confirm card — don't show results
  if (result.requiresConfirmation && result.costConfirm) {
    return {
      id,
      skill: 'query',
      headline: {
        text: `This query will process ~${formatBytes(result.costConfirm.totalBytesProcessed)}. Confirm to run?`,
        tone: 'ATTENTION',
        basis: 'THRESHOLD',
      },
      primaryArtifact: { type: 'COST_CONFIRM_CARD', data: result.costConfirm },
      provenance: { visibility: 'VISIBLE', sql: result.sql },
      nextActions: [],
      requiresConfirmation: true,
    };
  }

  // Normal result
  let tone: Tone = 'NEUTRAL';
  let basis: HeadlineBasis = 'STATUS';
  let headlineText = '';

  // Zero-row results always use the diagnostic headline builder.
  // The LLM summary is written assuming data will be returned, so it produces
  // misleading headlines like "Discover your storage footprint" for an empty result.
  if (result.rowCount === 0) {
    headlineText = buildQueryHeadline(0, result.sql, result.columns, result.rows);
  } else {
    // Prefer LLM-generated summary only if it's a clean, short natural-language string.
    // The agent loop sometimes returns raw JSON envelopes or verbose dumps as textResponse.
    const rawSummary = (result as any).resultSummary as string | null;
    const isCleanSummary = rawSummary
      && rawSummary.length < 300
      && !rawSummary.includes('"skill"')
      && !rawSummary.includes('"columns"')
      && !rawSummary.trimStart().startsWith('{')
      && !rawSummary.trimStart().startsWith('```');

    if (isCleanSummary) {
      headlineText = rawSummary;
      basis = 'DIRECT_ANSWER';
    } else {
      headlineText = buildQueryHeadline(result.rowCount, result.sql, result.columns, result.rows);
    }
  }

  // Set tone based on result characteristics
  if (result.rowCount === 0) {
    tone = 'ATTENTION';
    basis = 'STATUS';
  } else if (result.notableFindings) {
    tone = 'ATTENTION';
    basis = 'DEVIATION';
  }

  const insight = result.notableFindings ?? null;

  // Force TABLE for zero-row results -- chart components would receive empty data
  // Force TABLE for sample/preview queries -- charting random sample data is nonsensical
  const isSampleQuery = /SELECT\s+\*\s+FROM\b/i.test(result.sql) && /\bLIMIT\s+\d+\b/i.test(result.sql);
  const artifactType = result.rowCount === 0
    ? 'TABLE' as ArtifactType
    : isSampleQuery
      ? 'TABLE' as ArtifactType
      : inferVisualizationType(result);

  const nextActions: HandoffEnvelope[] = [];
  if (result.rowCount === 0) {
    // Diagnostic recovery chips for empty results
    const zeroRowTable = extractTableFromSql(result.sql);
    const fullTableRef = extractFullTableRef(result.sql);
    if (zeroRowTable && fullTableRef) {
      nextActions.push({
        targetSkill: 'query',
        label: `Sample \`${zeroRowTable}\``,
        context: { sql: `SELECT * FROM \`${fullTableRef}\` LIMIT 10` },
        sourceSkill: 'query',
        sourceResultRef: id,
      });
      nextActions.push({
        targetSkill: 'schema',
        label: `View \`${zeroRowTable}\` schema`,
        context: { table: fullTableRef },
        sourceSkill: 'query',
        sourceResultRef: id,
      });
    }
  } else {
    // "Export results" moved to kebab menu in ArtifactCard header
    // "Save this query" removed -- dedicated save button exists in header
    // If anomalies or nulls might be present, offer Data Quality
    if (result.notableFindings) {
      nextActions.push({
        targetSkill: 'data-quality',
        label: 'Check data quality',
        context: { sql: result.sql },
        sourceSkill: 'query',
        sourceResultRef: id,
      });
    }

    // Convert quality flag suggested actions into next-action chips
    // (respecting the 4-chip cap from invariants)
    if (qualityFlags) {
      for (const flag of qualityFlags) {
        if (flag.suggestedAction && nextActions.length < 4) {
          nextActions.push({
            targetSkill: flag.suggestedAction.skill,
            label: flag.suggestedAction.label,
            context: flag.suggestedAction.context,
            sourceSkill: 'query',
            sourceResultRef: id,
          });
        }
      }
    }

    // Generate data-driven suggestions when quality flags don't provide enough
    if (nextActions.length < 4 && result.rows.length > 0) {
      // Extract table name from SQL for targeted suggestions
      const tableMatch = result.sql?.match(/FROM\s+`?[\w.-]+\.(\w+)`?/i);
      const tableName = tableMatch?.[1] || '';

      // If result has a numeric aggregate column, suggest drill-down
      const numericCols = result.columns.filter((c, i) => {
        const firstVal = result.rows[0]?.[i];
        return typeof firstVal === 'number' || (typeof firstVal === 'string' && /^\d+(\.\d+)?$/.test(firstVal));
      });
      const categoryCols = result.columns.filter((c, i) => {
        const firstVal = result.rows[0]?.[i];
        return typeof firstVal === 'string' && !/^\d+(\.\d+)?$/.test(firstVal);
      });

      // Suggest charting if data has a category + numeric pattern
      if (categoryCols.length > 0 && numericCols.length > 0 && result.rows.length >= 2 && nextActions.length < 4) {
        nextActions.push({
          targetSkill: 'query',
          label: `Chart ${numericCols[0]} by ${categoryCols[0]}`,
          context: { table: tableName },
          sourceSkill: 'query',
          sourceResultRef: id,
        });
      }

      // Suggest drill-down into a specific value from the results
      if (categoryCols.length > 0 && result.rows.length > 1 && nextActions.length < 4) {
        const topVal = result.rows[0]?.[result.columns.indexOf(categoryCols[0])];
        if (topVal && typeof topVal === 'string' && topVal.length < 40) {
          nextActions.push({
            targetSkill: 'query',
            label: `Drill into ${categoryCols[0]} = "${topVal}"`,
            context: { table: tableName, filter: { column: categoryCols[0], value: topVal } },
            sourceSkill: 'query',
            sourceResultRef: id,
          });
        }
      }

      // Suggest data quality check for the source table
      if (tableName && nextActions.length < 4) {
        nextActions.push({
          targetSkill: 'data-quality',
          label: `Profile ${tableName}`,
          context: { table: tableName },
          sourceSkill: 'query',
          sourceResultRef: id,
        });
      }

      // Suggest viewing the table schema
      if (tableName && nextActions.length < 4) {
        nextActions.push({
          targetSkill: 'schema',
          label: `View ${tableName} schema`,
          context: { table: tableName },
          sourceSkill: 'query',
          sourceResultRef: id,
        });
      }
    }
  }

  return {
    id,
    skill: 'query',
    headline: { text: headlineText, tone, basis },
    primaryArtifact: {
      type: artifactType,
      data: result,
      emphasis: result.notableFindings
        ? { highlight: [], deemphasize: [] }
        : undefined,
    },
    provenance: {
      visibility: result.costTier >= 1 ? 'VISIBLE' : 'COLLAPSED',
      sql: result.sql,
      cost: {
        totalBytesProcessed: result.totalBytesProcessed,
        tier: result.costTier,
        requiresConfirmation: false,
      },
      jobId: result.jobId,
      project: extractProjectFromSql(result.sql),
    },
    nextActions,
    insight,
    qualityFlags: qualityFlags && qualityFlags.length > 0 ? qualityFlags : undefined,
    extractedParameters: result.extractedParameters,
  };
}

// ─── Data Management composition ──────────────────────────────────────────────

function composeDataManagement(
  result: DataManagementResult
): CompositionEnvelope {
  const id = randomUUID();

  if (result.requiresConfirmation) {
    // Confirmation card
    let headlineText = '';
    if (result.operation === 'DEDUPE') {
      const dupeCount = Number.isFinite(result.affectedRowCount) ? Math.round(result.affectedRowCount).toLocaleString() : 'some';
      headlineText = `Found ${dupeCount} duplicate rows across ${result.affectedGroupCount ?? 0} groups -- I'll keep the most recently updated copy of each`;
    } else {
      const count = Number.isFinite(result.affectedRowCount)
        ? Math.round(result.affectedRowCount).toLocaleString()
        : 'an unknown number of';
      headlineText = `This will affect ${count} rows. Review the preview and confirm.`;
    }

    return {
      id,
      skill: 'data-management',
      headline: { text: headlineText, tone: 'NEUTRAL', basis: 'DIRECT_ANSWER' },
      primaryArtifact: { type: 'CONFIRMATION_CARD', data: result },
      provenance: {
        visibility: 'VISIBLE',
        sql: result.previewSql,
        cost: result.costEstimate ?? undefined,
      },
      nextActions: [], // Confirm/Cancel are rendered by the card itself
      requiresConfirmation: true,
    };
  } else {
    // Completion card
    const tone: Tone = result.mismatch ? 'ATTENTION' : 'NEUTRAL';
    let headlineText: string;
    if (result.mismatch) {
      headlineText = result.mismatchNote ?? `Completed with unexpected result`;
    } else if (result.completionMessage) {
      headlineText = result.completionMessage;
    } else if (result.operation === 'DEDUPE') {
      headlineText = `Done — removed ${result.rowsAffected} duplicate rows`;
    } else {
      headlineText = `Done — ${result.rowsAffected} rows affected`;
    }

    const nextActions: HandoffEnvelope[] = [
      {
        targetSkill: 'query',
        label: 'Show the updated table',
        context: {},
        sourceSkill: 'data-management',
        sourceResultRef: id,
      },
    ];

    return {
      id,
      skill: 'data-management',
      headline: { text: headlineText, tone, basis: result.mismatch ? 'DEVIATION' : 'STATUS' },
      primaryArtifact: { type: 'COMPLETION_CARD', data: result },
      provenance: { visibility: 'COLLAPSED' },
      nextActions,
    };
  }
}

// ─── Governance composition ──────────────────────────────────────────────────

function composeGovernance(result: GovernanceResult): CompositionEnvelope {
  const id = randomUUID();
  let headlineText = '';
  let tone: Tone = 'NEUTRAL';
  const basis: HeadlineBasis = 'STATUS';
  const nextActions: HandoffEnvelope[] = [];
  let isLightweight = false; // true when result has no substantive data

  switch (result.governanceType) {
    case 'ACCESS_AUDIT': {
      const count = result.accessEntries?.length ?? 0;
      if (count === 0) {
        headlineText = `No explicit access entries found for \`${result.scope}\` -- permissions may be inherited from the project level`;
        isLightweight = true;
      } else {
        // Group by role for a descriptive headline
        const roleGroups: Record<string, number> = {};
        for (const e of result.accessEntries!) {
          roleGroups[e.role] = (roleGroups[e.role] || 0) + 1;
        }
        const uniqueEntities = new Set(result.accessEntries!.map(e => e.entity)).size;
        const topRole = Object.entries(roleGroups).sort(([, a], [, b]) => b - a)[0];
        if (topRole) {
          headlineText = `${uniqueEntities} principal${uniqueEntities !== 1 ? 's' : ''} have access to \`${result.scope}\` -- most common role: ${topRole[0]}`;
        } else {
          headlineText = `${count} access entries for \`${result.scope}\``;
        }
      }
      nextActions.push({
        targetSkill: 'governance',
        label: 'Check security policies',
        context: { governanceType: 'TABLE_SECURITY' },
        sourceSkill: 'governance',
        sourceResultRef: id,
      });
      nextActions.push({
        targetSkill: 'governance',
        label: 'Scan for PII',
        context: { governanceType: 'SENSITIVE_DATA_SCAN' },
        sourceSkill: 'governance',
        sourceResultRef: id,
      });
      break;
    }
    case 'TABLE_SECURITY': {
      const p = result.securityPolicies!;
      const parts: string[] = [];
      if (p.rowLevelPolicies > 0) parts.push(`${p.rowLevelPolicies} row-level polic${p.rowLevelPolicies !== 1 ? 'ies' : 'y'}`);
      if (p.columnLevelMasking > 0) parts.push(`${p.columnLevelMasking} column mask${p.columnLevelMasking !== 1 ? 's' : ''}`);
      if (p.policyTags.length > 0) parts.push(`${p.policyTags.length} policy tag${p.policyTags.length !== 1 ? 's' : ''}`);
      if (parts.length === 0) {
        headlineText = `No active row-level or column-level security policies detected on \`${result.scope}\``;
        tone = 'ATTENTION';
        isLightweight = true;
      } else {
        headlineText = `\`${result.scope}\`: ${parts.join(', ')}`;
        tone = 'POSITIVE';
      }
      nextActions.push({
        targetSkill: 'governance',
        label: 'Audit access',
        context: { governanceType: 'ACCESS_AUDIT' },
        sourceSkill: 'governance',
        sourceResultRef: id,
      });
      nextActions.push({
        targetSkill: 'governance',
        label: 'Scan for PII',
        context: { governanceType: 'SENSITIVE_DATA_SCAN' },
        sourceSkill: 'governance',
        sourceResultRef: id,
      });
      break;
    }
    case 'SENSITIVE_DATA_SCAN': {
      const count = result.sensitiveFindings?.length ?? 0;
      if (count === 0) {
        headlineText = `No sensitive data patterns detected in \`${result.scope}\``;
        tone = 'POSITIVE';
        isLightweight = true;
      } else {
        const highCount = result.sensitiveFindings!.filter(f => f.confidence === 'high').length;
        if (highCount > 0) {
          headlineText = `${count} potential PII pattern${count !== 1 ? 's' : ''} found in \`${result.scope}\` (${highCount} high confidence)`;
          tone = 'ATTENTION';
        } else {
          headlineText = `${count} potential PII pattern${count !== 1 ? 's' : ''} found in \`${result.scope}\``;
          tone = 'ATTENTION';
        }
      }
      nextActions.push({
        targetSkill: 'governance',
        label: 'Check security policies',
        context: { governanceType: 'TABLE_SECURITY' },
        sourceSkill: 'governance',
        sourceResultRef: id,
      });
      nextActions.push({
        targetSkill: 'governance',
        label: 'Check documentation',
        context: { governanceType: 'DATA_CLASSIFICATION' },
        sourceSkill: 'governance',
        sourceResultRef: id,
      });
      break;
    }
    case 'DATA_CLASSIFICATION': {
      const cls = result.classification!;
      const totalTables = cls.documentedTables + cls.undocumentedTables;
      const pct = totalTables > 0 ? Math.round((cls.documentedTables / totalTables) * 100) : 0;
      if (cls.undocumentedTables === 0) {
        headlineText = `All ${totalTables} tables in \`${result.scope}\` are documented`;
        tone = 'POSITIVE';
      } else {
        headlineText = `${pct}% documentation coverage in \`${result.scope}\` -- ${cls.undocumentedTables} table${cls.undocumentedTables !== 1 ? 's' : ''} undocumented`;
        tone = cls.undocumentedTables > 5 ? 'ATTENTION' : 'NEUTRAL';
      }
      nextActions.push({
        targetSkill: 'governance',
        label: 'Audit access',
        context: { governanceType: 'ACCESS_AUDIT' },
        sourceSkill: 'governance',
        sourceResultRef: id,
      });
      nextActions.push({
        targetSkill: 'governance',
        label: 'Scan for PII',
        context: { governanceType: 'SENSITIVE_DATA_SCAN' },
        sourceSkill: 'governance',
        sourceResultRef: id,
      });
      break;
    }
  }

  return {
    id,
    skill: 'governance',
    headline: { text: headlineText, tone, basis },
    primaryArtifact: { type: 'GOVERNANCE_VIEW', data: result },
    provenance: result.sql
      ? { visibility: 'COLLAPSED', sql: result.sql }
      : { visibility: 'COLLAPSED' },
    nextActions,
    ...(isLightweight ? { presentation: 'inline' as const } : {}),
  };
}

// ─── Generic fallback ─────────────────────────────────────────────────────────

function composeGeneric(
  skill: SkillName,
  result: unknown
): CompositionEnvelope {
  return {
    id: randomUUID(),
    skill,
    headline: { text: 'Result', tone: 'NEUTRAL', basis: 'STATUS' },
    primaryArtifact: { type: 'TABLE', data: result },
    provenance: { visibility: 'COLLAPSED' },
    nextActions: [],
  };
}

// ─── Monitoring composition ───────────────────────────────────────────────────

function composeMonitoring(result: MonitoringResult): CompositionEnvelope {
  const id = randomUUID();
  const { summary, items } = result;

  const tone: Tone = summary.errorCount > 0 ? 'ATTENTION' : 'NEUTRAL';
  let headlineText: string;
  if (summary.errorCount > 0) {
    const errorTypes = items.filter(j => j.status === 'ERROR');
    const uniqueErrors = new Set(errorTypes.map(j => j.statementType)).size;
    if (uniqueErrors === 1 && errorTypes.length > 1) {
      headlineText = `${summary.errorCount} failed ${errorTypes[0].statementType} jobs in the last 24h (${summary.totalJobs} total)`;
    } else {
      headlineText = `${summary.errorCount} failed job${summary.errorCount !== 1 ? 's' : ''} out of ${summary.totalJobs} in the last 24h`;
    }
  } else {
    headlineText = `${summary.totalJobs} jobs in the last 24h -- all successful, ${formatBytes(summary.totalBytesProcessed)} processed`;
  }

  const nextActions: HandoffEnvelope[] = [];

  // Always offer a cost drill-in
  nextActions.push({
    targetSkill: 'monitoring',
    label: 'Show most expensive queries',
    context: { monitoringHint: 'COST_ANALYSIS' },
    sourceSkill: 'monitoring',
    sourceResultRef: id,
  });

  // If there are errors, offer to diagnose them
  if (summary.errorCount > 0) {
    const failedJob = items.find((j) => j.status === 'ERROR');
    nextActions.push({
      targetSkill: 'monitoring',
      label: 'Diagnose failed jobs',
      context: { monitoringHint: 'DIAGNOSE_FAILURES', jobId: failedJob?.jobId },
      sourceSkill: 'monitoring',
      sourceResultRef: id,
    });
  }

  // Always offer storage analysis
  nextActions.push({
    targetSkill: 'monitoring',
    label: 'Storage analysis',
    context: { monitoringHint: 'STORAGE_ANALYSIS' },
    sourceSkill: 'monitoring',
    sourceResultRef: id,
  });

  return {
    id,
    skill: 'monitoring',
    headline: { text: headlineText, tone, basis: 'STATUS' },
    primaryArtifact: { type: 'MONITORING_VIEW', data: result },
    provenance: {
      visibility: 'COLLAPSED',
      sql: `SELECT job_id, user_email, statement_type, state, creation_time, total_bytes_processed, error_result, referenced_tables FROM \`region-<auto>\`.INFORMATION_SCHEMA.JOBS_BY_PROJECT WHERE creation_time > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR) ORDER BY creation_time DESC LIMIT 50`,
    },
    nextActions,
  };
}

// ─── Alert composition ────────────────────────────────────────────────────────

function composeAlert(result: AlertResult): CompositionEnvelope {
  const id = randomUUID();

  const categoryLabels: Record<string, string> = {
    PROJECT_WIDE: 'Project-wide alert',
    JOB_SPECIFIC: 'Job-specific check',
    DATA_CONDITION: 'Data condition check',
  };

  const headlineText = `${categoryLabels[result.alertCategory] || 'Alert'}: ${result.conditionDescription}`;
  const tone: Tone = 'NEUTRAL';




  return {
    id,
    skill: 'monitoring',
    headline: { text: headlineText, tone, basis: 'STATUS' },
    primaryArtifact: { type: 'ALERT_VIEW', data: result },
    provenance: result.checkSql
      ? { visibility: 'COLLAPSED', sql: result.checkSql }
      : { visibility: 'COLLAPSED' },
    nextActions: [],
  };
}

// ─── Discovery composition ────────────────────────────────────────────────────

function composeDiscovery(result: DiscoveryResult): CompositionEnvelope {
  const id = randomUUID();
  let headlineText = '';
  let tone: Tone = 'NEUTRAL';
  const basis: HeadlineBasis = 'STATUS';

  if (result.discoveryType === 'LINEAGE') {
    const lin = result.lineage;
    if (!lin) {
      headlineText = 'Lineage data unavailable';
    } else {
      headlineText = `Lineage for \`${lin.tableName}\`: ${lin.readsFrom.length} upstream, ${lin.writtenBy.length} downstream`;
    }
  } else if (result.discoveryType === 'ER_DIAGRAM') {
    const er = result.erDiagram;
    if (!er || er.tables.length === 0) {
      headlineText = 'No tables found for ER diagram';
    } else {
      const relCount = er.relationships.length;
      headlineText = `${er.tables.length} tables in \`${er.dataset}\`${relCount > 0 ? `, ${relCount} relationship${relCount !== 1 ? 's' : ''}` : ''}`;
    }
  } else if (result.discoveryType === 'COMPARISON') {
    const cmp = result.comparison;
    if (!cmp) {
      headlineText = 'Schema comparison unavailable';
    } else {
      const total = cmp.addedColumns.length + cmp.removedColumns.length + cmp.changedColumns.length;
      if (total === 0) {
        headlineText = `\`${cmp.left}\` and \`${cmp.right}\` have identical schemas`;
      } else {
        tone = 'ATTENTION';
        headlineText = `${total} difference${total !== 1 ? 's' : ''} between \`${cmp.left}\` and \`${cmp.right}\``;
      }
    }
  } else {
    const count = result.results.length;
    if (count > 0) {
      const tableCount = result.results.filter(r => r.type === 'TABLE').length;
      const viewCount = result.results.filter(r => r.type === 'VIEW').length;
      const parts: string[] = [];
      if (tableCount > 0) parts.push(`${tableCount} table${tableCount !== 1 ? 's' : ''}`);
      if (viewCount > 0) parts.push(`${viewCount} view${viewCount !== 1 ? 's' : ''}`);
      headlineText = parts.length > 0
        ? `Found ${parts.join(' and ')} matching "${result.query}"`
        : `Found ${count} result${count !== 1 ? 's' : ''} matching "${result.query}"`;
    } else {
      headlineText = `No tables or views found matching "${result.query}"`;
      tone = 'ATTENTION';
    }
  }

  const nextActions: HandoffEnvelope[] = [];

  if (result.discoveryType === 'COMPARISON') {
    // After a comparison, offer to inspect each table's full schema
    if (result.comparison) {
      nextActions.push({
        targetSkill: 'schema',
        label: `Inspect ${result.comparison.left.split('.').pop()}`,
        context: { table: result.comparison.left },
        sourceSkill: 'discovery',
        sourceResultRef: id,
      });
      nextActions.push({
        targetSkill: 'schema',
        label: `Inspect ${result.comparison.right.split('.').pop()}`,
        context: { table: result.comparison.right },
        sourceSkill: 'discovery',
        sourceResultRef: id,
      });
    }
  } else {
    // Search results: chip for each found item (up to 2)
    result.results.slice(0, 2).forEach((r) => {
      nextActions.push({
        targetSkill: 'schema',
        label: `Inspect ${r.ref.split('.').pop()}`,
        context: { table: r.ref },
        sourceSkill: 'discovery',
        sourceResultRef: id,
      });
    });
    // Always offer to run a query against first result
    if (result.results.length > 0) {
      nextActions.push({
        targetSkill: 'query',
        label: `Sample ${result.results[0].ref.split('.').pop()}`,
        context: { table: result.results[0].ref, sql: `SELECT * FROM \`${result.results[0].ref}\` LIMIT 20` },
        sourceSkill: 'discovery',
        sourceResultRef: id,
      });
    }
  }

  // Choose artifact type based on discovery subtype
  let artifactType: ArtifactType = 'DISCOVERY_VIEW';
  if (result.discoveryType === 'LINEAGE') artifactType = 'LINEAGE_DAG_VIEW';
  if (result.discoveryType === 'ER_DIAGRAM') artifactType = 'ER_DIAGRAM_VIEW';

  return {
    id,
    skill: 'discovery',
    headline: { text: headlineText, tone, basis },
    primaryArtifact: { type: artifactType, data: result },
    provenance: { visibility: 'COLLAPSED' },
    nextActions,
  };
}
// ─── Storage Breakdown composition ────────────────────────────────────────────

function composeStorageBreakdown(result: StorageBreakdownResult): CompositionEnvelope {
  const id = randomUUID();
  const dsCount = result.items.length;
  const headlineText = `Storage breakdown for ${result.project}: ${formatBytes(result.totalBytes)} across ${dsCount} dataset${dsCount !== 1 ? 's' : ''}`;

  return {
    id,
    skill: 'monitoring',
    headline: { text: headlineText, tone: 'NEUTRAL', basis: 'STATUS' },
    primaryArtifact: { type: 'STORAGE_VIEW', data: result },
    provenance: { visibility: 'COLLAPSED' },
    nextActions: [
      { targetSkill: 'monitoring', label: 'Data freshness', context: { monitoringHint: 'FRESHNESS' }, sourceSkill: 'monitoring', sourceResultRef: id },
      { targetSkill: 'monitoring', label: 'Cost analysis', context: { monitoringHint: 'COST_ANALYSIS' }, sourceSkill: 'monitoring', sourceResultRef: id },
    ],
  };
}

// ─── Access Patterns composition ──────────────────────────────────────────────

function composeAccessPatterns(result: AccessPatternResult): CompositionEnvelope {
  const id = randomUUID();
  const uniqueTables = new Set(result.entries.map(e => e.tableRef)).size;
  const uniqueUsers = new Set(result.entries.map(e => e.userEmail)).size;
  const headlineText = `Access patterns: ${uniqueUsers} user${uniqueUsers !== 1 ? 's' : ''} across ${uniqueTables} table${uniqueTables !== 1 ? 's' : ''} (last 30 days)`;

  return {
    id,
    skill: 'monitoring',
    headline: { text: headlineText, tone: 'NEUTRAL', basis: 'STATUS' },
    primaryArtifact: { type: 'ACCESS_PATTERN_VIEW', data: result },
    provenance: { visibility: 'COLLAPSED' },
    nextActions: [
      { targetSkill: 'monitoring', label: 'Cost analysis', context: { monitoringHint: 'COST_ANALYSIS' }, sourceSkill: 'monitoring', sourceResultRef: id },
      { targetSkill: 'monitoring', label: 'Storage breakdown', context: { monitoringHint: 'STORAGE_BREAKDOWN' }, sourceSkill: 'monitoring', sourceResultRef: id },
    ],
  };
}

// ─── Cost Analysis composition ────────────────────────────────────────────────

function composeCostAnalysis(result: CostAnalysisResult): CompositionEnvelope {
  const id = randomUUID();
  const costStr = `$${result.totalEstimatedCostUsd.toFixed(2)}`;
  const tone: Tone = result.totalEstimatedCostUsd > 10 ? 'ATTENTION' : 'NEUTRAL';
  const headlineText = `Estimated query cost: ${costStr} over the last 30 days`;

  return {
    id,
    skill: 'monitoring',
    headline: { text: headlineText, tone, basis: 'STATUS' },
    primaryArtifact: { type: 'COST_ANALYSIS_VIEW', data: result },
    provenance: { visibility: 'COLLAPSED' },
    nextActions: [
      { targetSkill: 'monitoring', label: 'Access patterns', context: { monitoringHint: 'ACCESS_PATTERNS' }, sourceSkill: 'monitoring', sourceResultRef: id },
      { targetSkill: 'monitoring', label: 'Job history', context: { monitoringHint: 'JOB_LIST' }, sourceSkill: 'monitoring', sourceResultRef: id },
    ],
  };
}

// ─── Freshness composition ────────────────────────────────────────────────────

function composeFreshness(result: FreshnessResult): CompositionEnvelope {
  const id = randomUUID();
  const staleCount = result.entries.filter(e => e.status === 'STALE').length;
  const veryStaleCount = result.entries.filter(e => e.status === 'VERY_STALE').length;
  const issueCount = staleCount + veryStaleCount;
  const tone: Tone = veryStaleCount > 0 ? 'ATTENTION' : issueCount > 0 ? 'NEUTRAL' : 'POSITIVE';
  const scopeLabel = result.dataset
    ? `dataset '${result.dataset}'`
    : `project '${result.project || 'unknown'}'`;
  const headlineText = result.entries.length === 0
    ? `No tables found in ${scopeLabel}`
    : issueCount > 0
      ? `${result.entries.length} tables in ${scopeLabel}: ${issueCount} stale (${veryStaleCount} critical)`
      : `All ${result.entries.length} tables in ${scopeLabel} are fresh`;

  return {
    id,
    skill: 'monitoring',
    headline: { text: headlineText, tone, basis: 'STATUS' },
    primaryArtifact: { type: 'FRESHNESS_VIEW', data: result },
    provenance: { visibility: 'COLLAPSED' },
    nextActions: [
      { targetSkill: 'monitoring', label: 'Storage breakdown', context: { monitoringHint: 'STORAGE_BREAKDOWN' }, sourceSkill: 'monitoring', sourceResultRef: id },
      { targetSkill: 'monitoring', label: 'Access patterns', context: { monitoringHint: 'ACCESS_PATTERNS' }, sourceSkill: 'monitoring', sourceResultRef: id },
    ],
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Date/time column detection patterns
const DATE_COL_PATTERN = /^(date|time|timestamp|created|updated|modified|month|year|quarter|day|week|hour|period|dt|ts|_at$)/i;
const DATE_SUFFIX_PATTERN = /(_date|_time|_at|_ts|_dt|_month|_year|_day|_week|_quarter)$/i;

function isDateColumn(colName: string, sampleValues: unknown[]): boolean {
  if (DATE_COL_PATTERN.test(colName) || DATE_SUFFIX_PATTERN.test(colName)) return true;
  // Check if sample values look like dates
  const sample = sampleValues.filter(v => v != null).slice(0, 5);
  if (sample.length === 0) return false;
  return sample.every(v => {
    const s = String(v);
    // ISO dates, YYYY-MM-DD, date-like strings
    return /^\d{4}-\d{2}(-\d{2})?/.test(s) || /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(s);
  });
}

function isNumericValue(v: unknown): boolean {
  if (typeof v === 'number') return true;
  if (typeof v === 'string' && v !== '' && !isNaN(Number(v))) return true;
  return false;
}

/**
 * Infer the best visualization type from the actual data shape.
 * The LLM's suggestedVisualization is used as a tiebreaker, not the primary signal.
 * Follows the chart-type-by-data-shape mapping from the response-composition spec.
 */
function inferVisualizationType(result: QueryResult): ArtifactType {
  const { columns, rows, rowCount } = result;
  if (!columns || columns.length === 0 || !rows || rows.length === 0) return 'TABLE';

  // Classify each column as numeric, date, or categorical based on actual values
  const colTypes: ('numeric' | 'date' | 'categorical')[] = columns.map((col, i) => {
    const sampleValues = rows.slice(0, 10).map(r => (r as unknown[])[i]);
    const nonNull = sampleValues.filter(v => v != null);
    if (nonNull.length === 0) return 'categorical';

    if (isDateColumn(col, nonNull)) return 'date';

    const numericCount = nonNull.filter(isNumericValue).length;
    if (numericCount / nonNull.length >= 0.8) return 'numeric';

    return 'categorical';
  });

  const numericCols = columns.filter((_, i) => colTypes[i] === 'numeric');
  const dateCols = columns.filter((_, i) => colTypes[i] === 'date');
  const catCols = columns.filter((_, i) => colTypes[i] === 'categorical');

  // 1 row, 1 numeric column -> KPI card
  if (rowCount === 1 && numericCols.length === 1 && columns.length <= 2) {
    return 'KPI_CARD';
  }

  // 1 date column + 1+ numeric columns -> line chart
  if (dateCols.length === 1 && numericCols.length >= 1 && rowCount >= 2) {
    return 'LINE_CHART';
  }

  // 1 categorical column + 1+ numeric columns, <=20 rows -> bar chart
  if (catCols.length === 1 && numericCols.length >= 1 && rowCount >= 2 && rowCount <= 20) {
    // <=8 categories with a single numeric column that looks like parts-of-whole -> pie chart
    if (rowCount <= 8 && numericCols.length === 1) {
      // Check if values sum to a plausible total (heuristic for parts-of-whole)
      const numIdx = columns.indexOf(numericCols[0]);
      const values = rows.map(r => Number((r as unknown[])[numIdx]) || 0);
      const allPositive = values.every(v => v >= 0);
      if (allPositive && rowCount <= 6) {
        return 'PIE_CHART';
      }
    }
    return 'BAR_CHART';
  }

  // 2 numeric columns + optional grouping -> scatter
  if (numericCols.length === 2 && catCols.length <= 1 && dateCols.length === 0 && rowCount >= 5) {
    return 'SCATTER';
  }

  // If the LLM suggested something specific (not TABLE), and we have no strong
  // shape-based opinion, respect the hint
  if (result.suggestedVisualization && result.suggestedVisualization !== 'TABLE') {
    return result.suggestedVisualization as ArtifactType;
  }

  return 'TABLE';
}


// Extract the leaf table name (last `.`-separated segment) from a SQL string.
// Handles both backtick-quoted refs (`project.dataset.table`) and unquoted names.
function extractTableFromSql(sql: string): string | null {
  const normalized = sql.replace(/\s+/g, ' ').trim();
  // Match FROM or JOIN followed by an optional backtick-quoted identifier or bare word
  const match = normalized.match(/\bFROM\s+`?([A-Za-z0-9_.]+)`?/i);
  if (!match) return null;
  const ref = match[1];
  // Return only the final segment (table name, not project/dataset prefix)
  return ref.split('.').pop() ?? null;
}

// Extract the project ID from a fully qualified backtick-quoted table reference in SQL.
// Handles `project.dataset.table` patterns.
function extractProjectFromSql(sql: string): string | undefined {
  const match = sql.match(/`([A-Za-z0-9_-]+)\.[A-Za-z0-9_]+\.[A-Za-z0-9_]+`/);
  return match?.[1] ?? undefined;
}

// Extract the full 3-part table reference (project.dataset.table) from SQL.
function extractFullTableRef(sql: string): string | null {
  const match = sql.match(/`([A-Za-z0-9_-]+\.[A-Za-z0-9_]+\.[A-Za-z0-9_]+)`/);
  return match?.[1] ?? null;
}

function buildQueryHeadline(
  rowCount: number,
  sql: string,
  columns?: string[],
  rows?: unknown[][],
): string {
  if (!rowCount || rowCount === 0) {
    const upper = sql.toUpperCase();
    if (upper.includes('INFORMATION_SCHEMA')) {
      const project = extractProjectFromSql(sql);
      return project
        ? `No metadata returned -- check region and permissions for \`${project}\``
        : 'No metadata returned -- check region and permissions';
    }
    if (/\bWHERE\b/i.test(sql)) {
      return 'No rows matched your filter criteria';
    }
    return 'Query returned no results -- the table may be empty or filters too restrictive';
  }

  const table = extractTableFromSql(sql);

  // KPI-style: 1 row with 1-2 columns -- surface the value prominently
  if (rowCount === 1 && columns && rows && rows.length > 0 && columns.length <= 2) {
    const val = rows[0]?.[columns.length - 1]; // prefer the last (usually the metric)
    const colName = humanizeColumnName(columns[columns.length - 1] ?? '');
    if (val !== null && val !== undefined) {
      const formatted = typeof val === 'number' || (typeof val === 'string' && /^\d+(\.\d+)?$/.test(val))
        ? Number(val).toLocaleString()
        : String(val);
      return `${colName}: ${formatted}`;
    }
  }

  // Multi-row: try to describe what the data represents
  if (columns && columns.length >= 2) {
    const catCols = columns.filter((c, i) => {
      if (!rows || rows.length === 0) return false;
      const v = rows[0]?.[i];
      return typeof v === 'string' && !/^\d+(\.\d+)?$/.test(v);
    });
    const numCols = columns.filter((c, i) => {
      if (!rows || rows.length === 0) return false;
      const v = rows[0]?.[i];
      return typeof v === 'number' || (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v));
    });

    if (catCols.length > 0 && numCols.length > 0) {
      const catLabel = humanizeColumnName(catCols[0]);
      const numLabel = humanizeColumnName(numCols[0]);
      const count = rowCount.toLocaleString();
      if (rowCount <= 20) {
        return `${count} ${catLabel.toLowerCase()}s by ${numLabel.toLowerCase()}`;
      }
      return `${count} rows: ${catLabel} by ${numLabel}`;
    }
  }

  // Fallback with table name
  const count = rowCount.toLocaleString();
  const rowWord = rowCount === 1 ? 'row' : 'rows';
  if (table) {
    return `${count} ${rowWord} from \`${table}\``;
  }
  return `${count} ${rowWord} returned`;
}

/**
 * Convert a SQL column name like "order_count" or "totalRevenue" into
 * a human-readable label like "Order count" or "Total revenue".
 */
function humanizeColumnName(col: string): string {
  // Replace underscores and split camelCase
  let label = col.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
  // Capitalize first letter
  label = label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
  return label;
}

// ─── Data Quality composition ─────────────────────────────────────────────────

function composeDataQuality(result: DataQualityResult): CompositionEnvelope {
  const id = randomUUID();
  const { summary } = result;
  const tone: Tone = summary.issuesFound > 0 ? 'ATTENTION' : 'POSITIVE';
  let headlineText: string;
  if (summary.issuesFound === 0) {
    headlineText = `\`${result.table.split('.').pop()}\` looks clean -- no issues found`;
  } else {
    const highNullCols = result.findings.filter(f => f.metric === 'null_rate' && Number(f.value) > 0.5);
    const warningNullCols = result.findings.filter(f => f.metric === 'null_rate' && Number(f.value) > 0.1 && Number(f.value) <= 0.5);
    const dupeFindings = result.findings.filter(f => f.metric === 'duplicate_groups' && Number(f.value) > 0);

    const parts: string[] = [];
    if (highNullCols.length > 0) {
      parts.push(`${highNullCols.length} column${highNullCols.length !== 1 ? 's' : ''} with >50% nulls`);
    }
    if (warningNullCols.length > 0) {
      parts.push(`${warningNullCols.length} column${warningNullCols.length !== 1 ? 's' : ''} with >10% nulls`);
    }
    if (dupeFindings.length > 0) {
      const dupeCount = Number(dupeFindings[0].value);
      parts.push(`${dupeCount.toLocaleString()} duplicate group${dupeCount !== 1 ? 's' : ''}`);
    }

    if (parts.length > 0) {
      headlineText = `\`${result.table.split('.').pop()}\`: ${parts.join(', ')}`;
    } else {
      headlineText = `${summary.issuesFound} issue${summary.issuesFound !== 1 ? 's' : ''} found in \`${result.table.split('.').pop()}\``;
    }
  }

  // Strip surrounding backticks from table reference for clean chip labels/SQL
  const cleanTable = result.table.replace(/`/g, '');
  const nextActions: HandoffEnvelope[] = [];
  const dupeFinding = result.findings.find((f) => f.metric === 'duplicate_groups' && Number(f.value) > 0);
  const highNullFindings = result.findings.filter((f) => f.metric === 'null_rate' && Number(f.value) > 0.1);
  if (dupeFinding) {
    nextActions.push({
      targetSkill: 'data-management',
      label: 'Remove duplicates',
      context: {
        table: cleanTable,
        operationHint: 'DEDUPE',
        keyColumn: dupeFinding.column,
        duplicateCount: dupeFinding.value,
      },
      sourceSkill: 'data-quality',
      sourceResultRef: id,
    });
  }
  if (highNullFindings.length > 0) {
    const nullCols = highNullFindings.map(f => f.column).join(', ');
    nextActions.push({
      targetSkill: 'data-management',
      label: 'Fix nulls',
      context: {
        table: cleanTable,
        operationHint: 'UPDATE',
        nullColumns: nullCols,
      },
      sourceSkill: 'data-quality',
      sourceResultRef: id,
    });
  }
  const shortTable = cleanTable.split('.').pop() || cleanTable;
  // Always offer to query the table
  nextActions.push({
    targetSkill: 'query',
    label: `Sample ${shortTable}`,
    context: { table: cleanTable, sql: `SELECT * FROM \`${cleanTable}\` LIMIT 20` },
    sourceSkill: 'data-quality',
    sourceResultRef: id,
  });
  // Always offer to view the schema
  nextActions.push({
    targetSkill: 'schema',
    label: 'View schema',
    context: { table: cleanTable },
    sourceSkill: 'data-quality',
    sourceResultRef: id,
  });
  // Save this check
  if (nextActions.length < 4) {
    nextActions.push({
      targetSkill: 'data-loading',
      label: 'Save this check',
      context: { sql: result.sql, table: result.table, saveAction: 'check', checkType: result.checkType },
      sourceSkill: 'data-quality',
      sourceResultRef: id,
    });
  }

  return {
    id,
    skill: 'data-quality',
    headline: { text: headlineText, tone, basis: 'STATUS' },
    primaryArtifact: { type: 'DATA_QUALITY_VIEW', data: result },
    provenance: result.sql ? { visibility: 'COLLAPSED', sql: result.sql } : { visibility: 'COLLAPSED' },
    nextActions,
  };
}

// ─── Data Loading composition ─────────────────────────────────────────────────

function composeDataLoading(result: DataLoadingResult): CompositionEnvelope {
  const id = randomUUID();
  let headlineText = result.message;
  // Successful operations get POSITIVE, informational responses get NEUTRAL
  const isSuccess = ['EXPORT_CSV', 'EXPORT_SHEETS', 'SCHEDULE_CREATED', 'QUERY_SAVED', 'SHARE_CLIPBOARD'].includes(result.operationType);
  const tone: Tone = isSuccess ? 'POSITIVE' : 'NEUTRAL';

  if (result.operationType === 'EXPORT_CSV' && result.rowCount !== undefined) {
    headlineText = `${result.rowCount.toLocaleString()} rows${result.columnCount ? ` across ${result.columnCount} columns` : ''} ready to download`;
  } else if (result.operationType === 'EXPORT_SHEETS' && result.sheetsUrl) {
    headlineText = `Exported ${result.rowCount?.toLocaleString() ?? ''} rows to Google Sheets`;
  } else if (result.operationType === 'SCHEDULE_CREATED') {
    headlineText = `Scheduled query created: ${result.scheduleFrequency || 'recurring'}`;
  } else if (result.operationType === 'QUERY_SAVED') {
    headlineText = `Query saved: "${result.savedQueryLabel || 'Saved Query'}"`;
  } else if (result.operationType === 'SHARE_CLIPBOARD') {
    headlineText = `Results ready to share (${result.rowCount?.toLocaleString() ?? ''} rows)`;
  } else if (result.operationType === 'SCHEDULE_INFO') {
    headlineText = 'Scheduling information';
  }

  return {
    id,
    skill: 'data-loading',
    headline: { text: headlineText, tone, basis: 'STATUS' },
    primaryArtifact: { type: 'DATA_LOADING_VIEW', data: result },
    provenance: { visibility: 'COLLAPSED' },
    nextActions: [
      {
        targetSkill: 'query',
        label: 'Run another query',
        context: {},
        sourceSkill: 'data-loading',
        sourceResultRef: id,
      },
      {
        targetSkill: 'monitoring',
        label: 'View job history',
        context: { monitoringHint: 'JOB_LIST' },
        sourceSkill: 'data-loading',
        sourceResultRef: id,
      },
    ],
  };
}

// --- Pipeline composition ----------------------------------------------------

function composePipeline(result: PipelineResult): CompositionEnvelope {
  const id = randomUUID();
  let headlineText = '';
  let tone: Tone = 'NEUTRAL';
  const basis: HeadlineBasis = 'STATUS';
  const nextActions: HandoffEnvelope[] = [];

  switch (result.pipelineType) {
    case 'LIST_SCHEDULES': {
      const count = result.schedules?.length ?? 0;
      if (count === 0) {
        headlineText = 'No scheduled queries found in this project';
        tone = 'ATTENTION';
      } else {
        const activeCount = result.schedules?.filter(s => (s.state || '').toUpperCase() === 'ACTIVE').length ?? 0;
        const failedCount = result.schedules?.filter(s =>
          ['FAILED', 'ERROR'].includes((s.state || '').toUpperCase()) ||
          (s.lastRunStatus || '').toUpperCase() === 'FAILED'
        ).length ?? 0;
        const parts: string[] = [`${count} scheduled quer${count !== 1 ? 'ies' : 'y'}`];
        if (activeCount > 0) parts.push(`${activeCount} active`);
        if (failedCount > 0) {
          parts.push(`${failedCount} with recent failures`);
          tone = 'ATTENTION';
        }
        headlineText = parts.join(' -- ');
      }
      nextActions.push({
        targetSkill: 'pipeline',
        label: 'Create new pipeline',
        context: { pipelineType: 'CREATE_PIPELINE' },
        sourceSkill: 'pipeline',
        sourceResultRef: id,
      });
      break;
    }

    case 'SCHEDULE_DETAILS': {
      const sched = result.schedules?.[0];
      if (sched) {
        headlineText = `"${sched.displayName}" runs ${sched.schedule}`;
        const runCount = result.runs?.length ?? 0;
        if (runCount > 0) {
          const failedRuns = result.runs?.filter(r => r.state === 'FAILED').length ?? 0;
          headlineText += ` -- ${runCount} recent run${runCount !== 1 ? 's' : ''}`;
          if (failedRuns > 0) {
            headlineText += `, ${failedRuns} failed`;
            tone = 'ATTENTION';
          }
        }
      } else {
        headlineText = 'Schedule not found';
        tone = 'ATTENTION';
      }
      nextActions.push({
        targetSkill: 'pipeline',
        label: 'All schedules',
        context: { pipelineType: 'LIST_SCHEDULES' },
        sourceSkill: 'pipeline',
        sourceResultRef: id,
      });
      break;
    }

    case 'CREATE_PIPELINE': {
      headlineText = 'Pipeline ready for review';
      if (result.confirmation?.estimatedCostPerRun) {
        headlineText += ` -- ${result.confirmation.estimatedCostPerRun}`;
      }
      break;
    }

    case 'UPDATE_SCHEDULE': {
      const action = result.confirmation?.action || '';
      if (action === 'UPDATED') {
        headlineText = `Schedule updated: ${result.schedules?.[0]?.displayName || 'schedule'}`;
        tone = 'POSITIVE';
      } else if (action === 'NOT_FOUND') {
        headlineText = 'Schedule not found';
        tone = 'ATTENTION';
      } else if (action === 'ERROR') {
        headlineText = 'Failed to update schedule';
        tone = 'ATTENTION';
      } else {
        headlineText = result.confirmation?.sql || 'Update result';
      }
      nextActions.push({
        targetSkill: 'pipeline',
        label: 'All schedules',
        context: { pipelineType: 'LIST_SCHEDULES' },
        sourceSkill: 'pipeline',
        sourceResultRef: id,
      });
      break;
    }

    case 'DELETE_SCHEDULE': {
      const action = result.confirmation?.action || '';
      if (action === 'DELETED') {
        headlineText = 'Schedule deleted';
        tone = 'POSITIVE';
      } else if (action === 'NOT_FOUND') {
        headlineText = 'Schedule not found';
        tone = 'ATTENTION';
      } else {
        headlineText = 'Failed to delete schedule';
        tone = 'ATTENTION';
      }
      nextActions.push({
        targetSkill: 'pipeline',
        label: 'All schedules',
        context: { pipelineType: 'LIST_SCHEDULES' },
        sourceSkill: 'pipeline',
        sourceResultRef: id,
      });
      break;
    }

    case 'RUN_HISTORY': {
      const runs = result.runs || [];
      if (runs.length === 0) {
        headlineText = 'No run history found';
        tone = 'ATTENTION';
      } else {
        const successCount = runs.filter(r => r.state === 'SUCCEEDED').length;
        const failedCount = runs.filter(r => r.state === 'FAILED').length;
        headlineText = `${runs.length} run${runs.length !== 1 ? 's' : ''}: ${successCount} succeeded`;
        if (failedCount > 0) {
          headlineText += `, ${failedCount} failed`;
          tone = 'ATTENTION';
        }
      }
      nextActions.push({
        targetSkill: 'pipeline',
        label: 'All schedules',
        context: { pipelineType: 'LIST_SCHEDULES' },
        sourceSkill: 'pipeline',
        sourceResultRef: id,
      });
      break;
    }

    default:
      headlineText = 'Pipeline operation completed';
  }

  return {
    id,
    skill: 'pipeline',
    headline: { text: headlineText, tone, basis },
    primaryArtifact: { type: 'PIPELINE_VIEW', data: result },
    provenance: {
      visibility: 'COLLAPSED',
      sql: result.confirmation?.sql || result.schedules?.[0]?.sql || undefined,
    },
    nextActions,
  };
}

