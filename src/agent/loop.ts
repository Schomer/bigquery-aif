// src/agent/loop.ts
// The agent loop -- the core of the v2 architecture.
// Generalized from handle-conversation.ts's callGeminiWithTools() pattern.
//
// The loop reacts to real results. Nothing decides on the model's behalf.
// The model decides what; deterministic code decides how.

import type { ModelAdapter, ToolDef as AdapterToolDef } from './model-adapter';
import type { ToolDef, ToolResult } from './tools/types';
import type { LoopContext } from './model-adapter';
import { StepEventEmitter, type StepEvent } from './step-events';
import { classifySql, requiresConfirmation } from './action-classes';
import { summarizeForContext } from './context';
import type { StatusCallback } from '../lib/types';

// ── Loop configuration ────────────────────────────────────────────────────────

export interface LoopConfig {
  /** Soft iteration cap -- model is prompted to wrap up. Default: 15. */
  softCap?: number;
  /** Hard iteration cap -- loop exits unconditionally. Default: 25. */
  hardCap?: number;
  /** Max retries per distinct error. Default: 2. */
  maxRetries?: number;
}

// ── Loop result ───────────────────────────────────────────────────────────────

export interface LoopResult {
  /** The model's final text response. */
  text: string;
  /** Ordered log of all step events. */
  events: ReadonlyArray<StepEvent>;
  /** Whether the loop was interrupted. */
  interrupted: boolean;
  /** Whether a confirmation gate was hit. */
  confirmationNeeded: boolean;
  /** If confirmationNeeded, the SQL that requires confirmation. */
  pendingSql?: string;
  /** The action class ID of the pending confirmation. */
  pendingActionClass?: string;
  /** Number of iterations used. */
  iterations: number;
  /** Total bytes billed across all queries. */
  totalBytesBilled: number;
}

// ── Interrupt signal ──────────────────────────────────────────────────────────

export class InterruptSignal {
  private _interrupted = false;

  interrupt(): void {
    this._interrupted = true;
  }

  get isInterrupted(): boolean {
    return this._interrupted;
  }
}

// ── The loop ──────────────────────────────────────────────────────────────────

/**
 * Run the agent loop.
 *
 * Assembles context, calls the model, executes tools, and repeats
 * until the model returns a final text response or the iteration cap is hit.
 *
 * @param ctx - Pre-assembled loop context (system prompt + contents)
 * @param adapter - The model adapter to use
 * @param tools - The tool belt (Phase 0: run_query, get_schema, list_resources)
 * @param config - Loop configuration (caps, retries)
 * @param onStatus - Optional legacy status callback
 * @param interruptSignal - Optional interrupt signal
 * @returns The loop result
 */
