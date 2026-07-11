// src/lib/skills/handle-governance.ts
// Governance skill handler: access audit, table security, sensitive data scan, data classification.
// All operations are read-only -- no permission changes, no DML.

import { callGemini } from '../gemini-client';
import { getAvailableDatasets, resolveDefaultDatasetFromList, extractDatasetFromMessage } from '../orchestrator-utils';
import { executeQuery } from '../bigquery-client';
import { compose } from '../composer';
import type { ChatMessage, CompositionEnvelope, GovernanceResult, SkillManifest, StatusCallback } from '../types';

// -- Gemini schema for governance intent classification --

const GovernanceIntentSchema = {
  type: 'OBJECT',
  properties: {
    governanceType: { type: 'STRING', enum: ['ACCESS_AUDIT', 'TABLE_SECURITY', 'SENSITIVE_DATA_SCAN', 'DATA_CLASSIFICATION'] },
    table: { type: 'STRING' },
    dataset: { type: 'STRING' },
  },
  required: ['governanceType'],
};

export async function handleGovernance(
  message: string,
  _history: ChatMessage[],
  context?: { project?: string; dataset?: string; lastTable?: string; resolvedDataset?: string; availableDatasets?: string[]; handoffContext?: Record<string, unknown> },
  onStatus?: StatusCallback,
): Promise<CompositionEnvelope[]> {
  const project = context?.project || '';
  const hc = context?.handoffContext;

  // Resolve dataset
  const available = context?.availableDatasets ?? await getAvailableDatasets(project);
  let dataset = context?.resolvedDataset ?? resolveDefaultDatasetFromList(available, context?.dataset, project);
  if (!dataset) {
    dataset = extractDatasetFromMessage(message, available) ?? '';
  }

  // Classify governance sub-type
  let intent: { governanceType: string; table?: string; dataset?: string };
  if (hc?.governanceType && typeof hc.governanceType === 'string') {
    intent = {
      governanceType: hc.governanceType as string,
      table: (hc.table as string) ?? undefined,
      dataset: (hc.dataset as string) ?? undefined,
    };
    onStatus?.(`Running ${intent.governanceType} (from handoff)...`);
  } else {
    onStatus?.('Classifying governance request...');
    intent = await callGemini({
      systemInstruction: `You classify BigQuery governance and security requests. Extract the governance type and table/dataset name.
Available governance types:
- ACCESS_AUDIT: Who has access to a dataset or table (permissions, roles, grants)
- TABLE_SECURITY: Row-level security policies, column-level masking, policy tags on a table
- SENSITIVE_DATA_SCAN: Scan table columns for potential PII patterns (emails, phones, SSNs, IPs, credit cards)
- DATA_CLASSIFICATION: Check documentation coverage -- which tables/columns have descriptions and labels

The active project is ${project}, default dataset is ${dataset}, available datasets are: ${available.join(', ')}.`,
      prompt: message,
      schema: GovernanceIntentSchema,
      project,
    });
  }

  const tableName = intent.table ?? context?.lastTable ?? null;
  let ds = intent.dataset ?? dataset;
  if (ds && ds.toLowerCase() === project.toLowerCase()) {
    ds = dataset;
  }

  switch (intent.governanceType) {
    case 'ACCESS_AUDIT':
      return handleAccessAudit(project, ds, tableName, onStatus);
    case 'TABLE_SECURITY':
      return handleTableSecurity(project, ds, tableName, onStatus);
    case 'SENSITIVE_DATA_SCAN':
      return handleSensitiveDataScan(project, ds, tableName, onStatus);
    case 'DATA_CLASSIFICATION':
      return handleDataClassification(project, ds, tableName, onStatus);
    default:
      return handleAccessAudit(project, ds, tableName, onStatus);
  }
}

// -- ACCESS_AUDIT sub-handler --

