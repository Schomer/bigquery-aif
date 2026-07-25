// src/agent/tools/types.ts
// Shared types for the Phase 0+ tool belt.

// ── Tool definition ───────────────────────────────────────────────────────────

export interface ToolDef {
  /** Gemini function declaration. */
  declaration: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, unknown>;
      required: string[];
    };
  };
  /** Execute the tool. Returns the result to feed back to the model. */
  execute: (
    args: Record<string, unknown>,
    project: string,
  ) => Promise<ToolResult>;
  /** Action class tier for confirmation gating. */
  tier: 'read' | 'reversible' | 'destructive';
}

// ── Tool call (from model) ────────────────────────────────────────────────────

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

// ── Tool result (from execution) ──────────────────────────────────────────────

export interface ToolResult {
  /** The data to feed back to the model as a function response. */
  data: unknown;
  /** Unique ID for caching full results in IndexedDB. */
  result_id?: string;
  /** Bytes billed by BigQuery, if applicable. */
  bytes_billed?: number;
  /** Error message if the tool failed. */
  error?: string;
}
