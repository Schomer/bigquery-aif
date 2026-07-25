// src/agent/model-adapter.ts
// Abstraction layer for LLM calls. The loop is model-agnostic;
// swapping models means swapping adapters.

import type { StepEvent } from './step-events';

// ── Tool types used by the adapter ────────────────────────────────────────────

export interface ToolDef {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, unknown>;
    required: string[];
  };
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

// ── Loop context passed to every adapter call ─────────────────────────────────

export interface LoopContext {
  systemPrompt: string;
  contents: Array<Record<string, unknown>>;
  turnId: string;
}

// ── Adapter response discriminated union ──────────────────────────────────────

export type AdapterResponse =
  | { kind: 'tool_calls'; calls: ToolCall[]; statusLabel: string; rawModelParts?: Array<Record<string, unknown>> }
  | { kind: 'final'; text: string };

// ── The adapter interface ─────────────────────────────────────────────────────

export interface ModelAdapter {
  /**
   * Send the current context + tool definitions to the model.
   * Returns either tool calls to execute or a final text response.
   */
  call(ctx: LoopContext, tools: ToolDef[]): Promise<AdapterResponse>;

  /** Model identifier (e.g. 'gemini-3.5-flash', 'gemini-3.5-pro') */
  name: string;
}
