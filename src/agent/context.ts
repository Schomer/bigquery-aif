// src/agent/context.ts
// LoopContext assembly and management.
// Responsible for building the system prompt, managing conversation history,
// and integrating schema cache into the context.

import type { LoopContext } from './model-adapter';
import { buildFlashSystemPrompt, type PromptContext } from './prompts/flash';
import { loadSkillDoc } from '../lib/gemini-client';

// ── Skill knowledge cache ─────────────────────────────────────────────────────

let _skillKnowledgeCache: string | null = null;

async function getSkillKnowledge(): Promise<string> {
  if (_skillKnowledgeCache) return _skillKnowledgeCache;

  const skillNames = [
    'schema', 'query', 'data-management', 'data-quality',
    'monitoring', 'discovery', 'data-loading', 'pipeline', 'governance',
  ];

  const docs = await Promise.all(skillNames.map(s => loadSkillDoc(s)));

  _skillKnowledgeCache = docs
    .map((d, i) => {
      const lines = d.split('\n').slice(0, 20);
      return `### ${skillNames[i]} skill\n${lines.join('\n')}`;
    })
    .join('\n\n---\n\n');

  return _skillKnowledgeCache;
}

// ── Context assembly options ──────────────────────────────────────────────────

export interface AssembleContextOptions {
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  project: string;
  availableDatasets: string[];
  lastTable?: string;
  lastTableSchema?: Array<{ name: string; type: string; description?: string }>;
  lastSkill?: string;
  lastDatasetTables?: string[];
  /** Max number of history messages to include (default: 30). */
  historyLimit?: number;
}

// ── Context assembly ──────────────────────────────────────────────────────────

/**
 * Assemble a LoopContext for the agent loop.
 * Builds the system prompt, truncates history, and formats contents
 * for the Gemini API.
 */
export async function assembleContext(opts: AssembleContextOptions): Promise<LoopContext> {
  const skillSummary = await getSkillKnowledge();

  const promptCtx: PromptContext = {
    project: opts.project,
    availableDatasets: opts.availableDatasets,
    lastTable: opts.lastTable,
    lastTableSchema: opts.lastTableSchema,
    lastSkill: opts.lastSkill,
    lastDatasetTables: opts.lastDatasetTables,
    skillSummary,
  };

  const systemPrompt = buildFlashSystemPrompt(promptCtx);

  // Truncate history to the last N messages
  const limit = opts.historyLimit ?? 30;
  const truncatedHistory = opts.history.slice(-limit);

  // Build Gemini-format contents
  const contents: Array<Record<string, unknown>> = truncatedHistory.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  // Add the current message
  contents.push({
    role: 'user',
    parts: [{ text: opts.message }],
  });

  const turnId = `turn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return {
    systemPrompt,
    contents,
    turnId,
  };
}

// ── Result summarization for context budget ───────────────────────────────────

/**
 * Summarize a tool result for context insertion.
 * Results over 2k tokens get profiled (schema, row count, first/last rows,
 * per-column stats) with result_id retained.
 */
export function summarizeForContext(
  toolName: string,
  result: unknown,
  resultId?: string,
): unknown {
  const json = JSON.stringify(result);
  const estimatedTokens = Math.ceil(json.length / 4);

  if (estimatedTokens <= 2000) {
    return result;
  }

  // Profile the result
  if (typeof result === 'object' && result !== null) {
    const obj = result as Record<string, unknown>;

    // If it has rows and columns (query result shape), profile it
    if (Array.isArray(obj.rows) && Array.isArray(obj.columns)) {
      const rows = obj.rows as unknown[][];
      const columns = obj.columns as string[];
      const columnTypes = (obj.column_types ?? obj.columnTypes) as string[] | undefined;

      const profile: Record<string, unknown> = {
        _note: 'Result summarized for context budget. Full data available via result_id.',
        result_id: resultId ?? obj.result_id,
        columns: columns.map((c, i) => ({
          name: c,
          type: columnTypes?.[i] ?? 'unknown',
        })),
        row_count: rows.length,
        first_5_rows: rows.slice(0, 5),
        last_5_rows: rows.length > 10 ? rows.slice(-5) : undefined,
      };

      // Per-column stats for numeric columns
      const colStats: Record<string, unknown> = {};
      columns.forEach((col, colIdx) => {
        const vals = rows
          .map(r => r[colIdx])
          .filter(v => v !== null && v !== undefined && v !== '');
        if (vals.length === 0) return;

        const numVals = vals.map(Number).filter(n => !isNaN(n));
        if (numVals.length > vals.length / 2) {
          colStats[col] = {
            min: Math.min(...numVals),
            max: Math.max(...numVals),
            distinct: new Set(vals.map(String)).size,
            null_count: rows.length - vals.length,
          };
        } else {
          colStats[col] = {
            distinct: new Set(vals.map(String)).size,
            null_count: rows.length - vals.length,
            sample_values: [...new Set(vals.map(String))].slice(0, 5),
          };
        }
      });

      if (Object.keys(colStats).length > 0) {
        profile.column_stats = colStats;
      }

      return profile;
    }
  }

  // Fallback: truncate JSON
  const truncated = json.slice(0, 8000);
  return {
    _note: 'Result truncated for context budget. Full data available via result_id.',
    result_id: resultId,
    truncated_preview: truncated + (json.length > 8000 ? '...' : ''),
    full_length_bytes: json.length,
  };
}
