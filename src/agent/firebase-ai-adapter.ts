// src/agent/firebase-ai-adapter.ts
// ModelAdapter implementation using Firebase AI Logic SDK.
// Wraps the existing getGenerativeModel + generateContent pattern
// from gemini-client.ts into the adapter interface.

import { getAI, getGenerativeModel, GoogleAIBackend, FunctionCallingMode } from 'firebase/ai';
import { app } from '../lib/firebase';
import type { ModelAdapter, LoopContext, ToolDef, AdapterResponse, ToolCall } from './model-adapter';

// ── Firebase AI singleton ─────────────────────────────────────────────────────

let _ai: ReturnType<typeof getAI> | null = null;
function getFirebaseAI() {
  if (!_ai) _ai = getAI(app, { backend: new GoogleAIBackend() });
  return _ai;
}

// ── Adapter implementation ────────────────────────────────────────────────────

export class FirebaseAiLogicAdapter implements ModelAdapter {
  readonly name: string;

  constructor(modelName: string = 'gemini-3.5-flash') {
    this.name = modelName;
  }

  async call(ctx: LoopContext, tools: ToolDef[]): Promise<AdapterResponse> {
    const model = getGenerativeModel(getFirebaseAI(), {
      model: this.name,
      systemInstruction: ctx.systemPrompt,
      tools: tools.length > 0
        ? [{ functionDeclarations: tools }] as any
        : undefined,
      toolConfig: tools.length > 0
        ? { functionCallingConfig: { mode: FunctionCallingMode.AUTO } }
        : undefined,
      generationConfig: { temperature: 0.1 },
    });

    const result = await model.generateContent({ contents: ctx.contents } as any);
    const response = result.response;

    // Check for function calls
    const functionCalls = response.functionCalls();
    if (!functionCalls || functionCalls.length === 0) {
      // Final text response
      return {
        kind: 'final',
        text: response.text() || '',
      };
    }

    // Build tool calls array
    const calls: ToolCall[] = functionCalls.map(fc => ({
      name: fc.name,
      args: (fc.args ?? {}) as Record<string, unknown>,
    }));

    // Generate a human-readable status label from the first tool call
    const statusLabel = generateStatusLabel(calls[0]);

    return {
      kind: 'tool_calls',
      calls,
      statusLabel,
    };
  }
}

// ── Adapter for raw contents extraction ───────────────────────────────────────

/**
 * Extract the raw `parts` from a model response for appending to the
 * conversation contents array. This is needed because the Firebase SDK
 * response object has the parts nested in candidates.
 */
export function extractModelParts(response: any): Record<string, unknown>[] | null {
  const candidate = response?.candidates?.[0];
  return candidate?.content?.parts ?? null;
}

// ── Status label generation ───────────────────────────────────────────────────

function generateStatusLabel(call: ToolCall): string {
  const { name, args } = call;

  if (name === 'run_query') {
    const sql = typeof args.sql === 'string' ? args.sql : '';
    const tableMatch = sql.match(/FROM\s+`?[\w.-]+\.[\w.-]+\.(\w+)`?/i);
    return tableMatch ? `Querying ${tableMatch[1]}...` : 'Running your query...';
  }

  if (name === 'get_schema') {
    const table = typeof args.table === 'string' ? args.table : '';
    const dataset = typeof args.dataset === 'string' ? args.dataset : '';
    if (table) return `Checking the structure of ${table}...`;
    if (dataset) return `Looking up tables in ${dataset}...`;
    return 'Looking up available datasets...';
  }

  if (name === 'list_resources') {
    const scope = typeof args.scope === 'string' ? args.scope : '';
    if (scope === 'datasets') return 'Looking up available datasets...';
    if (scope === 'tables') return `Looking up tables...`;
    return 'Looking up resources...';
  }

  const LABELS: Record<string, string> = {
    ask_user: 'Asking for clarification...',
    execute_dml: 'Running the operation...',
    create_dataset: 'Creating the dataset...',
  };

  return LABELS[name] ?? `Running ${name.replace(/_/g, ' ')}...`;
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Create a ModelAdapter for the specified model.
 * Defaults to gemini-3.5-flash per project policy.
 */
export function createAdapter(modelName: string = 'gemini-3.5-flash'): ModelAdapter {
  return new FirebaseAiLogicAdapter(modelName);
}