async function handleAccessAudit(
  project: string,
  dataset: string,
  table: string | null,
  onStatus?: StatusCallback,
): Promise<CompositionEnvelope[]> {
  if (!dataset) {
    return [compose('governance', {
      skill: 'governance',
      governanceType: 'ACCESS_AUDIT',
      scope: project,
      accessEntries: [],
      sql: '',
    } as GovernanceResult)];
  }

  onStatus?.(`Querying access privileges for ${dataset}...`);

  const sql = `SELECT
  grantee AS entity,
  privilege_type AS role,
  table_schema,
  table_name
FROM \`${project}.${dataset}\`.INFORMATION_SCHEMA.OBJECT_PRIVILEGES
${table ? `WHERE table_name = '${table}'` : ''}
ORDER BY grantee, privilege_type`;

  try {
    const response = await executeQuery(sql, project);
    const rows = response.rows || [];

    const accessEntries = rows.map((row: unknown[]) => {
      const entity = String(row[0] ?? '');
      let entityType: 'user' | 'group' | 'serviceAccount' | 'domain' | 'allUsers' = 'user';
      if (entity === 'allUsers' || entity === 'allAuthenticatedUsers') entityType = 'allUsers';
      else if (entity.includes('gserviceaccount.com')) entityType = 'serviceAccount';
      else if (entity.startsWith('group:') || entity.includes('@googlegroups.com')) entityType = 'group';
      else if (entity.includes('domain:')) entityType = 'domain';

      return {
        entity: entity.replace(/^(user:|group:|serviceAccount:|domain:)/, ''),
        entityType,
        role: String(row[1] ?? ''),
        grantedBy: undefined,
      };
    });

    const scope = table ? `\`${project}.${dataset}.${table}\`` : `\`${project}.${dataset}\``;
    const result: GovernanceResult = {
      skill: 'governance',
      governanceType: 'ACCESS_AUDIT',
      scope,
      accessEntries,
      sql,
    };
    return [compose('governance', result)];
  } catch (err: any) {
    // OBJECT_PRIVILEGES may not be available -- return empty
    const scope = table ? `\`${project}.${dataset}.${table}\`` : `\`${project}.${dataset}\``;
    const result: GovernanceResult = {
      skill: 'governance',
      governanceType: 'ACCESS_AUDIT',
      scope,
      accessEntries: [],
      sql,
    };
    return [compose('governance', result)];
  }
}

// -- TABLE_SECURITY sub-handler --

async function handleTableSecurity(
  project: string,
  dataset: string,
  table: string | null,
  onStatus?: StatusCallback,
): Promise<CompositionEnvelope[]> {
  if (!dataset) {
    return [compose('governance', {
      skill: 'governance',
      governanceType: 'TABLE_SECURITY',
      scope: project,
      securityPolicies: { rowLevelPolicies: 0, columnLevelMasking: 0, policyTags: [] },
    } as GovernanceResult)];
  }

  onStatus?.('Checking security policies...');

  let rowLevelPolicies = 0;
  let columnLevelMasking = 0;
  const policyTags: string[] = [];
  const sqlParts: string[] = [];

  // 1. Row access policies
  try {
    const rapSql = `SELECT COUNT(*) AS cnt
FROM \`${project}.${dataset}\`.INFORMATION_SCHEMA.ROW_ACCESS_POLICIES
${table ? `WHERE table_name = '${table}'` : ''}`;
    sqlParts.push(rapSql);
    const rapResult = await executeQuery(rapSql, project);
    if (rapResult.rows?.[0]) {
      rowLevelPolicies = Number(rapResult.rows[0][0]) || 0;
    }
  } catch {
    // ROW_ACCESS_POLICIES may not exist
  }

  // 2. Column field paths with policy tags
  try {
    const cfpSql = `SELECT column_name, data_type
FROM \`${project}.${dataset}\`.INFORMATION_SCHEMA.COLUMN_FIELD_PATHS
WHERE policy_tags IS NOT NULL
${table ? `AND table_name = '${table}'` : ''}`;
    sqlParts.push(cfpSql);
    const cfpResult = await executeQuery(cfpSql, project);
    columnLevelMasking = cfpResult.rows?.length || 0;
    for (const row of (cfpResult.rows || [])) {
      policyTags.push(String(row[0]));
    }
  } catch {
    // COLUMN_FIELD_PATHS may not support policy_tags filter
  }

  const scope = table ? `\`${project}.${dataset}.${table}\`` : `\`${project}.${dataset}\``;
  const result: GovernanceResult = {
    skill: 'governance',
    governanceType: 'TABLE_SECURITY',
    scope,
    securityPolicies: { rowLevelPolicies, columnLevelMasking, policyTags },
    sql: sqlParts.join('\n\n'),
  };
  return [compose('governance', result)];
}

// -- SENSITIVE_DATA_SCAN sub-handler --

