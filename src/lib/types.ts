// src/lib/types.ts
// Shared type definitions matching the normalized shapes in the skill docs

// ─── Skill names ─────────────────────────────────────────────────────────────

export type SkillName =
  | 'schema'
  | 'query'
  | 'data-management'
  | 'data-quality'
  | 'discovery'
  | 'monitoring'
  | 'data-loading'
  | 'pipeline'
  | 'multistep'
  | 'task'
  | 'governance'
  | 'saved';

// ─── Skill manifest (self-registering skill pattern) ─────────────────────────

/** Each skill handler exports a manifest that declares its routing signals and handler function. */
export interface SkillManifest {
  /** Unique skill identifier -- must match a SkillName value at runtime */
  skill: string;
  /** Human-readable label for status messages */
  label: string;
  /** Weighted routing signals for the keyword classifier */
  signals: Array<{ phrase: string; weight: number }>;
  /** The handler function (message, history, context, onStatus) */
  handle: (
    message: string,
    history: ChatMessage[],
    context: any,
    onStatus?: StatusCallback,
  ) => Promise<CompositionEnvelope[]>;
}

// ─── Handoff envelope (bigquery-shared-harness-policies.md §B) ───────────────

export interface HandoffEnvelope {
  targetSkill: SkillName;
  label: string; // user-facing chip text
  context: Record<string, unknown>;
  sourceSkill: SkillName | 'user';
  sourceResultRef?: string;
}

// ─── Cost tier (bigquery-shared-harness-policies.md §A) ──────────────────────

export type CostTier = 0 | 1 | 2 | 3 | 4;

export interface CostEstimate {
  totalBytesProcessed: number;
  tier: CostTier;
  requiresConfirmation: boolean; // tier >= 3
}

// ─── Saved Artifact types (parameter + type primitives) ──────────────────────

export type SavedArtifactType = 'query' | 'workflow' | 'pipeline' | 'app';

export interface ParameterDef {
  name: string;
  type: 'string' | 'number' | 'date' | 'table' | 'dataset' | 'column';
  default?: string;
  description: string;
  required: boolean;
}

// ─── Spaces (folder-like grouping for saved artifacts) ───────────────────────

