// src/agent/trace-recorder.ts
// Records full traces of tool-calling loops for evaluation and debugging.
// Used by eval/run.mjs against the current app and by the Phase 0 loop.

import type { StepEvent } from './step-events';

// ── Trace types ───────────────────────────────────────────────────────────────

export interface ToolCallTrace {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
  error?: string;
  t_start: number;
  t_end: number;
  duration_ms: number;
}

export interface TurnTrace {
  turn_id: string;
  prompt: string;
  tool_calls: ToolCallTrace[];
  events: StepEvent[];
  final_text: string;
  t_start: number;
  t_end: number;
  duration_ms: number;
  iteration_count: number;
  token_counts?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export interface TraceRecord {
  case_id: string;
  timestamp: string;
  model: string;
  turns: TurnTrace[];
  total_duration_ms: number;
  total_tool_calls: number;
}

// ── TraceRecorder ─────────────────────────────────────────────────────────────

/**
 * Accumulates trace data for a single golden-set case run.
 * Attaches to a StepEventEmitter and records all events + tool call details.
 */
export class TraceRecorder {
  readonly caseId: string;
  readonly model: string;
  private turns: TurnTrace[] = [];
  private currentTurn: TurnTrace | null = null;
  private currentToolStart: { name: string; args: Record<string, unknown>; t_start: number } | null = null;
  private recordStart: number;

  constructor(caseId: string, model: string) {
    this.caseId = caseId;
    this.model = model;
    this.recordStart = Date.now();
  }

  /** Start recording a new turn. */
  startTurn(turnId: string, prompt: string): void {
    if (this.currentTurn) {
      this.endTurn('');
    }
    this.currentTurn = {
      turn_id: turnId,
      prompt,
      tool_calls: [],
      events: [],
      final_text: '',
      t_start: Date.now(),
      t_end: 0,
      duration_ms: 0,
      iteration_count: 0,
    };
  }

  /** Record a StepEvent. */
  recordEvent(event: StepEvent): void {
    if (!this.currentTurn) return;
    this.currentTurn.events.push({ ...event });

    if (event.kind === 'tool_start' && event.tool_name) {
      this.currentToolStart = {
        name: event.tool_name,
        args: event.tool_args ?? {},
        t_start: event.t_start,
      };
    }

    if (event.kind === 'tool_result' && this.currentToolStart) {
      const t_end = event.t_end ?? Date.now();
      this.currentTurn.tool_calls.push({
        name: this.currentToolStart.name,
        args: this.currentToolStart.args,
        result: event.detail ?? null,
        error: event.status === 'error' ? event.detail : undefined,
        t_start: this.currentToolStart.t_start,
        t_end,
        duration_ms: t_end - this.currentToolStart.t_start,
      });
      this.currentToolStart = null;
    }
  }

  /** Record a tool call directly (when not using StepEvent stream). */
  recordToolCall(
    name: string,
    args: Record<string, unknown>,
    result: unknown,
    error: string | undefined,
    t_start: number,
    t_end: number,
  ): void {
    if (!this.currentTurn) return;
    this.currentTurn.tool_calls.push({
      name,
      args,
      result,
      error,
      t_start,
      t_end,
      duration_ms: t_end - t_start,
    });
  }

  /** End the current turn with the final text response. */
  endTurn(finalText: string): void {
    if (!this.currentTurn) return;
    this.currentTurn.final_text = finalText;
    this.currentTurn.t_end = Date.now();
    this.currentTurn.duration_ms = this.currentTurn.t_end - this.currentTurn.t_start;
    this.currentTurn.iteration_count = this.currentTurn.tool_calls.length;
    this.turns.push(this.currentTurn);
    this.currentTurn = null;
  }

  /** Finalize and return the complete trace record. */
  finalize(): TraceRecord {
    // Close any open turn
    if (this.currentTurn) {
      this.endTurn(this.currentTurn.final_text);
    }

    const totalDuration = Date.now() - this.recordStart;
    const totalToolCalls = this.turns.reduce((sum, t) => sum + t.tool_calls.length, 0);

    return {
      case_id: this.caseId,
      timestamp: new Date().toISOString(),
      model: this.model,
      turns: this.turns,
      total_duration_ms: totalDuration,
      total_tool_calls: totalToolCalls,
    };
  }

  /** Get tool call names in order (for assertion checking). */
  getToolSequence(): string[] {
    return this.turns.flatMap(t => t.tool_calls.map(tc => tc.name));
  }

  /** Check if any tool call had an error followed by a retry. */
  getRetryCount(toolName?: string): number {
    let retries = 0;
    for (const turn of this.turns) {
      for (let i = 1; i < turn.tool_calls.length; i++) {
        const prev = turn.tool_calls[i - 1];
        const curr = turn.tool_calls[i];
        if (prev.error && curr.name === prev.name) {
          if (!toolName || curr.name === toolName) {
            retries++;
          }
        }
      }
    }
    return retries;
  }

  /** Get total wall-clock duration in ms. */
  getTotalDuration(): number {
    return Date.now() - this.recordStart;
  }
}
