// src/lib/chat-orchestrator.ts
// Per-turn client-side orchestration: receive message -> router -> skill dispatch -> compose -> return envelopes
// Runs entirely in the browser using the Gemini API REST endpoint via the configured API key.
//
// This file was refactored from a 3,835-line monolith into a thin dispatch layer.
// Handler logic lives in src/lib/skills/handle-*.ts
// Infrastructure lives in src/lib/gemini-client.ts, orchestrator-utils.ts, self-review.ts

import { classifyIntent, resolveReferences } from './router';
import { compose } from './composer';
import { callGemini, IntentClassifierSchema, loadSkillDoc } from './gemini-client';
import {
  getAvailableDatasets,
  resolveDefaultDatasetFromList,
  buildConversationStateSummary,
  stepWithLink,
} from './orchestrator-utils';
import { selfReviewEnvelope } from './self-review';
import { extractVisualizationIntent, isVizMutationOnly } from './viz-intent';

// Skill handlers -- dispatched via manifest registry
import { SKILL_MAP, SKILL_LABELS } from './skills';
import { executeConfirmedOperation } from './skills/handle-data-management';
import { handleQuery } from './skills/handle-query';

import type {
  ChatMessage,
  CompositionEnvelope,
  DataManagementResult,
  QueryResult,
  ArtifactType,
  SkillName,
  StatusCallback,
} from './types';

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
  static async processMessage({ message, history, context, onStatus }: ProcessMessageArgs): Promise<OrchestrationResult> {
    // -- Handle confirmation responses --
    if (context?.confirmedPayload && 'executionSql' in context.confirmedPayload) {
      const confirmed = context.confirmedPayload;
      const project = context?.project || '';
      const envelopes = await executeConfirmedOperation(confirmed, project);
      return { envelopes };
    }

    const project = context?.project || '';

    // -- Resolve referential language --
    const resolvedMessage = resolveReferences(message, context);

    // -- Layer 1: Extract explicit visualization intent --
    // Do this before routing so we can use it throughout the pipeline.
    const userIntent: ArtifactType | null = extractVisualizationIntent(resolvedMessage);

    // -- Viz mutation: pure chart-type-change without new data query --
    // If the user says "make this a column chart" and we already have a result,
    // recompose the existing data with the new chart type instead of re-querying.
    if (userIntent && isVizMutationOnly(resolvedMessage) && context?.lastResultRef) {
      // Find the last query envelope from history to recompose
      const lastQueryEnvelope = history
        .slice()
        .reverse()
        .flatMap((m) => {
          try {
            const parsed = typeof m.content === 'string' && m.content.startsWith('[{') ? JSON.parse(m.content) : null;
            return Array.isArray(parsed) ? parsed : [];
          } catch { return []; }
        })
        .find((env: any) => env?.skill === 'query' && env?.primaryArtifact?.data?.rows);

      if (lastQueryEnvelope) {
        const mutatedEnvelope: CompositionEnvelope = {
          ...lastQueryEnvelope,
          id: 'viz_mut_' + Date.now(),
          primaryArtifact: {
            ...lastQueryEnvelope.primaryArtifact,
            type: userIntent,
          },
          headline: {
            ...lastQueryEnvelope.headline,
            text: `Showing as ${userIntent.replace(/_/g, ' ').toLowerCase()}`,
          },
          skipSelfReview: true,
        };
        return { envelopes: [mutatedEnvelope], skill: 'query' };
      }
      // If no recomposable envelope found, fall through to normal query
    }

    let resolvedDataset = context?.resolvedDataset;
    let availableDatasets = context?.availableDatasets;

    // -- Classify intent --
    // The conversation handler is the AI-first entry point. It has tools to
    // execute operations and can hold a dialogue. Only a few well-tested
    // handlers get the keyword fast-path; everything else goes to conversation.
    let skill = context?.forcedSkill;
    let routerConfidence: 'high' | 'medium' | 'low' = 'medium';

    // Skills that are reliable enough for high-confidence keyword bypass.
    // All others (data-management, monitoring, discovery, etc.) are routed
    // through conversation so the AI can ask questions and use tools.
    const KEYWORD_FAST_PATH_SKILLS = new Set<string>([
      'schema', 'query', 'data-quality', 'data-management',
    ]);

    if (!skill) {
      const keywordResult = classifyIntent(resolvedMessage, context);
      if (keywordResult.confidence === 'high' && KEYWORD_FAST_PATH_SKILLS.has(keywordResult.skill)) {
        skill = keywordResult.skill;
        routerConfidence = 'high';
        // Still need available datasets for downstream handlers
        if (!availableDatasets) {
          const available = await getAvailableDatasets(project);
          availableDatasets = available;
          resolvedDataset = resolvedDataset ?? resolveDefaultDatasetFromList(available, context?.dataset, project);
        }
      } else if (keywordResult.confidence === 'high') {
        // High-confidence match for a skill NOT in the fast-path list.
        // Route to conversation -- the AI agent has tools to handle it.
        skill = 'conversation' as SkillName;
        routerConfidence = 'high';
        if (!availableDatasets) {
          const available = await getAvailableDatasets(project);
          availableDatasets = available;
          resolvedDataset = resolvedDataset ?? resolveDefaultDatasetFromList(available, context?.dataset, project);
        }
      } else {
        // Low/medium confidence or ambiguous: fall back to LLM intent classifier
        routerConfidence = keywordResult.confidence;
        if (keywordResult.ambiguousReadWrite) {
          onStatus?.('Sorting out what you mean — looks like a mix of reading and writing...');
        }
        try {
          const available = availableDatasets ?? await getAvailableDatasets(project);
          const dataset = resolvedDataset ?? resolveDefaultDatasetFromList(available, context?.dataset, project);
          availableDatasets = available;
          resolvedDataset = dataset;
          const messages = history.slice(-20).map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }));

          onStatus?.('Figuring out what you need...');

          const routingRef = await loadSkillDoc('intent-routing');

          const classifierPrompt = `You are the intent classifier for a BigQuery AI assistant.
You have two jobs:
1. Classify which SKILL should handle the user's request.
2. Detect if the request requires MULTIPLE DISTINCT ACTIONS (multistep).

Use the following routing reference to determine the correct skill:

${routingRef}

CONVERSATION ROUTING:
- Route to 'conversation' when the user is chatting, asking questions, seeking advice,
  greeting, thanking, thinking out loud, or discussing options -- anything that is NOT
  a direct request to perform a specific data operation.
- When in doubt between conversation and a task skill, prefer conversation.
  The conversation skill can suggest the right task as a follow-up chip.

MULTISTEP RULES:
- A request with ONE VERB acting on ONE OBJECT is NEVER multistep.
- Only return isMultistep: true when the message contains EXPLICIT multi-action language: 'and then', 'after that', 'first...then', 'followed by', 'next', or a numbered list of distinct actions.
- When isMultistep is false, return an empty steps array.
- When isMultistep is true, decompose into steps. Each step needs: skill, description (short label), prompt (fully self-contained with explicit table refs like \`${project}.${dataset}.tablename\`).
- NEVER decompose an analytical question into a schema step followed by a query step. The query skill already loads schema context internally. Examples that are SINGLE-STEP query (NOT multistep): "show sales at store X over time", "analyze revenue by month", "what are the top products", "sales trend for category Y".
- Analytical phrases like 'analyze', 'show me', 'trend', 'over time', 'breakdown', 'compare', 'top N' are READ-ONLY query operations, NEVER data-management.

Current active project: ${project}
Current active dataset: ${dataset}
Available datasets: ${available.join(', ')}

CONVERSATION STATE:
${buildConversationStateSummary(context)}
The user's new message is a continuation of this conversation. Treat it as a follow-up to the current context unless it explicitly changes the subject. Do NOT re-derive context that is already established (e.g., do not add a schema step for a table the user is already looking at).`;

          const result = await callGemini({
            systemInstruction: classifierPrompt,
            messages: [...messages, { role: 'user' as const, content: resolvedMessage }],
            schema: IntentClassifierSchema,
            project,
          });

          if (result && result.isMultistep && result.steps && result.steps.length > 1) {
            // Guard: any workflow where all leading steps are schema and the
            // final step is query is always redundant because handleQuery()
            // loads schema context internally via buildSchemaContext().
            // Collapse to a single query step instead of creating a workflow.
            const lastStep = result.steps[result.steps.length - 1];
            const isRedundantSchemaQuery = lastStep.skill === 'query'
              && result.steps.slice(0, -1).every((s: { skill: string }) => s.skill === 'schema');

            if (isRedundantSchemaQuery) {
              // Use the query step's prompt directly as a single-step query
              skill = 'query' as SkillName;
            } else {
              const envelope: CompositionEnvelope = {
                id: 'workflow_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                skill: 'multistep',
                headline: {
                  text: `Created a workflow with ${result.steps.length} steps to complete your request.`,
                  tone: 'NEUTRAL',
                  basis: 'STATUS',
                },
                primaryArtifact: {
                  type: 'MULTISTEP_VIEW',
                  data: {
                    steps: result.steps,
                  },
                },
                provenance: {
                  visibility: 'COLLAPSED',
                },
                nextActions: [],
              };
              return { envelopes: [envelope], skill: 'multistep' };
            }
          }

           // Single-step: use the LLM-classified skill, but only fast-path
           // skills go direct. Everything else goes through conversation agent.
           if (result && result.skill) {
             const classifiedSkill = result.skill as SkillName;
             if (KEYWORD_FAST_PATH_SKILLS.has(classifiedSkill)) {
               skill = classifiedSkill;
             } else {
               skill = 'conversation' as SkillName;
             }
           }
         } catch (e) {
           console.warn('[Intent classifier failed, falling back to conversation]', e);
         }

         // Final fallback: conversation agent handles unknown intents
         if (!skill) {
           skill = 'conversation' as SkillName;
         }
      }
    }

    onStatus?.(`Matched skill: ${SKILL_LABELS[skill] || skill}`);

    // -- Dispatch to skill --
    let envelopes: CompositionEnvelope[] = [];

    // Pass pre-resolved context to handlers to avoid redundant fetches
    const enrichedContext = { ...context, resolvedDataset, availableDatasets, userIntent };

    // Manifest-driven dispatch: look up handler from the registry.
    // All handlers have a standardized signature: (message, history, context, onStatus)
    const manifest = SKILL_MAP.get(skill as string);
    if (manifest) {
      envelopes = await manifest.handle(resolvedMessage, history, enrichedContext, onStatus);
    } else {
      // Unknown skill -- fall back to query
      envelopes = await handleQuery(resolvedMessage, history, enrichedContext, onStatus);
    }

    // -- Self-review: run for skills that benefit from it --
    // Skip review for straightforward results where the Gemini review pass
    // rarely changes anything meaningful. This saves 1-3s of latency.
    //
    // Skip conditions (any envelope matching these is marked skipSelfReview):
    // 1. Schema results at PROJECT or DATASET scope (canned INFORMATION_SCHEMA)
    // 2. KPI_CARD results (single-value answers where headline IS the answer)
    // 3. High-confidence keyword match + clean execution + small result set
    if (envelopes.length > 0) {
      for (const env of envelopes) {
        if (env.requiresConfirmation || env.skipSelfReview) continue;

        const artifactType = env.primaryArtifact.type;
        const data = env.primaryArtifact.data as Record<string, unknown> | null;

        // Schema results: factual metadata -- self-review adds no value at any scope
        if (artifactType === 'SCHEMA_VIEW') {
          env.skipSelfReview = true;
          continue;
        }

        // KPI_CARD: single value answers, headline is the answer
        if (artifactType === 'KPI_CARD') {
          env.skipSelfReview = true;
          continue;
        }

        // High-confidence + small result: review adds little value
        // EXCEPTION: never skip when user explicitly requested a chart type
        if (routerConfidence === 'high' && !userIntent && data && 'rows' in data) {
          const rows = (data as { rows: unknown[] }).rows;
          if (Array.isArray(rows) && rows.length < 100) {
            env.skipSelfReview = true;
            continue;
          }
        }
      }

      const needsReview = envelopes.some((env) =>
        !env.requiresConfirmation && !env.skipSelfReview
      );
      if (needsReview) {
        onStatus?.('Checking the results look right...');
        const reviewed = await Promise.all(
          envelopes.map((env) =>
            (env.requiresConfirmation || env.skipSelfReview)
              ? Promise.resolve(env)
              : selfReviewEnvelope(env, resolvedMessage, project, onStatus)
          )
        );
        envelopes = reviewed;
      }
    }

    return { envelopes, skill, resolvedContext: { availableDatasets, resolvedDataset } };
  }
}
