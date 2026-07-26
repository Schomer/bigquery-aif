// src/agent/index.ts
// Agent v2 entry point.
// Wires the loop, adapter, tools, and context assembly together.
// Exports processWithAgentLoop() with the same return shape as
// ChatOrchestrator.processMessage() for feature-flag integration.

import { createAdapter } from './firebase-ai-adapter';
import { runLoop, InterruptSignal, type LoopConfig } from './loop';
import { assembleContext } from './context';
import { runQueryTool } from './tools/run-query';
import { getSchemaTool } from './tools/get-schema';
import { listResourcesTool } from './tools/list-resources';
import { executeDmlTool } from './tools/execute-dml';
import { managePipelineTool } from './tools/manage-pipeline';
import { exportDataTool } from './tools/export-data';
import { presentResultTool } from './tools/present-result';
import type { ToolDef } from './tools/types';
import type { StatusCallback, CompositionEnvelope, HandoffEnvelope, SkillName, ChatMessage, TaskIntent, VisualizationType } from '../lib/types';
import { compose } from '../lib/composer';
import { resultCache } from './result-cache';
import { fetchSchema } from '../lib/skills/schema';

// ── Feature flag ──────────────────────────────────────────────────────────────

const FEATURE_FLAG_KEY = 'bqaif_agent_v2';

/** Check if the v2 agent loop is enabled. */
export function isAgentV2Enabled(): boolean {
  if (typeof window === 'undefined') return false;

  // URL parameter takes precedence
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has('agent')) {
      return params.get('agent') === 'v2';
    }
  } catch {
    // Non-fatal
  }

  // Fall back to localStorage
  try {
    return localStorage.getItem(FEATURE_FLAG_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Set the v2 agent loop feature flag. */
export function setAgentV2Enabled(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(FEATURE_FLAG_KEY, 'true');
    } else {
      localStorage.removeItem(FEATURE_FLAG_KEY);
    }
  } catch {
    // Non-fatal
  }
}

// ── Phase 0 tool belt ─────────────────────────────────────────────────────────

const PHASE_0_TOOLS: ToolDef[] = [
  runQueryTool,
  getSchemaTool,
  listResourcesTool,
  executeDmlTool,
  managePipelineTool,
  exportDataTool,
  presentResultTool,
];

// ── Process message with the agent loop ───────────────────────────────────────

export interface AgentProcessArgs {
  message: string;
  history: ChatMessage[];
  context?: {
    project?: string;
    dataset?: string;
    resolvedDataset?: string;
    availableDatasets?: string[];
    lastTable?: string;
    lastTableSchema?: { name: string; type: string; description?: string }[];
    lastSkill?: SkillName;
    lastDatasetTables?: string[];
    uid?: string;
  };
  onStatus?: StatusCallback;
  signal?: AbortSignal;
}

export interface AgentProcessResult {
  envelopes: CompositionEnvelope[];
  skill?: SkillName;
  resolvedContext?: {
    availableDatasets?: string[];
    resolvedDataset?: string;
  };
}

/**
 * Process a user message through the v2 agent loop.
 * Return shape matches ChatOrchestrator.processMessage() for
 * transparent feature-flag integration.
 */
