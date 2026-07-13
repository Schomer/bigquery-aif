// src/lib/gemini-client.ts
// Gemini API client, response schemas, and skill doc loader.
// Extracted from chat-orchestrator.ts for shared use by all skill handlers.

import { getAccessToken } from './gis-auth';
import { SKILL_NAMES } from './skills';

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
  } catch {
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
  project,
}: CallGeminiArgs): Promise<any> {
  const projectId = project || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'malloy-data';
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

  const contents = [];
  if (messages) {
    for (const m of messages) {
      contents.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      });
    }
  }
  if (prompt) {
    contents.push({
      role: 'user',
      parts: [{ text: prompt }]
    });
  }

  const finalSystemInstruction = systemInstruction
    ? `${DATA_ASSISTANT_INSTRUCTIONS}\n\n${systemInstruction}`
    : DATA_ASSISTANT_INSTRUCTIONS;

  const requestBody = {
    systemInstruction: {
      parts: [{ text: finalSystemInstruction }]
    },
    contents,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: schema,
      temperature: 0.1,
    },
  };

  const maxRetries = 3;
  let delay = 1000;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();

      if (res.status === 401 || res.status === 403) {
        throw new Error('Not authenticated. Please sign in again.');
      }

      if (res.ok && !data.error) {
        // Vertex AI wraps the response in candidates[0].content.parts[0].text
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return JSON.parse(text);
        }
        throw new Error('No content in Vertex AI response');
      }

      const errorMsg = data?.error?.message || data?.error || `HTTP ${res.status}`;

      // Check for transient errors
      const isTransient =
        res.status === 429 ||
        res.status >= 500 ||
        (typeof errorMsg === 'string' && (
          errorMsg.toLowerCase().includes('demand') ||
          errorMsg.toLowerCase().includes('temporary') ||
          errorMsg.toLowerCase().includes('limit') ||
          errorMsg.toLowerCase().includes('quota') ||
          errorMsg.toLowerCase().includes('resource')
        ));

      if (isTransient && attempt < maxRetries - 1) {
        const jitter = Math.random() * delay * 0.3;
        await new Promise((resolve) => setTimeout(resolve, delay + jitter));
        delay *= 2;
        continue;
      }

      throw new Error(`Gemini API failed: ${errorMsg}`);

    } catch (err: any) {
      if (err.message?.includes('fetch') || err.message?.includes('network') || err.message?.includes('Failed to fetch')) {
        if (attempt < maxRetries - 1) {
          const jitter = Math.random() * delay * 0.3;
          await new Promise((resolve) => setTimeout(resolve, delay + jitter));
          delay *= 2;
          continue;
        }
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
  toolExecutor: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  project?: string;
  onStatus?: (msg: string) => void;
  /** Safety cap on loop iterations (default 6). */
  maxIterations?: number;
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
  project,
  onStatus,
  maxIterations = 6,
}: CallGeminiWithToolsArgs): Promise<ToolCallResult> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

  const finalSystemInstruction = `${DATA_ASSISTANT_INSTRUCTIONS}\n\n${systemInstruction}`;

  // Build initial contents from conversation history
  const contents: Array<Record<string, unknown>> = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const allToolCalls: ToolCallRecord[] = [];

  for (let i = 0; i < maxIterations; i++) {
    const requestBody = {
      systemInstruction: { parts: [{ text: finalSystemInstruction }] },
      contents,
      tools: [{ functionDeclarations: toolDeclarations }],
      toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
      generationConfig: { temperature: 0.1 },
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const data = await res.json();

    // Handle HTTP / API errors
    if (res.status === 401 || res.status === 403) {
      throw new Error('Not authenticated. Please sign in again.');
    }
    if (!res.ok || data.error) {
      const msg = data?.error?.message || data?.error || `HTTP ${res.status}`;
      throw new Error(`Gemini API failed: ${msg}`);
    }

    const candidate = data.candidates?.[0];
    if (!candidate?.content?.parts) {
      throw new Error('No content in Gemini response');
    }

    const parts = candidate.content.parts as Array<Record<string, any>>;
    const functionCalls = parts.filter((p) => p.functionCall);

    if (functionCalls.length === 0) {
      // LLM is done calling tools -- return its text response
      const textPart = parts.find((p) => p.text);
      return { textResponse: textPart?.text || '', toolCalls: allToolCalls };
    }

    // Append the model's function-call turn to contents
    contents.push({ role: 'model', parts });

    // Execute each requested function call and collect responses
    const TOOL_LABELS: Record<string, string> = {
      run_query: 'Running your query...',
      get_table_schema: 'Looking up the table schema...',
      list_tables: 'Looking up available tables...',
      list_datasets: 'Looking up available datasets...',
      get_job_status: 'Checking job status...',
      create_table: 'Creating the table...',
      insert_rows: 'Inserting rows...',
      delete_rows: 'Deleting rows...',
      update_rows: 'Updating rows...',
      create_dataset: 'Creating the dataset...',
      execute_dml: 'Running the operation...',
    };
    const responseParts: Array<Record<string, unknown>> = [];
    for (const fc of functionCalls) {
      const { name, args } = fc.functionCall;
      onStatus?.(TOOL_LABELS[name] ?? `Running ${name}...`);
      try {
        const result = await toolExecutor(name, args ?? {});
        allToolCalls.push({ name, args: args ?? {}, result });
        responseParts.push({ functionResponse: { name, response: { result } } });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        allToolCalls.push({ name, args: args ?? {}, result: { error: errMsg } });
        responseParts.push({ functionResponse: { name, response: { error: errMsg } } });
      }
    }

    // Feed function results back as the next user turn
    contents.push({ role: 'user', parts: responseParts });
  }

  // Exhausted iteration cap
  return {
    textResponse: 'Reached maximum tool-call iterations.',
    toolCalls: allToolCalls,
  };
}

