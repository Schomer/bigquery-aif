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
import type { ToolDef } from './tools/types';
import type { StatusCallback, CompositionEnvelope, SkillName, ChatMessage } from '../lib/types';
import { compose } from '../lib/composer';
import { resultCache } from './result-cache';

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
    // Check if we have any cached query results to display
    const queryEvents = result.events.filter(
      e => e.kind === 'tool_result' && e.tool_name === 'run_query' && e.status === 'ok'
    );

    if (queryEvents.length > 0) {
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
          suggestedVisualization: 'TABLE' as const,
          resultSummary: result.text,
        };
        const composed = compose('query', queryResult);
        composed.headline.text = result.text.split('\n')[0].slice(0, 200);
        composed.skipSelfReview = true;
        envelopes.push(composed);
      } else {
        // Text response with data mentioned
        envelopes.push(buildTextEnvelope(result.text));
      }
    } else {
      // Pure text response
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