export async function runLoop(
  ctx: LoopContext,
  adapter: ModelAdapter,
  tools: ToolDef[],
  config?: LoopConfig,
  onStatus?: StatusCallback,
  interruptSignal?: InterruptSignal,
): Promise<LoopResult> {
  const softCap = config?.softCap ?? 15;
  const hardCap = config?.hardCap ?? 25;
  const maxRetries = config?.maxRetries ?? 2;

  const emitter = new StepEventEmitter(ctx.turnId);

  // Forward events to legacy status callback
  if (onStatus) {
    emitter.on((event) => {
      if (event.kind === 'thinking' || event.kind === 'tool_start') {
        onStatus(event.label);
      }
    });
  }

  // Build adapter-compatible tool definitions
  const adapterTools: AdapterToolDef[] = tools.map(t => t.declaration);

  // Tool call deduplication cache
  const callCache = new Map<string, unknown>();

  // Error tracking for retry policy
  const errorCounts = new Map<string, number>();

  // Stall detection: track the previous tool call signature
  let prevCallSignature = '';

  let totalBytesBilled = 0;
  let confirmationNeeded = false;
  let pendingSql: string | undefined;
  let pendingActionClass: string | undefined;

  // Working contents (mutated during the loop)
  const contents = [...ctx.contents];

  for (let i = 0; i < hardCap; i++) {
    // Check for interruption
    if (interruptSignal?.isInterrupted) {
      emitter.emit({
        kind: 'stopped',
        label: `Interrupted after step ${i}`,
        status: 'ok',
        t_start: Date.now(),
      });
      return {
        text: `[Interrupted after step ${i}. Work completed up to this point is preserved.]`,
        events: emitter.getLog(),
        interrupted: true,
        confirmationNeeded: false,
        iterations: i,
        totalBytesBilled,
      };
    }

    // At soft cap, inject a nudge asking the model to wrap up
    if (i === softCap) {
      contents.push({
        role: 'user',
        parts: [{
          text: '[System: You have used many steps. Please wrap up your answer now, or ask the user for clarification if you are stuck.]',
        }],
      });
    }

    // Call the model
    emitter.emit({
      kind: 'thinking',
      label: i === 0 ? 'Thinking...' : 'Continuing...',
      status: 'running',
      t_start: Date.now(),
    });

    const loopCtx: LoopContext = {
      systemPrompt: ctx.systemPrompt,
      contents,
      turnId: ctx.turnId,
    };

    const response = await adapter.call(loopCtx, adapterTools);

    if (response.kind === 'final') {
      emitter.emit({
        kind: 'final',
        label: 'Done',
        status: 'ok',
        t_start: Date.now(),
      });
      return {
        text: response.text,
        events: emitter.getLog(),
        interrupted: false,
        confirmationNeeded: false,
        iterations: i + 1,
        totalBytesBilled,
      };
    }

    // Tool calls
    const { calls } = response;

    // Stall detection: if the model makes the same call as last time, inject a nudge
    const currentSignature = calls.map(c => `${c.name}:${JSON.stringify(c.args)}`).join('|');
    if (currentSignature === prevCallSignature && currentSignature !== '') {
      contents.push({
        role: 'user',
        parts: [{
          text: '[System: You just made the same tool call as last time. Try a different approach, check the schema, or ask the user for clarification.]',
        }],
      });
      prevCallSignature = '';
      // Don't execute the duplicate -- let the model try again
      continue;
    }
    prevCallSignature = currentSignature;

    // Append model's function-call turn to contents.
    // Use raw parts from the adapter (preserves thoughtSignature) when available,
    // fall back to synthetic reconstruction for backward compatibility.
    if (response.rawModelParts) {
      contents.push({ role: 'model', parts: response.rawModelParts });
    } else {
      contents.push({
        role: 'model',
        parts: calls.map(c => ({
          functionCall: { name: c.name, args: c.args },
        })),
      });
    }

    // Determine if any calls can run in parallel (all must be read-class)
    const allRead = calls.every(c => {
      const tool = tools.find(t => t.declaration.name === c.name);
      return tool?.tier === 'read';
    });

    // Execute tool calls
    const responseParts: Array<Record<string, unknown>> = [];

    const executeCalls = async (callList: typeof calls) => {
      for (const call of callList) {
        const tool = tools.find(t => t.declaration.name === call.name);
        if (!tool) {
          responseParts.push({
            functionResponse: {
              name: call.name,
              response: { error: `Unknown tool: ${call.name}` },
            },
          });
          continue;
        }

        // Confirmation gate check for SQL-bearing tools
        if ((call.name === 'run_query' || call.name === 'execute_dml') && typeof call.args.sql === 'string') {
          if (requiresConfirmation(call.args.sql)) {
            const actionClass = classifySql(call.args.sql);
            confirmationNeeded = true;
            pendingSql = call.args.sql;
            pendingActionClass = actionClass.id;

            emitter.emit({
              kind: 'confirmation_needed',
              label: `This operation requires confirmation: ${actionClass.id}`,
              detail: call.args.sql,
              status: 'ok',
              t_start: Date.now(),
            });

            responseParts.push({
              functionResponse: {
                name: call.name,
                response: {
                  pending_confirmation: true,
                  message: 'This operation requires user confirmation before execution.',
                  action_class: actionClass.id,
                },
              },
            });
            continue;
          }
        }

        // Deduplication check
        const cacheKey = `${call.name}:${JSON.stringify(call.args)}`;
        const cached = callCache.get(cacheKey);
        if (cached !== undefined) {
          responseParts.push({
            functionResponse: { name: call.name, response: { result: cached } },
          });
          continue;
        }

        // Execute the tool
        const startEvent = emitter.emit({
          kind: 'tool_start',
          label: response.statusLabel || `Running ${call.name}...`,
          status: 'running',
          t_start: Date.now(),
          tool_name: call.name,
          tool_args: call.args,
        });

        try {
          const result: ToolResult = await tool.execute(call.args, ctx.systemPrompt.includes('Project:')
            ? (ctx.systemPrompt.match(/Project:\s*(\S+)/)?.[1] ?? '')
            : '');

          if (result.error) {
            // Track error for retry policy
            const errorKey = `${call.name}:${result.error}`;
            const errorCount = (errorCounts.get(errorKey) ?? 0) + 1;
            errorCounts.set(errorKey, errorCount);

            emitter.update(startEvent.id, {
              kind: 'tool_result',
              status: errorCount <= maxRetries ? 'retrying' : 'error',
              t_end: Date.now(),
              detail: result.error,
            });

            responseParts.push({
              functionResponse: { name: call.name, response: { error: result.error } },
            });
          } else {
            if (result.bytes_billed) {
              totalBytesBilled += result.bytes_billed;
            }

            // Summarize large results for context
            const contextData = summarizeForContext(call.name, result.data, result.result_id);
            callCache.set(cacheKey, contextData);

            emitter.update(startEvent.id, {
              kind: 'tool_result',
              status: 'ok',
              t_end: Date.now(),
              detail: JSON.stringify(contextData).slice(0, 500),
              bytes_billed: result.bytes_billed,
              result_id: result.result_id,
            });

            responseParts.push({
              functionResponse: { name: call.name, response: { result: contextData } },
            });
          }
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);

          emitter.update(startEvent.id, {
            kind: 'tool_result',
            status: 'error',
            t_end: Date.now(),
            detail: errMsg,
          });

          responseParts.push({
            functionResponse: { name: call.name, response: { error: errMsg } },
          });
        }
      }
    };

    if (allRead && calls.length > 1) {
      // Execute read-only tools in parallel
      await Promise.all(calls.map(c => executeCalls([c])));
    } else {
      await executeCalls(calls);
    }

    // If a confirmation gate was hit, stop the loop
    if (confirmationNeeded) {
      return {
        text: '',
        events: emitter.getLog(),
        interrupted: false,
        confirmationNeeded: true,
        pendingSql,
        pendingActionClass,
        iterations: i + 1,
        totalBytesBilled,
      };
    }

    // Feed results back to the model
    contents.push({ role: 'user', parts: responseParts });
  }

  // Exhausted hard cap
  emitter.emit({
    kind: 'stopped',
    label: 'Reached maximum number of steps',
    status: 'error',
    t_start: Date.now(),
  });

  return {
    text: 'I was not able to finish -- I ran out of steps. Try breaking the request into smaller parts, or include more specific details.',
    events: emitter.getLog(),
    interrupted: false,
    confirmationNeeded: false,
    iterations: hardCap,
    totalBytesBilled,
  };
}