async function handleSensitiveDataScan(
  project: string,
  dataset: string,
  table: string | null,
  onStatus?: StatusCallback,
): Promise<CompositionEnvelope[]> {
  if (!table || !dataset) {
    return [compose('governance', {
      skill: 'governance',
      governanceType: 'SENSITIVE_DATA_SCAN',
      scope: dataset ? `\`${project}.${dataset}\`` : project,
      sensitiveFindings: [],
    } as GovernanceResult)];
  }

  onStatus?.(`Scanning \`${table}\` for potential sensitive data patterns...`);

  // First, get STRING columns from INFORMATION_SCHEMA.COLUMNS
  const colSql = `SELECT column_name
FROM \`${project}.${dataset}\`.INFORMATION_SCHEMA.COLUMNS
WHERE table_name = '${table}'
AND data_type IN ('STRING', 'BYTES')
ORDER BY ordinal_position`;

  let stringColumns: string[] = [];
  try {
    const colResult = await executeQuery(colSql, project);
    stringColumns = (colResult.rows || []).map((r: unknown[]) => String(r[0]));
  } catch {
    // Fallback if we can't get columns
  }

  if (stringColumns.length === 0) {
    const scope = `\`${project}.${dataset}.${table}\``;
    const result: GovernanceResult = {
      skill: 'governance',
      governanceType: 'SENSITIVE_DATA_SCAN',
      scope,
      sensitiveFindings: [],
      sql: colSql,
    };
    return [compose('governance', result)];
  }

  // Build heuristic PII detection query scanning up to 1000 rows
  const checks = stringColumns.slice(0, 20).map((col) => {
    const c = `\`${col}\``;
    return `
  STRUCT(
    '${col}' AS column_name,
    COUNTIF(REGEXP_CONTAINS(CAST(${c} AS STRING), r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}')) AS email_count,
    COUNTIF(REGEXP_CONTAINS(CAST(${c} AS STRING), r'\\b\\d{10,11}\\b')) AS phone_count,
    COUNTIF(REGEXP_CONTAINS(CAST(${c} AS STRING), r'\\b\\d{3}-\\d{2}-\\d{4}\\b')) AS ssn_count,
    COUNTIF(REGEXP_CONTAINS(CAST(${c} AS STRING), r'\\b\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\b')) AS ip_count,
    COUNTIF(REGEXP_CONTAINS(CAST(${c} AS STRING), r'\\b\\d{13,16}\\b')) AS cc_count
  )`;
  });

  const scanSql = `WITH sample AS (
  SELECT * FROM \`${project}.${dataset}.${table}\` LIMIT 1000
)
SELECT
  col.column_name,
  col.email_count,
  col.phone_count,
  col.ssn_count,
  col.ip_count,
  col.cc_count
FROM sample,
UNNEST([${checks.join(',\n')}]) AS col
WHERE col.email_count > 0
  OR col.phone_count > 0
  OR col.ssn_count > 0
  OR col.ip_count > 0
  OR col.cc_count > 0`;

  interface SensitiveFinding {
    column: string;
    pattern: string;
    sampleCount: number;
    confidence: 'low' | 'medium' | 'high';
  }

  const findings: SensitiveFinding[] = [];
  try {
    const scanResult = await executeQuery(scanSql, project);
    for (const row of (scanResult.rows || [])) {
      const colName = String(row[0]);
      const emailCount = Number(row[1]) || 0;
      const phoneCount = Number(row[2]) || 0;
      const ssnCount = Number(row[3]) || 0;
      const ipCount = Number(row[4]) || 0;
      const ccCount = Number(row[5]) || 0;

      if (emailCount > 0) {
        findings.push({ column: colName, pattern: 'Email address', sampleCount: emailCount, confidence: emailCount > 10 ? 'high' : emailCount > 2 ? 'medium' : 'low' });
      }
      if (phoneCount > 0) {
        findings.push({ column: colName, pattern: 'Phone number', sampleCount: phoneCount, confidence: phoneCount > 10 ? 'medium' : 'low' });
      }
      if (ssnCount > 0) {
        findings.push({ column: colName, pattern: 'SSN (NNN-NN-NNNN)', sampleCount: ssnCount, confidence: ssnCount > 5 ? 'high' : 'medium' });
      }
      if (ipCount > 0) {
        findings.push({ column: colName, pattern: 'IP address', sampleCount: ipCount, confidence: ipCount > 10 ? 'medium' : 'low' });
      }
      if (ccCount > 0) {
        findings.push({ column: colName, pattern: 'Credit card number', sampleCount: ccCount, confidence: ccCount > 5 ? 'high' : 'medium' });
      }
    }
  } catch {
    // Query may fail if table is too large or access denied
  }

  const scope = `\`${project}.${dataset}.${table}\``;
  const result: GovernanceResult = {
    skill: 'governance',
    governanceType: 'SENSITIVE_DATA_SCAN',
    scope,
    sensitiveFindings: findings,
    sql: scanSql,
  };
  return [compose('governance', result)];
}

// -- DATA_CLASSIFICATION sub-handler --

