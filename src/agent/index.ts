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
import { planAnalysisTool } from './tools/plan-tool';
import type { ToolDef } from './tools/types';
import type { StatusCallback, CompositionEnvelope, HandoffEnvelope, SkillName, ChatMessage, TaskIntent, VisualizationType, ExecutionTraceEntry } from '../lib/types';
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
  planAnalysisTool,
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
  const executionTrace = buildExecutionTrace(result.events);

  // ── Debug logging: capture actual agent behavior ──────────────────────────
  // Visible in browser DevTools console AND in the app's thinking steps dropdown.
  const toolCalls = result.events
    .filter(e => e.kind === 'tool_result')
    .map(e => ({
      tool: e.tool_name,
      status: e.status,
      args: e.tool_args,
      detail: e.detail?.slice(0, 200),
    }));
  console.group(`[Agent] "${message.slice(0, 80)}"`);
  console.log('Tool calls:', toolCalls);
  console.log('LLM text:', result.text?.slice(0, 300));
  console.log('Confirmation needed:', result.confirmationNeeded);
  console.groupEnd();

  // Emit as a thinking step for in-app visibility
  const toolSummary = toolCalls.map(tc =>
    `${tc.tool}(${tc.args ? Object.entries(tc.args).map(([k,v]) => `${k}=${JSON.stringify(v)}`).join(', ') : ''}) -> ${tc.status}`
  ).join(' | ');
  onStatus?.({ text: `Tools: ${toolSummary || 'none'}`, type: 'debug' } as any);

  // Check if plan_analysis detected ambiguities that need user resolution
  const planEvents = result.events.filter(
    e => e.kind === 'tool_result' && e.tool_name === 'plan_analysis'
  );
  if (planEvents.length > 0) {
    const lastPlanEvent = planEvents[planEvents.length - 1];
    const planArgs = lastPlanEvent.tool_args;
    if (planArgs?.ambiguities && Array.isArray(planArgs.ambiguities) && planArgs.ambiguities.length > 0) {
      // Ambiguities detected -- produce a clarification card
      const firstAmbiguity = planArgs.ambiguities[0] as {
        category: string;
        question: string;
        options: Array<{ label: string; value: string }>;
      };
      const { composeClarification } = await import('../lib/composer');
      const clarificationEnvelope = composeClarification({
        category: firstAmbiguity.category as any,
        question: firstAmbiguity.question,
        options: firstAmbiguity.options,
        context: typeof planArgs.plan_summary === 'string' ? planArgs.plan_summary : undefined,
        assumptions: undefined,
      });
      clarificationEnvelope.provenance.executionTrace = executionTrace;
      return {
        envelopes: [clarificationEnvelope],
        skill: 'conversation' as SkillName,
        resolvedContext: {
          availableDatasets,
          resolvedDataset: context?.resolvedDataset,
        },
      };
    }
  }

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
      provenance: { visibility: 'COLLAPSED', executionTrace },
      requiresConfirmation: true,
      skipSelfReview: true,
      nextActions: [],
    };
    envelopes.push(envelope);
  } else if (result.text) {
    // ── Build envelopes for ALL successful tool results ─────────────────────
    // Instead of picking one "winner," render every tool result as its own card.
    // The UI displays them all, giving the user a complete picture.

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

    // Collect all successful tool_result events
    const successEvents = result.events.filter(
      e => e.kind === 'tool_result' && e.status === 'ok'
    );

    // Track whether we built any structured envelopes
    let builtStructured = false;

    // When the agent called present_result, it explicitly chose how to format
    // the output. Any run_query calls in the same turn were data-gathering steps
    // and should not produce their own cards. This enforces the documented
    // priority: present_result > query (see invariants.md).
    const hasPresentResult = successEvents.some(e => e.tool_name === 'present_result');

    // When a primary action occurred (query, DML, pipeline, export, present_result),
    // schema lookups (get_schema, list_resources) were preparatory steps and
    // should not produce redundant SCHEMA_VIEW cards.
    // Only build a SCHEMA_VIEW when schema inspection was the terminal action.
    const hasPrimaryAction = successEvents.some(e =>
      e.tool_name === 'run_query' ||
      e.tool_name === 'execute_dml' ||
      e.tool_name === 'manage_pipeline' ||
      e.tool_name === 'export_data' ||
      e.tool_name === 'present_result'
    );

    // Track which schema scopes we've already rendered to avoid duplicates.
    // When the AI calls get_schema(dataset=X) and then get_schema(dataset=X, table=Y),
    // the dataset-level call was a preparatory step -- only render the table-level one.
    const renderedSchemaScopes = new Set<string>();

    // First pass: identify the most specific schema scope per dataset so we can
    // skip preparatory (less specific) schema calls.
    const schemaSpecificity = new Map<string, 'table' | 'dataset' | 'project'>();
    for (const event of successEvents) {
      if (event.tool_name === 'get_schema' || event.tool_name === 'list_resources') {
        const args = event.tool_args ?? {};
        const dataset = (args.dataset as string) || '';
        const table = (args.table as string) || '';
        const scope = event.tool_name === 'list_resources'
          ? (args.scope as string) || 'datasets'
          : '';

        let level: 'table' | 'dataset' | 'project';
        if (table) {
          level = 'table';
        } else if (dataset || scope === 'tables') {
          level = 'dataset';
        } else {
          level = 'project';
        }

        const key = dataset || '__project__';
        const existing = schemaSpecificity.get(key);
        const rank = { project: 0, dataset: 1, table: 2 };
        if (!existing || rank[level] > rank[existing]) {
          schemaSpecificity.set(key, level);
        }
      }
    }

    for (const event of successEvents) {
      const tool = event.tool_name;

      // ── DML/DDL result ──────────────────────────────────────────────────
      if (tool === 'execute_dml') {
        let dmlData: { completed?: boolean; rows_affected?: number; job_id?: string } = {};
        try {
          if (event.detail) dmlData = JSON.parse(event.detail);
        } catch { /* non-fatal */ }

        const meta = extractIntentMeta(result.events, 'execute_dml');
        const headline = meta.resultTitle || result.text?.split('\n')[0].slice(0, 200) || 'Operation complete';

        envelopes.push({
          id: 'dml_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          skill: 'data-management' as SkillName,
          headline: { text: headline, tone: 'POSITIVE', basis: 'STATUS' },
          primaryArtifact: {
            type: 'CONVERSATION',
            data: { text: result.text || headline, rowsAffected: dmlData.rows_affected ?? 0 },
          },
          provenance: { visibility: 'COLLAPSED', executionTrace },
          skipSelfReview: true,
          nextActions: buildFollowUpChips(meta.followUps),
        });
        builtStructured = true;
        continue;
      }

      // ── Pipeline result ─────────────────────────────────────────────────
      if (tool === 'manage_pipeline') {
        let pipelineData: Record<string, unknown> = {};
        try {
          if (event.detail) pipelineData = JSON.parse(event.detail);
        } catch { /* non-fatal */ }

        const actionToType: Record<string, string> = {
          LIST: 'LIST_SCHEDULES', DETAILS: 'SCHEDULE_DETAILS',
          CREATE: 'CREATE_PIPELINE', DELETE: 'DELETE_SCHEDULE',
        };
        const rawAction = String(pipelineData.action || 'list').toUpperCase();
        const pipelineResult = {
          skill: 'pipeline' as const,
          pipelineType: (actionToType[rawAction] || 'LIST_SCHEDULES') as 'LIST_SCHEDULES',
          schedules: (pipelineData.schedules as any[]) ?? [],
        };
        const composed = compose('pipeline', pipelineResult);
        composed.provenance.executionTrace = executionTrace;
        composed.headline.text = result.text?.split('\n')[0].slice(0, 200) || 'Pipeline';
        composed.skipSelfReview = true;
        envelopes.push(composed);
        builtStructured = true;
        continue;
      }

      // ── Export result ────────────────────────────────────────────────────
      if (tool === 'export_data') {
        let exportData: Record<string, unknown> = {};
        try {
          if (event.detail) exportData = JSON.parse(event.detail);
        } catch { /* non-fatal */ }

        const dataLoadingResult = {
          skill: 'data-loading' as const,
          operationType: (exportData.format === 'sheets' ? 'EXPORT_SHEETS' : 'EXPORT_CSV') as 'EXPORT_CSV',
          message: result.text || '',
          csvContent: exportData.csv_content as string | undefined,
          sheetsUrl: exportData.sheets_url as string | undefined,
          rowCount: exportData.row_count as number | undefined,
          columnCount: exportData.column_count as number | undefined,
        };
        const composed = compose('data-loading', dataLoadingResult);
        composed.provenance.executionTrace = executionTrace;
        composed.headline.text = result.text?.split('\n')[0].slice(0, 200) || 'Export complete';
        composed.skipSelfReview = true;
        envelopes.push(composed);
        builtStructured = true;
        continue;
      }

      // ── Query result ────────────────────────────────────────────────────
      if (tool === 'run_query') {
        // Skip query cards when the agent explicitly formatted output via
        // present_result -- the query was a data-gathering step, not the
        // final presentation.
        if (hasPresentResult) {
          continue;
        }
        let resultData: { columns?: string[]; rows?: unknown[][]; column_types?: string[]; sql?: string } | null = null;
        let querySql = typeof event.tool_args?.sql === 'string' ? event.tool_args.sql : '';
        try {
          const rid = event.result_id
            ?? (event.detail ? JSON.parse(event.detail).result_id : undefined);
          if (rid) {
            const cached = await resultCache.get(rid);
            if (cached) {
              if (!querySql && cached.sql) querySql = cached.sql;
              resultData = {
                columns: cached.schema.map(s => s.name),
                column_types: cached.schema.map(s => s.type),
                rows: cached.rows,
                sql: cached.sql,
              };
            }
          }
        } catch { /* non-fatal */ }

        if (resultData?.columns && resultData?.rows) {
          const meta = extractIntentMeta(result.events, 'run_query');
          const vizHint = (meta.vizHint || 'TABLE') as VisualizationType;
          const finalSql = querySql || resultData.sql || '';

          const queryResult = {
            skill: 'query' as const,
            sql: finalSql,
            requiresConfirmation: false,
            costConfirm: null,
            columns: resultData.columns,
            columnTypes: resultData.column_types ?? [],
            rows: resultData.rows,
            rowCount: resultData.rows.length,
            totalBytesProcessed: result.totalBytesBilled,
            costTier: 0 as const,
            suggestedVisualization: vizHint,
            resultSummary: result.text || '',
          };
          const composed = compose('query', queryResult);
          composed.provenance.executionTrace = executionTrace;
          if (finalSql) {
            composed.provenance.sql = finalSql;
          }
          composed.headline.text = meta.resultTitle || result.text?.split('\n')[0].slice(0, 200) || 'Query results';
          composed.skipSelfReview = true;
          if (meta.followUps?.length) {
            composed.nextActions = [...composed.nextActions, ...buildFollowUpChips(meta.followUps)];
          }
          envelopes.push(composed);
          builtStructured = true;
        }
        continue;
      }

      // ── Schema / list_resources result ───────────────────────────────────
      if (tool === 'get_schema' || tool === 'list_resources') {
        // Skip schema cards when a primary action (query, DML, pipeline, export, present_result)
        // was executed. Schema fetches are preparatory context-gathering steps for queries/mutations.
        // Only build a SCHEMA_VIEW when schema inspection was the terminal action.
        if (hasPrimaryAction) {
          continue;
        }

        const args = event.tool_args ?? {};
        const dataset = (args.dataset as string) || '';
        const table = (args.table as string) || '';
        const scope = tool === 'list_resources' ? (args.scope as string) || 'datasets' : '';

        // Determine this event's specificity level
        let level: 'table' | 'dataset' | 'project';
        if (table) {
          level = 'table';
        } else if (dataset || scope === 'tables') {
          level = 'dataset';
        } else {
          level = 'project';
        }

        // Skip if a more specific call exists for the same dataset
        const key = dataset || '__project__';
        const mostSpecific = schemaSpecificity.get(key);
        const rank = { project: 0, dataset: 1, table: 2 };
        if (mostSpecific && rank[level] < rank[mostSpecific]) {
          continue; // Skip this preparatory call
        }

        // Deduplicate: don't render the same scope twice
        const scopeKey = `${dataset}:${table}:${scope}`;
        if (renderedSchemaScopes.has(scopeKey)) continue;
        renderedSchemaScopes.add(scopeKey);

        try {
          const schemaResult = await fetchSchema(
            dataset || undefined,
            table || undefined,
            project,
          );
          const composed = compose('schema', schemaResult);
          composed.provenance.executionTrace = executionTrace;
          if (table && dataset) {
            composed.headline.text = `Schema: ${dataset}.${table}`;
          } else if (dataset) {
            composed.headline.text = `Tables in ${dataset}`;
          } else {
            composed.headline.text = `Datasets in ${project}`;
          }
          composed.skipSelfReview = true;
          envelopes.push(composed);
          builtStructured = true;
        } catch {
          // Non-fatal -- skip this schema card
        }
        continue;
      }

      // ── present_result ──────────────────────────────────────────────────
      if (tool === 'present_result') {
        const pArgs = event.tool_args ?? {};
        const presentationData = {
          format: (pArgs.format as string) || 'info',
          title: pArgs.title as string | undefined,
          text: pArgs.text as string | undefined,
          items: (pArgs.items as Array<Record<string, unknown>>) || [],
        };
        const meta = extractIntentMeta(result.events, 'present_result');
        const presentHeadline = presentationData.title || meta.resultTitle || 'Results';

        envelopes.push({
          id: 'agent_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          skill: 'conversation' as SkillName,
          headline: { text: presentHeadline, tone: 'NEUTRAL', basis: 'STATUS' },
          primaryArtifact: { type: 'PRESENTATION', data: presentationData },
          provenance: { visibility: 'COLLAPSED', executionTrace },
          skipSelfReview: true,
          nextActions: meta.followUps?.length ? buildFollowUpChips(meta.followUps) : [],
        });
        builtStructured = true;
        continue;
      }

      // ── plan_analysis: skip (handled above) ─────────────────────────────
      // plan_analysis events are handled in the ambiguity check before this loop.
    }

    // If no structured envelopes were built, fall back to text
    if (!builtStructured && result.text) {
      envelopes.push(buildTextEnvelope(result.text, executionTrace));
    }
  } else if (result.interrupted) {
    envelopes.push(buildTextEnvelope(
      'The request was interrupted. Work completed up to the interruption point is preserved.',
      executionTrace
    ));
  }

  // Log the final envelope decision
  console.log(`[Agent] Envelope: ${envelopes.map(e => `${e.primaryArtifact.type} (skill=${e.skill})`).join(', ') || 'none'}`);

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

