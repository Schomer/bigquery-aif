// src/lib/skills/handle-dashboard.ts
// Dashboard creation skill: generates a DashboardDefinition from a natural-language
// request, executes each tile's SQL to get an initial snapshot, saves to Firestore,
// and returns a DASHBOARD_VIEW artifact card for chat.

import { callGemini } from '../gemini-client';
import { getAvailableDatasets, resolveDefaultDatasetFromList, buildSchemaContext } from '../orchestrator-utils';
import { executeQuery, dryRun } from '../bigquery-client';
import type {
  ChatMessage,
  CompositionEnvelope,
  DashboardResult,
  DashboardTile,
  SavedDashboard,
  SkillManifest,
  StatusCallback,
} from '../types';

// ── Firestore helpers (lazy-imported to keep server bundle lean) ──────────────

async function saveDashboard(uid: string, dashboard: SavedDashboard): Promise<void> {
  const { doc, setDoc } = await import('firebase/firestore');
  const { db } = await import('../firebase');
  await setDoc(doc(db, 'users', uid, 'savedDashboards', dashboard.id), dashboard);
}

function generateId(): string {
  return `dash_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function tileId(): string {
  return `tile_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// ── Gemini schema for dashboard intent ───────────────────────────────────────

const DashboardIntentSchema = {
  type: 'object',
  properties: {
    dashboardName: { type: 'string' },
    tiles: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          prompt: { type: 'string' },
          vizType: {
            type: 'string',
            enum: ['TABLE', 'BAR_CHART', 'LINE_CHART', 'PIE_CHART', 'DONUT_CHART', 'COLUMN_CHART', 'KPI'],
          },
          colSpan: { type: 'number' },
          rowSpan: { type: 'number' },
        },
        required: ['title', 'prompt', 'vizType', 'colSpan', 'rowSpan'],
      },
    },
  },
  required: ['dashboardName', 'tiles'],
};

// ── SQL generation for a single tile ─────────────────────────────────────────

const SqlSchema = {
  type: 'object',
  properties: {
    sql: { type: 'string' },
    xAxis: { type: 'string' },
    yAxis: { type: 'array', items: { type: 'string' } },
  },
  required: ['sql'],
};