export interface Space {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Composition envelope (bigquery-response-composition.md §2) ──────────────

export type Tone = 'NEUTRAL' | 'POSITIVE' | 'ATTENTION';
export type HeadlineBasis =
  | 'STATUS'
  | 'DEVIATION'
  | 'THRESHOLD'
  | 'COMPARISON'
  | 'DIRECT_ANSWER';

export type ArtifactType =
  | 'TABLE'
  // Recharts native
  | 'LINE_CHART' | 'BAR_CHART' | 'AREA_CHART' | 'SCATTER' | 'PIE_CHART'
  | 'DONUT_CHART' | 'COLUMN_CHART' | 'HISTOGRAM' | 'SPARKLINE'
  | 'RADAR' | 'FUNNEL' | 'TREEMAP' | 'SANKEY' | 'COMPOSED_CHART'
  // Custom SVG
  | 'GAUGE' | 'HEATMAP' | 'BOXPLOT' | 'CANDLESTICK'
  | 'VIOLIN' | 'DENSITY_PLOT' | 'RIDGELINE' | 'NETWORK_GRAPH' | 'TILE_MAP'
  // Maps
  | 'GEO_POINT_MAP' | 'USA_MAP' | 'WORLD_MAP'
  // Non-chart artifact types
  | 'KPI_CARD'
  | 'STAT_ROW'         // W2-02: 2–5 rows with cat+numeric → StatCard grid
  | 'SCHEMA_VIEW'
  | 'CONFIRMATION_CARD'
  | 'COMPLETION_CARD'
  | 'COST_CONFIRM_CARD'
  | 'DATA_QUALITY_VIEW'
  | 'DATA_LOADING_VIEW'
  | 'MONITORING_VIEW'
  | 'DISCOVERY_VIEW'
  | 'ALERT_VIEW'
  | 'MULTISTEP_VIEW'
  // Data views
  | 'LINEAGE_DAG_VIEW'
  | 'ER_DIAGRAM_VIEW'
  | 'STORAGE_VIEW'
  | 'ACCESS_PATTERN_VIEW'
  | 'COST_ANALYSIS_VIEW'
  | 'FRESHNESS_VIEW'
  | 'PIPELINE_VIEW'
  | 'TASK_VIEW'
  | 'GOVERNANCE_VIEW';

export interface CompositionEnvelope {
  id: string; // unique per response, used as sourceResultRef
  skill: SkillName;
  headline: {
    text: string;
    tone: Tone;
    basis: HeadlineBasis;
  };
  primaryArtifact: {
    type: ArtifactType;
    data: unknown;
    emphasis?: {
      highlight: string[]; // column names / series names / row keys
      deemphasize: string[];
    };
  };
  provenance: {
    visibility: 'COLLAPSED' | 'VISIBLE';
    sql?: string;
    cost?: CostEstimate;
    freshness?: string;
    sourceResultRef?: string;
    jobId?: string;
    project?: string;
  };
  nextActions: HandoffEnvelope[];
  /** Controls how much visual chrome ArtifactCard renders.
   *  'card' (default) = full card with headline bar, dividers, chips, provenance.
   *  'inline' = lightweight -- suppresses divider-before-chips and provenance.
   *  'custom' = view owns its full layout using composable CardParts.
   *             ArtifactCard is just a thin container. */
  presentation?: 'card' | 'inline' | 'custom';
  requiresConfirmation?: boolean;
  skipSelfReview?: boolean;
  insight?: string | null;
  qualityFlags?: import('./result-quality').QualityFlag[];
  extractedParameters?: ParameterDef[];
  /** Conversational summary shown above the artifact card. */
  briefing?: {
    narrative: string;
    findings?: Array<{
      label: string;
      value: string;
      detail?: string;
    }>;
  };
  /** W3-01: Optional companion artifact auto-shown on ANOMALY insights. */
  companionArtifact?: {
    type: ArtifactType;
    data: unknown;
    label: string;
  };
}

/** Props passed to view components that use presentation: 'custom'.
 *  The view receives the full envelope + all action callbacks and
 *  composes its own layout from CardParts building blocks. */
export interface CustomViewProps {
  envelope: CompositionEnvelope;
  onChipClick?: (chip: HandoffEnvelope) => void;
  onSave?: (envelope: CompositionEnvelope) => void;
  onPin?: (envelope: CompositionEnvelope) => void;
  onRunSql?: (sql: string) => void;
  onSendMessage?: (msg: string) => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  isPinned?: boolean;
}

// Re-export QualityFlag from result-quality module for convenience
export type { QualityFlag } from './result-quality';

// ─── Pipeline skill result (see second definition at bottom of file) ─────────
// Single definition kept at the bottom of the file to avoid interface merging issues.

// ─── Structured thinking step with optional BQ Console link ──────────────────

export interface StepInfo {
  text: string;
  link?: {
    url: string;       // full BQ Console URL
    label?: string;    // tooltip text, e.g. "Open dataset in BigQuery"
  };
}

export type StatusCallback = (status: string | StepInfo) => void;

// ─── Context item (visible chip in the prompt area) ──────────────────────────

export interface ContextItem {
  id: string;             // unique key for React + dedup
  type: 'project' | 'dataset' | 'table' | 'result';
  label: string;          // display text: "ecomm", "orders", "47 rows"
  icon: string;           // Material Symbol name
  dataset?: string;
  table?: string;
  skill?: SkillName;
  resultRef?: string;     // envelope ID
  sql?: string;           // source SQL for result-type items
}

// ─── Schema normalized result (bigquery-skill-schema.md §5) ──────────────────

export interface SchemaColumn {
  name: string;
  type: string;
  mode: 'REQUIRED' | 'NULLABLE' | 'REPEATED';
  description?: string | null;
  fields?: SchemaColumn[];
  // Dataset-level table metadata (populated when scope === 'DATASET')
  rowCount?: number | null;
  columnCount?: number | null;
  sizeBytes?: number | null;
  creationTime?: string | null;
  queryFrequency?: number;          // W2-12: # queries in last 30d (for sort order)
  // Project-level dataset metadata (populated when scope === 'PROJECT')
  tableCount?: number | null;
  policyTags?: string[];  // W3-07: policy tag names applied to this column
}

export interface SchemaUsageSignals {
  queryCount30d: number;           // # of SELECT queries referencing this table in last 30 days
  lastQueriedAt?: string | null;   // ISO timestamp of most recent query
  topUsers?: string[];             // up to 3 user emails
  popularJoins?: Array<{           // W2-11: frequent JOIN patterns
    joinedTable: string;
    onClause: string;
    count: number;
  }>;
}

export interface SchemaResult {
  skill: 'schema';
  scope: 'PROJECT' | 'DATASET' | 'TABLE';
  project: string;
  dataset?: string | null;
  table?: string | null;
  description?: string | null;
  type?: 'TABLE' | 'VIEW' | 'MATERIALIZED_VIEW' | 'EXTERNAL' | null;
  columns: SchemaColumn[];
  partitioning?: { field: string; type: string } | null;
  clustering?: string[] | null;
  rowCount?: number | null;
  sizeBytes?: number | null;
  lastModifiedTime?: string | null;
  usageSignals?: SchemaUsageSignals | null;   // W2-10
  tableConstraints: {
    primaryKey: string[];
    foreignKeys: Array<{
      columns: string[];
      referencedTable: string;
      referencedColumns: string[];
    }>;
  };
  fetchedAt: string;
}


// ─── Query normalized result (bigquery-skill-template.md) ────────────────────

export type VisualizationType =
  | 'TABLE'
  // Recharts native
  | 'LINE_CHART' | 'BAR_CHART' | 'AREA_CHART' | 'SCATTER' | 'PIE_CHART'
  | 'DONUT_CHART' | 'COLUMN_CHART' | 'HISTOGRAM' | 'SPARKLINE'
  | 'RADAR' | 'FUNNEL' | 'TREEMAP' | 'SANKEY' | 'COMPOSED_CHART'
  // Custom SVG
  | 'GAUGE' | 'HEATMAP' | 'BOXPLOT' | 'CANDLESTICK'
  | 'VIOLIN' | 'DENSITY_PLOT' | 'RIDGELINE' | 'NETWORK_GRAPH' | 'TILE_MAP'
  // Maps
  | 'GEO_POINT_MAP' | 'USA_MAP' | 'WORLD_MAP'
  | 'KPI_CARD'
  | 'STAT_ROW';         // W2-02: 2–5 row categorical+numeric grid


export interface QueryResult {
  skill: 'query';
  sql: string;
  requiresConfirmation: boolean;
  costConfirm?: CostEstimate | null;
  columns: string[];
  /** Authoritative BigQuery field types parallel to columns array (e.g. 'STRING', 'INTEGER', 'DATE', 'TIMESTAMP'). */
  columnTypes?: string[];
  rows: unknown[][];
  rowCount: number;
  jobId?: string;
  totalBytesProcessed: number;
  costTier: CostTier;
  suggestedVisualization: VisualizationType;
  xAxis?: string | null;
  yAxis?: string[] | null;
  notableFindings?: string | null;
  resultSummary?: string | null;
  extractedParameters?: ParameterDef[];
}

// ─── Data Management normalized result (bigquery-skill-data-management.md) ───

export type DmOperation =
  | 'DEDUPE'
  | 'DELETE'
  | 'UPDATE'
  | 'FILL_NULLS'
  | 'CREATE_TABLE'
  | 'ALTER_TABLE'
  | 'CREATE_VIEW'
  | 'RENAME'
  | 'COPY_TABLE'
  | 'MERGE'
  | 'PARTITION_TABLE';

export interface DmExampleGroup {
  keyValue: Record<string, unknown>;
  keepRow: Record<string, unknown>;
  removeRows: Record<string, unknown>[];
}

export interface DataManagementConfirmResult {
  skill: 'data-management';
  requiresConfirmation: true;
  operation: DmOperation;
  previewSql: string;
  affectedRowCount: number;
  affectedGroupCount?: number; // for DEDUPE
  exampleGroup?: DmExampleGroup; // for DEDUPE
  costEstimate?: CostEstimate | null;
  tiebreakerColumn?: string;
  tiebreakerDirection?: 'KEEP_LATEST' | 'KEEP_EARLIEST';
  executionSql: string;
  snapshotRowIds?: (string | number)[];
  snapshotOffer?: boolean;  // W2-19: show snapshot suggestion before confirm
}

export interface DataManagementCompleteResult {
  skill: 'data-management';
  requiresConfirmation: false;
  operation: DmOperation;
  rowsAffected: number;
  rowsExpected: number;
  mismatch: boolean;
  mismatchNote?: string | null;
  schemaInvalidated: string[];
  jobId?: string;
  completionMessage?: string | null;
}

export type DataManagementResult =
  | DataManagementConfirmResult
  | DataManagementCompleteResult;

// ─── Data Quality types (bigquery-skill-data-quality) ─────────────────────────

export type DqCheckType = 'PROFILE' | 'NULLS' | 'DUPLICATES' | 'FRESHNESS' | 'COMPLETENESS' | 'RANGE_VALIDATION' | 'REFERENTIAL_INTEGRITY' | 'SCHEMA_DRIFT';
export type DqSeverity = 'INFO' | 'WARNING' | 'ISSUE' | 'PASS';

export interface DqFinding {
  column: string;
  metric: string;
  value: number | string | null;
  severity: DqSeverity;
  sampleRows?: Array<Record<string, unknown>>; // W2-14: up to 5 failing rows
  histogram?: Array<{ bucket: string; count: number }>; // W2-15: numeric distribution
}

export interface DataQualityResult {
  skill: 'data-quality';
  checkType: DqCheckType;
  table: string;
  sql: string;
  findings: DqFinding[];
  summary: {
    rowsScanned: number;
    issuesFound: number;
    checkedAt: string;
  };
}

// ─── Data Loading normalized result ──────────────────────────────────────────

export interface DataLoadingResult {
  skill: 'data-loading'
  operationType: 'EXPORT_CSV' | 'EXPORT_SHEETS' | 'SCHEDULE_INFO' | 'SCHEDULE_CREATED' | 'QUERY_SAVED' | 'SHARE_CLIPBOARD' | 'NOT_SUPPORTED'
  message: string
  csvContent?: string | null
  sheetsUrl?: string | null
  rowCount?: number
  columnCount?: number
  sql?: string | null
  scheduleName?: string | null
  scheduleFrequency?: string | null
  shareText?: string | null
  savedQueryLabel?: string | null
}

// ─── Saved Artifact compound types ───────────────────────────────────────────

export interface ArtifactStep {
  id: string;
  order: number;
  skill: SkillName;
  prompt: string;
  cachedSql?: string;
  visualizationType?: ArtifactType;
  parameters?: ParameterDef[];
  lastResultSnapshot?: CompositionEnvelope;
}

export interface SavedArtifact {
  id: string;
  userId: string;
  type: SavedArtifactType;
  name: string;
  description: string;
  steps: ArtifactStep[];
  parameters: ParameterDef[];
  createdAt: string;
  updatedAt: string;
  project?: string;
  dataset?: string;
  tags: string[];
  pinned: boolean;
  runCount: number;
  lastRunAt?: string;
  spaceId?: string;
}

// ─── W3-11: Saved Dashboard (Firestore: savedDashboards/{id}) ────────────────

export interface DashboardTile {
  id: string;
  artifactId: string;              // references SavedArtifact.id
  title: string;
  col: number;                     // 0-indexed column in 12-column grid
  row: number;                     // 0-indexed row
  colSpan: number;                 // 1–12
  rowSpan: number;                 // 1–4
  cachedSql?: string;              // SQL to re-run on dashboard load
  lastSnapshot?: {                 // cached result from last successful run
    columns: string[];
    rows: (string | number | boolean | null)[][];
    rowCount: number;
    fetchedAt: string;             // ISO timestamp
  };
}

export interface SavedDashboard {
  id: string;
  userId: string;
  name: string;
  description: string;
  tiles: DashboardTile[];
  project?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── W3-12: Join Definition (Firestore: joinDefinitions/{id}) ────────────────

export interface JoinDefinition {
  id: string;
  userId: string;
  project: string;
  leftTable: string;              // fully qualified: project.dataset.table
  rightTable: string;
  joinKey: string;                // e.g. "left.customer_id = right.id"
  joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
  matchRateSql?: string;          // auto-generated SQL for match rate check
  matchRatePct?: number;          // last computed match rate (0–100)
  discoveredAt: string;
  notes?: string;
}

// ─── Chat message ─────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  envelopes?: CompositionEnvelope[];
  timestamp: string;
}

// ─── Operation log entry (conversation continuity) ───────────────────────────

export interface OperationLogEntry {
  messageIndex: number;
  skill: SkillName;
  operation: string; // "query", "create_table", "delete_rows", "export", etc.
  table?: string;
  timestamp: string;
  undoable: boolean; // true for DML operations within 7-day time travel
}

// ─── Monitoring normalized result ─────────────────────────────────────────────

export interface MonitoringJob {
  jobId: string
  userEmail: string
  statementType: string
  status: 'DONE' | 'RUNNING' | 'ERROR'
  createTime: string
  totalBytesProcessed: number
  errorMessage?: string | null
  referencedTables: string[]
  query?: string | null       // SQL text or stage bar representation
}

export interface MonitoringResult {
  skill: 'monitoring'
  monitoringType: 'JOB_LIST' | 'JOB_STATUS' | 'ALERT' | 'STORAGE_BREAKDOWN' | 'ACCESS_PATTERNS' | 'COST_ANALYSIS' | 'FRESHNESS'
  timeRange: { start: string; end: string }
  items: MonitoringJob[]
  summary: {
    totalJobs: number
    totalBytesProcessed: number
    errorCount: number
  }
}

// --- Saved Checks & Alerting -------------------------------------------------

export type AlertTier = 'TIER_0' | 'TIER_1';

export interface SavedCheck {
  id: string;
  createdAt: string;
  label: string;
  sql: string;
  conditionDescription: string;
  table?: string;
  tier: AlertTier;
  schedule?: string;       // cron expression for Tier 1
  transferConfigName?: string;  // BigQuery Data Transfer config name for Tier 1
}

export interface AlertResult {
  skill: 'monitoring';
  monitoringType: 'ALERT';
  alertCategory: 'PROJECT_WIDE' | 'JOB_SPECIFIC' | 'DATA_CONDITION';
  conditionDescription: string;
  checkSql?: string;
  savedCheckId?: string;
  tier?: AlertTier;
  guidance?: string;
  nextActions?: Array<{ label: string; action: string }>;
}

// ─── Discovery normalized result ──────────────────────────────────────────────

export interface DiscoverySearchResult {
  type: 'TABLE' | 'VIEW' | 'DATASET'
  ref: string
  matchedOn: string
  description?: string | null
}

export interface DiscoveryResult {
  skill: 'discovery'
  discoveryType: 'SEARCH' | 'COMPARISON' | 'LINEAGE' | 'ER_DIAGRAM' | 'JOIN_DISCOVERY'
  query?: string
  results: DiscoverySearchResult[]
  comparison?: {
    left: string
    right: string
    addedColumns: Array<{ name: string; type: string }>
    removedColumns: Array<{ name: string; type: string }>
    changedColumns: Array<{ name: string; fromType: string; toType: string }>
  } | null
  lineage?: {
    tableName: string;
    readsFrom: string[];
    writtenBy: string[];
    nodes?: LineageNode[];
    edges?: LineageEdge[];
  } | null
  erDiagram?: ErDiagramData | null
  // W3-13: join discovery results
  joinDefinition?: {
    leftTable: string;
    rightTable: string;
    candidates: string[];
    topJoinKey?: string;
    matchRatePct?: number;
    overlaps: string[];
  } | null
}

// ─── Table Preview Types ──────────────────────────────────────────────────────

export interface PreviewColumn {
  name: string;
  type: string;
  nullPct: number | null;
  distinctCount: number | null;
  min: string | null;
  max: string | null;
  topValues: Array<{ value: string; count: number }>;
}

export interface PreviewResponse {
  sample: {
    columns: string[];
    rows: unknown[][];
    rowCount: number;
  };
  profile: PreviewColumn[];
}

// ─── Lineage DAG types ────────────────────────────────────────────────────────

export interface LineageNode {
  id: string;         // fully-qualified table ref
  label: string;      // short name
  type: 'TABLE' | 'VIEW' | 'EXTERNAL' | 'TARGET';
  dataset: string;
  rowCount?: number | null;
  lastModified?: string | null;
}

export interface LineageEdge {
  source: string;     // node id
  target: string;     // node id
  jobCount: number;   // how many jobs created this edge
  lastSeen: string;   // timestamp of most recent job
  statementTypes: string[];  // INSERT, MERGE, CREATE_TABLE_AS_SELECT, etc.
}

// ─── ER Diagram types ─────────────────────────────────────────────────────────

export interface ErTableInfo {
  name: string;
  columns: Array<{ name: string; type: string; isPk: boolean }>;
}

export interface ErRelationship {
  fromTable: string;
  fromColumns: string[];
  toTable: string;
  toColumns: string[];
  type: 'FOREIGN_KEY' | 'INFERRED';
}

export interface ErDiagramData {
  dataset: string;
  tables: ErTableInfo[];
  relationships: ErRelationship[];
}

// ─── Storage Breakdown types ──────────────────────────────────────────────────

export interface StorageItem {
  ref: string;
  label: string;
  sizeBytes: number;
  rowCount: number;
  type: 'DATASET' | 'TABLE';
  children?: StorageItem[];
}

export interface StorageBreakdownResult {
  skill: 'monitoring';
  monitoringType: 'STORAGE_BREAKDOWN';
  project: string;
  totalBytes: number;
  items: StorageItem[];
}

// ─── Access Pattern types ─────────────────────────────────────────────────────

export interface AccessPatternEntry {
  tableRef: string;
  userEmail: string;
  queryCount: number;
  totalBytesProcessed: number;
  lastAccessed: string;
}

export interface AccessPatternResult {
  skill: 'monitoring';
  monitoringType: 'ACCESS_PATTERNS';
  timeRange: { start: string; end: string };
  entries: AccessPatternEntry[];
}

// ─── Cost Analysis types ──────────────────────────────────────────────────────

export interface CostBucket {
  period: string;
  user: string;
  bytesProcessed: number;
  estimatedCostUsd: number;
  jobCount: number;
}

export interface CostAnalysisResult {
  skill: 'monitoring';
  monitoringType: 'COST_ANALYSIS';
  timeRange: { start: string; end: string };
  totalEstimatedCostUsd: number;
  buckets: CostBucket[];
  currentMonthCostUsd?: number;        // W3-10: current month spend so far
  projectedMonthEndCostUsd?: number;   // W3-10: linear projection to month end
}

// ─── Data Freshness types ─────────────────────────────────────────────────────

export interface FreshnessEntry {
  tableRef: string;
  lastModified: string;
  ageHours: number;
  rowCount: number;
  status: 'FRESH' | 'STALE' | 'VERY_STALE';
}

export interface FreshnessResult {
  skill: 'monitoring';
  monitoringType: 'FRESHNESS';
  dataset: string | null;
  project?: string;
  entries: FreshnessEntry[];
  thresholds: { freshHours: number; staleHours: number };
}

// ─── Pipeline Management types ───────────────────────────────────────────────

export interface PipelineResult {
  skill: 'pipeline';
  pipelineType: 'LIST_SCHEDULES' | 'SCHEDULE_DETAILS' | 'CREATE_PIPELINE' | 'UPDATE_SCHEDULE' | 'DELETE_SCHEDULE' | 'RUN_HISTORY';
  schedules?: Array<{
    configId: string;
    displayName: string;
    schedule: string;
    state: string;
    lastRunStatus?: string;
    lastRunTime?: string;
    nextRunTime?: string;
    sql?: string;
    destinationTable?: string;
    healthDots?: Array<{      // W2-18: recent run statuses for dot strip
      date: string;           // ISO date string
      status: 'success' | 'failure' | 'running' | 'pending';
      durationMs?: number;
    }>;
  }>;
  runs?: Array<{
    runId: string;
    state: string;
    startTime: string;
    endTime?: string;
    errorStatus?: string;
  }>;
  confirmation?: {
    action: string;
    sql?: string;
    schedule?: string;
    estimatedCostPerRun?: string;
  };
}

// ─── Governance types ─────────────────────────────────────────────────────────

export interface GovernanceResult {
  skill: 'governance';
  governanceType: 'ACCESS_AUDIT' | 'TABLE_SECURITY' | 'SENSITIVE_DATA_SCAN' | 'DATA_CLASSIFICATION';
  scope: string; // dataset or table ref
  accessEntries?: Array<{
    entity: string;
    entityType: 'user' | 'group' | 'serviceAccount' | 'domain' | 'allUsers';
    role: string;
    grantedBy?: string;
  }>;
  securityPolicies?: {
    rowLevelPolicies: number;
    columnLevelMasking: number;
    policyTags: string[];
  };
  sensitiveFindings?: Array<{
    column: string;
    pattern: string;
    sampleCount: number;
    confidence: 'low' | 'medium' | 'high';
  }>;
  classification?: {
    documentedTables: number;
    undocumentedTables: number;
    documentedColumns: number;
    undocumentedColumns: number;
    labels: Record<string, string>;
  };
  sql?: string;
}