// ─── Gemini Response Schemas (OpenAPI 3.0 Uppercase Format) ────────────────────

export const SchemaResponseSchema = {
  type: 'OBJECT',
  properties: {
    scope: { type: 'STRING', enum: ['PROJECT', 'DATASET', 'TABLE'] },
    dataset: { type: 'STRING' },
    table: { type: 'STRING' }
  },
  required: ['scope']
};

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

export const SelfReviewResponseSchema = {
  type: 'OBJECT',
  properties: {
    improvedHeadline: { type: 'STRING' },
    additionalInsight: { type: 'STRING' },
    betterVisualization: { type: 'STRING', enum: [
      'TABLE', 'KPI_CARD',
      'LINE_CHART', 'BAR_CHART', 'AREA_CHART', 'SCATTER', 'PIE_CHART',
      'DONUT_CHART', 'COLUMN_CHART', 'HISTOGRAM', 'SPARKLINE',
      'RADAR', 'FUNNEL', 'TREEMAP', 'SANKEY', 'COMPOSED_CHART',
      'GAUGE', 'HEATMAP', 'BOXPLOT', 'CANDLESTICK',
      'VIOLIN', 'DENSITY_PLOT', 'RIDGELINE', 'NETWORK_GRAPH', 'TILE_MAP',
      'GEO_POINT_MAP', 'USA_MAP', 'WORLD_MAP',
    ] },
    improvedXAxis: { type: 'STRING' },
    improvedYAxis: { type: 'ARRAY', items: { type: 'STRING' } },
    highlightColumns: { type: 'ARRAY', items: { type: 'STRING' } },
    deemphasizeColumns: { type: 'ARRAY', items: { type: 'STRING' } },
    designNotes: { type: 'STRING' },
    briefingNarrative: { type: 'STRING' },
    briefingFindings: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          label: { type: 'STRING' },
          value: { type: 'STRING' },
          detail: { type: 'STRING' },
        },
        required: ['label', 'value'],
      },
    },
  },
  required: [],
};

export const DataManagementResponseSchema = {
  type: 'OBJECT',
  properties: {
    operation: { type: 'STRING', enum: ['DEDUPE', 'DELETE', 'UPDATE', 'FILL_NULLS', 'CREATE_TABLE', 'CREATE_SCHEMA', 'DROP_SCHEMA', 'DROP_TABLE', 'ALTER_TABLE', 'CREATE_VIEW', 'TRUNCATE', 'INSERT', 'RENAME', 'COPY_TABLE', 'MERGE', 'PARTITION_TABLE'] },
    executionStrategy: { type: 'STRING', enum: ['DIRECT_EXECUTE', 'PREVIEW_AND_CONFIRM', 'PREVIEW_AND_CONFIRM_DEDUPE'] },
    dataset: { type: 'STRING' },
    table: { type: 'STRING' },
    previewSql: { type: 'STRING' },
    executionSql: { type: 'STRING' },
    completionMessage: { type: 'STRING' },
    tiebreakerColumn: { type: 'STRING' },
    tiebreakerDirection: { type: 'STRING', enum: ['KEEP_LATEST', 'KEEP_EARLIEST'] }
  },
  required: ['operation', 'executionStrategy', 'dataset', 'table', 'executionSql']
};