async function generateTileSql(
  tilePrompt: string,
  project: string,
  dataset: string,
  schemaContext: string,
): Promise<{ sql: string; xAxis?: string; yAxis?: string[] }> {
  const result = await callGemini({
    systemInstruction: `You are a BigQuery SQL expert. Generate a single BigQuery SELECT statement for a dashboard tile.
Project: ${project}. Dataset: ${dataset}.
${schemaContext}
Rules:
- Return only a valid SELECT query, no DDL or DML.
- Wrap all table references in backticks: \`project.dataset.table\`.
- Keep the query focused and efficient — dashboard tiles show summaries, not raw rows.
- Limit result rows to 20 unless the tile is a KPI (1 row).`,
    prompt: tilePrompt,
    schema: SqlSchema,
    project,
  });
  return {
    sql: result.sql ?? '',
    xAxis: result.xAxis ?? undefined,
    yAxis: Array.isArray(result.yAxis) ? result.yAxis : undefined,
  };
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function handleDashboard(
  message: string,
  _history: ChatMessage[],
  context?: {
    project?: string;
    dataset?: string;
    uid?: string;
    availableDatasets?: string[];
  },
  onStatus?: StatusCallback,
): Promise<CompositionEnvelope[]> {
  const project = context?.project ?? '';
  const uid = context?.uid ?? '';

  if (!project) {
    const { compose } = await import('../composer');
    return [compose('dashboard', {
      skill: 'dashboard',
      dashboardId: '',
      name: 'No project selected',
      tileCount: 0,
      tileNames: [],
    } as DashboardResult)];
  }

  // 1. Resolve dataset
  onStatus?.('Resolving dataset...');
  const available = context?.availableDatasets ?? await getAvailableDatasets(project);
  const dataset = resolveDefaultDatasetFromList(available, context?.dataset, project) ?? '';

  // 2. Classify intent: extract dashboard name + tile specs
  onStatus?.('Designing dashboard layout...');
  const schemaContext = dataset ? await buildSchemaContext(project, dataset) : '';

  const intent = await callGemini({
    systemInstruction: `You are a dashboard designer for BigQuery. The user wants to create a dashboard.
Extract: a dashboard name and a list of tiles (2–6 tiles).
For each tile: a title, a plain-language data prompt, a visualization type, colSpan (3/4/6/8/12 out of 12), and rowSpan (1–3).
Make the layout balanced — KPIs are colSpan=3/rowSpan=1, charts colSpan=6/rowSpan=2, full-width tables colSpan=12/rowSpan=2.
Project: ${project}. Dataset: ${dataset}.
${schemaContext}`,
    prompt: message,
    schema: DashboardIntentSchema,
    project,
  }) as { dashboardName: string; tiles: Array<{ title: string; prompt: string; vizType: string; colSpan: number; rowSpan: number }> };

  const tileSpecs = (intent.tiles ?? []).slice(0, 6);
  const dashboardName = intent.dashboardName ?? 'My Dashboard';

  // 3. Generate SQL for each tile (parallel)
  onStatus?.(`Generating SQL for ${tileSpecs.length} tiles...`);
  const sqlResults = await Promise.allSettled(
    tileSpecs.map((spec) => generateTileSql(spec.prompt, project, dataset, schemaContext))
  );

  // 4. For each tile with valid SQL, dry-run (skip if cost too high) then execute
  const tiles: DashboardTile[] = [];
  let currentRow = 0;

  for (let i = 0; i < tileSpecs.length; i++) {
    const spec = tileSpecs[i];
    const sqlResult = sqlResults[i];
    const id = tileId();

    if (sqlResult.status === 'rejected' || !sqlResult.value.sql) {
      // Add tile with no SQL — will show skeleton state
      tiles.push({
        id,
        artifactId: '',
        title: spec.title,
        col: 0,
        row: currentRow,
        colSpan: spec.colSpan,
        rowSpan: spec.rowSpan,
        tileType: 'query',
        vizType: spec.vizType,
      });
    } else {
      const { sql, xAxis, yAxis } = sqlResult.value;

      // Dry-run cost gate: skip execution if > 1GB
      let snapshot: DashboardTile['lastSnapshot'] | undefined;
      try {
        const cost = await dryRun(sql, project);
        if (cost.totalBytesProcessed < 1_000_000_000) {
          onStatus?.(`Loading data for "${spec.title}"...`);
          const result = await executeQuery(sql, project);
          snapshot = {
            columns: result.columns,
            rows: result.rows as (string | number | boolean | null)[][],
            rowCount: result.rowCount,
            fetchedAt: new Date().toISOString(),
          };
        }
      } catch {
        // Execution failure is non-fatal — tile shows with cached SQL but no snapshot
      }

      tiles.push({
        id,
        artifactId: '',
        title: spec.title,
        col: 0,
        row: currentRow,
        colSpan: spec.colSpan,
        rowSpan: spec.rowSpan,
        tileType: 'query',
        vizType: spec.vizType,
        xAxis: xAxis ?? null,
        yAxis: yAxis ?? null,
        cachedSql: sql,
        lastSnapshot: snapshot,
      });
    }

    currentRow += spec.rowSpan;
  }

  // 5. Save to Firestore
  const dashboardId = generateId();
  const now = new Date().toISOString();
  const dashboard: SavedDashboard = {
    id: dashboardId,
    userId: uid,
    name: dashboardName,
    description: '',
    tiles,
    project,
    createdAt: now,
    updatedAt: now,
  };

  if (uid) {
    onStatus?.('Saving dashboard...');
    await saveDashboard(uid, dashboard).catch(() => {/* non-fatal */});
  }

  // 6. Compose result
  const dashResult: DashboardResult = {
    skill: 'dashboard',
    dashboardId,
    name: dashboardName,
    tileCount: tiles.length,
    tileNames: tiles.map((t) => t.title),
  };

  const { compose } = await import('../composer');
  return [compose('dashboard', dashResult)];
}

// ── Skill manifest ────────────────────────────────────────────────────────────

export const manifest: SkillManifest = {
  skill: 'dashboard',
  label: 'Dashboard Builder',
  signals: [
    { phrase: 'create a dashboard', weight: 10 },
    { phrase: 'build a dashboard', weight: 10 },
    { phrase: 'make a dashboard', weight: 10 },
    { phrase: 'create dashboard', weight: 9 },
    { phrase: 'build dashboard', weight: 9 },
    { phrase: 'dashboard showing', weight: 8 },
    { phrase: 'new dashboard', weight: 7 },
  ],
  handle: handleDashboard,
};
