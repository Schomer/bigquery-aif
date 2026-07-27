// src/lib/chat-orchestrator.ts
// Per-turn client-side orchestration: receive message -> agent loop -> compose -> return envelopes
// Runs entirely in the browser using the Gemini API REST endpoint via the configured API key.
import { callGemini, loadSkillDoc } from './gemini-client';
import {
  getAvailableDatasets,
  resolveDefaultDatasetFromList,
} from './orchestrator-utils';
import type { ConversationState } from './conversation-state';

// Skill handlers -- only confirmation execution remains
import { executeConfirmedOperation } from './skills/execute-confirmed';

import type {
  ChatMessage,
  CompositionEnvelope,
  DataManagementResult,
  SkillName,
  StatusCallback,
} from './types';

// Agent v2 loop
import { processWithAgentLoop } from '../agent';

// ── Inline reference resolver (moved from router.ts) ──────────────────────────
// Replaces "that table" / "this table" / "about it" with the last table name.
// Only used by the /plan path.
function resolveTableReferences(
  message: string,
  context?: { lastTable?: string; lastResultRef?: string }
): string {
  if (!context?.lastTable) return message;
  return message
    .replace(/\bthat table\b/gi, context.lastTable)
    .replace(/\bthis table\b/gi, context.lastTable)
    .replace(/\b(?:from|in|on|to|into|of|against|about)\s+it\b/gi, (match) =>
      match.replace(/\bit\b/i, context.lastTable!)
    );
}

// ---- Orchestrator client class ----

export interface ProcessMessageArgs {
  message: string;
  history: ChatMessage[];
  context?: {
    lastSkill?: SkillName;
    lastResultRef?: string;
    lastTable?: string;
    lastTableSchema?: { name: string; type: string; description?: string }[];
    lastDatasetTables?: string[];
    dataset?: string;
    project?: string;
    uid?: string;
    confirmedPayload?: DataManagementResult;
    forcedSkill?: SkillName;
    resolvedDataset?: string;
    availableDatasets?: string[];
    // Handoff chain: full envelope context from chip clicks
    handoffContext?: Record<string, unknown>;
    // Cumulative session state
    conversationState?: ConversationState;
  };
  onStatus?: StatusCallback;
  /** Optional AbortSignal -- if aborted, in-flight work should stop as soon as possible. */
  signal?: AbortSignal;
}


export interface OrchestrationResult {
  envelopes: CompositionEnvelope[];
  skill?: SkillName;
  resolvedContext?: {
    availableDatasets?: string[];
    resolvedDataset?: string;
  };
}

export class ChatOrchestrator {
  static async processMessage({ message, history, context, onStatus, signal }: ProcessMessageArgs): Promise<OrchestrationResult> {
    // -- Handle confirmation responses --
    if (context?.confirmedPayload && 'executionSql' in context.confirmedPayload) {
      const confirmed = context.confirmedPayload;
      const project = context?.project || '';
      const envelopes = await executeConfirmedOperation(confirmed, project);
      return { envelopes };
    }

    // -- Agent loop (v2) -- all prompts go through the tool-calling loop --
    const result = await processWithAgentLoop({
      message,
      history,
      context: {
        project: context?.project,
        dataset: context?.dataset,
        resolvedDataset: context?.resolvedDataset,
        availableDatasets: context?.availableDatasets,
        lastTable: context?.lastTable,
        lastTableSchema: context?.lastTableSchema,
        lastSkill: context?.lastSkill,
        lastDatasetTables: context?.lastDatasetTables,
        uid: context?.uid,
      },
      onStatus,
      signal,
    });
    return {
      envelopes: result.envelopes,
      skill: result.skill,
      resolvedContext: result.resolvedContext,
    };
  }

