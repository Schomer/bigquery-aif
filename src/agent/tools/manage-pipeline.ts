// src/agent/tools/manage-pipeline.ts
// Tool: manage_pipeline
// Manages BigQuery scheduled queries via the Data Transfer API.
// Wraps the same API calls as handle-pipeline.ts but as an agent tool.

import { detectBqRegion } from '../../lib/bigquery-client';
import { getAccessToken } from '../../lib/gis-auth';
import type { ToolDef, ToolResult } from './types';

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

function extractConfigId(resourceName: string): string {
  const parts = resourceName.split('/');
  return parts[parts.length - 1] || resourceName;
}

export const managePipelineTool: ToolDef = {
  declaration: {
    name: 'manage_pipeline',
    description:
      'Manage BigQuery scheduled queries and data transfer pipelines. ' +
      'Use action="list" to see all scheduled queries. ' +
      'Use action="details" with config_name to get details and run history for a specific schedule. ' +
      'Use action="create" with sql, schedule, and display_name to create a new scheduled query. ' +
      'Use action="delete" with config_name to remove a scheduled query.',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: {
          type: 'STRING',
          description: 'The pipeline operation to perform.',
          enum: ['list', 'details', 'create', 'delete'],
        },
        config_name: {
          type: 'STRING',
          description: 'Display name or config ID of a specific schedule. Required for details and delete.',
        },
        sql: {
          type: 'STRING',
          description: 'SQL for the scheduled query. Required for create.',
        },
        schedule: {
          type: 'STRING',
          description: 'Schedule expression (e.g. "every 24 hours", "every monday 09:00"). Required for create.',
        },
        display_name: {
          type: 'STRING',
          description: 'Display name for the new scheduled query. Used for create.',
        },
      },
      required: ['action'],
    },
  },
  tier: 'reversible',

  execute: async (args, project): Promise<ToolResult> => {
    const action = args.action as string;
    const location = await detectBqRegion(project).catch(() => 'us');
    const parentPath = `projects/${encodeURIComponent(project)}/locations/${location}`;

    try {
      if (action === 'list') {
        const data = await dtFetch(
          `${DT_BASE}/${parentPath}/transferConfigs?dataSourceIds=scheduled_query`
        );
        const configs = (data.transferConfigs || []).filter(
          (c: any) => c.dataSourceId === 'scheduled_query'
        );
        const schedules = configs.map((c: any) => ({
          config_id: extractConfigId(c.name || ''),
          display_name: c.displayName || 'Unnamed',
          schedule: c.schedule || 'Not set',
          state: c.state || 'UNKNOWN',
          next_run_time: c.nextRunTime || '',
          sql: c.params?.query || '',
        }));
        return {
          data: {
            action: 'list',
            schedule_count: schedules.length,
            schedules,
          },
        };
      }

      if (action === 'details') {
        const configName = args.config_name as string || '';
        // Find config by name
        const listData = await dtFetch(
          `${DT_BASE}/${parentPath}/transferConfigs?dataSourceIds=scheduled_query`
        );
        const configs = (listData.transferConfigs || []);
        const match = configs.find((c: any) =>
          (c.displayName || '').toLowerCase().includes(configName.toLowerCase()) ||
          (c.name || '').includes(configName)
        );
        if (!match) {
          return { data: { action: 'details', error: `No schedule found matching "${configName}".` } };
        }
        // Fetch runs
        let runs: any[] = [];
        try {
          const runsData = await dtFetch(`${DT_BASE}/${match.name}/runs?pageSize=10`);
          runs = (runsData.transferRuns || []).map((r: any) => ({
            state: r.state || 'UNKNOWN',
            start_time: r.startTime || '',
            end_time: r.endTime || '',
            error: r.errorStatus?.message || '',
          }));
        } catch { /* runs fetch is non-fatal */ }

        return {
          data: {
            action: 'details',
            config_id: extractConfigId(match.name || ''),
            display_name: match.displayName || 'Unnamed',
            schedule: match.schedule || 'Not set',
            state: match.state || 'UNKNOWN',
            sql: match.params?.query || '',
            destination_dataset: match.destinationDatasetId || '',
            recent_runs: runs,
          },
        };
      }

      if (action === 'create') {
        const sql = args.sql as string || '';
        const schedule = args.schedule as string || 'every 24 hours';
        const displayName = args.display_name as string || 'Scheduled Query';

        if (!sql) {
          return { data: { error: 'SQL is required to create a scheduled query.' } };
        }

        const body = {
          displayName,
          dataSourceId: 'scheduled_query',
          params: { query: sql },
          schedule,
        };
        const result = await dtFetch(
          `${DT_BASE}/${parentPath}/transferConfigs`,
          { method: 'POST', body: JSON.stringify(body) }
        );
        return {
          data: {
            action: 'create',
            created: true,
            config_id: extractConfigId(result.name || ''),
            display_name: displayName,
            schedule,
          },
        };
      }

      if (action === 'delete') {
        const configName = args.config_name as string || '';
        const listData = await dtFetch(
          `${DT_BASE}/${parentPath}/transferConfigs?dataSourceIds=scheduled_query`
        );
        const configs = (listData.transferConfigs || []);
        const match = configs.find((c: any) =>
          (c.displayName || '').toLowerCase().includes(configName.toLowerCase()) ||
          (c.name || '').includes(configName)
        );
        if (!match) {
          return { data: { action: 'delete', error: `No schedule found matching "${configName}".` } };
        }
        await dtFetch(`${DT_BASE}/${match.name}`, { method: 'DELETE' });
        return {
          data: {
            action: 'delete',
            deleted: true,
            display_name: match.displayName || configName,
          },
        };
      }

      return { data: { error: `Unknown action: ${action}` } };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { data: { error: msg }, error: msg };
    }
  },
};