/** Convert raw step events into a human-readable execution trace. */
function buildExecutionTrace(events: ReadonlyArray<{ kind: string; status: string; label: string; tool_name?: string; tool_args?: Record<string, unknown>; t_start: number; t_end?: number; detail?: string }>): ExecutionTraceEntry[] {
  const trace: ExecutionTraceEntry[] = [];
  let stepNum = 0;
  for (const event of events) {
    // Only include tool events and thinking events, skip internal/final
    if (event.kind === 'tool_start' || event.kind === 'tool_result') {
      // tool_start and tool_result share the same event ID after update(),
      // so we only track tool_result (the completed state)
      if (event.kind === 'tool_result') {
        stepNum++;
        const duration = event.t_end ? event.t_end - event.t_start : undefined;
        trace.push({
          step: stepNum,
          action: event.label,
          tool: event.tool_name,
          durationMs: duration,
          status: event.status as 'ok' | 'error' | 'retrying',
          error: event.status === 'error' ? event.detail?.slice(0, 200) : undefined,
        });
      }
    }
  }
  return trace;
}

function buildTextEnvelope(text: string, trace?: ExecutionTraceEntry[]): CompositionEnvelope {
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
    provenance: { visibility: 'COLLAPSED', executionTrace: trace },
    skipSelfReview: true,
    nextActions: [],
  };
}
