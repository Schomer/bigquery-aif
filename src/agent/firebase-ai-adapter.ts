// src/agent/firebase-ai-adapter.ts
// ModelAdapter implementation using direct REST calls to the Firebase Vertex AI endpoint.
// Uses raw fetch() instead of the Firebase AI Logic SDK to preserve thought signatures
// and other opaque fields that the SDK strips during deserialization.

import { app } from '../lib/firebase';
import type { ModelAdapter, LoopContext, ToolDef, AdapterResponse, ToolCall } from './model-adapter';

// ── REST endpoint ─────────────────────────────────────────────────────────────

function getEndpoint(): { url: string; apiKey: string } {
  const config = app.options;
  const apiKey = config.apiKey;
  const projectId = config.projectId;
  if (!apiKey || !projectId) {
    throw new Error('Firebase config missing apiKey or projectId');
  }
  return {
    url: `https://firebasevertexai.googleapis.com/v1beta/projects/${projectId}/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
    apiKey,
  };
}

// ── Adapter implementation ────────────────────────────────────────────────────

export class FirebaseAiLogicAdapter implements ModelAdapter {
  readonly name: string;

  constructor(modelName: string = 'gemini-3.5-flash') {
    this.name = modelName;
  }

  async call(ctx: LoopContext, tools: ToolDef[]): Promise<AdapterResponse> {
    const { url } = getEndpoint();

    const body: Record<string, unknown> = {
      contents: ctx.contents,
      systemInstruction: { parts: [{ text: ctx.systemPrompt }] },
      generationConfig: { temperature: 0.1 },
    };

    if (tools.length > 0) {
      body.tools = [{ functionDeclarations: tools }];
      body.toolConfig = { functionCallingConfig: { mode: 'AUTO' } };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Error fetching from ${url.replace(/key=[^&]+/, 'key=***')}: ` +
        `[${response.status}] ${errorText}`
      );
    }

    const data = await response.json();

    // Validate response structure
    const candidate = data?.candidates?.[0];
    if (!candidate?.content?.parts) {
      const blockReason = data?.promptFeedback?.blockReason;
      if (blockReason) {
        throw new Error(`Request blocked by safety filter: ${blockReason}`);
      }
      throw new Error('No valid candidate in model response');
    }

    const parts: Array<Record<string, unknown>> = candidate.content.parts;

    // Diagnostic: log thought signature presence on each part
    console.log('[adapter] Raw parts from API:', parts.map((p, idx) => ({
      idx,
      keys: Object.keys(p),
      hasThoughtSignature: 'thoughtSignature' in p,
      hasThought_signature: 'thought_signature' in p,
      hasFunctionCall: 'functionCall' in p,
      hasText: 'text' in p,
    })));

    // Extract function calls from raw parts
    const functionCallParts = parts.filter(
      (p) => p.functionCall != null
    );

    if (functionCallParts.length === 0) {
      // Final text response -- concatenate all text parts
      const textParts = parts
        .filter((p) => typeof p.text === 'string')
        .map((p) => p.text as string);
      return {
        kind: 'final',
        text: textParts.join(''),
      };
    }

    // Build tool calls array from raw parts
    const calls: ToolCall[] = functionCallParts.map((p) => {
      const fc = p.functionCall as { name: string; args?: Record<string, unknown> };
      return {
        name: fc.name,
        args: (fc.args ?? {}) as Record<string, unknown>,
      };
    });

    // Generate a human-readable status label from the first tool call
    const statusLabel = generateStatusLabel(calls[0]);

    return {
      kind: 'tool_calls',
      calls,
      statusLabel,
      // Pass the ENTIRE raw parts array verbatim -- this preserves
      // thoughtSignature, thought text, and any other opaque fields.
      rawModelParts: parts,
    };
  }
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

  if (name === 'execute_dml') {
    const sql = typeof args.sql === 'string' ? args.sql : '';
    const verb = sql.trimStart().split(/\s+/)[0]?.toUpperCase() ?? 'DML';
    const tableMatch = sql.match(/(?:INTO|FROM|TABLE|VIEW)\s+`?[\w.-]+\.[\w.-]+\.(\w+)`?/i);
    return tableMatch
      ? `${verb === 'CREATE' ? 'Creating' : verb === 'ALTER' ? 'Modifying' : verb === 'INSERT' ? 'Inserting into' : verb === 'UPDATE' ? 'Updating' : verb === 'MERGE' ? 'Merging into' : 'Running'} ${tableMatch[1]}...`
      : 'Running the operation...';
  }

  if (name === 'manage_pipeline') {
    const action = typeof args.action === 'string' ? args.action : '';
    const actionLabels: Record<string, string> = {
      list: 'Fetching scheduled queries...',
      details: 'Loading schedule details...',
      create: 'Creating scheduled query...',
      delete: 'Deleting scheduled query...',
    };
    return actionLabels[action] ?? 'Managing pipelines...';
  }

  if (name === 'export_data') {
    const format = typeof args.format === 'string' ? args.format : '';
    return format === 'sheets' ? 'Exporting to Google Sheets...' : 'Exporting to CSV...';
  }

  const LABELS: Record<string, string> = {
    ask_user: 'Asking for clarification...',
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
