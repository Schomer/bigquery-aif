// src/lib/skills/handle-pipeline.ts
// Pipeline management handler: scheduled query CRUD, run history, simple pipeline builder.
// Uses BigQuery Data Transfer API via the user's OAuth token.

import { callGemini } from '../gemini-client';
import { compose } from '../composer';
import { getAccessToken } from '../gis-auth';
import { dryRun, detectBqRegion } from '../bigquery-client';
import { formatBytes } from '@/lib/format';
import type { ChatMessage, CompositionEnvelope, PipelineResult, SkillManifest, StatusCallback } from '../types';

// -- Data Transfer API helpers ------------------------------------------------

const DT_BASE = 'https://bigquerydatatransfer.googleapis.com/v1';

async function dtFetch(url: string, init?: RequestInit): Promise<any> {
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated. Please sign in again.');
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    const msg = data?.error?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(String(msg));
  }
  return data;
}

// -- Sub-type classifier schema -----------------------------------------------

const PipelineIntentSchema = {
  type: 'OBJECT' as const,
  properties: {
    pipelineType: {
      type: 'STRING' as const,
      enum: ['LIST_SCHEDULES', 'SCHEDULE_DETAILS', 'CREATE_PIPELINE', 'UPDATE_SCHEDULE', 'DELETE_SCHEDULE', 'RUN_HISTORY'],
      description: 'The pipeline operation requested.',
    },
    configName: {
      type: 'STRING' as const,
      description: 'Display name or config ID of a specific transfer config, if referenced.',
    },
    sql: {
      type: 'STRING' as const,
      description: 'SQL for pipeline creation, if provided.',
    },
    schedule: {
      type: 'STRING' as const,
      description: 'Schedule expression (e.g. "every 24 hours", "every monday 09:00").',
    },
    sourceTable: {
      type: 'STRING' as const,
      description: 'Source table reference for pipeline creation.',
    },
    destinationTable: {
      type: 'STRING' as const,
      description: 'Destination table reference for pipeline creation.',
    },
    displayName: {
      type: 'STRING' as const,
      description: 'Display name for a new pipeline or schedule.',
    },
  },
  required: ['pipelineType'],
};

// -- Main handler -------------------------------------------------------------

