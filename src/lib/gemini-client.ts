// src/lib/gemini-client.ts
// Gemini API client, response schemas, and skill doc loader.
// Extracted from chat-orchestrator.ts for shared use by all skill handlers.

import { getAccessToken } from './gis-auth';

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
    resultSummary: { type: 'STRING' }
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
  },
  required: [],
};

export const DataManagementResponseSchema = {
  type: 'OBJECT',
  properties: {
    operation: { type: 'STRING', enum: ['DEDUPE', 'DELETE', 'UPDATE', 'FILL_NULLS', 'CREATE_TABLE', 'ALTER_TABLE', 'CREATE_VIEW', 'RENAME', 'COPY_TABLE', 'MERGE', 'PARTITION_TABLE'] },
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
    sql: { type: 'STRING' },
    displayName: { type: 'STRING' },
    schedule: { type: 'STRING' },
  },
  required: ['operationType']
};

export const IntentClassifierSchema = {
  type: 'OBJECT',
  properties: {
    isMultistep: { type: 'BOOLEAN' },
    skill: { type: 'STRING', enum: ['schema', 'query', 'data-management', 'data-quality', 'discovery', 'monitoring', 'data-loading', 'task'] },
    steps: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          skill: { type: 'STRING', enum: ['schema', 'query', 'data-management', 'data-quality', 'discovery', 'monitoring', 'data-loading', 'task'] },
          description: { type: 'STRING' },
          prompt: { type: 'STRING' }
        },
        required: ['skill', 'description', 'prompt']
      }
    }
  },
  required: ['isMultistep', 'skill']
};

export const EnrichedSchemaQuerySchema = {
  type: 'OBJECT',
  properties: {
    sql: { type: 'STRING' },
    resultSummary: { type: 'STRING' },
  },
  required: ['sql', 'resultSummary']
};
