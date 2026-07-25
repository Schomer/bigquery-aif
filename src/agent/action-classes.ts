// src/agent/action-classes.ts
// Action-class taxonomy for confirmation gating.
// Built in Phase 0 (spec section 3.3) even though writes arrive in Phase 1,
// because gates-as-data is cheap now and avoids a rewrite later.

// ── Types ─────────────────────────────────────────────────────────────────────

export type ActionTier = 'read' | 'reversible' | 'destructive';

export interface ActionClass {
  /** Unique identifier, e.g. 'dml.delete', 'iam.grant', 'dataset.create' */
  id: string;
  /** The confirmation tier */
  tier: ActionTier;
  /** Matching rules */
  match: {
    /** SQL statement prefixes that match this class */
    sql_statement?: string[];
    /** HTTP method + URL pattern for REST API calls (Phase 1) */
    http?: {
      method: string;
      url_pattern: RegExp;
    };
  };
}

// ── Action class registry ─────────────────────────────────────────────────────

const ACTION_CLASSES: ActionClass[] = [
  // Destructive (require confirmation)
  {
    id: 'dml.delete',
    tier: 'destructive',
    match: { sql_statement: ['DELETE'] },
  },
  {
    id: 'dml.truncate',
    tier: 'destructive',
    match: { sql_statement: ['TRUNCATE'] },
  },
  {
    id: 'ddl.drop_table',
    tier: 'destructive',
    match: { sql_statement: ['DROP TABLE', 'DROP VIEW'] },
  },
  {
    id: 'ddl.drop_schema',
    tier: 'destructive',
    match: { sql_statement: ['DROP SCHEMA', 'DROP DATASET'] },
  },
  {
    id: 'iam.revoke',
    tier: 'destructive',
    match: {
      http: { method: 'DELETE', url_pattern: /\/iam\/v\d+\// },
    },
  },

  // Reversible (execute without confirmation)
  {
    id: 'dml.insert',
    tier: 'reversible',
    match: { sql_statement: ['INSERT'] },
  },
  {
    id: 'dml.update',
    tier: 'reversible',
    match: { sql_statement: ['UPDATE'] },
  },
  {
    id: 'dml.merge',
    tier: 'reversible',
    match: { sql_statement: ['MERGE'] },
  },
  {
    id: 'ddl.create_table',
    tier: 'reversible',
    match: { sql_statement: ['CREATE TABLE', 'CREATE OR REPLACE TABLE', 'CREATE VIEW', 'CREATE OR REPLACE VIEW', 'CREATE MATERIALIZED VIEW'] },
  },
  {
    id: 'ddl.alter',
    tier: 'reversible',
    match: { sql_statement: ['ALTER TABLE', 'ALTER VIEW', 'ALTER SCHEMA'] },
  },
  {
    id: 'dataset.create',
    tier: 'reversible',
    match: { sql_statement: ['CREATE SCHEMA', 'CREATE DATASET'] },
  },
  {
    id: 'iam.grant',
    tier: 'reversible',
    match: {
      http: { method: 'POST', url_pattern: /\/iam\/v\d+\/.*:setIamPolicy/ },
    },
  },
  {
    id: 'transfer.create',
    tier: 'reversible',
    match: {
      http: { method: 'POST', url_pattern: /\/bigquerydatatransfer\/v\d+\// },
    },
  },
  {
    id: 'transfer.update',
    tier: 'reversible',
    match: {
      http: { method: 'PATCH', url_pattern: /\/bigquerydatatransfer\/v\d+\// },
    },
  },

  // Read (never gated)
  {
    id: 'query.select',
    tier: 'read',
    match: { sql_statement: ['SELECT', 'WITH'] },
  },
];

// ── Classification functions ──────────────────────────────────────────────────

/**
 * Classify a SQL statement into an action class.
 * Returns the most specific matching class, or a default 'read' class.
 */
export function classifySql(sql: string): ActionClass {
  const trimmed = sql.trimStart().toUpperCase();

  for (const ac of ACTION_CLASSES) {
    if (!ac.match.sql_statement) continue;
    for (const prefix of ac.match.sql_statement) {
      if (trimmed.startsWith(prefix)) {
        return ac;
      }
    }
  }

  // Default: treat as read
  return { id: 'unknown.read', tier: 'read', match: {} };
}

/**
 * Classify an HTTP API call into an action class.
 * Returns the most specific matching class, or a default based on method.
 */
export function classifyHttp(method: string, url: string): ActionClass {
  const upperMethod = method.toUpperCase();

  for (const ac of ACTION_CLASSES) {
    if (!ac.match.http) continue;
    if (ac.match.http.method === upperMethod && ac.match.http.url_pattern.test(url)) {
      return ac;
    }
  }

  // Default by HTTP method
  if (upperMethod === 'DELETE') {
    return { id: 'http.delete', tier: 'destructive', match: {} };
  }
  if (upperMethod === 'GET' || upperMethod === 'HEAD') {
    return { id: 'http.read', tier: 'read', match: {} };
  }
  return { id: 'http.write', tier: 'reversible', match: {} };
}

/**
 * Check if a SQL statement requires user confirmation before execution.
 */
export function requiresConfirmation(sql: string): boolean {
  return classifySql(sql).tier === 'destructive';
}

/**
 * Get a human-readable description of what the action does.
 */
export function describeAction(actionClass: ActionClass): string {
  const DESCRIPTIONS: Record<string, string> = {
    'dml.delete': 'Delete rows from a table',
    'dml.truncate': 'Remove all rows from a table',
    'ddl.drop_table': 'Drop a table or view permanently',
    'ddl.drop_schema': 'Drop a dataset and all its contents',
    'iam.revoke': 'Revoke access permissions',
    'dml.insert': 'Insert rows into a table',
    'dml.update': 'Update existing rows',
    'dml.merge': 'Merge data into a table',
    'ddl.create_table': 'Create a new table or view',
    'ddl.alter': 'Modify table or view structure',
    'dataset.create': 'Create a new dataset',
    'iam.grant': 'Grant access permissions',
    'transfer.create': 'Create a data transfer configuration',
    'transfer.update': 'Update a data transfer configuration',
    'query.select': 'Read data (no changes)',
  };
  return DESCRIPTIONS[actionClass.id] ?? `Unknown operation (${actionClass.id})`;
}