export async function handlePipeline(
  message: string,
  _history: ChatMessage[],
  context?: {
    project?: string;
    dataset?: string;
    resolvedDataset?: string;
    handoffContext?: Record<string, unknown>;
  },
  onStatus?: StatusCallback,
): Promise<CompositionEnvelope[]> {
  const project = context?.project || '';
  const dataset = context?.resolvedDataset || context?.dataset || '';
  const hc = context?.handoffContext;
  const location = await detectBqRegion(project).catch(() => 'us'); // Data Transfer API requires a location

  // If handoff context carries a pre-classified pipeline type, skip LLM
  let intent: {
    pipelineType: string;
    configName?: string;
    sql?: string;
    schedule?: string;
    sourceTable?: string;
    destinationTable?: string;
    displayName?: string;
  };

  if (hc?.pipelineType && typeof hc.pipelineType === 'string') {
    intent = {
      pipelineType: hc.pipelineType as string,
      configName: (hc.configName as string) ?? undefined,
      sql: (hc.sql as string) ?? undefined,
      schedule: (hc.schedule as string) ?? undefined,
      displayName: (hc.displayName as string) ?? undefined,
    };
    onStatus?.(`Running ${intent.pipelineType} (from handoff)...`);
  } else {
    onStatus?.('Classifying pipeline request...');
    intent = await callGemini({
      systemInstruction: `You classify BigQuery pipeline/scheduling management requests. Available types:
LIST_SCHEDULES: list all scheduled queries or transfer configs
SCHEDULE_DETAILS: get details about a specific scheduled query
CREATE_PIPELINE: create a new pipeline or scheduled query (ETL, data movement)
UPDATE_SCHEDULE: update an existing schedule's SQL, frequency, or settings
DELETE_SCHEDULE: delete/remove a scheduled query
RUN_HISTORY: show run history or execution logs for a transfer config

Extract the config name or display name if the user references a specific schedule.
Extract SQL, schedule expression, source/destination tables if provided.
Project: ${project}, dataset: ${dataset}`,
      prompt: message,
      schema: PipelineIntentSchema,
      project,
    });
  }

  const pipelineType = intent.pipelineType || 'LIST_SCHEDULES';

  // -- LIST_SCHEDULES ---------------------------------------------------------
  if (pipelineType === 'LIST_SCHEDULES') {
    onStatus?.(`Fetching scheduled queries for project ${project}...`);
    try {
      const data = await dtFetch(
        `${DT_BASE}/projects/${encodeURIComponent(project)}/locations/${location}/transferConfigs?dataSourceIds=scheduled_query`
      );
      const configs = (data.transferConfigs || []).filter(
        (c: any) => c.dataSourceId === 'scheduled_query'
      );

      const schedules: PipelineResult['schedules'] = configs.map((c: any) => ({
        configId: extractConfigId(c.name || ''),
        displayName: c.displayName || 'Unnamed',
        schedule: c.schedule || 'Not set',
        state: c.state || 'UNKNOWN',
        lastRunStatus: c.state === 'SUCCEEDED' ? 'SUCCESS' : c.state,
        lastRunTime: c.updateTime || c.nextRunTime || '',
        nextRunTime: c.nextRunTime || '',
        sql: c.params?.query || '',
        destinationTable: c.destinationDatasetId || '',
      }));

      // W2-18: Fetch health dots (recent run history) in parallel for up to 5 schedules
      const healthFetches = (schedules ?? []).slice(0, 5).map(async (s) => {
        try {
          const runsData = await dtFetch(
            `${DT_BASE}/projects/${encodeURIComponent(project)}/locations/${location}/transferConfigs/${encodeURIComponent(s.configId)}/runs?pageSize=30&states=SUCCEEDED,FAILED,RUNNING,PENDING`
          );
          const recentRuns = (runsData.transferRuns || []).slice(0, 30);
          s.healthDots = recentRuns.map((r: any) => {
            const st = (r.state || '').toUpperCase();
            const status: 'success' | 'failure' | 'running' | 'pending' =
              st === 'SUCCEEDED' ? 'success' : st === 'FAILED' ? 'failure' : st === 'RUNNING' ? 'running' : 'pending';
            const start = r.startTime ? new Date(r.startTime).getTime() : 0;
            const end = r.endTime ? new Date(r.endTime).getTime() : start;
            return {
              date: r.startTime ? r.startTime.split('T')[0] : '',
              status,
              durationMs: end - start,
            };
          });
        } catch { /* health dots are non-critical */ }
      });
      await Promise.all(healthFetches);

      const result: PipelineResult = {
        skill: 'pipeline',
        pipelineType: 'LIST_SCHEDULES',
        schedules,
      };
      return [compose('pipeline', result)];

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const result: PipelineResult = {
        skill: 'pipeline',
        pipelineType: 'LIST_SCHEDULES',
        schedules: [],
        confirmation: {
          action: 'ERROR',
          sql: `Could not list scheduled queries: ${errMsg}. Ensure the BigQuery Data Transfer API is enabled for project ${project}.`,
        },
      };
      return [compose('pipeline', result)];
    }
  }

  // -- SCHEDULE_DETAILS -------------------------------------------------------
  if (pipelineType === 'SCHEDULE_DETAILS') {
    const configName = intent.configName || '';
    onStatus?.(`Fetching details for schedule "${configName}"...`);

    try {
      // Try to find the config by name if it's not a full resource path
      let configPath: string;
      if (configName.startsWith('projects/')) {
        configPath = configName;
      } else {
        // List and find by display name
        const listData = await dtFetch(
          `${DT_BASE}/projects/${encodeURIComponent(project)}/locations/${location}/transferConfigs?dataSourceIds=scheduled_query`
        );
        const configs = (listData.transferConfigs || []);
        const match = configs.find((c: any) =>
          (c.displayName || '').toLowerCase().includes(configName.toLowerCase()) ||
          (c.name || '').includes(configName)
        );
        if (!match) {
          const result: PipelineResult = {
            skill: 'pipeline',
            pipelineType: 'SCHEDULE_DETAILS',
            schedules: [],
            confirmation: { action: 'NOT_FOUND', sql: `No schedule found matching "${configName}".` },
          };
          return [compose('pipeline', result)];
        }
        configPath = match.name;
      }

      const configData = await dtFetch(`${DT_BASE}/${configPath}`);

      // Fetch recent runs
      let runs: PipelineResult['runs'] = [];
      try {
        const runsData = await dtFetch(`${DT_BASE}/${configPath}/runs?pageSize=10`);
        runs = (runsData.transferRuns || []).map((r: any) => ({
          runId: extractRunId(r.name || ''),
          state: r.state || 'UNKNOWN',
          startTime: r.startTime || r.runTime || '',
          endTime: r.endTime || '',
          errorStatus: r.errorStatus?.message || '',
        }));
      } catch {
        // Runs fetch is non-fatal
      }

      const schedules: PipelineResult['schedules'] = [{
        configId: extractConfigId(configData.name || ''),
        displayName: configData.displayName || 'Unnamed',
        schedule: configData.schedule || 'Not set',
        state: configData.state || 'UNKNOWN',
        lastRunTime: configData.updateTime || '',
        nextRunTime: configData.nextRunTime || '',
        sql: configData.params?.query || '',
        destinationTable: configData.destinationDatasetId || '',
      }];

      const result: PipelineResult = {
        skill: 'pipeline',
        pipelineType: 'SCHEDULE_DETAILS',
        schedules,
        runs,
      };
      return [compose('pipeline', result)];
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const result: PipelineResult = {
        skill: 'pipeline',
        pipelineType: 'SCHEDULE_DETAILS',
        schedules: [],
        confirmation: { action: 'ERROR', sql: `Could not fetch schedule details: ${errMsg}` },
      };
      return [compose('pipeline', result)];
    }
  }

  // -- CREATE_PIPELINE --------------------------------------------------------
  if (pipelineType === 'CREATE_PIPELINE') {
    onStatus?.('Generating pipeline SQL...');

    // Use Gemini to generate pipeline SQL if not provided
    let pipelineSql = intent.sql || '';
    const sourceTable = intent.sourceTable || '';
    const destTable = intent.destinationTable || '';
    const displayName = intent.displayName || 'Pipeline';
    const schedule = intent.schedule || 'every 24 hours';

    if (!pipelineSql && (sourceTable || destTable)) {
      const genResult = await callGemini({
        systemInstruction: `You generate BigQuery SQL for data pipelines.
Given a source table, destination table, and a description of the transformation, produce a single SQL statement.
Use CREATE OR REPLACE TABLE \`destination\` AS SELECT ... FROM \`source\` ... pattern for simple pipelines.
Use INSERT INTO for append-only pipelines.
Always wrap table references in backticks.
Project: ${project}, dataset: ${dataset}`,
        prompt: message,
        schema: {
          type: 'OBJECT' as const,
          properties: {
            sql: { type: 'STRING' as const, description: 'The pipeline SQL statement' },
            description: { type: 'STRING' as const, description: 'Brief description of what the pipeline does' },
          },
          required: ['sql'],
        },
        project,
      });
      pipelineSql = genResult.sql || '';
    }

    if (!pipelineSql) {
      // Generate from the message description
      const genResult = await callGemini({
        systemInstruction: `You generate BigQuery SQL for data pipelines.
Given a natural language description of a data pipeline, produce a SQL statement that implements it.
Use CREATE OR REPLACE TABLE for full refresh, INSERT INTO for incremental, or MERGE for upsert patterns.
Always wrap table references in backticks.
Project: ${project}, dataset: ${dataset || 'default'}`,
        prompt: message,
        schema: {
          type: 'OBJECT' as const,
          properties: {
            sql: { type: 'STRING' as const, description: 'The pipeline SQL statement' },
            description: { type: 'STRING' as const, description: 'Brief description of what the pipeline does' },
          },
          required: ['sql'],
        },
        project,
      });
      pipelineSql = genResult.sql || '';
    }

    // Dry-run for cost estimate
    let estimatedCost = '';
    if (pipelineSql) {
      try {
        onStatus?.('Estimating pipeline cost...');
        const dr = await dryRun(pipelineSql, project);
        estimatedCost = `~${formatBytes(dr.totalBytesProcessed)} per run (Tier ${dr.tier})`;
      } catch {
        estimatedCost = 'Cost estimate unavailable';
      }
    }

    const result: PipelineResult = {
      skill: 'pipeline',
      pipelineType: 'CREATE_PIPELINE',
      confirmation: {
        action: 'CREATE',
        sql: pipelineSql,
        schedule,
        estimatedCostPerRun: estimatedCost,
      },
    };
    return [compose('pipeline', result)];
  }

  // -- UPDATE_SCHEDULE --------------------------------------------------------
  if (pipelineType === 'UPDATE_SCHEDULE') {
    const configName = intent.configName || '';
    onStatus?.(`Looking up schedule "${configName}" to update...`);

    try {
      // Find the config
      const listData = await dtFetch(
        `${DT_BASE}/projects/${encodeURIComponent(project)}/locations/${location}/transferConfigs?dataSourceIds=scheduled_query`
      );
      const configs = (listData.transferConfigs || []);
      const match = configs.find((c: any) =>
        (c.displayName || '').toLowerCase().includes(configName.toLowerCase()) ||
        (c.name || '').includes(configName)
      );

      if (!match) {
        const result: PipelineResult = {
          skill: 'pipeline',
          pipelineType: 'UPDATE_SCHEDULE',
          confirmation: { action: 'NOT_FOUND', sql: `No schedule found matching "${configName}".` },
        };
        return [compose('pipeline', result)];
      }

      // Build update mask
      const updateFields: string[] = [];
      const body: any = {};

      if (intent.sql) {
        body.params = { query: intent.sql };
        updateFields.push('params');
      }
      if (intent.schedule) {
        body.schedule = intent.schedule;
        updateFields.push('schedule');
      }
      if (intent.displayName) {
        body.displayName = intent.displayName;
        updateFields.push('display_name');
      }

      if (updateFields.length === 0) {
        const result: PipelineResult = {
          skill: 'pipeline',
          pipelineType: 'UPDATE_SCHEDULE',
          confirmation: { action: 'NO_CHANGES', sql: 'No changes specified. Provide new SQL, schedule, or display name.' },
        };
        return [compose('pipeline', result)];
      }

      onStatus?.(`Updating schedule "${match.displayName}"...`);
      await dtFetch(
        `${DT_BASE}/${match.name}?updateMask=${updateFields.join(',')}`,
        { method: 'PATCH', body: JSON.stringify(body) }
      );

      const schedules: PipelineResult['schedules'] = [{
        configId: extractConfigId(match.name || ''),
        displayName: intent.displayName || match.displayName || 'Unnamed',
        schedule: intent.schedule || match.schedule || 'Not set',
        state: match.state || 'UNKNOWN',
        sql: intent.sql || match.params?.query || '',
      }];

      const result: PipelineResult = {
        skill: 'pipeline',
        pipelineType: 'UPDATE_SCHEDULE',
        schedules,
        confirmation: {
          action: 'UPDATED',
          sql: `Updated fields: ${updateFields.join(', ')}`,
        },
      };
      return [compose('pipeline', result)];
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const result: PipelineResult = {
        skill: 'pipeline',
        pipelineType: 'UPDATE_SCHEDULE',
        confirmation: { action: 'ERROR', sql: `Could not update schedule: ${errMsg}` },
      };
      return [compose('pipeline', result)];
    }
  }

  // -- DELETE_SCHEDULE --------------------------------------------------------
  if (pipelineType === 'DELETE_SCHEDULE') {
    const configName = intent.configName || '';
    onStatus?.(`Looking up schedule "${configName}" to delete...`);

    try {
      const listData = await dtFetch(
        `${DT_BASE}/projects/${encodeURIComponent(project)}/locations/${location}/transferConfigs?dataSourceIds=scheduled_query`
      );
      const configs = (listData.transferConfigs || []);
      const match = configs.find((c: any) =>
        (c.displayName || '').toLowerCase().includes(configName.toLowerCase()) ||
        (c.name || '').includes(configName)
      );

      if (!match) {
        const result: PipelineResult = {
          skill: 'pipeline',
          pipelineType: 'DELETE_SCHEDULE',
          confirmation: { action: 'NOT_FOUND', sql: `No schedule found matching "${configName}".` },
        };
        return [compose('pipeline', result)];
      }

      onStatus?.(`Deleting schedule "${match.displayName}"...`);
      await dtFetch(`${DT_BASE}/${match.name}`, { method: 'DELETE' });

      const result: PipelineResult = {
        skill: 'pipeline',
        pipelineType: 'DELETE_SCHEDULE',
        confirmation: {
          action: 'DELETED',
          sql: `Deleted scheduled query "${match.displayName}" (${extractConfigId(match.name || '')}).`,
        },
      };
      return [compose('pipeline', result)];
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const result: PipelineResult = {
        skill: 'pipeline',
        pipelineType: 'DELETE_SCHEDULE',
        confirmation: { action: 'ERROR', sql: `Could not delete schedule: ${errMsg}` },
      };
      return [compose('pipeline', result)];
    }
  }

  // -- RUN_HISTORY ------------------------------------------------------------
  if (pipelineType === 'RUN_HISTORY') {
    const configName = intent.configName || '';
    onStatus?.(`Fetching run history${configName ? ` for "${configName}"` : ''}...`);

    try {
      const listData = await dtFetch(
        `${DT_BASE}/projects/${encodeURIComponent(project)}/locations/${location}/transferConfigs?dataSourceIds=scheduled_query`
      );
      const configs = (listData.transferConfigs || []);

      // If config name specified, filter to that one
      let targetConfigs = configs;
      if (configName) {
        const match = configs.find((c: any) =>
          (c.displayName || '').toLowerCase().includes(configName.toLowerCase()) ||
          (c.name || '').includes(configName)
        );
        targetConfigs = match ? [match] : [];
      }

      if (targetConfigs.length === 0) {
        const result: PipelineResult = {
          skill: 'pipeline',
          pipelineType: 'RUN_HISTORY',
          runs: [],
          confirmation: { action: 'NOT_FOUND', sql: configName ? `No schedule found matching "${configName}".` : 'No scheduled queries found.' },
        };
        return [compose('pipeline', result)];
      }

      // Fetch runs for first matching config (or all if no specific name)
      const allRuns: NonNullable<PipelineResult['runs']> = [];
      const schedules: NonNullable<PipelineResult['schedules']> = [];

      for (const cfg of targetConfigs.slice(0, 5)) {
        try {
          const runsData = await dtFetch(`${DT_BASE}/${cfg.name}/runs?pageSize=10`);
          const runs = (runsData.transferRuns || []).map((r: any) => ({
            runId: extractRunId(r.name || ''),
            state: r.state || 'UNKNOWN',
            startTime: r.startTime || r.runTime || '',
            endTime: r.endTime || '',
            errorStatus: r.errorStatus?.message || '',
          }));
          allRuns.push(...runs);
        } catch {
          // Non-fatal
        }

        schedules.push({
          configId: extractConfigId(cfg.name || ''),
          displayName: cfg.displayName || 'Unnamed',
          schedule: cfg.schedule || 'Not set',
          state: cfg.state || 'UNKNOWN',
          sql: cfg.params?.query || '',
        });
      }

      const result: PipelineResult = {
        skill: 'pipeline',
        pipelineType: 'RUN_HISTORY',
        schedules,
        runs: allRuns,
      };
      return [compose('pipeline', result)];
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const result: PipelineResult = {
        skill: 'pipeline',
        pipelineType: 'RUN_HISTORY',
        runs: [],
        confirmation: { action: 'ERROR', sql: `Could not fetch run history: ${errMsg}` },
      };
      return [compose('pipeline', result)];
    }
  }

  // Fallback: list schedules
  return handlePipeline('list my scheduled queries', [], context, onStatus);
}