  /**
   * Generate a plain-language plan for a user query without executing anything.
   * Called when the user prefixes their message with /plan.
   * When existingPlan is provided (re-plan after comment), the LLM is asked to
   * edit the existing steps minimally rather than generating from scratch.
   * Returns a single PLAN_CARD envelope.
   */
  static async generatePlan({
    message,
    context,
    onStatus,
    existingPlan,
  }: Pick<ProcessMessageArgs, 'message' | 'context' | 'onStatus'> & {
    existingPlan?: {
      title: string;
      summary: string;
      steps: Array<{ label: string; detail: string }>;
      estimatedCost?: string | null;
      dataAccessed?: string[];
      originalQuery: string;
    };
  }): Promise<CompositionEnvelope> {
    const project = context?.project || '';

    onStatus?.(existingPlan ? 'Updating plan...' : 'Building your plan...');

    const resolvedMessage = resolveTableReferences(message, context);

    // Get available datasets for context, but don't fail if unavailable
    let availableDatasets: string[] = context?.availableDatasets || [];
    let resolvedDataset = context?.resolvedDataset || context?.dataset || '';
    try {
      if (!availableDatasets.length) {
        availableDatasets = await getAvailableDatasets(project);
        resolvedDataset = resolveDefaultDatasetFromList(availableDatasets, context?.dataset, project);
      }
    } catch {
      // Non-fatal -- plan can proceed without dataset list
    }

    const PlanSchema = {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING' },
        summary: { type: 'STRING' },
        steps: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              label: { type: 'STRING' },
              detail: { type: 'STRING' },
            },
            required: ['label', 'detail'],
          },
        },
        estimatedCost: { type: 'STRING' },
        dataAccessed: {
          type: 'ARRAY',
          items: { type: 'STRING' },
        },
      },
      required: ['title', 'summary', 'steps'],
    };

    let systemPrompt: string;

    if (existingPlan) {
      // Edit mode: show the existing plan and ask for minimal changes only
      const existingStepsText = existingPlan.steps
        .map((s, i) => `  Step ${i + 1}: ${s.label} — ${s.detail}`)
        .join('\n');

      systemPrompt = `You are a planning assistant for a BigQuery AI app. The user has reviewed an existing plan and added a comment requesting a change. Your job is to edit the plan minimally — only modify the steps that are directly affected by the amendment. Keep all other steps exactly as they are, word for word.

Project: ${project}
Active dataset: ${resolvedDataset || 'unknown'}
Available datasets: ${availableDatasets.join(', ') || 'unknown'}

EXISTING PLAN:
Title: ${existingPlan.title}
Summary: ${existingPlan.summary}
Steps:
${existingStepsText}

AMENDMENT FROM USER: ${resolvedMessage.replace(/\[Amendment:\s*/i, '').replace(/\]$/, '')}

RULES:
- Keep unchanged steps verbatim (same label, same detail text).
- Only modify, add, or remove steps that are directly affected by the amendment.
- Do NOT reorganise, merge, or rewrite steps that are not relevant to the amendment.
- If the amendment only changes a filter or parameter (e.g. "use US only"), update only the step(s) that reference that filter.
- Prefer editing a step's detail in place over splitting or merging steps.
- Return all steps in order, including the unchanged ones.
- The title and summary may be lightly updated to reflect the amendment, but keep them close to the originals.

Return the full updated plan with all steps (modified and unmodified alike).`;
    } else {
      // Fresh plan mode
      systemPrompt = `You are a planning assistant for a BigQuery AI app.

The user has asked you to describe — in plain language — what the assistant WOULD do to fulfill their request, before any queries are run. Do NOT execute anything. Do NOT write SQL. Just explain the plan clearly.

Project: ${project}
Active dataset: ${resolvedDataset || 'unknown'}
Available datasets: ${availableDatasets.join(', ') || 'unknown'}

Return a structured plan with:
- title: A short title for the plan (max 8 words)
- summary: 1-2 sentence description of what the assistant will do overall
- steps: An ordered list of steps the assistant would take. Each step has:
  - label: Short action label (e.g. "Query sales table", "Filter by region")
  - detail: One sentence explaining what this step does and why
- estimatedCost: Optional rough estimate ("< $0.01", "~$0.10\", etc.) if a query will run. Omit if not applicable.
- dataAccessed: List of table or dataset names that will be read (if known from the request). Empty array if uncertain.

Be honest about uncertainty. If you don't know which table to use, say so in the relevant step's detail.`;
    }

    const result = await callGemini({
      systemInstruction: systemPrompt,
      messages: [{ role: 'user', content: resolvedMessage }],
      schema: PlanSchema,
      project,
    });

    // Preserve the original query for Proceed replay (strip any amendment suffix)
    const originalQuery = existingPlan?.originalQuery || message;

    const envelope: CompositionEnvelope = {
      id: 'plan_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      skill: 'query',
      headline: {
        text: result?.title || 'Plan ready — review before running',
        tone: 'NEUTRAL',
        basis: 'STATUS',
      },
      primaryArtifact: {
        type: 'PLAN_CARD',
        data: {
          title: result?.title || 'Plan',
          summary: result?.summary || '',
          steps: result?.steps || [],
          estimatedCost: result?.estimatedCost || null,
          dataAccessed: result?.dataAccessed || [],
          originalQuery,
        },
      },
      provenance: {
        visibility: 'COLLAPSED',
      },
      nextActions: [],
      requiresConfirmation: true,
      skipSelfReview: true,
    };

    return envelope;
  }
}
