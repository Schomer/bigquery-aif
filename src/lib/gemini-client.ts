// src/lib/gemini-client.ts
// Gemini API client using Firebase AI Logic SDK.
// Calls Gemini through Firebase's infrastructure -- no custom proxy needed.

import { getAI, getGenerativeModel, GoogleAIBackend, FunctionCallingMode } from 'firebase/ai';
import { app } from './firebase';
import type { StatusCallback } from './types';
import type { ModelAdapter } from '../agent/model-adapter';
import { createAdapter } from '../agent/firebase-ai-adapter';

// Lazy singleton adapter for the old pipeline (callGeminiWithTools without explicit adapter).
// Uses the same raw-REST adapter to preserve thoughtSignature on functionCall parts.
let _defaultAdapter: ModelAdapter | null = null;
function createAdapterForLoop(): ModelAdapter {
  if (!_defaultAdapter) _defaultAdapter = createAdapter();
  return _defaultAdapter;
}

// ── Firebase AI Logic initialization ──────────────────────────────────────────

let _ai: ReturnType<typeof getAI> | null = null;
function getFirebaseAI() {
  if (!_ai) _ai = getAI(app, { backend: new GoogleAIBackend() });
  return _ai;
}

const GEMINI_MODEL = 'gemini-3.5-flash';

// ─── System instructions ──────────────────────────────────────────────────────

export const DATA_ASSISTANT_INSTRUCTIONS = `You are a data assistant for BigQuery. When a user asks you to do something with their data, your job is to actually do it — not explain how to do it, not ask clarifying questions unless something is genuinely ambiguous, just do it.
Every request should follow this pattern:

Figure out what the user wants. Even if it's phrased casually or incompletely, make your best interpretation and act on it. If you truly can't proceed without more information, ask one specific question — not a list of questions.
Do the work. Run whatever queries, checks, or operations are needed. If it takes multiple steps, run them in order. Don't stop between steps to ask permission unless a step would permanently change or delete data.
For any step that will permanently change or delete data, pause and show the user exactly what you're about to do and how many rows or objects will be affected. Wait for them to confirm before proceeding.
Report what happened. When you're done, tell the user what you did and what you found — a result table, a chart, a number, a confirmation. If something went wrong, say what and why. If something interesting showed up in the data along the way, mention it briefly.

Keep your responses short and direct. Lead with the result, not with a description of what you're doing. If a task takes multiple steps, you can note the steps briefly, but the result is what matters.

CRITICAL SQL RULE:
Always wrap fully qualified table references in literal backticks: \`project.dataset.tablename\` (e.g., \`my-project.dataset.orders\`). This is CRITICAL to prevent syntax errors in BigQuery when project names or dataset names contain dashes/hyphens.`;

// ─── Load skill docs from public assets (cached in memory) ───────────────────

export const _skillDocCache = new Map<string, string>();

export async function loadSkillDoc(skillName: string): Promise<string> {
  const cached = _skillDocCache.get(skillName);
  if (cached) return cached;
  try {
    // Server-side: read from filesystem; client-side: use fetch
    let text: string;
    if (typeof window === 'undefined') {
      const { readFileSync } = await import('fs');
      const { join } = await import('path');
      text = readFileSync(join(process.cwd(), 'public', 'skills', `${skillName}.md`), 'utf-8');
    } else {
      const res = await fetch(`/skills/${skillName}.md`);
      if (!res.ok) throw new Error();
      text = await res.text();
    }
    _skillDocCache.set(skillName, text);
    return text;
  } catch (err) {
    console.warn(`[gemini-client] Failed to load skill doc "${skillName}":`, err instanceof Error ? err.message : err);
    const fallback = `You are the ${skillName} skill. Help the user with their data request.`;
    _skillDocCache.set(skillName, fallback);
    return fallback;
  }
}

// ─── Gemini API call with retry logic ─────────────────────────────────────────

export interface CallGeminiArgs {
  systemInstruction?: string;
  prompt?: string;
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  schema: any;
  project?: string;
}

export async function callGemini({
  systemInstruction,
  prompt,
  messages,
  schema,
}: CallGeminiArgs): Promise<any> {
  const finalSystemInstruction = systemInstruction
    ? `${DATA_ASSISTANT_INSTRUCTIONS}\n\n${systemInstruction}`
    : DATA_ASSISTANT_INSTRUCTIONS;

  const model = getGenerativeModel(getFirebaseAI(), {
    model: GEMINI_MODEL,
    systemInstruction: finalSystemInstruction,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: schema,
      temperature: 0.1,
    } as any,
  });

  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  if (messages) {
    for (const m of messages) {
      contents.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      });
    }
  }
  if (prompt) {
    contents.push({
      role: 'user',
      parts: [{ text: prompt }],
    });
  }

  const maxRetries = 3;
  let delay = 1000;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await model.generateContent({ contents } as any);
      const text = result.response.text();
      return JSON.parse(text);
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      const isTransient =
        errorMsg.toLowerCase().includes('demand') ||
        errorMsg.toLowerCase().includes('temporary') ||
        errorMsg.toLowerCase().includes('limit') ||
        errorMsg.toLowerCase().includes('quota') ||
        errorMsg.toLowerCase().includes('resource') ||
        errorMsg.toLowerCase().includes('429') ||
        errorMsg.toLowerCase().includes('500') ||
        errorMsg.toLowerCase().includes('503') ||
        errorMsg.toLowerCase().includes('overloaded') ||
        errorMsg.toLowerCase().includes('fetch') ||
        errorMsg.toLowerCase().includes('network');

      if (isTransient && attempt < maxRetries - 1) {
        const jitter = Math.random() * delay * 0.3;
        await new Promise((resolve) => setTimeout(resolve, delay + jitter));
        delay *= 2;
        continue;
      }
      throw err;
    }
  }
  throw new Error('Gemini API overloaded: The model could not be reached after multiple retries.');
}