// -- Helpers ------------------------------------------------------------------

function extractConfigId(resourceName: string): string {
  // projects/p/locations/l/transferConfigs/configId
  const parts = resourceName.split('/');
  return parts[parts.length - 1] || resourceName;
}

function extractRunId(resourceName: string): string {
  // .../runs/runId
  const parts = resourceName.split('/');
  return parts[parts.length - 1] || resourceName;
}

// ─── Skill manifest ───────────────────────────────────────────────────────────

export const manifest: SkillManifest = {
  skill: 'pipeline',
  label: 'pipeline management',
  signals: [
    { phrase: 'show my schedules', weight: 3 },
    { phrase: 'show my scheduled queries', weight: 3 },
    { phrase: 'list schedules', weight: 3 },
    { phrase: 'list scheduled queries', weight: 3 },
    { phrase: "what's scheduled", weight: 3 },
    { phrase: 'what is scheduled', weight: 3 },
    { phrase: 'scheduled to run', weight: 3 },
    { phrase: 'create a pipeline', weight: 3 },
    { phrase: 'set up a pipeline', weight: 3 },
    { phrase: 'build a pipeline', weight: 3 },
    { phrase: 'data pipeline', weight: 3 },
    { phrase: 'transfer config', weight: 3 },
    { phrase: 'data transfer', weight: 3 },
    { phrase: 'run history', weight: 3 },
    { phrase: 'run every', weight: 3 },
    { phrase: 'run daily', weight: 3 },
    { phrase: 'run weekly', weight: 3 },
    { phrase: 'run monthly', weight: 3 },
    { phrase: 'make this recurring', weight: 3 },
    { phrase: 'delete the schedule', weight: 3 },
    { phrase: 'remove the schedule', weight: 3 },
    { phrase: 'update the schedule', weight: 3 },
    { phrase: 'edit the schedule', weight: 3 },
    { phrase: 'pipeline', weight: 2 },
    { phrase: 'automate', weight: 2 },
    { phrase: 'workflow', weight: 2 },
    { phrase: 'etl', weight: 2 },
    { phrase: 'every day', weight: 2 },
    { phrase: 'every hour', weight: 2 },
    { phrase: 'recurring', weight: 2 },
    { phrase: 'schedule', weight: 1 },
  ],
  handle: handlePipeline,
};