export async function processWithAgentLoop({
  message,
  history,
  context,
  onStatus,
  signal,
}: AgentProcessArgs): Promise<AgentProcessResult> {
  const project = context?.project ?? '';

  // Resolve available datasets if not provided
  let availableDatasets = context?.availableDatasets ?? [];
  if (availableDatasets.length === 0 && project) {
    try {
      const result = await getSchemaTool.execute({}, project);
      const data = result.data as { datasets?: string[] };
      availableDatasets = data.datasets ?? [];
    } catch {
      // Non-fatal -- proceed with empty list
    }
  }

  // Convert history to the format the context builder expects
  const historyMessages = history.slice(-30).map(m => ({
    role: m.role as 'user' | 'assistant',
    content: typeof m.content === 'string' ? m.content : String(m.content ?? ''),
  }));

  // Assemble context
  const ctx = await assembleContext({
    message,
    history: historyMessages,
    project,
    availableDatasets,
    lastTable: context?.lastTable,
    lastTableSchema: context?.lastTableSchema,
    lastSkill: context?.lastSkill as string | undefined,
    lastDatasetTables: context?.lastDatasetTables,
  });

  // Create adapter and interrupt signal
  const adapter = createAdapter();
  const interruptSignal = new InterruptSignal();

  // Wire abort signal to interrupt
  if (signal) {
    signal.addEventListener('abort', () => interruptSignal.interrupt(), { once: true });
  }

  const config: LoopConfig = {
    softCap: 15,
    hardCap: 25,
    maxRetries: 2,
  };

  // Run the loop
  onStatus?.('Thinking...');
  const result = await runLoop(ctx, adapter, PHASE_0_TOOLS, config, onStatus, interruptSignal);

  // Build envelopes from the result
  const envelopes: CompositionEnvelope[] = [];

  if (result.confirmationNeeded && result.pendingSql) {
    // Build a confirmation envelope
    // The loop paused because a destructive SQL statement was detected
    const envelope: CompositionEnvelope = {
      id: 'confirm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      skill: 'data-management' as SkillName,
      headline: {
        text: `This operation requires confirmation before proceeding.`,
        tone: 'ATTENTION',
        basis: 'STATUS',
      },
      primaryArtifact: {
        type: 'CONFIRMATION_CARD',
        data: {
          sql: result.pendingSql,
          actionClass: result.pendingActionClass,
        },
      },
      provenance: { visibility: 'COLLAPSED' },
      requiresConfirmation: true,
      skipSelfReview: true,
      nextActions: [],
    };
    envelopes.push(envelope);
  } else if (result.text) {
    // ── Extract intent metadata from tool call args ──────────────────────────
    // The LLM provides task_intent, visualization_hint, result_title, and
    // suggested_follow_ups as tool call arguments. These are stored in
    // event.tool_args by the loop.
    type IntentMeta = {
      taskIntent?: TaskIntent;
      vizHint?: VisualizationType;
      resultTitle?: string;
      followUps?: string[];
    };
    function extractIntentMeta(events: typeof result.events, toolName: string): IntentMeta {
      const toolEvents = events.filter(e => e.tool_name === toolName);
      const last = toolEvents[toolEvents.length - 1];
      if (!last?.tool_args) return {};
      return {
        taskIntent: last.tool_args.task_intent as TaskIntent | undefined,
        vizHint: last.tool_args.visualization_hint as VisualizationType | undefined,
        resultTitle: last.tool_args.result_title as string | undefined,
        followUps: last.tool_args.suggested_follow_ups as string[] | undefined,
      };
    }
    function buildFollowUpChips(followUps: string[] | undefined): HandoffEnvelope[] {
      if (!followUps?.length) return [];
      return followUps.slice(0, 3).map(q => ({
        targetSkill: 'query' as SkillName,
        label: q,
        context: { prefill: q },
        sourceSkill: 'query' as SkillName,
      }));
    }
    // Check for DML/DDL completion events
    const dmlEvents = result.events.filter(
      e => e.kind === 'tool_result' && e.tool_name === 'execute_dml' && e.status === 'ok'
    );

    // Check for pipeline management events
    const pipelineEvents = result.events.filter(
      e => e.kind === 'tool_result' && e.tool_name === 'manage_pipeline' && e.status === 'ok'
    );

    // Check for export events
    const exportEvents = result.events.filter(
      e => e.kind === 'tool_result' && e.tool_name === 'export_data' && e.status === 'ok'
    );

    // Check for query result events
    const queryEvents = result.events.filter(
      e => e.kind === 'tool_result' && e.tool_name === 'run_query' && e.status === 'ok'
    );

    // Check for schema exploration events
    const schemaEvents = result.events.filter(
      e => e.kind === 'tool_result' &&
      (e.tool_name === 'get_schema' || e.tool_name === 'list_resources') &&
      e.status === 'ok'
    );

    // Check for presentation events (agent explicitly structured its response)
    const presentEvents = result.events.filter(
      e => e.kind === 'tool_result' && e.tool_name === 'present_result' && e.status === 'ok'
    );

    if (dmlEvents.length > 0 && queryEvents.length === 0) {
      // DML/DDL completed -- build a completion envelope
      const lastDmlEvent = dmlEvents[dmlEvents.length - 1];
      let dmlData: { completed?: boolean; rows_affected?: number; job_id?: string } = {};
      try {
        if (lastDmlEvent.detail) {
          dmlData = JSON.parse(lastDmlEvent.detail);
        }
      } catch { /* non-fatal */ }

      const meta = extractIntentMeta(result.events, 'execute_dml');
      const headline = meta.resultTitle || result.text.split('\n')[0].slice(0, 200);

      const envelope: CompositionEnvelope = {
        id: 'dml_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        skill: 'data-management' as SkillName,
        headline: {
          text: headline,
          tone: 'POSITIVE',
          basis: 'STATUS',
        },
        primaryArtifact: {
          type: 'CONVERSATION',
          data: {
            text: result.text,
            rowsAffected: dmlData.rows_affected ?? 0,
          },
        },
        provenance: { visibility: 'COLLAPSED' },
        skipSelfReview: true,
        nextActions: buildFollowUpChips(meta.followUps),
      };
      envelopes.push(envelope);
    } else if (pipelineEvents.length > 0 && queryEvents.length === 0) {
      // Pipeline management result
      const lastPipelineEvent = pipelineEvents[pipelineEvents.length - 1];
      let pipelineData: Record<string, unknown> = {};
      try {
        if (lastPipelineEvent.detail) {
          pipelineData = JSON.parse(lastPipelineEvent.detail);
        }
      } catch { /* non-fatal */ }

      const actionToType: Record<string, string> = {
        LIST: 'LIST_SCHEDULES',
        DETAILS: 'SCHEDULE_DETAILS',
        CREATE: 'CREATE_PIPELINE',
        DELETE: 'DELETE_SCHEDULE',
      };
      const rawAction = String(pipelineData.action || 'list').toUpperCase();
      const pipelineResult = {
        skill: 'pipeline' as const,
        pipelineType: (actionToType[rawAction] || 'LIST_SCHEDULES') as 'LIST_SCHEDULES',
        schedules: (pipelineData.schedules as any[]) ?? [],
      };
      const composed = compose('pipeline', pipelineResult);
      composed.headline.text = result.text.split('\n')[0].slice(0, 200);
      composed.skipSelfReview = true;
      envelopes.push(composed);
    } else if (exportEvents.length > 0 && queryEvents.length === 0) {
      // Export result
      const lastExportEvent = exportEvents[exportEvents.length - 1];
      let exportData: Record<string, unknown> = {};
      try {
        if (lastExportEvent.detail) {
          exportData = JSON.parse(lastExportEvent.detail);
        }
      } catch { /* non-fatal */ }

      const dataLoadingResult = {
        skill: 'data-loading' as const,
        operationType: (exportData.format === 'sheets' ? 'EXPORT_SHEETS' : 'EXPORT_CSV') as 'EXPORT_CSV',
        message: result.text,
        csvContent: exportData.csv_content as string | undefined,
        sheetsUrl: exportData.sheets_url as string | undefined,
        rowCount: exportData.row_count as number | undefined,
        columnCount: exportData.column_count as number | undefined,
      };
      const composed = compose('data-loading', dataLoadingResult);
      composed.headline.text = result.text.split('\n')[0].slice(0, 200);
      composed.skipSelfReview = true;
      envelopes.push(composed);
    } else if (schemaEvents.length > 0) {
      // Schema exploration -- build SCHEMA_VIEW even if queries also ran.
      // When a user explores a dataset, the agent may call get_schema AND
      // run supplementary queries. The schema view is the primary result.
      const lastSchemaEvent = schemaEvents[schemaEvents.length - 1];
      const args = lastSchemaEvent.tool_args ?? {};

      let schemaDataset: string | undefined;
      let schemaTable: string | undefined;

      if (lastSchemaEvent.tool_name === 'get_schema') {
        schemaDataset = args.dataset as string | undefined;
        schemaTable = args.table as string | undefined;
      } else if (lastSchemaEvent.tool_name === 'list_resources') {
        const scope = args.scope as string;
        if (scope === 'tables') {
          schemaDataset = args.dataset as string | undefined;
        }
      }

      let schemaEnvelopeBuilt = false;
      try {
        const schemaResult = await fetchSchema(
          schemaDataset ?? undefined,
          schemaTable ?? undefined,
          project,
        );
        const composed = compose('schema', schemaResult);
        composed.headline.text = result.text.split('\n')[0].slice(0, 200);
        composed.skipSelfReview = true;
        envelopes.push(composed);
        schemaEnvelopeBuilt = true;
      } catch {
        // Non-fatal -- fall back to text envelope
      }

      if (!schemaEnvelopeBuilt) {
        envelopes.push(buildTextEnvelope(result.text));
      }
    } else if (queryEvents.length > 0) {
      // Find the last successful query result_id
      const lastQueryEvent = queryEvents[queryEvents.length - 1];
      // Extract result_id from the event detail if possible
      let resultData: { columns?: string[]; rows?: unknown[][]; column_types?: string[] } | null = null;

      try {
        if (lastQueryEvent.detail) {
          const parsed = JSON.parse(lastQueryEvent.detail);
          if (parsed.result_id) {
            const cached = await resultCache.get(parsed.result_id);
            if (cached) {
              resultData = {
                columns: cached.schema.map(s => s.name),
                column_types: cached.schema.map(s => s.type),
                rows: cached.rows,
              };
            }
          }
        }
      } catch {
        // Non-fatal -- fall back to text response
      }

      if (resultData && resultData.columns && resultData.rows) {
        // Build a query result envelope via compose
        const meta = extractIntentMeta(result.events, 'run_query');
        const vizHint = (meta.vizHint || 'TABLE') as VisualizationType;

        const queryResult = {
          skill: 'query' as const,
          sql: '',
          requiresConfirmation: false,
          costConfirm: null,
          columns: resultData.columns,
          columnTypes: resultData.column_types ?? [],
          rows: resultData.rows,
          rowCount: resultData.rows.length,
          totalBytesProcessed: result.totalBytesBilled,
          costTier: 0 as const,
          suggestedVisualization: vizHint,
          resultSummary: result.text,
        };
        const composed = compose('query', queryResult);
        // Use agent-provided title or fall back to LLM text
        composed.headline.text = meta.resultTitle || result.text.split('\n')[0].slice(0, 200);
        composed.skipSelfReview = true;
        // Wire follow-up chips from agent metadata
        if (meta.followUps?.length) {
          composed.nextActions = [
            ...composed.nextActions,
            ...buildFollowUpChips(meta.followUps),
          ];
        }
        envelopes.push(composed);
      } else {
        // Text response with data mentioned
        envelopes.push(buildTextEnvelope(result.text));
      }
    } else if (presentEvents.length > 0) {
      // Agent structured its response via present_result.
      // This only triggers when no other structured tool (schema, query, etc.)
      // produced results. present_result is for enriching what would otherwise
      // be plain text.
      const lastPresentEvent = presentEvents[presentEvents.length - 1];
      const pArgs = lastPresentEvent.tool_args ?? {};
      const presentationData = {
        format: (pArgs.format as string) || 'info',
        title: pArgs.title as string | undefined,
        text: pArgs.text as string | undefined,
        items: (pArgs.items as Array<Record<string, unknown>>) || [],
      };
      const meta = extractIntentMeta(result.events, 'present_result');
      const presentEnvelope: CompositionEnvelope = {
        id: 'agent_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        skill: 'conversation' as SkillName,
        headline: {
          text: presentationData.title || result.text.split('\n')[0].slice(0, 200),
          tone: 'NEUTRAL',
          basis: 'STATUS',
        },
        primaryArtifact: {
          type: 'PRESENTATION',
          data: presentationData,
        },
        provenance: { visibility: 'COLLAPSED' },
        skipSelfReview: true,
        nextActions: meta.followUps?.length ? buildFollowUpChips(meta.followUps) : [],
      };
      envelopes.push(presentEnvelope);
    } else {
      // Pure text response -- no tools produced structured data
      envelopes.push(buildTextEnvelope(result.text));
    }
  } else if (result.interrupted) {
    envelopes.push(buildTextEnvelope(
      'The request was interrupted. Work completed up to the interruption point is preserved.'
    ));
  }

  return {
    envelopes,
    skill: 'conversation' as SkillName,
    resolvedContext: {
      availableDatasets,
      resolvedDataset: context?.resolvedDataset,
    },
  };
}

// ── Helper ────────────────────────────────────────────────────────────────────

function buildTextEnvelope(text: string): CompositionEnvelope {
  return {
    id: 'agent_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    skill: 'conversation' as SkillName,
    headline: {
      text,
      tone: 'NEUTRAL',
      basis: 'STATUS',
    },
    primaryArtifact: {
      type: 'CONVERSATION',
      data: { text },
    },
    provenance: { visibility: 'COLLAPSED' },
    skipSelfReview: true,
    nextActions: [],
  };
}