// ─── Typed structured output wrapper ──────────────────────────────────────────

/**
 * Typed wrapper around callGemini for structured output.
 * Accepts an OpenAPI-style JSON schema (same format the other schemas in this
 * file use) and returns a typed result. Replaces the need for generateObject
 * from the ai SDK.
 */
export async function callGeminiWithSchema<T>(args: CallGeminiArgs): Promise<T> {
  const result = await callGemini(args);
  return result as T;
}

// ─── Tool-calling agent loop ──────────────────────────────────────────────────

export interface ToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
}

export interface ToolCallResult {
  /** The LLM's final text response after all tool calls are complete. */
  textResponse: string;
  /** Ordered log of every tool call made during the loop. */
  toolCalls: ToolCallRecord[];
}

export interface CallGeminiWithToolsArgs {
  systemInstruction: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Gemini function declarations (the schema half of each tool). */
  toolDeclarations: Array<{ name: string; description: string; parameters: unknown }>;
  /** Executes a named tool and returns the result for the LLM. */
  toolExecutor: (name: string, args: Record<string, unknown>, onStatus?: StatusCallback) => Promise<unknown>;
  project?: string;
  onStatus?: StatusCallback;
  /** Safety cap on loop iterations (default 8). */
  maxIterations?: number;
  /**
   * When set, the loop exits immediately after any of the named tools executes
   * successfully (no error thrown). The tool result is still fed back to the
   * LLM as a functionResponse, but then we break -- the LLM does not get
   * another round to call more tools.
   *
   * Use this in the query handler to guarantee we stop after run_query, not
   * after the LLM optionally decides to stop.
   */
  terminateAfter?: string[];
  /**
   * Optional ModelAdapter. When provided, the adapter handles the model call
   * instead of the direct Firebase AI SDK. All loop mechanics (dedup cache,
   * terminateAfter, contents accumulation) remain here.
   * Used to prove the adapter interface in production (Phase -1).
   */
  adapter?: ModelAdapter;
}

/**
 * Runs a Gemini function-calling loop:
 *   1. Send the conversation + tool declarations to Gemini.
 *   2. If the response contains functionCall parts, execute them and feed
 *      the results back as functionResponse messages.
 *   3. Repeat until the LLM returns a text response (no more tool calls)
 *      or the iteration cap is reached.
 */