async function handleDataClassification(
  project: string,
  dataset: string,
  table: string | null,
  onStatus?: StatusCallback,
): Promise<CompositionEnvelope[]> {
  if (!dataset) {
    return [compose('governance', {
      skill: 'governance',
      governanceType: 'DATA_CLASSIFICATION',
      scope: project,
      classification: { documentedTables: 0, undocumentedTables: 0, documentedColumns: 0, undocumentedColumns: 0, labels: {} },
    } as GovernanceResult)];
  }

  onStatus?.(`Checking documentation coverage for ${dataset}...`);

  // Query tables with description and labels
  const tablesSql = `SELECT
  table_name,
  IFNULL(option_value, '') AS description
FROM \`${project}.${dataset}\`.INFORMATION_SCHEMA.TABLE_OPTIONS
WHERE option_name = 'description'
${table ? `AND table_name = '${table}'` : ''}`;

  const columnsSql = `SELECT
  table_name,
  column_name,
  description
FROM \`${project}.${dataset}\`.INFORMATION_SCHEMA.COLUMNS
${table ? `WHERE table_name = '${table}'` : ''}
ORDER BY table_name, ordinal_position`;

  // Labels query
  const labelsSql = `SELECT
  table_name,
  option_name,
  option_value
FROM \`${project}.${dataset}\`.INFORMATION_SCHEMA.TABLE_OPTIONS
WHERE option_name = 'labels'
${table ? `AND table_name = '${table}'` : ''}`;

  let documentedTables = 0;
  let undocumentedTables = 0;
  let documentedColumns = 0;
  let undocumentedColumns = 0;
  const labels: Record<string, string> = {};
  const allSql = [tablesSql, columnsSql, labelsSql].join('\n\n');

  try {
    // Get table descriptions
    const tableDescriptions = new Map<string, string>();
    try {
      const tablesResult = await executeQuery(tablesSql, project);
      for (const row of (tablesResult.rows || [])) {
        const tName = String(row[0]);
        const desc = String(row[1] ?? '').trim();
        tableDescriptions.set(tName, desc);
      }
    } catch {
      // TABLE_OPTIONS may not be accessible
    }

    // Get columns
    const tablesSeen = new Set<string>();
    try {
      const columnsResult = await executeQuery(columnsSql, project);
      for (const row of (columnsResult.rows || [])) {
        const tName = String(row[0]);
        const desc = String(row[2] ?? '').trim();
        tablesSeen.add(tName);
        if (desc) {
          documentedColumns++;
        } else {
          undocumentedColumns++;
        }
      }
    } catch {
      // COLUMNS should always be accessible
    }

    // Count table documentation
    for (const tName of tablesSeen) {
      const desc = tableDescriptions.get(tName) ?? '';
      if (desc.length > 0) {
        documentedTables++;
      } else {
        undocumentedTables++;
      }
    }

    // Get labels
    try {
      const labelsResult = await executeQuery(labelsSql, project);
      for (const row of (labelsResult.rows || [])) {
        const tName = String(row[0]);
        const val = String(row[2] ?? '');
        if (val) {
          labels[tName] = val;
        }
      }
    } catch {
      // Labels may not be set
    }
  } catch {
    // General fallback
  }

  const scope = table ? `\`${project}.${dataset}.${table}\`` : `\`${project}.${dataset}\``;
  const result: GovernanceResult = {
    skill: 'governance',
    governanceType: 'DATA_CLASSIFICATION',
    scope,
    classification: { documentedTables, undocumentedTables, documentedColumns, undocumentedColumns, labels },
    sql: allSql,
  };
  return [compose('governance', result)];
}

// ─── Skill manifest ───────────────────────────────────────────────────────────

export const manifest: SkillManifest = {
  skill: 'governance',
  label: 'governance check',
  signals: [
    { phrase: 'who has access', weight: 3 },
    { phrase: 'who can access', weight: 3 },
    { phrase: 'show permissions', weight: 3 },
    { phrase: 'access control', weight: 3 },
    { phrase: 'row-level security', weight: 3 },
    { phrase: 'column permissions', weight: 3 },
    { phrase: 'data masking', weight: 3 },
    { phrase: 'data classification', weight: 3 },
    { phrase: 'sensitive data', weight: 3 },
    { phrase: 'PII', weight: 3 },
    { phrase: 'policy tags', weight: 3 },
    { phrase: 'compliance', weight: 3 },
    { phrase: 'audit access', weight: 3 },
    { phrase: 'access audit', weight: 3 },
    { phrase: 'privacy', weight: 2 },
    { phrase: 'security posture', weight: 3 },
    { phrase: 'security', weight: 2 },
    { phrase: 'IAM', weight: 2 },
    { phrase: 'roles', weight: 2 },
    { phrase: 'grants', weight: 2 },
    { phrase: 'govern', weight: 2 },
    { phrase: 'policy', weight: 2 },
    { phrase: 'audit', weight: 2 },
  ],
  handle: handleGovernance,
};
