// src/lib/skills/handle-saved.ts
// Skill handler for running saved artifacts from chat.
// Matches phrases like "run my weekly report" or "execute saved query X".

import { getArtifacts, getArtifact, recordRun } from '../saved-work';
import { compose } from '../composer';
import { executeQuery } from '../bigquery-client';
import { analyzeResultQuality } from '../result-quality';
import type {
  ChatMessage,
  CompositionEnvelope,
  SkillManifest,
  StatusCallback,
  SavedArtifact,
  QueryResult,
  VisualizationType,
  ParameterDef,
} from '../types';

// -- Fuzzy name matching ------------------------------------------------------

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function scoreMatch(query: string, artifact: SavedArtifact): number {
  const q = normalizeText(query);
  const name = normalizeText(artifact.name);
  const desc = normalizeText(artifact.description);

  // Exact name match
  if (name === q) return 100;
  // Name contains query
  if (name.includes(q)) return 80;
  // Query contains name
  if (q.includes(name)) return 70;
  // Word overlap
  const qWords = q.split(/\s+/);
  const nameWords = name.split(/\s+/);
  const descWords = desc.split(/\s+/);
  const allWords = new Set([...nameWords, ...descWords]);
  const overlap = qWords.filter((w) => allWords.has(w)).length;
  if (overlap === 0) return 0;
  return Math.min(60, (overlap / qWords.length) * 60);
}

// -- Strip trigger phrases from the message -----------------------------------

const TRIGGER_PATTERNS = [
  /^run\s+(my|saved|the)\s+/i,
  /^execute\s+(my|saved|the)\s+/i,
  /^open\s+(my|saved|the)\s+/i,
  /^load\s+(my|saved|the)\s+/i,
  /^rerun\s+(my|saved|the)?\s*/i,
  /^re-run\s+(my|saved|the)?\s*/i,
];

function extractArtifactQuery(message: string): string {
  let cleaned = message.trim();
  for (const pattern of TRIGGER_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  // Remove trailing "query", "workflow", "report", "pipeline" type words
  cleaned = cleaned.replace(/\s+(query|workflow|report|pipeline|artifact|saved item)$/i, '');
  return cleaned.trim() || message.trim();
}

// -- Handler ------------------------------------------------------------------

export async function handleSaved(
  message: string,
  history: ChatMessage[],
  context?: { project?: string; userId?: string },
  onStatus?: StatusCallback,
): Promise<CompositionEnvelope[]> {
  const userId = context?.userId;
  if (!userId) {
    throw new Error('You must be signed in to run saved items.');
  }

  const project = context?.project || '';

  onStatus?.('Looking up your saved items...');

  const artifacts = await getArtifacts(userId);
  if (artifacts.length === 0) {
    throw new Error('You have no saved items yet. Run a query or workflow and save it first.');
  }

  // Find the best matching artifact
  const query = extractArtifactQuery(message);
  const scored = artifacts
    .map((a) => ({ artifact: a, score: scoreMatch(query, a) }))
    .filter((s) => s.score > 20)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    // List available artifacts as suggestions
    const names = artifacts.slice(0, 8).map((a) => `- ${a.name} (${a.type})`).join('\n');
    throw new Error(
      `Could not find a saved item matching "${query}". Your saved items:\n${names}`
    );
  }

  const match = scored[0].artifact;
  onStatus?.(`Running saved ${match.type}: ${match.name}...`);

  // Execute each step sequentially
  const envelopes: CompositionEnvelope[] = [];
  for (let i = 0; i < match.steps.length; i++) {
    const step = match.steps[i];
    if (match.steps.length > 1) {
      onStatus?.(`Step ${i + 1} of ${match.steps.length}: ${step.prompt.slice(0, 80)}...`);
    }

    if (step.cachedSql) {
      // Fast path: execute cached SQL directly (no Gemini call)
      try {
        const executed = await executeQuery(step.cachedSql, project);
        const qualityFlags = analyzeResultQuality(executed.columns, executed.rows, step.cachedSql);

        const result: QueryResult = {
          skill: 'query',
          sql: step.cachedSql,
          requiresConfirmation: false,
          costConfirm: null,
          columns: executed.columns,
          rows: executed.rows,
          rowCount: executed.rowCount,
          jobId: executed.jobId || undefined,
          totalBytesProcessed: 0,
          costTier: 0,
          suggestedVisualization: (step.visualizationType as VisualizationType) || 'TABLE',
          notableFindings: null,
          resultSummary: match.name,
          // Virtual-table context: stored in envelope data so extractContextFromEnvelope
          // can set lastSavedArtifactSql/Name/VizType on ChatContext.
          savedArtifactSql: step.cachedSql,
          savedArtifactName: match.name,
          savedArtifactVizType: step.visualizationType || 'TABLE',
        } as QueryResult & { savedArtifactSql: string; savedArtifactName: string; savedArtifactVizType: string };
        envelopes.push(compose('query', result, qualityFlags));
      } catch (err: unknown) {
        // SQL execution failed -- fall back to re-running via the orchestrator
        // For now, throw the error. In Phase 2, this would fall back to the
        // prompt-based re-generation path.
        const errMsg = err instanceof Error ? err.message : String(err);
        throw new Error(
          `Failed to run saved query "${match.name}": ${errMsg}. ` +
          `The cached SQL may be outdated. Try re-creating the query.`
        );
      }
    } else if (step.prompt) {
      // No cached SQL -- would need to re-run through the orchestrator.
      // For Phase 1, we require cached SQL. Phase 2 will add LLM fallback.
      throw new Error(
        `Saved item "${match.name}" step ${i + 1} has no cached SQL. ` +
        `Re-running via prompt is not yet supported.`
      );
    }
  }

  // Record the run
  try {
    await recordRun(userId, match.id);
  } catch {
    // Non-fatal -- don't block the result
  }

  return envelopes;
}

// -- Skill manifest -----------------------------------------------------------

export const manifest: SkillManifest = {
  skill: 'saved',
  label: 'saved artifact runner',
  signals: [
    { phrase: 'run my', weight: 4 },
    { phrase: 'run saved', weight: 4 },
    { phrase: 'open saved', weight: 3 },
    { phrase: 'execute my', weight: 3 },
    { phrase: 'rerun my', weight: 4 },
    { phrase: 're-run my', weight: 4 },
    { phrase: 'load my saved', weight: 3 },
    { phrase: 'run the saved', weight: 3 },
  ],
  handle: handleSaved,
};