export const DiscoveryResponseSchema = {
  type: 'OBJECT',
  properties: {
    discoveryType: { type: 'STRING', enum: ['SEARCH', 'COMPARISON', 'LINEAGE', 'ER_DIAGRAM'] },
    query: { type: 'STRING' },
    secondTable: { type: 'STRING' },
    tableName: { type: 'STRING' }
  },
  required: ['discoveryType', 'query']
};

export const DqIntentSchema = {
  type: 'OBJECT',
  properties: {
    checkType: { type: 'STRING', enum: ['PROFILE', 'NULLS', 'DUPLICATES', 'FRESHNESS', 'COMPLETENESS', 'RANGE_VALIDATION', 'REFERENTIAL_INTEGRITY', 'SCHEMA_DRIFT'] },
    table: { type: 'STRING' },
    dataset: { type: 'STRING' }
  },
  required: ['checkType']
};

export const MonitoringIntentSchema = {
  type: 'OBJECT',
  properties: {
    monitoringType: { type: 'STRING', enum: ['JOBS', 'STORAGE', 'SLOTS', 'QUERY_PLAN', 'ALERT', 'STORAGE_BREAKDOWN', 'ACCESS_PATTERNS', 'COST_ANALYSIS', 'FRESHNESS'] },
    jobId: { type: 'STRING' },
    table: { type: 'STRING' },
    dataset: { type: 'STRING' }
  },
  required: ['monitoringType']
};

export const DataLoadingIntentSchema = {
  type: 'OBJECT',
  properties: {
    operationType: { type: 'STRING', enum: ['EXPORT_CSV', 'EXPORT_SHEETS', 'SCHEDULE', 'SAVED_QUERY', 'SHARE'] },
    tableName: { type: 'STRING' },
    dataset: { type: 'STRING' },
    sql: { type: 'STRING' },
    displayName: { type: 'STRING' },
    schedule: { type: 'STRING' },
  },
  required: ['operationType']
};

// Built as a function to avoid circular import timing issues
// (gemini-client -> skills/index -> handle-*.ts -> gemini-client)
let _intentClassifierSchema: ReturnType<typeof buildIntentClassifierSchema> | null = null;

function buildIntentClassifierSchema() {
  return {
    type: 'OBJECT' as const,
    properties: {
      isMultistep: { type: 'BOOLEAN' as const },
      skill: { type: 'STRING' as const, enum: SKILL_NAMES },
      steps: {
        type: 'ARRAY' as const,
        items: {
          type: 'OBJECT' as const,
          properties: {
            skill: { type: 'STRING' as const, enum: SKILL_NAMES },
            description: { type: 'STRING' as const },
            prompt: { type: 'STRING' as const }
          },
          required: ['skill', 'description', 'prompt']
        }
      }
    },
    required: ['isMultistep', 'skill']
  };
}

export const IntentClassifierSchema = new Proxy({} as ReturnType<typeof buildIntentClassifierSchema>, {
  get(_target, prop) {
    if (!_intentClassifierSchema) _intentClassifierSchema = buildIntentClassifierSchema();
    return (_intentClassifierSchema as any)[prop];
  },
});

export const EnrichedSchemaQuerySchema = {
  type: 'OBJECT',
  properties: {
    sql: { type: 'STRING' },
    resultSummary: { type: 'STRING' },
  },
  required: ['sql', 'resultSummary']
};

export const ConversationResponseSchema = {
  type: 'OBJECT',
  properties: {
    response: {
      type: 'STRING',
      description: 'Your conversational response to the user.',
    },
    suggestedActions: {
      type: 'ARRAY',
      description: 'Optional next-step chips. Only include when the conversation naturally leads to a concrete action.',
      items: {
        type: 'OBJECT',
        properties: {
          label: { type: 'STRING', description: 'Short chip label phrased as a user action (e.g., "Show me my datasets")' },
          skill: { type: 'STRING', description: 'Target skill if known (schema, query, data-management, data-quality, monitoring, discovery, data-loading, pipeline, governance)' },
        },
        required: ['label'],
      },
    },
  },
  required: ['response'],
};