export async function callGeminiWithTools({
  systemInstruction,
  messages,
  toolDeclarations,
  toolExecutor,
  onStatus,
  maxIterations = 8,
  terminateAfter,
  adapter,
}: CallGeminiWithToolsArgs): Promise<ToolCallResult> {
  const finalSystemInstruction = `${DATA_ASSISTANT_INSTRUCTIONS}\n\n${systemInstruction}`;

  // Always use the adapter for model calls. The adapter uses raw REST which
  // preserves thoughtSignature on functionCall parts. The Firebase AI Logic SDK
  // strips these during deserialization, causing API rejections on subsequent calls.
  const effectiveAdapter = adapter ?? createAdapterForLoop();

  // Build initial contents from conversation history
  const contents: Array<Record<string, unknown>> = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const allToolCalls: ToolCallRecord[] = [];
  const callCache = new Map<string, unknown>();

  for (let i = 0; i < maxIterations; i++) {
    let functionCalls: Array<{ name: string; args?: Record<string, unknown> }> | null = null;

    // Use the adapter for the model call
    const adapterCtx = {
      systemPrompt: finalSystemInstruction,
      contents,
      turnId: `turn_${i}`,
    };
    const adapterTools = toolDeclarations.map(td => ({
      name: td.name,
      description: td.description,
      parameters: td.parameters as { type: string; properties: Record<string, unknown>; required: string[] },
    }));
    const adapterResult = await effectiveAdapter.call(adapterCtx, adapterTools);
    if (adapterResult.kind === 'final') {
      return { textResponse: adapterResult.text, toolCalls: allToolCalls };
    }
    // Convert adapter tool_calls to the format expected below
    functionCalls = adapterResult.calls;
    // Append model's function-call turn to contents.
    // Use raw parts from the adapter (preserves thoughtSignature).
    if (adapterResult.rawModelParts) {
      contents.push({ role: 'model', parts: adapterResult.rawModelParts });
    } else {
      contents.push({
        role: 'model',
        parts: functionCalls.map(fc => ({
          functionCall: { name: fc.name, args: fc.args ?? {} },
        })),
      });
    }


    // Execute each requested function call and collect responses
    // Build a context-aware status message from tool name + arguments
    function getToolStatus(name: string, args: Record<string, unknown>): string {
      if (name === 'run_query') {
        const sql = typeof args.sql === 'string' ? args.sql : '';
        const tableMatch = sql.match(/FROM\s+`?[\w.-]+\.[\w.-]+\.(\w+)`?/i);
        return tableMatch ? `Querying ${tableMatch[1]}...` : 'Running your query...';
      }
      if (name === 'get_table_schema') {
        const table = typeof args.table === 'string' ? args.table : '';
        return table ? `Checking the structure of ${table}...` : 'Looking up the table schema...';
      }
      if (name === 'list_tables') {
        const dataset = typeof args.dataset === 'string' ? args.dataset : '';
        return dataset ? `Looking up tables in ${dataset}...` : 'Looking up available tables...';
      }
      const TOOL_LABELS: Record<string, string> = {
        list_datasets: 'Looking up available datasets...',
        get_job_status: 'Checking job status...',
        create_table: 'Creating the table...',
        insert_rows: 'Inserting rows...',
        delete_rows: 'Deleting rows...',
        update_rows: 'Updating rows...',
        create_dataset: 'Creating the dataset...',
        execute_dml: 'Running the operation...',
      };
      return TOOL_LABELS[name] ?? `Running ${name}...`;
    }
    const responseParts: Array<Record<string, unknown>> = [];
    for (const fc of functionCalls) {
      const name = fc.name;
      const args = (fc.args ?? {}) as Record<string, unknown>;
      try {
        // Deduplication: skip re-execution of identical tool calls
        const callKey = `${name}:${JSON.stringify(args ?? {})}`;
        const cached = callCache.get(callKey);
        if (cached !== undefined) {
          allToolCalls.push({ name, args: args ?? {}, result: cached });
          responseParts.push({ functionResponse: { name, response: { result: cached } } });
          continue;
        }
        // Emit status only for non-cached calls
        onStatus?.(getToolStatus(name, args));
        const execResult = await toolExecutor(name, args ?? {}, onStatus);
        callCache.set(callKey, execResult);
        allToolCalls.push({ name, args: args ?? {}, result: execResult });
        responseParts.push({ functionResponse: { name, response: { result: execResult } } });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        allToolCalls.push({ name, args: args ?? {}, result: { error: errMsg } });
        responseParts.push({ functionResponse: { name, response: { error: errMsg } } });
      }
    }

    // Feed function results back as the next user turn
    contents.push({ role: 'user', parts: responseParts });

    // If a terminateAfter tool succeeded this round, break before the LLM
    // gets another chance to call more tools.
    if (terminateAfter && terminateAfter.length > 0) {
      const successfulNames = allToolCalls
        .slice(-functionCalls.length)
        .filter((tc) => !(tc.result as Record<string, unknown>)?.error)
        .map((tc) => tc.name);
      if (successfulNames.some((n) => terminateAfter.includes(n))) {
        return { textResponse: '', toolCalls: allToolCalls };
      }
    }
  }

  // Exhausted iteration cap
  return {
    textResponse: '__MAX_ITERATIONS_REACHED__',
    toolCalls: allToolCalls,
  };
}

// ─── Gemini Response Schemas (OpenAPI 3.0 Uppercase Format) ────────────────────

export const QueryResponseSchema = {
  type: 'OBJECT',
  properties: {
    sql: { type: 'STRING' },
    suggestedVisualization: { type: 'STRING', enum: [
      'TABLE', 'KPI_CARD',
      // Recharts native
      'LINE_CHART', 'BAR_CHART', 'AREA_CHART', 'SCATTER', 'PIE_CHART',
      'DONUT_CHART', 'COLUMN_CHART', 'HISTOGRAM', 'SPARKLINE',
      'RADAR', 'FUNNEL', 'TREEMAP', 'SANKEY', 'COMPOSED_CHART',
      // Custom SVG
      'GAUGE', 'HEATMAP', 'BOXPLOT', 'CANDLESTICK',
      'VIOLIN', 'DENSITY_PLOT', 'RIDGELINE', 'NETWORK_GRAPH', 'TILE_MAP',
      // Maps
      'GEO_POINT_MAP', 'USA_MAP', 'WORLD_MAP',
    ] },
    xAxis: { type: 'STRING' },
    yAxis: { type: 'ARRAY', items: { type: 'STRING' } },
    notableFindings: { type: 'STRING' },
    resultSummary: { type: 'STRING' },
    parameters: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          type: { type: 'STRING', enum: ['string', 'number', 'date', 'table', 'dataset', 'column'] },
          default: { type: 'STRING' },
          description: { type: 'STRING' },
        },
        required: ['name', 'type', 'description'],
      },
    },
  },
  required: ['sql', 'suggestedVisualization']
};
